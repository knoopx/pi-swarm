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

// Batch operations

export function handleBatchDelete(
  state: StoreState,
  agentIds: string[],
): StoreState {
  const idsSet = new Set(agentIds);
  return {
    ...state,
    agents: state.agents.filter((a) => !idsSet.has(a.id)),
    selectedId:
      state.selectedId && idsSet.has(state.selectedId)
        ? null
        : state.selectedId,
  };
}

export function selectCompletedAgents(agents: Agent[]): Agent[] {
  return agents.filter((a) => a.status === "completed" || a.status === "error");
}

export function selectDeletableAgents(agents: Agent[]): Agent[] {
  return agents.filter((a) => a.status !== "running");
}

export function selectMergeableAgents(agents: Agent[]): Agent[] {
  return agents.filter(
    (a) =>
      a.status === "completed" ||
      a.status === "waiting" ||
      a.status === "stopped",
  );
}

export function getAgentIds(agents: Agent[]): string[] {
  return agents.map((a) => a.id);
}
