// Store utilities - extracted for testability

import type { Agent } from "../types";

export interface StoreState {
  agents: Agent[];
  selectedId: string | null;
}

// Reducer functions for WebSocket message handling

export function handleAgentCreated(
  state: StoreState,
  agent: Agent,
): StoreState {
  // Prevent duplicates - only add if agent doesn't already exist
  if (state.agents.some((a) => a.id === agent.id)) {
    return state;
  }
  return { ...state, agents: [...state.agents, agent] };
}

export function handleAgentUpdated(
  state: StoreState,
  agent: Partial<Agent> & { id: string },
): StoreState {
  return {
    ...state,
    agents: state.agents.map((a) =>
      a.id === agent.id ? { ...a, ...agent } : a,
    ),
  };
}

export function handleAgentDeleted(
  state: StoreState,
  agentId: string,
): StoreState {
  return {
    ...state,
    agents: state.agents.filter((a) => a.id !== agentId),
    selectedId: state.selectedId === agentId ? null : state.selectedId,
  };
}

export function handleAgentEvent(
  state: StoreState,
  agentId: string,
  event: unknown,
): StoreState {
  return {
    ...state,
    agents: state.agents.map((a) =>
      a.id === agentId
        ? { ...a, output: a.output + JSON.stringify(event) + "\n" }
        : a,
    ),
  };
}

// Selectors

export function selectAgentById(
  agents: Agent[],
  id: string | null,
): Agent | undefined {
  if (!id) return undefined;
  return agents.find((a) => a.id === id);
}

export function selectRunningAgents(agents: Agent[]): Agent[] {
  return agents.filter((a) => a.status === "running");
}

export function selectAgentsByStatus(
  agents: Agent[],
  status: Agent["status"],
): Agent[] {
  return agents.filter((a) => a.status === status);
}

export function isSpecAgent(agent: Agent): boolean {
  return agent.name.startsWith("spec-");
}

// Name generation from instruction (used by handleCreate/handleRefine)

export function generateAgentName(instruction: string): string {
  return (
    instruction
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .slice(0, 3)
      .join("-")
      .substring(0, 20) || "task"
  );
}

// Model string parsing

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

export function formatModelString(provider: string, modelId: string): string {
  return `${provider}/${modelId}`;
}
