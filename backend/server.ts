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
let app = new Elysia();

// Only use static plugin in production (when dist exists)
if (!IS_DEV) {
  app = app.use(
    staticPlugin({
      assets: FRONTEND_DIST,
      prefix: "/",
    }),
  );
}

app = app
  // WebSocket for real-time updates
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
      console.log("WS message:", message);
    },
  })
  // REST API
  .get("/api/models", () => ({ models: getAvailableModels() }))
  .get("/api/agents", async () => {
    const agentList = await Promise.all(
      Array.from(agents.values()).map(async (a) => ({
        ...serializeAgent(a),
        modifiedFiles: await getModifiedFiles(a.workspace),
        diffStat: await getDiffStat(a.workspace),
      })),
    );
    return { agents: agentList };
  })
  .post(
    "/api/agents",
    async ({ body }) => {
      const id = generateId();
      const workspace = await createWorkspace(BASE_PATH, id);

      let { provider, model: modelId } = body;
      if (!provider || !modelId) {
        const defaultModel = getDefaultModel();
        provider = provider || defaultModel.provider;
        modelId = modelId || defaultModel.modelId;
      }

      const agent: Agent = {
        id,
        name: body.name || "unnamed",
        status: "pending",
        instruction: body.instruction || "",
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

      agents.set(id, agent);
      broadcast({ type: "agent_created", agent: serializeAgent(agent) });
      saveAgents();
      return serializeAgent(agent);
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        instruction: t.Optional(t.String()),
        provider: t.Optional(t.String()),
        model: t.Optional(t.String()),
      }),
    },
  )
  .get("/api/agents/:id", async ({ params }) => {
    const agent = agents.get(params.id);
    if (!agent) return errorResponse(404, { error: "Agent not found" });

    return {
      ...serializeAgent(agent),
      modifiedFiles: await getModifiedFiles(agent.workspace),
      diffStat: await getDiffStat(agent.workspace),
    };
  })
  .post("/api/agents/:id/start", async ({ params }) => {
    const agent = agents.get(params.id);
    if (!agent) return errorResponse(404, { error: "Agent not found" });

    await startAgent(agent);
    return serializeAgent(agent);
  })
  .post("/api/agents/:id/stop", async ({ params }) => {
    const agent = agents.get(params.id);
    if (!agent) return errorResponse(404, { error: "Agent not found" });

    await stopAgent(agent);
    return serializeAgent(agent);
  })
  .post(
    "/api/agents/:id/instruct",
    async ({ params, body }) => {
      const agent = agents.get(params.id);
      if (!agent) return errorResponse(404, { error: "Agent not found" });

      await instructAgent(agent, body.instruction);
      return { success: true, agent: serializeAgent(agent) };
    },
    {
      body: t.Object({
        instruction: t.String(),
      }),
    },
  )
  .post(
    "/api/agents/:id/model",
    async ({ params, body }) => {
      const agent = agents.get(params.id);
      if (!agent) return errorResponse(404, { error: "Agent not found" });

      try {
        await setAgentModel(agent, body.provider, body.model);
        return { success: true, agent: serializeAgent(agent) };
      } catch (e) {
        return errorResponse(400, { error: String(e) });
      }
    },
    {
      body: t.Object({
        provider: t.String(),
        model: t.String(),
      }),
    },
  )
  .get("/api/agents/:id/diff", async ({ params }) => {
    const agent = agents.get(params.id);
    if (!agent) return errorResponse(404, { error: "Agent not found" });

    const diff = await getDiff(agent.workspace);
    return { diff };
  })
  .post("/api/agents/:id/merge", async ({ params }) => {
    const agent = agents.get(params.id);
    if (!agent) return errorResponse(404, { error: "Agent not found" });

    const result = await mergeAgent(agent);
    if (result.success) {
      return { success: true, message: "Changes merged" };
    }
    return errorResponse(500, { error: "Merge failed", details: result.error });
  })
  .delete("/api/agents/:id", async ({ params }) => {
    const agent = agents.get(params.id);
    if (!agent) return errorResponse(404, { error: "Agent not found" });

    await deleteAgent(agent);
    return { success: true };
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
