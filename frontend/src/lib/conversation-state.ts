// Conversation state management - processes events incrementally

import type { ToolUIPart } from "ai";

// Core event types
export interface ToolEvent {
  type: "tool";
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  isError?: boolean;
  state: ToolUIPart["state"];
}

export interface TextEvent {
  type: "text";
  content: string;
  role: "user" | "assistant";
}

export interface ThinkingEvent {
  type: "thinking";
  content: string;
}

export interface ProcessingEvent {
  type: "processing";
  content: string;
}

export type ConversationEvent =
  | ToolEvent
  | TextEvent
  | ThinkingEvent
  | ProcessingEvent;

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
        state: "streaming-input",
      };

      const newToolsById = new Map(state.toolsById);
      newToolsById.set(toolEvent.toolCallId, toolEvent);

      // Flush any pending text before tool
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
      events.push(toolEvent);

      return {
        ...state,
        events,
        toolsById: newToolsById,
        pendingText: "",
        pendingThinking: "",
      };
    }

    case "tool_execution_update": {
      const toolId = e.toolCallId as string;
      const existing = state.toolsById.get(toolId);
      if (!existing) return state;

      const updated: ToolEvent = {
        ...existing,
        result: e.partialResult,
        state: "streaming-output",
      };

      const newToolsById = new Map(state.toolsById);
      newToolsById.set(toolId, updated);

      // Update in events array too
      const events = state.events.map((ev) =>
        ev.type === "tool" && ev.toolCallId === toolId ? updated : ev,
      );

      return { ...state, events, toolsById: newToolsById };
    }

    case "tool_execution_end": {
      const toolId = e.toolCallId as string;
      const existing = state.toolsById.get(toolId);
      if (!existing) return state;

      const isError = e.isError as boolean;
      const updated: ToolEvent = {
        ...existing,
        result: e.result,
        isError,
        state: isError ? "output-error" : "output-available",
      };

      const newToolsById = new Map(state.toolsById);
      newToolsById.set(toolId, updated);

      // Update in events array
      const events = state.events.map((ev) =>
        ev.type === "tool" && ev.toolCallId === toolId ? updated : ev,
      );

      return { ...state, events, toolsById: newToolsById };
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
      // Flush all pending content
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

      return {
        ...state,
        events,
        pendingText: "",
        pendingThinking: "",
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
    const events = [...state.events];
    if (state.pendingThinking.trim()) {
      events.push({ type: "thinking", content: state.pendingThinking.trim() });
    }
    if (state.pendingText.trim()) {
      events.push({
        type: "text",
        content: state.pendingText.trim(),
        role: "assistant",
      });
    }
    state = { ...state, events, pendingText: "", pendingThinking: "" };
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

// Extract tool result text (utility)
export function extractToolResult(result: unknown): string {
  if (!result) return "";

  if (typeof result === "object" && result !== null && "content" in result) {
    const content = (result as { content: unknown }).content;
    if (Array.isArray(content)) {
      return content
        .filter(
          (c): c is { type: "text"; text: string } =>
            typeof c === "object" && c !== null && c.type === "text",
        )
        .map((c) => c.text)
        .join("\n");
    }
    if (typeof content === "string") {
      return content;
    }
  }

  if (typeof result === "string") return result;
  return JSON.stringify(result, null, 2);
}
