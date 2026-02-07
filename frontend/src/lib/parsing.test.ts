import { describe, it, expect } from "vitest";
import {
  parseOutput,
  extractToolResult,
  extractTextFromOutput,
  isProcessingMessage,
  type ToolExecutionEvent,
  type TextEvent,
} from "./parsing";

describe("parsing", () => {
  describe("isProcessingMessage", () => {
    describe("given processing status messages", () => {
      const processingMessages = [
        "",
        "⏳ Processing...",
        "⏳ Waiting...",
        "⏳ Starting...",
      ];

      processingMessages.forEach((msg) => {
        it(`then returns true for "${msg || "(empty)"}"`, () => {
          expect(isProcessingMessage(msg)).toBe(true);
        });
      });
    });

    describe("given regular output", () => {
      it("then returns false", () => {
        expect(isProcessingMessage("some output")).toBe(false);
        expect(isProcessingMessage('{"type":"test"}')).toBe(false);
      });
    });
  });

  describe("parseOutput", () => {
    describe("given empty output", () => {
      it("then returns processing event", () => {
        const result = parseOutput("");
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe("processing");
        expect((result[0] as { content: string }).content).toBe("Waiting...");
      });
    });

    describe("given processing status message", () => {
      it("then returns processing event with that message", () => {
        const result = parseOutput("⏳ Processing...");
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe("processing");
        expect((result[0] as { content: string }).content).toBe(
          "⏳ Processing...",
        );
      });
    });

    describe("given tool_execution_start event", () => {
      const output = JSON.stringify({
        type: "tool_execution_start",
        toolCallId: "call-1",
        toolName: "Read",
        args: { path: "/test.txt" },
      });

      it("then returns tool event with input-available state", () => {
        const result = parseOutput(output);
        expect(result).toHaveLength(1);

        const event = result[0] as ToolExecutionEvent;
        expect(event.type).toBe("tool");
        expect(event.toolCallId).toBe("call-1");
        expect(event.toolName).toBe("Read");
        expect(event.args).toEqual({ path: "/test.txt" });
        expect(event.state).toBe("input-available");
      });
    });

    describe("given tool_execution_start followed by tool_execution_end", () => {
      const output = [
        JSON.stringify({
          type: "tool_execution_start",
          toolCallId: "call-1",
          toolName: "Read",
          args: { path: "/test.txt" },
        }),
        JSON.stringify({
          type: "tool_execution_end",
          toolCallId: "call-1",
          result: "file contents",
          isError: false,
        }),
      ].join("\n");

      it("then updates tool event with result and output-available state", () => {
        const result = parseOutput(output);
        expect(result).toHaveLength(1);

        const event = result[0] as ToolExecutionEvent;
        expect(event.result).toBe("file contents");
        expect(event.isError).toBe(false);
        expect(event.state).toBe("output-available");
      });
    });

    describe("given tool_execution_end with error", () => {
      const output = [
        JSON.stringify({
          type: "tool_execution_start",
          toolCallId: "call-1",
          toolName: "Read",
          args: { path: "/missing.txt" },
        }),
        JSON.stringify({
          type: "tool_execution_end",
          toolCallId: "call-1",
          result: "File not found",
          isError: true,
        }),
      ].join("\n");

      it("then sets output-error state", () => {
        const result = parseOutput(output);
        const event = result[0] as ToolExecutionEvent;
        expect(event.isError).toBe(true);
        expect(event.state).toBe("output-error");
      });
    });

    describe("given message_update events with text_delta", () => {
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

      it("then accumulates text into a single text event", () => {
        const result = parseOutput(output);
        expect(result).toHaveLength(1);

        const event = result[0] as TextEvent;
        expect(event.type).toBe("text");
        expect(event.content).toBe("Hello world!");
        expect(event.role).toBe("assistant");
      });
    });

    describe("given mixed tool and text events", () => {
      const output = [
        JSON.stringify({
          type: "message_update",
          assistantMessageEvent: {
            type: "text_delta",
            delta: "Let me read that file.",
          },
        }),
        JSON.stringify({ type: "message_end" }),
        JSON.stringify({
          type: "tool_execution_start",
          toolCallId: "call-1",
          toolName: "Read",
          args: { path: "/test.txt" },
        }),
        JSON.stringify({
          type: "tool_execution_end",
          toolCallId: "call-1",
          result: "contents",
          isError: false,
        }),
        JSON.stringify({
          type: "message_update",
          assistantMessageEvent: {
            type: "text_delta",
            delta: "Here are the contents.",
          },
        }),
        JSON.stringify({ type: "agent_end" }),
      ].join("\n");

      it("then returns events in correct order", () => {
        const result = parseOutput(output);
        expect(result).toHaveLength(3);

        expect(result[0].type).toBe("text");
        expect((result[0] as TextEvent).content).toBe("Let me read that file.");

        expect(result[1].type).toBe("tool");
        expect((result[1] as ToolExecutionEvent).toolName).toBe("Read");

        expect(result[2].type).toBe("text");
        expect((result[2] as TextEvent).content).toBe("Here are the contents.");
      });
    });

    describe("given non-JSON lines", () => {
      const output = "plain text line 1\nplain text line 2";

      it("then treats them as text content", () => {
        const result = parseOutput(output);
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe("text");
        expect((result[0] as TextEvent).content).toContain("plain text line 1");
        expect((result[0] as TextEvent).content).toContain("plain text line 2");
      });
    });

    describe("given tool_execution_update event", () => {
      const output = [
        JSON.stringify({
          type: "tool_execution_start",
          toolCallId: "call-1",
          toolName: "Bash",
          args: { command: "ls" },
        }),
        JSON.stringify({
          type: "tool_execution_update",
          toolCallId: "call-1",
          partialResult: "file1.txt",
        }),
        JSON.stringify({
          type: "tool_execution_end",
          toolCallId: "call-1",
          result: "file1.txt\nfile2.txt",
          isError: false,
        }),
      ].join("\n");

      it("then updates result during streaming", () => {
        const result = parseOutput(output);
        expect(result).toHaveLength(1);

        const event = result[0] as ToolExecutionEvent;
        // Final result should be from tool_execution_end
        expect(event.result).toBe("file1.txt\nfile2.txt");
      });
    });

    describe("given multiple tools in sequence", () => {
      const output = [
        JSON.stringify({
          type: "tool_execution_start",
          toolCallId: "call-1",
          toolName: "Read",
          args: { path: "/a.txt" },
        }),
        JSON.stringify({
          type: "tool_execution_end",
          toolCallId: "call-1",
          result: "A",
          isError: false,
        }),
        JSON.stringify({
          type: "tool_execution_start",
          toolCallId: "call-2",
          toolName: "Read",
          args: { path: "/b.txt" },
        }),
        JSON.stringify({
          type: "tool_execution_end",
          toolCallId: "call-2",
          result: "B",
          isError: false,
        }),
      ].join("\n");

      it("then creates separate tool events", () => {
        const result = parseOutput(output);
        expect(result).toHaveLength(2);

        expect((result[0] as ToolExecutionEvent).toolCallId).toBe("call-1");
        expect((result[0] as ToolExecutionEvent).result).toBe("A");

        expect((result[1] as ToolExecutionEvent).toolCallId).toBe("call-2");
        expect((result[1] as ToolExecutionEvent).result).toBe("B");
      });
    });

    describe("given empty args in tool_execution_start", () => {
      const output = JSON.stringify({
        type: "tool_execution_start",
        toolCallId: "call-1",
        toolName: "Test",
        // args is missing
      });

      it("then defaults args to empty object", () => {
        const result = parseOutput(output);
        const event = result[0] as ToolExecutionEvent;
        expect(event.args).toEqual({});
      });
    });
  });

  describe("extractToolResult", () => {
    describe("given null/undefined", () => {
      it("then returns empty string", () => {
        expect(extractToolResult(null)).toBe("");
        expect(extractToolResult(undefined)).toBe("");
      });
    });

    describe("given string result", () => {
      it("then returns the string as-is", () => {
        expect(extractToolResult("simple result")).toBe("simple result");
      });
    });

    describe("given AgentToolResult format with content array", () => {
      const result = {
        content: [
          { type: "text", text: "Line 1" },
          { type: "text", text: "Line 2" },
        ],
      };

      it("then extracts and joins text content", () => {
        expect(extractToolResult(result)).toBe("Line 1\nLine 2");
      });
    });

    describe("given AgentToolResult with mixed content types", () => {
      const result = {
        content: [
          { type: "text", text: "Text content" },
          { type: "image", data: "..." },
          { type: "text", text: "More text" },
        ],
      };

      it("then extracts only text content", () => {
        expect(extractToolResult(result)).toBe("Text content\nMore text");
      });
    });

    describe("given AgentToolResult with string content", () => {
      const result = {
        content: "string content",
      };

      it("then returns the string content", () => {
        expect(extractToolResult(result)).toBe("string content");
      });
    });

    describe("given object without content property", () => {
      const result = { data: "some data", value: 123 };

      it("then returns JSON stringified result", () => {
        const output = extractToolResult(result);
        expect(output).toContain('"data"');
        expect(output).toContain('"some data"');
        expect(output).toContain('"value"');
        expect(output).toContain("123");
      });
    });

    describe("given empty content array", () => {
      const result = { content: [] };

      it("then returns empty string", () => {
        expect(extractToolResult(result)).toBe("");
      });
    });
  });

  describe("extractTextFromOutput", () => {
    describe("given output with message_update events", () => {
      const output = [
        JSON.stringify({
          type: "message_update",
          assistantMessageEvent: { type: "text_delta", delta: "Hello " },
        }),
        JSON.stringify({
          type: "message_update",
          assistantMessageEvent: { type: "text_delta", delta: "world!" },
        }),
      ].join("\n");

      it("then extracts and concatenates text deltas", () => {
        expect(extractTextFromOutput(output)).toBe("Hello world!");
      });
    });

    describe("given output with non-text events", () => {
      const output = [
        JSON.stringify({ type: "tool_execution_start", toolName: "Read" }),
        JSON.stringify({
          type: "message_update",
          assistantMessageEvent: { type: "text_delta", delta: "Result: OK" },
        }),
        JSON.stringify({ type: "tool_execution_end" }),
      ].join("\n");

      it("then extracts only text from message_update events", () => {
        expect(extractTextFromOutput(output)).toBe("Result: OK");
      });
    });

    describe("given output with no text events", () => {
      const output = [
        JSON.stringify({ type: "tool_execution_start" }),
        JSON.stringify({ type: "tool_execution_end" }),
      ].join("\n");

      it("then returns empty string", () => {
        expect(extractTextFromOutput(output)).toBe("");
      });
    });

    describe("given empty output", () => {
      it("then returns empty string", () => {
        expect(extractTextFromOutput("")).toBe("");
      });
    });

    describe("given message_update without text_delta", () => {
      const output = JSON.stringify({
        type: "message_update",
        assistantMessageEvent: { type: "thinking", content: "..." },
      });

      it("then ignores non-text_delta events", () => {
        expect(extractTextFromOutput(output)).toBe("");
      });
    });
  });
});
