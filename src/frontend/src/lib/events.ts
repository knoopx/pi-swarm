// Shared event types for agent conversation parsing and state management

import type { ToolUIPart } from "ai";

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}

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

export interface SystemEvent {
  type: "system";
  content: string;
  variant: "info" | "warning" | "error";
}

export type ConversationEvent =
  | ToolEvent
  | TextEvent
  | ThinkingEvent
  | ProcessingEvent
  | SystemEvent;
