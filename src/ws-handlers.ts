// WebSocket command handlers - extracted from server.ts for maintainability

import {
  generateId,
  nowTs,
  serializeAgent,
  type Agent,
  type SerializedAgent,
} from "./core";

// Handler context - dependencies injected from server
// Uses generic T to allow server's extended Agent type (with session)
export interface HandlerContext<T extends Agent = Agent> {
  agents: Map<string, T>;
  basePath: string;
  maxConcurrency: number;
  setMaxConcurrency: (value: number) => void;
  broadcast: (event: { type: string; [key: string]: unknown }) => void;
  saveAgent: (agent: T) => Promise<void>;
  createWorkspace: (
    basePath: string,
    id: string,
    instruction: string,
  ) => Promise<string>;
  getDefaultModel: () => { provider: string; modelId: string };
  startAgent: (agent: T) => Promise<void>;
  stopAgent: (agent: T) => Promise<void>;
  resumeAgent: (agent: T, instruction: string) => Promise<void>;
  instructAgent: (
    agent: T,
    instruction: string,
    options: { queue?: boolean },
  ) => Promise<void>;
  interruptAgent: (agent: T, instruction: string) => Promise<void>;
  setAgentModel: (agent: T, provider: string, modelId: string) => Promise<void>;
  deleteAgent: (agent: T) => Promise<void>;
  mergeAgent: (agent: T) => Promise<{ success: boolean; error?: string }>;
  getDiff: (workspace: string) => Promise<string>;
  getModifiedFiles: (workspace: string) => Promise<string[]>;
  getDiffStat: (workspace: string) => Promise<string>;
  getCompletions: () => unknown;
  getWorkspaceFiles: (
    workspace: string,
  ) => Promise<Array<{ name: string; source: string; path: string }>>;
  tryStartNextPending: () => Promise<void>;
}

// WebSocket types
export interface WsClient {
  send: (data: string) => void;
}

export interface WsRequest {
  id: string;
  type: string;
  [key: string]: unknown;
}

export interface WsResponse {
  id: string;
  type: "response";
  success: boolean;
  data?: unknown;
  error?: string;
}

// Response helper
function sendResponse(
  ws: WsClient,
  id: string,
  success: boolean,
  data?: unknown,
  error?: string,
): void {
  const response: WsResponse = { id, type: "response", success, data, error };
  ws.send(JSON.stringify(response));
}

// Agent lookup helper
function requireAgent(
  ctx: HandlerContext,
  ws: WsClient,
  id: string,
  agentId: unknown,
): Agent | null {
  if (typeof agentId !== "string") {
    sendResponse(ws, id, false, undefined, "Missing agent ID");
    return null;
  }
  const agent = ctx.agents.get(agentId);
  if (!agent) {
    sendResponse(ws, id, false, undefined, "Agent not found");
    return null;
  }
  return agent;
}

// Handler type
type CommandHandler = (
  ctx: HandlerContext,
  ws: WsClient,
  id: string,
  message: WsRequest,
) => Promise<void>;

// Individual handlers

const handleCreateAgent: CommandHandler = async (ctx, ws, id, message) => {
  const agentId = generateId();
  const instruction = (message.instruction as string) || "";
  const workspace = await ctx.createWorkspace(
    ctx.basePath,
    agentId,
    instruction,
  );

  let { provider, model: modelId } = message as {
    provider?: string;
    model?: string;
  };
  if (!provider || !modelId) {
    const defaultModel = ctx.getDefaultModel();
    provider = provider || defaultModel.provider;
    modelId = modelId || defaultModel.modelId;
  }

  const agent: Agent = {
    id: agentId,
    name: (message.name as string) || "unnamed",
    status: "pending",
    instruction,
    workspace,
    basePath: ctx.basePath,
    createdAt: nowTs(),
    updatedAt: nowTs(),
    output: "",
    modifiedFiles: [],
    diffStat: "",
    provider,
    model: modelId,
  };

  ctx.agents.set(agentId, agent);
  ctx.broadcast({ type: "agent_created", agent: serializeAgent(agent) });
  await ctx.saveAgent(agent);
  sendResponse(ws, id, true, serializeAgent(agent));
};

const handleStartAgent: CommandHandler = async (ctx, ws, id, message) => {
  const agent = requireAgent(ctx, ws, id, message.agentId);
  if (!agent) return;
  await ctx.startAgent(agent);
  sendResponse(ws, id, true, serializeAgent(agent));
};

const handleStopAgent: CommandHandler = async (ctx, ws, id, message) => {
  const agent = requireAgent(ctx, ws, id, message.agentId);
  if (!agent) return;
  await ctx.stopAgent(agent);
  sendResponse(ws, id, true, serializeAgent(agent));
};

const handleResumeAgent: CommandHandler = async (ctx, ws, id, message) => {
  const agent = requireAgent(ctx, ws, id, message.agentId);
  if (!agent) return;
  if (agent.status !== "stopped") {
    sendResponse(ws, id, false, undefined, "Agent must be stopped to resume");
    return;
  }
  const instruction =
    (message.instruction as string) ||
    "Continue where you left off. Review what you've done so far and complete the remaining work.";
  await ctx.resumeAgent(agent, instruction);
  sendResponse(ws, id, true, serializeAgent(agent));
};

const handleInstructAgent: CommandHandler = async (ctx, ws, id, message) => {
  const agent = requireAgent(ctx, ws, id, message.agentId);
  if (!agent) return;
  await ctx.instructAgent(agent, message.instruction as string, {
    queue: message.queue as boolean,
  });
  sendResponse(ws, id, true, serializeAgent(agent));
};

const handleInterruptAgent: CommandHandler = async (ctx, ws, id, message) => {
  const agent = requireAgent(ctx, ws, id, message.agentId);
  if (!agent) return;
  if (agent.status !== "running") {
    sendResponse(ws, id, false, undefined, "Agent is not running");
    return;
  }
  await ctx.interruptAgent(agent, message.instruction as string);
  sendResponse(ws, id, true, serializeAgent(agent));
};

const handleSetModel: CommandHandler = async (ctx, ws, id, message) => {
  const agent = requireAgent(ctx, ws, id, message.agentId);
  if (!agent) return;
  await ctx.setAgentModel(
    agent,
    message.provider as string,
    message.model as string,
  );
  sendResponse(ws, id, true, serializeAgent(agent));
};

const handleGetDiff: CommandHandler = async (ctx, ws, id, message) => {
  const agent = requireAgent(ctx, ws, id, message.agentId);
  if (!agent) return;
  const diff = await ctx.getDiff(agent.workspace);
  sendResponse(ws, id, true, { diff });
};

const handleMergeAgent: CommandHandler = async (ctx, ws, id, message) => {
  const agent = requireAgent(ctx, ws, id, message.agentId);
  if (!agent) return;
  const result = await ctx.mergeAgent(agent);
  if (result.success) {
    sendResponse(ws, id, true, { message: "Changes merged" });
  } else {
    sendResponse(ws, id, false, undefined, result.error);
  }
};

const handleDeleteAgent: CommandHandler = async (ctx, ws, id, message) => {
  const agent = requireAgent(ctx, ws, id, message.agentId);
  if (!agent) return;
  await ctx.deleteAgent(agent);
  sendResponse(ws, id, true);
};

const handleFetchAgent: CommandHandler = async (ctx, ws, id, message) => {
  const agent = requireAgent(ctx, ws, id, message.agentId);
  if (!agent) return;
  const agentData: SerializedAgent & {
    modifiedFiles: string[];
    diffStat: string;
  } = {
    ...serializeAgent(agent),
    modifiedFiles: await ctx.getModifiedFiles(agent.workspace),
    diffStat: await ctx.getDiffStat(agent.workspace),
  };
  sendResponse(ws, id, true, agentData);
};

const handleGetCompletions: CommandHandler = async (ctx, ws, id, _message) => {
  const completions = ctx.getCompletions();
  sendResponse(ws, id, true, { completions });
};

const handleGetWorkspaceFiles: CommandHandler = async (
  ctx,
  ws,
  id,
  message,
) => {
  const agentId = message.agentId as string | undefined;
  const workspace = agentId
    ? ctx.agents.get(agentId)?.workspace || ctx.basePath
    : ctx.basePath;
  const files = await ctx.getWorkspaceFiles(workspace);
  sendResponse(ws, id, true, { files });
};

const handleSetMaxConcurrency: CommandHandler = async (
  ctx,
  ws,
  id,
  message,
) => {
  const value = message.maxConcurrency as number;
  if (typeof value === "number" && value >= 1 && value <= 10) {
    ctx.setMaxConcurrency(value);
    ctx.broadcast({ type: "max_concurrency_changed", maxConcurrency: value });
    sendResponse(ws, id, true, { maxConcurrency: value });
    await ctx.tryStartNextPending();
  } else {
    sendResponse(
      ws,
      id,
      false,
      undefined,
      "Invalid concurrency value (must be 1-10)",
    );
  }
};

// Command handler map
export const commandHandlers: Record<string, CommandHandler> = {
  create_agent: handleCreateAgent,
  start_agent: handleStartAgent,
  stop_agent: handleStopAgent,
  resume_agent: handleResumeAgent,
  instruct_agent: handleInstructAgent,
  interrupt_agent: handleInterruptAgent,
  set_model: handleSetModel,
  get_diff: handleGetDiff,
  merge_agent: handleMergeAgent,
  delete_agent: handleDeleteAgent,
  fetch_agent: handleFetchAgent,
  get_completions: handleGetCompletions,
  get_workspace_files: handleGetWorkspaceFiles,
  set_max_concurrency: handleSetMaxConcurrency,
};

// Main dispatcher
export async function dispatchCommand<T extends Agent>(
  ctx: HandlerContext<T>,
  ws: WsClient,
  message: WsRequest,
): Promise<void> {
  const { id, type } = message;

  try {
    const handler = commandHandlers[type];
    if (handler) {
      // Cast ctx to base HandlerContext since handlers only use Agent's base properties
      await handler(ctx as unknown as HandlerContext, ws, id, message);
    } else {
      sendResponse(ws, id, false, undefined, `Unknown command: ${type}`);
    }
  } catch (err) {
    sendResponse(ws, id, false, undefined, String(err));
  }
}
