// Conversation state management - processes events incrementally

import type { ToolEvent, ConversationEvent } from "./events";
import { extractToolResult } from "./shared";

// Re-export types for convenience
export type {
  ToolEvent,
  TextEvent,
  ThinkingEvent,
  ProcessingEvent,
  ConversationEvent,
} from "./events";
export { extractToolResult };

// Conversation state that gets updated incrementally
export interface ConversationState {
  events: ConversationEvent[];
  // Track tools by ID for efficient updates
  toolsById: Map<string, ToolEvent>;
  // Accumulate streaming text/thinking
  pendingText: string;
  pendingThinking: string;
}

export function createConversationState(): ConversationState {
  return {
    events: [],
    toolsById: new Map(),
    pendingText: "",
    pendingThinking: "",
  };
}

// Helper to update a tool event in state
function updateToolInState(
  state: ConversationState,
  toolId: string,
  updater: (existing: ToolEvent) => ToolEvent,
): ConversationState {
  const existing = state.toolsById.get(toolId);
  if (!existing) return state;

  const updated = updater(existing);
  const newToolsById = new Map(state.toolsById);
  newToolsById.set(toolId, updated);

  const events = state.events.map((ev) =>
    ev.type === "tool" && ev.toolCallId === toolId ? updated : ev,
  );

  return { ...state, events, toolsById: newToolsById };
}

// Helper to flush pending content
function flushPendingContent(state: ConversationState): {
  events: ConversationEvent[];
  pendingText: string;
  pendingThinking: string;
} {
  const events = [...state.events];

  if (state.pendingThinking.trim()) {
    events.push({
      type: "thinking",
      content: state.pendingThinking.trim(),
    });
  }
  if (state.pendingText.trim()) {
    events.push({
      type: "text",
      content: state.pendingText.trim(),
      role: "assistant",
    });
  }

  return { events, pendingText: "", pendingThinking: "" };
}

// Process a single agent session event and update state
// Returns a new state object (immutable update)
export function processEvent(
  state: ConversationState,
  event: unknown,
): ConversationState {
  if (!event || typeof event !== "object") return state;

  const e = event as Record<string, unknown>;
  const eventType = e.type as string;

  switch (eventType) {
    case "tool_execution_start": {
      const toolEvent: ToolEvent = {
        type: "tool",
        toolCallId: e.toolCallId as string,
        toolName: e.toolName as string,
        args: (e.args as Record<string, unknown>) || {},
        state: "input-streaming",
      };

      const newToolsById = new Map(state.toolsById);
      newToolsById.set(toolEvent.toolCallId, toolEvent);

      // Flush any pending content before tool
      const flushed = flushPendingContent(state);
      flushed.events.push(toolEvent);

      return {
        ...state,
        events: flushed.events,
        toolsById: newToolsById,
        pendingText: flushed.pendingText,
        pendingThinking: flushed.pendingThinking,
      };
    }

    case "tool_execution_update": {
      return updateToolInState(state, e.toolCallId as string, (existing) => ({
        ...existing,
        result: e.partialResult,
        state: "input-available",
      }));
    }

    case "tool_execution_end": {
      const isError = e.isError as boolean;
      return updateToolInState(state, e.toolCallId as string, (existing) => ({
        ...existing,
        result: e.result,
        isError,
        state: isError ? "output-error" : "output-available",
      }));
    }

    case "message_update": {
      const msgEvent = e.assistantMessageEvent as Record<string, unknown>;
      if (!msgEvent) return state;

      const msgType = msgEvent.type as string;

      if (msgType === "text_delta" && msgEvent.delta) {
        return {
          ...state,
          pendingText: state.pendingText + (msgEvent.delta as string),
        };
      }

      if (msgType === "reasoning" && msgEvent.text) {
        return {
          ...state,
          pendingThinking: state.pendingThinking + (msgEvent.text as string),
        };
      }

      if (msgType === "thinking_delta" && msgEvent.delta) {
        return {
          ...state,
          pendingThinking: state.pendingThinking + (msgEvent.delta as string),
        };
      }

      return state;
    }

    case "thinking_start":
    case "reasoning_start": {
      // Flush pending text before thinking starts
      if (!state.pendingText.trim()) return state;

      const events = [...state.events];
      events.push({
        type: "text",
        content: state.pendingText.trim(),
        role: "assistant",
      });

      return { ...state, events, pendingText: "" };
    }

    case "thinking_end":
    case "reasoning_end": {
      // Flush thinking
      if (!state.pendingThinking.trim()) return state;

      const events = [...state.events];
      events.push({ type: "thinking", content: state.pendingThinking.trim() });

      return { ...state, events, pendingThinking: "" };
    }

    case "message_end":
    case "agent_end": {
      const flushed = flushPendingContent(state);
      return {
        ...state,
        events: flushed.events,
        pendingText: flushed.pendingText,
        pendingThinking: flushed.pendingThinking,
      };
    }

    default:
      return state;
  }
}

// Parse a raw output string into conversation state (for initial hydration)
export function parseOutputToState(output: string): ConversationState {
  if (!output || !output.trim()) {
    return createConversationState();
  }

  const lines = output.split("\n").filter((l) => l.trim());
  let state = createConversationState();

  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      state = processEvent(state, event);
    } catch {
      // Non-JSON line, accumulate as text
      state = { ...state, pendingText: state.pendingText + line + "\n" };
    }
  }

  // Final flush
  if (state.pendingThinking.trim() || state.pendingText.trim()) {
    const flushed = flushPendingContent(state);
    state = {
      ...state,
      events: flushed.events,
      pendingText: flushed.pendingText,
      pendingThinking: flushed.pendingThinking,
    };
  }

  return state;
}

// Get displayable events (includes pending text if any)
export function getDisplayEvents(
  state: ConversationState,
): ConversationEvent[] {
  const events = [...state.events];

  // Add pending thinking/text as in-progress
  if (state.pendingThinking.trim()) {
    events.push({ type: "thinking", content: state.pendingThinking });
  }
  if (state.pendingText.trim()) {
    events.push({
      type: "text",
      content: state.pendingText,
      role: "assistant",
    });
  }

  return events;
}

// Extract all text content from conversation state
export function extractTextFromConversation(state: ConversationState): string {
  const textParts: string[] = [];

  for (const event of state.events) {
    if (event.type === "text") {
      textParts.push(event.content);
    }
  }

  // Include pending text
  if (state.pendingText.trim()) {
    textParts.push(state.pendingText.trim());
  }

  return textParts.join("\n");
}
