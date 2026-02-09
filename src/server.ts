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
  nowTs,
  serializeAgent,
  determineAgentAction,
  getMergeDescription,
  validateMerge,
  type Agent as CoreAgent,
} from "./core";
import { dispatchCommand, type HandlerContext } from "./ws-handlers";
import { createPersistence } from "./persistence";
import {
  createWorkspace,
  getWorkspaceFiles,
  getModifiedFiles,
  getDiffStat,
  getDiff,
  setOrCreateChange,
} from "./workspace";

// Types - extend core Agent with session
interface Agent extends CoreAgent {
  session?: AgentSession;
  unsubscribe?: () => void;
}

// WebSocket message types
interface WsRequest {
  id: string; // Request ID for response correlation
  type: string;
  [key: string]: unknown;
}

// State
const agents = new Map<string, Agent>();
const wsClients = new Set<{ send: (data: string) => void }>();
let maxConcurrency = 2;

// Concurrency helpers
function getRunningCount(): number {
  return Array.from(agents.values()).filter((a) => a.status === "running")
    .length;
}

function getPendingAgents(): Agent[] {
  return Array.from(agents.values())
    .filter((a) => a.status === "pending")
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
}

function hasAvailableSlot(): boolean {
  return getRunningCount() < maxConcurrency;
}

async function tryStartNextPending(): Promise<void> {
  if (!hasAvailableSlot()) return;

  const pending = getPendingAgents();
  if (pending.length === 0) return;

  const next = pending[0];
  console.log(
    `[Scheduler] Auto-starting queued agent ${next.id} (${getRunningCount()}/${maxConcurrency} slots used)`,
  );
  await startAgent(next);
}

// Package paths (set by CLI or defaults for dev)
const BASE_PATH = process.env.PI_SWARM_CWD || process.cwd();
const FRONTEND_DIST =
  process.env.PI_SWARM_DIST || join(BASE_PATH, "frontend", "dist");
const AGENT_DIR = join(process.env.HOME || "~", ".pi", "agent");
const IS_DEV = !existsSync(join(FRONTEND_DIST, "index.html"));
const VITE_DEV_SERVER = "http://localhost:3000";

// Initialize persistence module
const persistence = createPersistence({ basePath: BASE_PATH });
const {
  getAgentSessionDir,
  ensureSessionDir,
  saveAgent,
  deleteAgentSession,
  loadAgents: loadAgentsFromDisk,
} = persistence;

// Load agents from disk into memory
async function loadAgents(): Promise<void> {
  const loaded = await loadAgentsFromDisk();
  for (const [id, agent] of loaded) {
    agents.set(id, agent as Agent);
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
  // Try to start next pending agent since a slot freed up
  tryStartNextPending();
}

async function updateAndPersistAgent(agent: Agent) {
  agent.updatedAt = nowTs();
  broadcastAgentUpdate(agent);
  await saveAgent(agent);
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

  // Clean up any existing subscription before creating new one
  if (agent.unsubscribe) {
    agent.unsubscribe();
    agent.unsubscribe = undefined;
  }

  agent.session = session;
  agent.status = "running";

  agent.unsubscribe = session.subscribe((event: AgentSessionEvent) => {
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
      // Try to start next pending agent since a slot freed up
      tryStartNextPending();
    }
  });
}

async function startAgent(agent: Agent): Promise<void> {
  // Check if there's an available slot
  if (!hasAvailableSlot()) {
    console.log(
      `[Agent ${agent.id}] Queued (${getRunningCount()}/${maxConcurrency} slots used)`,
    );
    // Keep agent in pending state, it will auto-start when a slot frees up
    return;
  }

  agent.output = "";
  await createAgentSessionAndSubscribe(agent);

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
  if (agent.unsubscribe) {
    agent.unsubscribe();
    agent.unsubscribe = undefined;
  }
  if (agent.session) {
    await agent.session.abort();
  }
  agent.status = "stopped";
  await updateAndPersistAgent(agent);
  // Try to start next pending agent since a slot freed up
  await tryStartNextPending();
}

async function instructAgent(
  agent: Agent,
  instruction: string,
  options: { queue?: boolean } = {},
): Promise<void> {
  const action = determineAgentAction(!!agent.session, agent.status);

  switch (action) {
    case "continue_active":
      // Active session - set or create change and send prompt
      await setOrCreateChange(agent.workspace, instruction);
      agent.status = "running";
      agent.instruction = instruction;
      // Use 'followUp' to queue message, 'steer' to redirect immediately
      agent
        .session!.prompt(instruction, {
          streamingBehavior: options.queue ? "followUp" : "steer",
        })
        .catch((err) => {
          handleAgentError(agent, err, "instruction error");
        });
      break;

    case "resume_session":
      // Stopped agent - set or create change and resume with session history
      await setOrCreateChange(agent.workspace, instruction);
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

  // Set or create change for the interrupt instruction
  await setOrCreateChange(agent.workspace, instruction);

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
  if (agent.unsubscribe) {
    agent.unsubscribe();
    agent.unsubscribe = undefined;
  }
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
  // Try to start next pending agent since a slot may have freed up
  await tryStartNextPending();
}

async function mergeAgent(
  agent: Agent,
): Promise<{ success: boolean; error?: string }> {
  // Validate agent can be merged
  const validation = validateMerge(agent);
  if (!validation.valid) {
    console.error(
      `[mergeAgent] Validation failed for agent ${agent.id}:`,
      validation.error,
    );
    return { success: false, error: validation.error };
  }

  try {
    // Get the description from the agent's change to use as merge message (before rebase)
    const descResult =
      await Bun.$`cd ${agent.workspace} && jj log -r @ --no-graph -T 'description'`.quiet();
    const changeDescription = descResult.stdout.toString();
    const description = getMergeDescription(
      changeDescription,
      agent.instruction,
    );

    console.log(
      `[mergeAgent] Rebasing agent ${agent.id} onto default@, description: "${description}"`,
    );
    // Use -b to rebase all changes in the feature workspace branch, not just the current revision
    await Bun.$`cd ${agent.workspace} && jj rebase -b @ -d default@`.quiet();

    // Get the change ID of the rebased change and switch the default workspace to it
    const changeIdResult =
      await Bun.$`cd ${agent.workspace} && jj log -r @ --no-graph -T 'change_id'`.quiet();
    const changeId = changeIdResult.stdout.toString().trim();
    console.log(
      `[mergeAgent] Switching default workspace to rebased change ${changeId}`,
    );
    await Bun.$`cd ${agent.basePath} && jj edit ${changeId}`.quiet();

    console.log(`[mergeAgent] Successfully merged agent ${agent.id}`);
    return { success: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[mergeAgent] Failed to merge agent ${agent.id}:`, error);
    return { success: false, error };
  }
}

// Handler context for WebSocket command dispatcher
function createHandlerContext(): HandlerContext<Agent> {
  return {
    agents,
    basePath: BASE_PATH,
    maxConcurrency,
    setMaxConcurrency: (value: number) => {
      maxConcurrency = value;
    },
    broadcast,
    saveAgent,
    createWorkspace,
    getDefaultModel,
    startAgent,
    stopAgent,
    resumeAgent,
    instructAgent,
    interruptAgent,
    setAgentModel,
    deleteAgent,
    mergeAgent,
    getDiff: async (agent) => getDiff(agent.workspace, agent.baseRevision),
    getModifiedFiles: async (agent) =>
      getModifiedFiles(agent.workspace, agent.baseRevision),
    getDiffStat: async (agent) =>
      getDiffStat(agent.workspace, agent.baseRevision),
    getCompletions,
    getWorkspaceFiles,
    tryStartNextPending,
  };
}

// WebSocket command handler
async function handleWsCommand(
  ws: { send: (data: string) => void },
  message: WsRequest,
): Promise<void> {
  const ctx = createHandlerContext();
  await dispatchCommand(ctx, ws, message);
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
