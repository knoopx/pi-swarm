import { create } from "zustand";
import type { Agent, ModelInfo } from "./types";

const API_BASE = "/api";
const WS_URL = `ws://${window.location.host}/ws`;

interface WsMessage {
  type: string;
  agents?: Agent[];
  models?: ModelInfo[];
  agent?: Agent;
  agentId?: string;
  event?: unknown;
}

interface AgentStore {
  // State
  agents: Agent[];
  models: ModelInfo[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  selectedId: string | null;
  diff: string | null;

  // WebSocket
  ws: WebSocket | null;
  reconnectTimeout: NodeJS.Timeout | null;

  // Actions
  connect: () => void;
  disconnect: () => void;
  setSelectedId: (id: string | null) => void;
  setDiff: (diff: string | null) => void;

  // API Actions
  createAgent: (
    name: string,
    instruction: string,
    provider?: string,
    model?: string,
  ) => Promise<Agent | null>;
  startAgent: (id: string) => Promise<boolean>;
  stopAgent: (id: string) => Promise<boolean>;
  instructAgent: (id: string, instruction: string) => Promise<boolean>;
  setAgentModel: (
    id: string,
    provider: string,
    model: string,
  ) => Promise<boolean>;
  getDiff: (id: string) => Promise<string | null>;
  mergeAgent: (id: string) => Promise<boolean>;
  deleteAgent: (id: string) => Promise<boolean>;
  fetchAgent: (id: string) => Promise<Agent | null>;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  // Initial state
  agents: [],
  models: [],
  loading: true,
  error: null,
  connected: false,
  selectedId: null,
  diff: null,
  ws: null,
  reconnectTimeout: null,

  connect: () => {
    const state = get();
    if (state.ws?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      set({ connected: true, error: null });
      console.log("WebSocket connected");
    };

    ws.onclose = () => {
      set({ connected: false, ws: null });
      // Reconnect after 2 seconds
      const timeout = setTimeout(() => get().connect(), 2000);
      set({ reconnectTimeout: timeout });
    };

    ws.onerror = () => {
      set({ error: "WebSocket error" });
    };

    ws.onmessage = (event) => {
      try {
        const data: WsMessage = JSON.parse(event.data);

        switch (data.type) {
          case "init":
            set({
              agents: data.agents || [],
              models: data.models || [],
              loading: false,
            });
            break;

          case "agent_created":
            if (data.agent) {
              set((state) => {
                // Prevent duplicates - only add if agent doesn't already exist
                if (state.agents.some((a) => a.id === data.agent!.id)) {
                  return state;
                }
                return { agents: [...state.agents, data.agent!] };
              });
            }
            break;

          case "agent_updated":
            if (data.agent) {
              set((state) => ({
                agents: state.agents.map((a) =>
                  a.id === data.agent!.id ? { ...a, ...data.agent } : a,
                ),
              }));
            }
            break;

          case "agent_deleted":
            if (data.agentId) {
              set((state) => ({
                agents: state.agents.filter((a) => a.id !== data.agentId),
                selectedId:
                  state.selectedId === data.agentId ? null : state.selectedId,
              }));
            }
            break;

          case "agent_event":
            if (data.agentId && data.event) {
              set((state) => ({
                agents: state.agents.map((a) =>
                  a.id === data.agentId
                    ? {
                        ...a,
                        output: a.output + JSON.stringify(data.event) + "\n",
                      }
                    : a,
                ),
              }));
            }
            break;
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    set({ ws });
  },

  disconnect: () => {
    const state = get();
    if (state.reconnectTimeout) {
      clearTimeout(state.reconnectTimeout);
    }
    if (state.ws) {
      state.ws.close();
    }
    set({ ws: null, reconnectTimeout: null });
  },

  setSelectedId: (id) => set({ selectedId: id, diff: null }),
  setDiff: (diff) => set({ diff }),

  createAgent: async (name, instruction, provider, model) => {
    try {
      const res = await fetch(`${API_BASE}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, instruction, provider, model }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to create agent",
      });
      return null;
    }
  },

  startAgent: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/agents/${id}/start`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return true;
    } catch (err) {
      console.error("Failed to start agent:", err);
      return false;
    }
  },

  stopAgent: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/agents/${id}/stop`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return true;
    } catch (err) {
      console.error("Failed to stop agent:", err);
      return false;
    }
  },

  instructAgent: async (id, instruction) => {
    try {
      const res = await fetch(`${API_BASE}/agents/${id}/instruct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return true;
    } catch (err) {
      console.error("Failed to instruct agent:", err);
      return false;
    }
  },

  setAgentModel: async (id, provider, model) => {
    try {
      const res = await fetch(`${API_BASE}/agents/${id}/model`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return true;
    } catch (err) {
      console.error("Failed to set agent model:", err);
      return false;
    }
  },

  getDiff: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/agents/${id}/diff`);
      const data = await res.json();
      const diff = data.diff || null;
      set({ diff });
      return diff;
    } catch (err) {
      console.error("Failed to get diff:", err);
      return null;
    }
  },

  mergeAgent: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/agents/${id}/merge`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return true;
    } catch (err) {
      console.error("Failed to merge agent:", err);
      return false;
    }
  },

  deleteAgent: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/agents/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return true;
    } catch (err) {
      console.error("Failed to delete agent:", err);
      return false;
    }
  },

  fetchAgent: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/agents/${id}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      set((state) => ({
        agents: state.agents.map((a) => (a.id === id ? { ...a, ...data } : a)),
      }));
      return data;
    } catch (err) {
      console.error("Failed to fetch agent:", err);
      return null;
    }
  },
}));
