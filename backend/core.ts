// Core business logic - extracted for testability

// Types
export interface Agent {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "waiting" | "stopped" | "error";
  instruction: string;
  workspace: string;
  basePath: string;
  createdAt: string;
  updatedAt: string;
  session?: unknown;
  output: string;
  modifiedFiles: string[];
  diffStat: string;
  model: string;
  provider: string;
}

export type SerializedAgent = Omit<Agent, "session">;

export interface ModelInfo {
  provider: string;
  modelId: string;
  name: string;
}

export interface BroadcastEvent {
  type: string;
  [key: string]: unknown;
}

// Pure functions

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function nowTs(): string {
  return new Date().toISOString();
}

export function serializeAgent(agent: Agent): SerializedAgent {
  const { session: _session, ...rest } = agent;
  return rest;
}

export function createAgentData(
  id: string,
  name: string,
  instruction: string,
  workspace: string,
  basePath: string,
  provider: string,
  model: string,
): Agent {
  const now = nowTs();
  return {
    id,
    name: name || "unnamed",
    status: "pending",
    instruction: instruction || "",
    workspace,
    basePath,
    createdAt: now,
    updatedAt: now,
    output: "",
    modifiedFiles: [],
    diffStat: "",
    provider,
    model,
  };
}

export function formatModelName(provider: string, modelId: string): string {
  return `${provider}/${modelId}`;
}

export function parseModelString(
  modelString: string,
): { provider: string; modelId: string } | null {
  const parts = modelString.split("/");
  if (parts.length < 2) return null;
  return {
    provider: parts[0],
    modelId: parts.slice(1).join("/"),
  };
}

export function mapModelsToInfo(
  models: Array<{ provider: string; id: string }>,
): ModelInfo[] {
  return models.map((model) => ({
    provider: model.provider,
    modelId: model.id,
    name: formatModelName(model.provider, model.id),
  }));
}

export function findPreferredModel<T extends { id: string }>(
  models: T[],
  preferredId: string,
): T | undefined {
  return models.find((m) => m.id === preferredId);
}

export function parseOutputLines(output: string): string[] {
  return output.split("\n").filter(Boolean);
}

export function appendOutput(currentOutput: string, event: unknown): string {
  return currentOutput + JSON.stringify(event) + "\n";
}

// Validation

export function isValidAgentStatus(status: string): status is Agent["status"] {
  return [
    "pending",
    "running",
    "completed",
    "waiting",
    "stopped",
    "error",
  ].includes(status);
}

export function canAgentReceiveInstruction(agent: Agent): boolean {
  return agent.status === "running" || agent.status === "waiting";
}

export function canAgentBeStarted(agent: Agent): boolean {
  return agent.status === "pending" || agent.status === "stopped";
}

export function canAgentBeStopped(agent: Agent): boolean {
  return agent.status === "running";
}

export function canAgentBeMerged(agent: Agent): boolean {
  return (
    agent.status === "completed" ||
    agent.status === "waiting" ||
    agent.status === "stopped"
  );
}

// Agent state transitions

export function transitionToRunning(agent: Agent): Agent {
  return {
    ...agent,
    status: "running",
    updatedAt: nowTs(),
  };
}

export function transitionToStopped(agent: Agent): Agent {
  return {
    ...agent,
    status: "stopped",
    updatedAt: nowTs(),
  };
}

export function transitionToWaiting(agent: Agent): Agent {
  return {
    ...agent,
    status: "waiting",
    updatedAt: nowTs(),
  };
}

export function transitionToError(agent: Agent, errorMessage: string): Agent {
  return {
    ...agent,
    status: "error",
    output: appendOutput(agent.output, {
      type: "error",
      message: errorMessage,
    }),
    updatedAt: nowTs(),
  };
}

// Workspace path helpers

export function buildWorkspacePath(basePath: string, id: string): string {
  return `${basePath}/workspaces/${id}`;
}

// Name generation from instruction

export function generateNameFromInstruction(instruction: string): string {
  const name =
    instruction
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .slice(0, 3)
      .join("-")
      .substring(0, 20) || "task";
  return name;
}
