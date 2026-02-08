import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { existsSync } from "fs";
import {
  createAgentSession,
  SessionManager,
  type AgentSession,
  type AgentSessionEvent,
  ModelRegistry,
  AuthStorage,
  DefaultResourceLoader,
} from "@mariozechner/pi-coding-agent";
import { getModel, type Model, type Api } from "@mariozechner/pi-ai";
import { join } from "path";
import {
  generateId,
  nowTs,
  serializeAgent,
  buildWorkspacePath,
  buildAgentSessionDir,
  buildAgentMetadataPath,
  buildSessionsDir,
  determineAgentAction,
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
let maxConcurrency = 2;

// Package paths (set by CLI or defaults for dev)
const BASE_PATH = process.env.PI_SWARM_CWD || process.cwd();
const FRONTEND_DIST =
  process.env.PI_SWARM_DIST || join(BASE_PATH, "frontend", "dist");
const AGENT_DIR = join(process.env.HOME || "~", ".pi", "agent");
const IS_DEV = !existsSync(join(FRONTEND_DIST, "index.html"));
const VITE_DEV_SERVER = "http://localhost:3000";
const SESSIONS_DIR = buildSessionsDir(BASE_PATH);

// Per-agent session directory helpers (using core functions)
function getAgentSessionDir(agentId: string): string {
  return buildAgentSessionDir(BASE_PATH, agentId);
}

function getAgentMetadataPath(agentId: string): string {
  return buildAgentMetadataPath(BASE_PATH, agentId);
}

// Persistence helpers
async function ensureSessionDir(agentId: string) {
  const dir = getAgentSessionDir(agentId);
  if (!existsSync(dir)) {
    await Bun.$`mkdir -p ${dir}`.quiet();
  }
}

async function saveAgent(agent: Agent) {
  await ensureSessionDir(agent.id);
  const metadataPath = getAgentMetadataPath(agent.id);
  await Bun.write(metadataPath, JSON.stringify(serializeAgent(agent), null, 2));
}

async function deleteAgentSession(agentId: string) {
  const dir = getAgentSessionDir(agentId);
  if (existsSync(dir)) {
    await Bun.$`rm -rf ${dir}`.quiet();
  }
}

async function loadAgents() {
  try {
    if (!existsSync(SESSIONS_DIR)) {
      return;
    }

    const entries = await Bun.$`ls -1 ${SESSIONS_DIR}`.quiet();
    const agentIds = entries.stdout.toString().split("\n").filter(Boolean);

    for (const agentId of agentIds) {
      const metadataPath = getAgentMetadataPath(agentId);
      if (existsSync(metadataPath)) {
        const agentData = await Bun.file(metadataPath).json();
        // Reset running agents to stopped on restart
        if (agentData.status === "running") {
          agentData.status = "stopped";
        }
        agents.set(agentData.id, agentData);
      }
    }
    console.log(`📂 Loaded ${agents.size} agents from ${SESSIONS_DIR}`);
  } catch (err) {
    console.error("Failed to load agents:", err);
  }
}

// Auth and model registry - use user's existing auth
const authStorage = new AuthStorage(join(AGENT_DIR, "auth.json"));
const modelRegistry = new ModelRegistry(authStorage);

// Resource loader for completions (skills, prompts, etc.)
const resourceLoader = new DefaultResourceLoader({
  cwd: BASE_PATH,
  agentDir: AGENT_DIR,
});

// Initialize resource loader
async function initResourceLoader() {
  try {
    await resourceLoader.reload();
    console.log("📚 Resource loader initialized");
  } catch (err) {
    console.error("Failed to initialize resource loader:", err);
  }
}

// Get available completions (commands, skills, prompts)
function getCompletions(): Array<{
  name: string;
  description?: string;
  source: "extension" | "prompt" | "skill";
  location?: string;
  path?: string;
}> {
  const completions: Array<{
    name: string;
    description?: string;
    source: "extension" | "prompt" | "skill";
    location?: string;
    path?: string;
  }> = [];

  // Get prompt templates
  const { prompts } = resourceLoader.getPrompts();
  for (const prompt of prompts) {
    completions.push({
      name: prompt.name,
      description: prompt.description,
      source: "prompt",
      location: prompt.source,
      path: prompt.filePath,
    });
  }

  // Get skills
  const { skills } = resourceLoader.getSkills();
  for (const skill of skills) {
    completions.push({
      name: `skill:${skill.name}`,
      description: skill.description,
      source: "skill",
      location: skill.source,
      path: skill.filePath,
    });
  }

  return completions;
}

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

function broadcastAgentUpdate(agent: Agent) {
  broadcast({ type: "agent_updated", agent: serializeAgent(agent) });
}

function handleAgentError(agent: Agent, err: unknown, context: string) {
  console.error(`Agent ${agent.id} ${context}:`, err);
  agent.status = "error";
  agent.output +=
    JSON.stringify({ type: "error", message: String(err) }) + "\n";
  broadcastAgentUpdate(agent);
  saveAgent(agent);
}

async function updateAndPersistAgent(agent: Agent) {
  agent.updatedAt = nowTs();
  broadcastAgentUpdate(agent);
  await saveAgent(agent);
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

async function createAgentSessionAndSubscribe(
  agent: Agent,
  options: { resume?: boolean } = {},
): Promise<void> {
  const model = getModel(
    agent.provider as "anthropic",
    agent.model as "claude-sonnet-4-20250514",
  );
  if (!model) {
    throw new Error(`Model ${agent.provider}/${agent.model} not found`);
  }

  await ensureSessionDir(agent.id);
  const sessionDir = getAgentSessionDir(agent.id);

  // Use continueRecent to restore session history, or create for fresh start
  const sessionManager = options.resume
    ? SessionManager.continueRecent(agent.workspace, sessionDir)
    : SessionManager.create(agent.workspace, sessionDir);

  const { session } = await createAgentSession({
    cwd: agent.workspace,
    agentDir: AGENT_DIR,
    model,
    authStorage,
    modelRegistry,
    sessionManager,
  });

  agent.session = session;
  agent.status = "running";

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
      updateAndPersistAgent(agent);
    }
  });
}

async function startAgent(agent: Agent): Promise<void> {
  agent.output = "";
  await createAgentSessionAndSubscribe(agent);

  // Set the change description after session is created (avoids double changes)
  if (agent.instruction) {
    await Bun.$`cd ${agent.workspace} && jj desc -m ${agent.instruction}`.quiet();
  }

  console.log(
    `[Agent ${agent.id}] Starting with instruction:`,
    agent.instruction.substring(0, 200),
  );
  agent.session!.prompt(agent.instruction).catch((err) => {
    handleAgentError(agent, err, "start error");
  });

  await updateAndPersistAgent(agent);
}

async function resumeAgent(agent: Agent, instruction: string): Promise<void> {
  // Resume restores session history via SessionManager.continueRecent
  await createAgentSessionAndSubscribe(agent, { resume: true });

  console.log(
    `[Agent ${agent.id}] Resuming with instruction:`,
    instruction.substring(0, 200),
  );
  agent.session!.prompt(instruction).catch((err) => {
    handleAgentError(agent, err, "resume error");
  });

  await updateAndPersistAgent(agent);
}

async function stopAgent(agent: Agent): Promise<void> {
  if (agent.session) {
    await agent.session.abort();
  }
  agent.status = "stopped";
  await updateAndPersistAgent(agent);
}

async function instructAgent(agent: Agent, instruction: string): Promise<void> {
  const action = determineAgentAction(!!agent.session, agent.status);

  switch (action) {
    case "continue_active":
      // Active session - create new change and send prompt
      await Bun.$`cd ${agent.workspace} && jj new -m ${instruction}`.quiet();
      agent.status = "running";
      agent.instruction = instruction;
      agent.session!.prompt(instruction).catch((err) => {
        handleAgentError(agent, err, "instruction error");
      });
      break;

    case "resume_session":
      // Stopped agent - create new change and resume with session history
      await Bun.$`cd ${agent.workspace} && jj new -m ${instruction}`.quiet();
      agent.instruction = instruction;
      await resumeAgent(agent, instruction);
      return; // resumeAgent handles broadcast/save

    case "start_fresh":
      // Pending or error - start fresh
      agent.instruction = instruction;
      await startAgent(agent);
      return; // startAgent handles broadcast/save
  }

  await updateAndPersistAgent(agent);
}

async function interruptAgent(
  agent: Agent,
  instruction: string,
): Promise<void> {
  // Abort current operation if running
  if (agent.session && agent.status === "running") {
    try {
      await agent.session.abort();
    } catch {
      // Ignore abort errors
    }
  }

  // Add a visual separator in the output
  agent.output +=
    JSON.stringify({ type: "interrupt", message: "Interrupted by user" }) +
    "\n";

  // Create new change for the interrupt instruction
  await Bun.$`cd ${agent.workspace} && jj new -m ${instruction}`.quiet();

  // Resume with the new steering instruction
  await createAgentSessionAndSubscribe(agent, { resume: true });

  console.log(
    `[Agent ${agent.id}] Interrupted with instruction:`,
    instruction.substring(0, 200),
  );
  agent.session!.prompt(instruction).catch((err) => {
    handleAgentError(agent, err, "interrupt error");
  });

  await updateAndPersistAgent(agent);
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

  await updateAndPersistAgent(agent);
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
  await deleteAgentSession(agent.id);
}

async function mergeAgent(
  agent: Agent,
): Promise<{ success: boolean; error?: string }> {
  try {
    const cidResult =
      await Bun.$`cd ${agent.workspace} && jj log -r @ --no-graph -T 'change_id'`.quiet();
    const cid = cidResult.stdout.toString().trim();
    // Rebase agent's change onto the root workspace
    await Bun.$`cd ${agent.basePath} && jj rebase -r ${cid} -d default@`.quiet();
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
        const instruction = (message.instruction as string) || "";
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
          instruction,
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
        await saveAgent(agent);
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

      case "resume_agent": {
        const agent = agents.get(message.agentId as string);
        if (!agent) {
          sendResponse(ws, id, false, undefined, "Agent not found");
          return;
        }
        if (agent.status !== "stopped") {
          sendResponse(
            ws,
            id,
            false,
            undefined,
            "Agent must be stopped to resume",
          );
          return;
        }
        const instruction =
          (message.instruction as string) ||
          "Continue where you left off. Review what you've done so far and complete the remaining work.";
        await resumeAgent(agent, instruction);
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

      case "interrupt_agent": {
        const agent = agents.get(message.agentId as string);
        if (!agent) {
          sendResponse(ws, id, false, undefined, "Agent not found");
          return;
        }
        if (agent.status !== "running") {
          sendResponse(ws, id, false, undefined, "Agent is not running");
          return;
        }
        await interruptAgent(agent, message.instruction as string);
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

      case "get_completions": {
        const completions = getCompletions();
        sendResponse(ws, id, true, { completions });
        break;
      }

      case "set_max_concurrency": {
        const value = message.maxConcurrency as number;
        if (typeof value === "number" && value >= 1 && value <= 10) {
          maxConcurrency = value;
          broadcast({ type: "max_concurrency_changed", maxConcurrency });
          sendResponse(ws, id, true, { maxConcurrency });
        } else {
          sendResponse(
            ws,
            id,
            false,
            undefined,
            "Invalid concurrency value (must be 1-10)",
          );
        }
        break;
      }

      default:
        sendResponse(ws, id, false, undefined, `Unknown command: ${type}`);
    }
  } catch (err) {
    sendResponse(ws, id, false, undefined, String(err));
  }
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
          cwd: BASE_PATH,
          agents: Array.from(agents.values()).map(serializeAgent),
          models: getAvailableModels(),
          completions: getCompletions(),
          maxConcurrency,
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
  });

// Load persisted agents, initialize resources, and start server
await loadAgents();
await initResourceLoader();

app.listen(3001);

if (IS_DEV) {
  console.log(`📡 Dev mode: proxying to Vite at ${VITE_DEV_SERVER}`);
}

console.log(`🚀 Pi Swarm running on http://localhost:${app.server?.port}`);
