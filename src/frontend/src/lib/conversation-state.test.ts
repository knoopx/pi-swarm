import { describe, it, expect } from "vitest";
import {
  createConversationState,
  processEvent,
  parseOutputToState,
  getDisplayEvents,
  extractTextFromConversation,
  type ConversationState,
} from "./conversation-state";
import { extractToolResult } from "./shared";

describe("conversation-state", () => {
  describe("createConversationState", () => {
    it("creates empty state", () => {
      const state = createConversationState();
      expect(state.events).toEqual([]);
      expect(state.toolsById.size).toBe(0);
      expect(state.pendingText).toBe("");
      expect(state.pendingThinking).toBe("");
      expect(state.usage).toEqual({
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        totalCost: 0,
      });
    });
  });

  describe("processEvent", () => {
    describe("tool_execution_start", () => {
      it("adds tool event to state", () => {
        const state = createConversationState();
        const event = {
          type: "tool_execution_start",
          toolCallId: "tool-1",
          toolName: "Read",
          args: { path: "/test" },
        };

        const newState = processEvent(state, event);

        expect(newState.events).toHaveLength(1);
        expect(newState.events[0]).toMatchObject({
          type: "tool",
          toolCallId: "tool-1",
          toolName: "Read",
          args: { path: "/test" },
          state: "input-streaming",
        });
        expect(newState.toolsById.get("tool-1")).toBeDefined();
      });

      it("flushes pending text before tool", () => {
        const state: ConversationState = {
          ...createConversationState(),
          pendingText: "Some text",
        };
        const event = {
          type: "tool_execution_start",
          toolCallId: "tool-1",
          toolName: "Read",
          args: {},
        };

        const newState = processEvent(state, event);

        expect(newState.events).toHaveLength(2);
        expect(newState.events[0]).toMatchObject({
          type: "text",
          content: "Some text",
        });
        expect(newState.events[1].type).toBe("tool");
        expect(newState.pendingText).toBe("");
      });
    });

    describe("tool_execution_update", () => {
      it("updates tool with partial result", () => {
        let state = createConversationState();
        state = processEvent(state, {
          type: "tool_execution_start",
          toolCallId: "tool-1",
          toolName: "Read",
          args: {},
        });

        const newState = processEvent(state, {
          type: "tool_execution_update",
          toolCallId: "tool-1",
          partialResult: "partial content",
        });

        const tool = newState.toolsById.get("tool-1");
        expect(tool?.result).toBe("partial content");
        expect(tool?.state).toBe("input-available");
      });
    });

    describe("tool_execution_end", () => {
      it("updates tool with final result", () => {
        let state = createConversationState();
        state = processEvent(state, {
          type: "tool_execution_start",
          toolCallId: "tool-1",
          toolName: "Read",
          args: {},
        });

        const newState = processEvent(state, {
          type: "tool_execution_end",
          toolCallId: "tool-1",
          result: "final content",
          isError: false,
        });

        const tool = newState.toolsById.get("tool-1");
        expect(tool?.result).toBe("final content");
        expect(tool?.state).toBe("output-available");
        expect(tool?.isError).toBe(false);
      });

      it("marks tool as error when isError is true", () => {
        let state = createConversationState();
        state = processEvent(state, {
          type: "tool_execution_start",
          toolCallId: "tool-1",
          toolName: "Read",
          args: {},
        });

        const newState = processEvent(state, {
          type: "tool_execution_end",
          toolCallId: "tool-1",
          result: "error message",
          isError: true,
        });

        const tool = newState.toolsById.get("tool-1");
        expect(tool?.state).toBe("output-error");
        expect(tool?.isError).toBe(true);
      });
    });

    describe("message_update with text_delta", () => {
      it("accumulates text in pendingText", () => {
        const state = createConversationState();

        let newState = processEvent(state, {
          type: "message_update",
          assistantMessageEvent: { type: "text_delta", delta: "Hello " },
        });

        expect(newState.pendingText).toBe("Hello ");

        newState = processEvent(newState, {
          type: "message_update",
          assistantMessageEvent: { type: "text_delta", delta: "world!" },
        });

        expect(newState.pendingText).toBe("Hello world!");
      });
    });

    describe("message_update with thinking_delta", () => {
      it("accumulates thinking in pendingThinking", () => {
        const state = createConversationState();

        let newState = processEvent(state, {
          type: "message_update",
          assistantMessageEvent: { type: "thinking_delta", delta: "I think " },
        });

        expect(newState.pendingThinking).toBe("I think ");

        newState = processEvent(newState, {
          type: "message_update",
          assistantMessageEvent: { type: "thinking_delta", delta: "deeply" },
        });

        expect(newState.pendingThinking).toBe("I think deeply");
      });
    });

    describe("message_end / agent_end", () => {
      it("flushes pending text and thinking", () => {
        const state: ConversationState = {
          ...createConversationState(),
          pendingText: "Final text",
          pendingThinking: "Final thinking",
        };

        const newState = processEvent(state, { type: "message_end" });

        expect(newState.pendingText).toBe("");
        expect(newState.pendingThinking).toBe("");
        expect(newState.events).toHaveLength(2);
        expect(newState.events[0]).toMatchObject({
          type: "thinking",
          content: "Final thinking",
        });
        expect(newState.events[1]).toMatchObject({
          type: "text",
          content: "Final text",
        });
      });

      it("accumulates usage from assistant messages", () => {
        const state = createConversationState();

        const messageWithUsage = {
          type: "message_end",
          message: {
            role: "assistant",
            usage: {
              input: 100,
              output: 50,
              cacheRead: 10,
              cacheWrite: 5,
              totalTokens: 165,
              cost: {
                input: 0.001,
                output: 0.002,
                cacheRead: 0.0001,
                cacheWrite: 0.00005,
                total: 0.00315,
              },
            },
          },
        };

        const newState = processEvent(state, messageWithUsage);

        expect(newState.usage.input).toBe(100);
        expect(newState.usage.output).toBe(50);
        expect(newState.usage.cacheRead).toBe(10);
        expect(newState.usage.cacheWrite).toBe(5);
        expect(newState.usage.totalTokens).toBe(165);
        expect(newState.usage.totalCost).toBeCloseTo(0.00315);
      });

      it("accumulates usage across multiple messages", () => {
        let state = createConversationState();

        state = processEvent(state, {
          type: "message_end",
          message: {
            role: "assistant",
            usage: {
              input: 100,
              output: 50,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 150,
              cost: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                total: 0.01,
              },
            },
          },
        });

        state = processEvent(state, {
          type: "message_end",
          message: {
            role: "assistant",
            usage: {
              input: 200,
              output: 100,
              cacheRead: 0,
              cacheWrite: 0,
              totalTokens: 300,
              cost: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                total: 0.02,
              },
            },
          },
        });

        expect(state.usage.input).toBe(300);
        expect(state.usage.output).toBe(150);
        expect(state.usage.totalTokens).toBe(450);
        expect(state.usage.totalCost).toBeCloseTo(0.03);
      });
    });
  });

  describe("parseOutputToState", () => {
    it("parses empty output", () => {
      const state = parseOutputToState("");
      expect(state.events).toEqual([]);
    });

    it("parses tool events", () => {
      const output = [
        JSON.stringify({
          type: "tool_execution_start",
          toolCallId: "t1",
          toolName: "Read",
          args: { path: "/test" },
        }),
        JSON.stringify({
          type: "tool_execution_end",
          toolCallId: "t1",
          result: "content",
          isError: false,
        }),
      ].join("\n");

      const state = parseOutputToState(output);

      expect(state.events).toHaveLength(1);
      expect(state.events[0]).toMatchObject({
        type: "tool",
        toolName: "Read",
        result: "content",
        state: "output-available",
      });
    });

    it("parses text events", () => {
      const output = [
        JSON.stringify({
          type: "message_update",
          assistantMessageEvent: { type: "text_delta", delta: "Hello " },
        }),
        JSON.stringify({
          type: "message_update",
          assistantMessageEvent: { type: "text_delta", delta: "world!" },
        }),
        JSON.stringify({ type: "message_end" }),
      ].join("\n");

      const state = parseOutputToState(output);

      expect(state.events).toHaveLength(1);
      expect(state.events[0]).toMatchObject({
        type: "text",
        content: "Hello world!",
        role: "assistant",
      });
    });

    it("parses mixed events in correct order", () => {
      const output = [
        JSON.stringify({
          type: "message_update",
          assistantMessageEvent: { type: "text_delta", delta: "I will read" },
        }),
        JSON.stringify({
          type: "tool_execution_start",
          toolCallId: "t1",
          toolName: "Read",
          args: {},
        }),
        JSON.stringify({
          type: "tool_execution_end",
          toolCallId: "t1",
          result: "content",
          isError: false,
        }),
        JSON.stringify({
          type: "message_update",
          assistantMessageEvent: { type: "text_delta", delta: "Done!" },
        }),
        JSON.stringify({ type: "agent_end" }),
      ].join("\n");

      const state = parseOutputToState(output);

      expect(state.events).toHaveLength(3);
      expect(state.events[0].type).toBe("text");
      expect(state.events[1].type).toBe("tool");
      expect(state.events[2].type).toBe("text");
    });
  });

  describe("getDisplayEvents", () => {
    it("includes pending text in display", () => {
      const state: ConversationState = {
        events: [{ type: "text", content: "Hello", role: "assistant" }],
        toolsById: new Map(),
        pendingText: "streaming...",
        pendingThinking: "",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          totalCost: 0,
        },
      };

      const events = getDisplayEvents(state);

      expect(events).toHaveLength(2);
      expect(events[1]).toMatchObject({
        type: "text",
        content: "streaming...",
      });
    });

    it("includes pending thinking in display", () => {
      const state: ConversationState = {
        events: [],
        toolsById: new Map(),
        pendingText: "",
        pendingThinking: "thinking...",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          totalCost: 0,
        },
      };

      const events = getDisplayEvents(state);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "thinking",
        content: "thinking...",
      });
    });
  });

  describe("extractTextFromConversation", () => {
    it("extracts text from events", () => {
      const state: ConversationState = {
        events: [
          { type: "text", content: "Hello", role: "assistant" },
          {
            type: "tool",
            toolCallId: "t1",
            toolName: "Read",
            args: {},
            state: "output-available",
          },
          { type: "text", content: "World", role: "assistant" },
        ],
        toolsById: new Map(),
        pendingText: "",
        pendingThinking: "",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          totalCost: 0,
        },
      };

      const text = extractTextFromConversation(state);
      expect(text).toBe("Hello\nWorld");
    });

    it("includes pending text", () => {
      const state: ConversationState = {
        events: [{ type: "text", content: "Hello", role: "assistant" }],
        toolsById: new Map(),
        pendingText: " streaming",
        pendingThinking: "",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          totalCost: 0,
        },
      };

      const text = extractTextFromConversation(state);
      expect(text).toBe("Hello\nstreaming");
    });
  });

  describe("extractToolResult", () => {
    it("extracts text from content array", () => {
      const result = {
        content: [
          { type: "text", text: "Hello" },
          { type: "text", text: "World" },
        ],
      };

      expect(extractToolResult(result)).toBe("Hello\nWorld");
    });

    it("extracts string content", () => {
      const result = { content: "plain text" };
      expect(extractToolResult(result)).toBe("plain text");
    });

    it("returns string as-is", () => {
      expect(extractToolResult("raw string")).toBe("raw string");
    });

    it("stringifies unknown objects", () => {
      const result = { foo: "bar" };
      expect(extractToolResult(result)).toBe(JSON.stringify(result, null, 2));
    });

    it("handles null/undefined", () => {
      expect(extractToolResult(null)).toBe("");
      expect(extractToolResult(undefined)).toBe("");
    });
  });
});
