// Store utilities - extracted for testability

import type { Agent } from "../types";
import {
  generateAgentName,
  parseModelString,
  formatModelString,
} from "./shared";

// Re-export for convenience
export { generateAgentName, parseModelString, formatModelString };

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
