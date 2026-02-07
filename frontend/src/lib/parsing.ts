// Parsing utilities for agent output - extracted for testability

import type { ToolEvent, ParsedEvent, ToolExecutionEvent } from "./events";
import { extractToolResult } from "./shared";

// Re-export types for convenience
export type {
  ToolEvent,
  TextEvent,
  ThinkingEvent,
  ProcessingEvent,
  ParsedEvent,
  ToolExecutionEvent,
} from "./events";
export { extractToolResult };

// Processing status messages
const PROCESSING_MESSAGES = [
  "⏳ Processing...",
  "⏳ Waiting...",
  "⏳ Starting...",
];

export function isProcessingMessage(output: string): boolean {
  return !output || PROCESSING_MESSAGES.includes(output);
}

export function parseOutput(output: string): ParsedEvent[] {
  if (isProcessingMessage(output)) {
    return [{ type: "processing", content: output || "Waiting..." }];
  }

  const events: ParsedEvent[] = [];
  const lines = output.split("\n").filter((l) => l.trim());

  // Track tool executions by ID for merging start/end events
  const toolMap = new Map<string, ToolExecutionEvent>();

  // Track accumulated text and thinking
  let currentText = "";
  let currentThinking = "";

  const flushThinking = () => {
    if (currentThinking.trim()) {
      events.push({
        type: "thinking",
        content: currentThinking.trim(),
      });
      currentThinking = "";
    }
  };

  const flushText = () => {
    // Flush any thinking before text
    flushThinking();
    if (currentText.trim()) {
      events.push({
        type: "text",
        content: currentText.trim(),
        role: "assistant",
      });
      currentText = "";
    }
  };

  for (const line of lines) {
    try {
      const event = JSON.parse(line);

      switch (event.type) {
        case "tool_execution_start": {
          flushText();
          const toolEvent: ToolEvent = {
            type: "tool",
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args || {},
            state: "input-available",
          };
          toolMap.set(event.toolCallId, toolEvent);
          events.push(toolEvent);
          break;
        }

        case "tool_execution_update": {
          // Update existing tool with partial result
          const existing = toolMap.get(event.toolCallId);
          if (existing) {
            existing.result = event.partialResult;
          }
          break;
        }

        case "tool_execution_end": {
          // Update existing tool with final result
          const existing = toolMap.get(event.toolCallId);
          if (existing) {
            existing.result = event.result;
            existing.isError = event.isError;
            existing.state = event.isError
              ? "output-error"
              : "output-available";
          }
          break;
        }

        case "message_update": {
          const msgEvent = event.assistantMessageEvent;
          if (msgEvent?.type === "text_delta" && msgEvent.delta) {
            currentText += msgEvent.delta;
          }
          // Handle reasoning/thinking content from extended thinking models
          if (msgEvent?.type === "reasoning" && msgEvent.text) {
            currentThinking += msgEvent.text;
          }
          // Handle thinking delta format (streaming)
          if (msgEvent?.type === "thinking_delta" && msgEvent.delta) {
            currentThinking += msgEvent.delta;
          }
          break;
        }

        case "thinking_start":
        case "reasoning_start": {
          // Start of a thinking block
          flushText();
          break;
        }

        case "thinking_end":
        case "reasoning_end": {
          // End of a thinking block - flush accumulated thinking
          flushThinking();
          break;
        }

        case "message_end":
        case "agent_end":
          flushThinking();
          flushText();
          break;

        default:
          break;
      }
    } catch {
      // Non-JSON line, treat as plain text
      if (line.trim()) {
        currentText += line + "\n";
      }
    }
  }

  // Flush any remaining thinking and text
  flushThinking();
  flushText();

  // If nothing parsed, show raw output
  if (events.length === 0 && output.trim()) {
    return [{ type: "text", content: output, role: "assistant" }];
  }

  return events;
}

// Extract text from agent output (used by handleAcceptSpec)
export function extractTextFromOutput(output: string): string {
  const lines = output.split("\n");
  let text = "";

  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      // Handle message_update events with text deltas
      if (event.type === "message_update") {
        const msgEvent = event.assistantMessageEvent;
        if (msgEvent?.type === "text_delta" && msgEvent.delta) {
          text += msgEvent.delta;
        }
      }
    } catch {
      // Skip non-JSON lines
    }
  }

  return text.trim();
}
