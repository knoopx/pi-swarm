import { create } from "zustand";
import type { Agent, ModelInfo, CompletionItem } from "./types";
import { parseOutputToState, processEvent } from "./lib/conversation-state";

const WS_URL = `ws://${window.location.host}/ws`;

interface WsMessage {
  type: string;
  cwd?: string;
  agents?: Agent[];
  models?: ModelInfo[];
  completions?: CompletionItem[];
  maxConcurrency?: number;
  agent?: Agent;
  agentId?: string;
  event?: unknown;
}

// Pending request tracking
type PendingRequest = {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
};

const pendingRequests = new Map<string, PendingRequest>();
let requestId = 0;

function generateRequestId(): string {
  return `req-${++requestId}-${Date.now()}`;
}

interface AgentStore {
  // State
  cwd: string | null;
  agents: Agent[];
  models: ModelInfo[];
  completions: CompletionItem[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  selectedId: string | null;
  diff: string | null;
  maxConcurrency: number;

  // WebSocket
  ws: WebSocket | null;
  reconnectTimeout: ReturnType<typeof setTimeout> | null;

  // Actions
  connect: () => void;
  disconnect: () => void;
  setSelectedId: (id: string | null) => void;
  setDiff: (diff: string | null) => void;
  fetchCompletions: () => Promise<void>;
  setMaxConcurrency: (value: number) => Promise<boolean>;

  // WebSocket Commands
  sendCommand: <T = unknown>(
    type: string,
    payload?: Record<string, unknown>,
  ) => Promise<T>;

  // Agent Actions
  createAgent: (
    name: string,
    instruction: string,
    provider?: string,
    model?: string,
  ) => Promise<Agent | null>;
  startAgent: (id: string) => Promise<boolean>;
  stopAgent: (id: string) => Promise<boolean>;
  resumeAgent: (id: string, instruction?: string) => Promise<boolean>;
  instructAgent: (id: string, instruction: string) => Promise<boolean>;
  interruptAgent: (id: string, instruction: string) => Promise<boolean>;
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
  cwd: null,
  agents: [],
  models: [],
  completions: [],
  loading: true,
  error: null,
  connected: false,
  selectedId: null,
  diff: null,
  maxConcurrency: 2,
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
      // Reject all pending requests
      for (const [id, { reject }] of pendingRequests) {
        reject(new Error("WebSocket disconnected"));
        pendingRequests.delete(id);
      }
      // Reconnect after 2 seconds
      const timeout = setTimeout(() => get().connect(), 2000);
      set({ reconnectTimeout: timeout });
    };

    ws.onerror = () => {
      set({ error: "WebSocket error" });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle response to a request
        if (data.type === "response" && data.id) {
          const pending = pendingRequests.get(data.id);
          if (pending) {
            pendingRequests.delete(data.id);
            if (data.success) {
              pending.resolve(data.data);
            } else {
              pending.reject(new Error(data.error || "Request failed"));
            }
          }
          return;
        }

        // Handle broadcast events
        const wsData = data as WsMessage;
        switch (wsData.type) {
          case "init": {
            // Hydrate agents with conversation state from raw output
            const hydratedAgents = (wsData.agents || []).map((agent) => ({
              ...agent,
              conversation: parseOutputToState(agent.output),
            }));
            set({
              cwd: wsData.cwd || null,
              agents: hydratedAgents,
              models: wsData.models || [],
              completions: wsData.completions || [],
              maxConcurrency: wsData.maxConcurrency ?? 2,
              loading: false,
            });
            break;
          }

          case "agent_created":
            if (wsData.agent) {
              set((state) => {
                // Prevent duplicates - only add if agent doesn't already exist
                if (state.agents.some((a) => a.id === wsData.agent!.id)) {
                  return state;
                }
                const newAgent = {
                  ...wsData.agent!,
                  conversation: parseOutputToState(wsData.agent!.output),
                };
                return { agents: [...state.agents, newAgent] };
              });
            }
            break;

          case "agent_updated":
            if (wsData.agent) {
              set((state) => ({
                agents: state.agents.map((a) =>
                  a.id === wsData.agent!.id
                    ? {
                        ...a,
                        ...wsData.agent,
                        // Re-parse if output changed significantly (e.g., agent restart)
                        conversation:
                          wsData.agent!.output !== a.output
                            ? parseOutputToState(wsData.agent!.output)
                            : a.conversation,
                      }
                    : a,
                ),
              }));
            }
            break;

          case "agent_deleted":
            if (wsData.agentId) {
              set((state) => ({
                agents: state.agents.filter((a) => a.id !== wsData.agentId),
                selectedId:
                  state.selectedId === wsData.agentId ? null : state.selectedId,
              }));
            }
            break;

          case "agent_event":
            if (wsData.agentId && wsData.event) {
              set((state) => ({
                agents: state.agents.map((a) =>
                  a.id === wsData.agentId
                    ? {
                        ...a,
                        // Keep raw output for persistence/debugging
                        output: a.output + JSON.stringify(wsData.event) + "\n",
                        // Process event incrementally into structured state
                        conversation: processEvent(
                          a.conversation,
                          wsData.event,
                        ),
                      }
                    : a,
                ),
              }));
            }
            break;

          case "max_concurrency_changed":
            if (wsData.maxConcurrency !== undefined) {
              set({ maxConcurrency: wsData.maxConcurrency });
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

  fetchCompletions: async () => {
    try {
      const data = await get().sendCommand<{ completions: CompletionItem[] }>(
        "get_completions",
      );
      set({ completions: data?.completions || [] });
    } catch (err) {
      console.error("Failed to fetch completions:", err);
    }
  },

  setMaxConcurrency: async (value: number) => {
    try {
      await get().sendCommand("set_max_concurrency", { maxConcurrency: value });
      set({ maxConcurrency: value });
      return true;
    } catch (err) {
      console.error("Failed to set max concurrency:", err);
      return false;
    }
  },

  // Generic WebSocket command sender with request-response
  sendCommand: <T = unknown>(
    type: string,
    payload: Record<string, unknown> = {},
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      const { ws, connected } = get();

      if (!ws || !connected) {
        reject(new Error("WebSocket not connected"));
        return;
      }

      const id = generateRequestId();
      const message = { id, type, ...payload };

      // Store pending request
      pendingRequests.set(id, {
        resolve: resolve as (data: unknown) => void,
        reject,
      });

      // Set timeout for request
      setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error("Request timeout"));
        }
      }, 30000);

      ws.send(JSON.stringify(message));
    });
  },

  createAgent: async (name, instruction, provider, model) => {
    try {
      const data = await get().sendCommand<Agent>("create_agent", {
        name,
        instruction,
        provider,
        model,
      });
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
      await get().sendCommand("start_agent", { agentId: id });
      return true;
    } catch (err) {
      console.error("Failed to start agent:", err);
      return false;
    }
  },

  stopAgent: async (id) => {
    try {
      await get().sendCommand("stop_agent", { agentId: id });
      return true;
    } catch (err) {
      console.error("Failed to stop agent:", err);
      return false;
    }
  },

  resumeAgent: async (id, instruction) => {
    try {
      await get().sendCommand("resume_agent", { agentId: id, instruction });
      return true;
    } catch (err) {
      console.error("Failed to resume agent:", err);
      return false;
    }
  },

  instructAgent: async (id, instruction) => {
    try {
      await get().sendCommand("instruct_agent", { agentId: id, instruction });
      return true;
    } catch (err) {
      console.error("Failed to instruct agent:", err);
      return false;
    }
  },

  interruptAgent: async (id, instruction) => {
    try {
      await get().sendCommand("interrupt_agent", { agentId: id, instruction });
      return true;
    } catch (err) {
      console.error("Failed to interrupt agent:", err);
      return false;
    }
  },

  setAgentModel: async (id, provider, model) => {
    try {
      await get().sendCommand("set_model", { agentId: id, provider, model });
      return true;
    } catch (err) {
      console.error("Failed to set agent model:", err);
      return false;
    }
  },

  getDiff: async (id) => {
    try {
      const data = await get().sendCommand<{ diff: string }>("get_diff", {
        agentId: id,
      });
      const diff = data?.diff || null;
      set({ diff });
      return diff;
    } catch (err) {
      console.error("Failed to get diff:", err);
      return null;
    }
  },

  mergeAgent: async (id) => {
    try {
      await get().sendCommand("merge_agent", { agentId: id });
      return true;
    } catch (err) {
      console.error("Failed to merge agent:", err);
      return false;
    }
  },

  deleteAgent: async (id) => {
    try {
      await get().sendCommand("delete_agent", { agentId: id });
      return true;
    } catch (err) {
      console.error("Failed to delete agent:", err);
      return false;
    }
  },

  fetchAgent: async (id) => {
    try {
      const data = await get().sendCommand<Agent>("fetch_agent", {
        agentId: id,
      });
      if (data) {
        const hydratedAgent = {
          ...data,
          conversation: parseOutputToState(data.output),
        };
        set((state) => ({
          agents: state.agents.map((a) =>
            a.id === id ? { ...a, ...hydratedAgent } : a,
          ),
        }));
        return hydratedAgent;
      }
      return null;
    } catch (err) {
      console.error("Failed to fetch agent:", err);
      return null;
    }
  },
}));
