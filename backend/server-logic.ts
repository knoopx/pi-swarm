// Server business logic - extracted for testability

import { serializeAgent, type Agent } from "./core";

// WebSocket message types
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

export interface WsClient {
  send: (data: string) => void;
}

export interface ModelInfo {
  provider: string;
  modelId: string;
  name: string;
}

// Response formatting
export function createSuccessResponse(id: string, data?: unknown): WsResponse {
  return { id, type: "response", success: true, data };
}

export function createErrorResponse(id: string, error: string): WsResponse {
  return { id, type: "response", success: false, error };
}

export function formatResponse(response: WsResponse): string {
  return JSON.stringify(response);
}

// Broadcast event formatting
export function formatBroadcastEvent(event: {
  type: string;
  [key: string]: unknown;
}): string {
  return JSON.stringify(event);
}

// Model formatting
export function formatModelInfo(model: {
  provider: string;
  id: string;
}): ModelInfo {
  return {
    provider: model.provider,
    modelId: model.id,
    name: `${model.provider}/${model.id}`,
  };
}

export function formatModelsInfo(
  models: Array<{ provider: string; id: string }>,
): ModelInfo[] {
  return models.map(formatModelInfo);
}

// Init message formatting
export function createInitMessage(
  agents: Agent[],
  models: ModelInfo[],
): string {
  return JSON.stringify({
    type: "init",
    agents: agents.map(serializeAgent),
    models,
  });
}

// Agent event formatting
export function createAgentCreatedEvent(agent: Agent): {
  type: string;
  agent: Omit<Agent, "session">;
} {
  return { type: "agent_created", agent: serializeAgent(agent) };
}

export function createAgentUpdatedEvent(agent: Agent): {
  type: string;
  agent: Omit<Agent, "session">;
} {
  return { type: "agent_updated", agent: serializeAgent(agent) };
}

export function createAgentDeletedEvent(agentId: string): {
  type: string;
  agentId: string;
} {
  return { type: "agent_deleted", agentId };
}

export function createAgentEventBroadcast(
  agentId: string,
  event: unknown,
): { type: string; agentId: string; event: unknown } {
  return { type: "agent_event", agentId, event };
}

// Command validation
export type CommandType =
  | "create_agent"
  | "start_agent"
  | "stop_agent"
  | "resume_agent"
  | "instruct_agent"
  | "set_model"
  | "get_diff"
  | "merge_agent"
  | "delete_agent"
  | "fetch_agent";

const VALID_COMMANDS: CommandType[] = [
  "create_agent",
  "start_agent",
  "stop_agent",
  "resume_agent",
  "instruct_agent",
  "set_model",
  "get_diff",
  "merge_agent",
  "delete_agent",
  "fetch_agent",
];

export function isValidCommand(type: string): type is CommandType {
  return VALID_COMMANDS.includes(type as CommandType);
}

export function isValidWsRequest(message: unknown): message is WsRequest {
  if (!message || typeof message !== "object") return false;
  const msg = message as Record<string, unknown>;
  return typeof msg.id === "string" && typeof msg.type === "string";
}

// Command parameter extraction
export function extractAgentId(message: WsRequest): string | null {
  const agentId = message.agentId;
  if (typeof agentId === "string" && agentId.length > 0) {
    return agentId;
  }
  return null;
}

export function extractInstruction(message: WsRequest): string {
  const instruction = message.instruction;
  return typeof instruction === "string" ? instruction : "";
}

export function extractModelParams(
  message: WsRequest,
): { provider: string; model: string } | null {
  const provider = message.provider;
  const model = message.model;
  if (typeof provider === "string" && typeof model === "string") {
    return { provider, model };
  }
  return null;
}

export function extractCreateAgentParams(message: WsRequest): {
  name: string;
  instruction: string;
  provider?: string;
  model?: string;
} {
  return {
    name: typeof message.name === "string" ? message.name : "unnamed",
    instruction:
      typeof message.instruction === "string" ? message.instruction : "",
    provider:
      typeof message.provider === "string" ? message.provider : undefined,
    model: typeof message.model === "string" ? message.model : undefined,
  };
}

// Command routing
export interface CommandContext {
  agents: Map<string, Agent>;
  getAgent: (id: string) => Agent | undefined;
}

export function routeCommand(
  type: string,
  message: WsRequest,
  context: CommandContext,
):
  | { valid: true; agent?: Agent; params?: Record<string, unknown> }
  | { valid: false; error: string } {
  if (!isValidCommand(type)) {
    return { valid: false, error: `Unknown command: ${type}` };
  }

  // Commands that don't need an existing agent
  if (type === "create_agent") {
    return { valid: true, params: extractCreateAgentParams(message) };
  }

  // All other commands need an agent ID
  const agentId = extractAgentId(message);
  if (!agentId) {
    return { valid: false, error: "Missing agent ID" };
  }

  const agent = context.getAgent(agentId);
  if (!agent) {
    return { valid: false, error: "Agent not found" };
  }

  // Extract command-specific params
  switch (type) {
    case "instruct_agent": {
      const instruction = extractInstruction(message);
      return { valid: true, agent, params: { instruction } };
    }
    case "set_model": {
      const modelParams = extractModelParams(message);
      if (!modelParams) {
        return { valid: false, error: "Missing provider or model" };
      }
      return { valid: true, agent, params: modelParams };
    }
    default:
      return { valid: true, agent };
  }
}

// Broadcast helpers
export function broadcastToClients(
  clients: Set<WsClient>,
  event: { type: string; [key: string]: unknown },
): { sent: number; failed: number } {
  const data = formatBroadcastEvent(event);
  let sent = 0;
  let failed = 0;
  const toRemove: WsClient[] = [];

  for (const client of clients) {
    try {
      client.send(data);
      sent++;
    } catch {
      toRemove.push(client);
      failed++;
    }
  }

  // Clean up failed clients
  for (const client of toRemove) {
    clients.delete(client);
  }

  return { sent, failed };
}

// Parse incoming WebSocket message
export function parseWsMessage(
  message: string | unknown,
): WsRequest | { error: string } {
  try {
    const data = typeof message === "string" ? JSON.parse(message) : message;
    if (isValidWsRequest(data)) {
      return data;
    }
    return { error: "Invalid message format: missing id or type" };
  } catch (err) {
    return { error: `Failed to parse message: ${err}` };
  }
}
