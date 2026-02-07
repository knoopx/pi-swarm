import { Elysia, t } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { existsSync } from "fs";
import {
  createAgentSession,
  SessionManager,
  type AgentSession,
  type AgentSessionEvent,
  ModelRegistry,
  AuthStorage,
} from "@mariozechner/pi-coding-agent";
import { getModel, type Model, type Api } from "@mariozechner/pi-ai";
import { join } from "path";
import {
  generateId,
  nowTs,
  serializeAgent,
  buildWorkspacePath,
  type Agent as CoreAgent,
} from "./core";

// Types - extend core Agent with session
interface Agent extends CoreAgent {
  session?: AgentSession;
}

// WebSocket message types
interface WsRequest {
  id: string; // Request ID for response correlation
  type: string;
  [key: string]: unknown;
}

interface WsResponse {
  id: string; // Correlation ID
  type: "response";
  success: boolean;
  data?: unknown;
  error?: string;
}

// State
const agents = new Map<string, Agent>();
const wsClients = new Set<{ send: (data: string) => void }>();

const BASE_PATH = process.cwd().replace("/backend", "");
const FRONTEND_DIST = join(BASE_PATH, "frontend", "dist");
const AGENT_DIR = join(process.env.HOME || "~", ".pi", "agent");
const IS_DEV = !existsSync(join(FRONTEND_DIST, "index.html"));
const VITE_DEV_SERVER = "http://localhost:3000";
const SWARM_DIR = join(BASE_PATH, ".pi", "swarm");
const AGENTS_FILE = join(SWARM_DIR, "agents.json");

// Persistence helpers
async function ensureSwarmDir() {
  if (!existsSync(SWARM_DIR)) {
    await Bun.$`mkdir -p ${SWARM_DIR}`.quiet();
  }
}

async function saveAgents() {
  await ensureSwarmDir();
  const data = Array.from(agents.values()).map(serializeAgent);
  await Bun.write(AGENTS_FILE, JSON.stringify(data, null, 2));
}

async function loadAgents() {
  try {
    if (existsSync(AGENTS_FILE)) {
      const data = await Bun.file(AGENTS_FILE).json();
      for (const agentData of data) {
        // Reset running agents to stopped on restart
        if (agentData.status === "running") {
          agentData.status = "stopped";
        }
        agents.set(agentData.id, agentData);
      }
      console.log(`📂 Loaded ${agents.size} agents from disk`);
    }
  } catch (err) {
    console.error("Failed to load agents:", err);
  }
}

// Auth and model registry - use user's existing auth
const authStorage = new AuthStorage(join(AGENT_DIR, "auth.json"));
const modelRegistry = new ModelRegistry(authStorage);

// Helpers
function broadcast(event: { type: string; [key: string]: unknown }) {
  const data = JSON.stringify(event);
  for (const client of wsClients) {
    try {
      client.send(data);
    } catch {
      wsClients.delete(client);
    }
  }
}

function sendResponse(
  ws: { send: (data: string) => void },
  id: string,
  success: boolean,
  data?: unknown,
  error?: string,
) {
  const response: WsResponse = { id, type: "response", success, data, error };
  ws.send(JSON.stringify(response));
}

async function createWorkspace(basePath: string, id: string): Promise<string> {
  const workspace = buildWorkspacePath(basePath, id);
  await Bun.$`mkdir -p ${basePath}/.pi/swarm/workspaces`.quiet();
  await Bun.$`cd ${basePath} && jj workspace add ${workspace} --name ${id}`.quiet();
  return workspace;
}

async function getModifiedFiles(workspace: string): Promise<string[]> {
  try {
    const result = await Bun.$`cd ${workspace} && jj diff --name-only`.quiet();
    return result.stdout.toString().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

async function getDiffStat(workspace: string): Promise<string> {
  try {
    const result = await Bun.$`cd ${workspace} && jj diff --stat`.quiet();
    return result.stdout.toString();
  } catch {
    return "";
  }
}

async function getDiff(workspace: string): Promise<string> {
  try {
    const result = await Bun.$`cd ${workspace} && jj diff --git`.quiet();
    return result.stdout.toString();
  } catch {
    return "";
  }
}

function getDefaultModel(): {
  model: Model<Api>;
  provider: string;
  modelId: string;
} {
  const available = modelRegistry.getAvailable();

  // Prefer claude-sonnet-4 as default
  const preferred = available.find((m) => m.id === "claude-sonnet-4-20250514");
  if (preferred) {
    return {
      model: preferred,
      provider: preferred.provider,
      modelId: preferred.id,
    };
  }

  // Fallback to first available model
  if (available.length > 0) {
    return {
      model: available[0],
      provider: available[0].provider,
      modelId: available[0].id,
    };
  }

  throw new Error("No models available - configure API keys first");
}

function getAvailableModels() {
  // Get only models with configured API keys
  const available = modelRegistry.getAvailable();
  return available.map((model) => ({
    provider: model.provider,
    modelId: model.id,
    name: `${model.provider}/${model.id}`,
  }));
}

async function startAgent(agent: Agent): Promise<void> {
  const model = getModel(
    agent.provider as "anthropic",
    agent.model as "claude-sonnet-4-20250514",
  );
  if (!model) {
    throw new Error(`Model ${agent.provider}/${agent.model} not found`);
  }

  const { session } = await createAgentSession({
    cwd: agent.workspace,
    agentDir: AGENT_DIR,
    model,
    authStorage,
    modelRegistry,
    sessionManager: SessionManager.inMemory(),
  });

  agent.session = session;
  agent.status = "running";
  agent.output = "";

  session.subscribe((event: AgentSessionEvent) => {
    agent.output += JSON.stringify(event) + "\n";

    // Broadcast event to all connected clients
    broadcast({
      type: "agent_event",
      agentId: agent.id,
      event,
    });

    if (event.type === "agent_end") {
      agent.status = "waiting";
      agent.updatedAt = nowTs();
      broadcast({ type: "agent_updated", agent: serializeAgent(agent) });
      saveAgents();
    }
  });

  console.log(
    `[Agent ${agent.id}] Starting with instruction:`,
    agent.instruction.substring(0, 200),
  );
  session.prompt(agent.instruction).catch((err) => {
    console.error(`Agent ${agent.id} error:`, err);
    agent.status = "error";
    agent.output +=
      JSON.stringify({ type: "error", message: String(err) }) + "\n";
    broadcast({ type: "agent_updated", agent: serializeAgent(agent) });
    saveAgents();
  });

  broadcast({ type: "agent_updated", agent: serializeAgent(agent) });
  saveAgents();
}

async function stopAgent(agent: Agent): Promise<void> {
  if (agent.session) {
    await agent.session.abort();
  }
  agent.status = "stopped";
  agent.updatedAt = nowTs();
  broadcast({ type: "agent_updated", agent: serializeAgent(agent) });
  saveAgents();
}

async function instructAgent(agent: Agent, instruction: string): Promise<void> {
  if (
    agent.session &&
    (agent.status === "running" || agent.status === "waiting")
  ) {
    agent.status = "running";
    agent.instruction = instruction;
    agent.session.prompt(instruction).catch((err) => {
      console.error(`Agent ${agent.id} instruction error:`, err);
      agent.status = "error";
      broadcast({ type: "agent_updated", agent: serializeAgent(agent) });
      saveAgents();
    });
  } else {
    agent.instruction = instruction;
    await startAgent(agent);
  }
  agent.updatedAt = nowTs();
  broadcast({ type: "agent_updated", agent: serializeAgent(agent) });
  saveAgents();
}

async function setAgentModel(
  agent: Agent,
  provider: string,
  modelId: string,
): Promise<void> {
  const model = getModel(
    provider as "anthropic",
    modelId as "claude-sonnet-4-20250514",
  );
  if (!model) {
    throw new Error(`Model ${provider}/${modelId} not found`);
  }

  agent.provider = provider;
  agent.model = modelId;

  if (agent.session) {
    await agent.session.setModel(model);
  }

  agent.updatedAt = nowTs();
  broadcast({ type: "agent_updated", agent: serializeAgent(agent) });
  saveAgents();
}

async function deleteAgent(agent: Agent): Promise<void> {
  if (agent.session) {
    try {
      await agent.session.abort();
    } catch {
      // Ignore
    }
  }

  try {
    await Bun.$`cd ${agent.basePath} && jj workspace forget ${agent.id}`.quiet();
    await Bun.$`rm -rf ${agent.workspace}`.quiet();
  } catch {
    // Ignore
  }

  agents.delete(agent.id);
  broadcast({ type: "agent_deleted", agentId: agent.id });
  saveAgents();
}

async function mergeAgent(
  agent: Agent,
): Promise<{ success: boolean; error?: string }> {
  try {
    const cidResult =
      await Bun.$`cd ${agent.workspace} && jj log -r @ --no-graph -T 'change_id'`.quiet();
    const cid = cidResult.stdout.toString().trim();
    await Bun.$`cd ${agent.basePath} && jj squash --from ${cid}`.quiet();
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// WebSocket command handler
async function handleWsCommand(
  ws: { send: (data: string) => void },
  message: WsRequest,
): Promise<void> {
  const { id, type } = message;

  try {
    switch (type) {
      case "create_agent": {
        const agentId = generateId();
        const workspace = await createWorkspace(BASE_PATH, agentId);

        let { provider, model: modelId } = message as {
          provider?: string;
          model?: string;
        };
        if (!provider || !modelId) {
          const defaultModel = getDefaultModel();
          provider = provider || defaultModel.provider;
          modelId = modelId || defaultModel.modelId;
        }

        const agent: Agent = {
          id: agentId,
          name: (message.name as string) || "unnamed",
          status: "pending",
          instruction: (message.instruction as string) || "",
          workspace,
          basePath: BASE_PATH,
          createdAt: nowTs(),
          updatedAt: nowTs(),
          output: "",
          modifiedFiles: [],
          diffStat: "",
          provider,
          model: modelId,
        };

        agents.set(agentId, agent);
        broadcast({ type: "agent_created", agent: serializeAgent(agent) });
        saveAgents();
        sendResponse(ws, id, true, serializeAgent(agent));
        break;
      }

      case "start_agent": {
        const agent = agents.get(message.agentId as string);
        if (!agent) {
          sendResponse(ws, id, false, undefined, "Agent not found");
          return;
        }
        await startAgent(agent);
        sendResponse(ws, id, true, serializeAgent(agent));
        break;
      }

      case "stop_agent": {
        const agent = agents.get(message.agentId as string);
        if (!agent) {
          sendResponse(ws, id, false, undefined, "Agent not found");
          return;
        }
        await stopAgent(agent);
        sendResponse(ws, id, true, serializeAgent(agent));
        break;
      }

      case "instruct_agent": {
        const agent = agents.get(message.agentId as string);
        if (!agent) {
          sendResponse(ws, id, false, undefined, "Agent not found");
          return;
        }
        await instructAgent(agent, message.instruction as string);
        sendResponse(ws, id, true, serializeAgent(agent));
        break;
      }

      case "set_model": {
        const agent = agents.get(message.agentId as string);
        if (!agent) {
          sendResponse(ws, id, false, undefined, "Agent not found");
          return;
        }
        await setAgentModel(
          agent,
          message.provider as string,
          message.model as string,
        );
        sendResponse(ws, id, true, serializeAgent(agent));
        break;
      }

      case "get_diff": {
        const agent = agents.get(message.agentId as string);
        if (!agent) {
          sendResponse(ws, id, false, undefined, "Agent not found");
          return;
        }
        const diff = await getDiff(agent.workspace);
        sendResponse(ws, id, true, { diff });
        break;
      }

      case "merge_agent": {
        const agent = agents.get(message.agentId as string);
        if (!agent) {
          sendResponse(ws, id, false, undefined, "Agent not found");
          return;
        }
        const result = await mergeAgent(agent);
        if (result.success) {
          sendResponse(ws, id, true, { message: "Changes merged" });
        } else {
          sendResponse(ws, id, false, undefined, result.error);
        }
        break;
      }

      case "delete_agent": {
        const agent = agents.get(message.agentId as string);
        if (!agent) {
          sendResponse(ws, id, false, undefined, "Agent not found");
          return;
        }
        await deleteAgent(agent);
        sendResponse(ws, id, true);
        break;
      }

      case "fetch_agent": {
        const agent = agents.get(message.agentId as string);
        if (!agent) {
          sendResponse(ws, id, false, undefined, "Agent not found");
          return;
        }
        const agentData = {
          ...serializeAgent(agent),
          modifiedFiles: await getModifiedFiles(agent.workspace),
          diffStat: await getDiffStat(agent.workspace),
        };
        sendResponse(ws, id, true, agentData);
        break;
      }

      default:
        sendResponse(ws, id, false, undefined, `Unknown command: ${type}`);
    }
  } catch (err) {
    sendResponse(ws, id, false, undefined, String(err));
  }
}

// Helper for error responses
function errorResponse(status: number, body: object) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Dev proxy helper
async function proxyToVite(path: string): Promise<Response> {
  const url = `${VITE_DEV_SERVER}${path}`;
  return fetch(url);
}

// Elysia App
const baseApp = new Elysia();

// Only use static plugin in production (when dist exists)
const app = IS_DEV
  ? baseApp
  : baseApp.use(
      staticPlugin({
        assets: FRONTEND_DIST,
        prefix: "/",
      }),
    );

app
  // WebSocket for real-time updates and commands
  .ws("/ws", {
    open(ws) {
      wsClients.add(ws);
      // Send initial state
      ws.send(
        JSON.stringify({
          type: "init",
          agents: Array.from(agents.values()).map(serializeAgent),
          models: getAvailableModels(),
        }),
      );
    },
    close(ws) {
      wsClients.delete(ws);
    },
    message(ws, message) {
      try {
        const data =
          typeof message === "string" ? JSON.parse(message) : message;
        if (data.id && data.type) {
          handleWsCommand(ws, data as WsRequest);
        }
      } catch (err) {
        console.error("Failed to handle WS message:", err);
      }
    },
  })
  // SPA fallback - proxy to Vite in dev mode, serve from dist in production
  .get("*", ({ request }) => {
    if (IS_DEV) {
      const url = new URL(request.url);
      return proxyToVite(url.pathname);
    }
    return Bun.file(join(FRONTEND_DIST, "index.html"));
  })
  .listen(3001);

// Load persisted agents and start server
await loadAgents();

if (IS_DEV) {
  console.log(`📡 Dev mode: proxying to Vite at ${VITE_DEV_SERVER}`);
}

console.log(`🚀 Pi Swarm running on http://localhost:${app.server?.port}`);
