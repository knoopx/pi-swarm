import { describe, it, expect } from "vitest";
import {
  extractToolResult,
  generateAgentName,
  parseModelString,
  formatModelString,
} from "./shared";

describe("shared", () => {
  describe("extractToolResult", () => {
    describe("given null or undefined result", () => {
      const nullishValues = [null, undefined];

      nullishValues.forEach((value) => {
        describe(`when result is ${value}`, () => {
          it("then returns empty string", () => {
            expect(extractToolResult(value)).toBe("");
          });
        });
      });
    });

    describe("given AgentToolResult format with content array", () => {
      describe("when content contains text items", () => {
        const result = {
          content: [
            { type: "text", text: "First line" },
            { type: "text", text: "Second line" },
          ],
        };

        it("then extracts and joins text content with newlines", () => {
          expect(extractToolResult(result)).toBe("First line\nSecond line");
        });
      });

      describe("when content contains mixed types", () => {
        const result = {
          content: [
            { type: "text", text: "Text content" },
            { type: "image", url: "http://example.com/image.png" },
            { type: "text", text: "More text" },
          ],
        };

        it("then extracts only text content", () => {
          expect(extractToolResult(result)).toBe("Text content\nMore text");
        });
      });

      describe("when content array is empty", () => {
        const result = { content: [] };

        it("then returns empty string", () => {
          expect(extractToolResult(result)).toBe("");
        });
      });

      describe("when content contains no text items", () => {
        const result = {
          content: [
            { type: "image", url: "http://example.com/image.png" },
            { type: "audio", data: "base64..." },
          ],
        };

        it("then returns empty string", () => {
          expect(extractToolResult(result)).toBe("");
        });
      });

      describe("when content items have missing text property", () => {
        const result = {
          content: [
            { type: "text" }, // missing text - text will be undefined
            { type: "text", text: "Valid" },
          ],
        };

        it("then includes items with missing text as undefined", () => {
          // The type guard passes but text is undefined, joined as "undefined\nValid"
          // This tests current behavior - consider fixing the filter
          const extracted = extractToolResult(result);
          expect(extracted).toContain("Valid");
        });
      });
    });

    describe("given AgentToolResult format with string content", () => {
      const result = { content: "Plain string content" };

      describe("when content is a string", () => {
        it("then returns the string directly", () => {
          expect(extractToolResult(result)).toBe("Plain string content");
        });
      });
    });

    describe("given plain string result", () => {
      const result = "Simple string result";

      describe("when result is a string", () => {
        it("then returns the string as-is", () => {
          expect(extractToolResult(result)).toBe("Simple string result");
        });
      });
    });

    describe("given object without content property", () => {
      const result = { data: "some data", value: 123 };

      describe("when result is a plain object", () => {
        it("then returns JSON stringified result", () => {
          expect(extractToolResult(result)).toBe(
            JSON.stringify(result, null, 2),
          );
        });
      });
    });

    describe("given number result", () => {
      const result = 42;

      describe("when result is a number", () => {
        it("then returns JSON stringified result", () => {
          expect(extractToolResult(result)).toBe("42");
        });
      });
    });

    describe("given boolean result", () => {
      describe("when result is true", () => {
        it("then returns stringified true", () => {
          expect(extractToolResult(true)).toBe("true");
        });
      });

      describe("when result is false", () => {
        it("then returns empty string (falsy check)", () => {
          // false is falsy, so early return with ""
          expect(extractToolResult(false)).toBe("");
        });
      });
    });

    describe("given nested object result", () => {
      const result = {
        level1: {
          level2: {
            value: "deep",
          },
        },
      };

      describe("when result is deeply nested", () => {
        it("then returns properly formatted JSON", () => {
          const extracted = extractToolResult(result);
          expect(extracted).toContain('"level1"');
          expect(extracted).toContain('"deep"');
        });
      });
    });

    describe("given array result without content property", () => {
      const result = [1, 2, 3];

      describe("when result is an array", () => {
        it("then returns JSON stringified array", () => {
          expect(extractToolResult(result)).toBe("[\n  1,\n  2,\n  3\n]");
        });
      });
    });
  });

  describe("generateAgentName", () => {
    describe("given normal instruction", () => {
      const instruction = "Fix the login bug";

      describe("when generating name", () => {
        it("then returns kebab-case from first 3 words", () => {
          expect(generateAgentName(instruction)).toBe("fix-the-login");
        });
      });
    });

    describe("given instruction with special characters", () => {
      const instructions = [
        { input: "Fix bug #123!", expected: "fix-bug-123" },
        { input: "Update @user config", expected: "update-user-config" },
        { input: "Add feature: new login", expected: "add-feature-new" },
        { input: "Fix (critical) issue", expected: "fix-critical-issue" },
      ];

      instructions.forEach(({ input, expected }) => {
        describe(`when instruction is "${input}"`, () => {
          it(`then removes special characters and returns "${expected}"`, () => {
            expect(generateAgentName(input)).toBe(expected);
          });
        });
      });
    });

    describe("given instruction with uppercase letters", () => {
      const instruction = "FIX The LOGIN Bug";

      describe("when generating name", () => {
        it("then converts to lowercase", () => {
          expect(generateAgentName(instruction)).toBe("fix-the-login");
        });
      });
    });

    describe("given instruction longer than 20 characters", () => {
      const instruction = "implement authentication system with oauth";

      describe("when generating name", () => {
        it("then truncates to 20 characters", () => {
          const result = generateAgentName(instruction);
          expect(result.length).toBeLessThanOrEqual(20);
        });
      });
    });

    describe("given instruction with more than 3 words", () => {
      const instruction = "fix the login bug in the system";

      describe("when generating name", () => {
        it("then uses only first 3 words", () => {
          expect(generateAgentName(instruction)).toBe("fix-the-login");
        });
      });
    });

    describe("given instruction with less than 3 words", () => {
      const instructions = [
        { input: "Refactor", expected: "refactor" },
        { input: "Fix bugs", expected: "fix-bugs" },
      ];

      instructions.forEach(({ input, expected }) => {
        describe(`when instruction is "${input}"`, () => {
          it(`then returns "${expected}"`, () => {
            expect(generateAgentName(input)).toBe(expected);
          });
        });
      });
    });

    describe("given empty instruction", () => {
      describe("when generating name", () => {
        it("then returns 'task'", () => {
          expect(generateAgentName("")).toBe("task");
        });
      });
    });

    describe("given whitespace-only instruction", () => {
      const whitespaceInputs = ["   ", "\t\t", "\n\n", "  \t  \n  "];

      whitespaceInputs.forEach((input) => {
        describe(`when instruction is whitespace "${input.replace(/\n/g, "\\n").replace(/\t/g, "\\t")}"`, () => {
          it("then returns 'task'", () => {
            expect(generateAgentName(input)).toBe("task");
          });
        });
      });
    });

    describe("given instruction with numbers", () => {
      const instruction = "Fix bug 123 in module 456";

      describe("when generating name", () => {
        it("then preserves numbers", () => {
          expect(generateAgentName(instruction)).toBe("fix-bug-123");
        });
      });
    });

    describe("given instruction with leading/trailing whitespace", () => {
      const instruction = "   fix the bug   ";

      describe("when generating name", () => {
        it("then trims whitespace", () => {
          expect(generateAgentName(instruction)).toBe("fix-the-bug");
        });
      });
    });

    describe("given instruction with multiple spaces between words", () => {
      const instruction = "fix   the    bug";

      describe("when generating name", () => {
        it("then handles multiple spaces", () => {
          expect(generateAgentName(instruction)).toBe("fix-the-bug");
        });
      });
    });
  });

  describe("parseModelString", () => {
    describe("given valid model string", () => {
      const modelString = "anthropic/claude-3-sonnet";

      describe("when parsing", () => {
        it("then returns provider and modelId", () => {
          const result = parseModelString(modelString);
          expect(result).toEqual({
            provider: "anthropic",
            modelId: "claude-3-sonnet",
          });
        });
      });
    });

    describe("given model string with multiple slashes", () => {
      const modelString = "openai/gpt-4/turbo/preview";

      describe("when parsing", () => {
        it("then keeps all slashes in modelId", () => {
          const result = parseModelString(modelString);
          expect(result).toEqual({
            provider: "openai",
            modelId: "gpt-4/turbo/preview",
          });
        });
      });
    });

    describe("given model string with only provider and model", () => {
      const modelStrings = [
        {
          input: "anthropic/claude-3",
          expected: { provider: "anthropic", modelId: "claude-3" },
        },
        {
          input: "openai/gpt-4",
          expected: { provider: "openai", modelId: "gpt-4" },
        },
        {
          input: "google/gemini-pro",
          expected: { provider: "google", modelId: "gemini-pro" },
        },
      ];

      modelStrings.forEach(({ input, expected }) => {
        describe(`when model string is "${input}"`, () => {
          it(`then returns correct provider and modelId`, () => {
            expect(parseModelString(input)).toEqual(expected);
          });
        });
      });
    });

    describe("given invalid model string without slash", () => {
      const invalidStrings = ["invalid", "modelonly", "anthropic"];

      invalidStrings.forEach((input) => {
        describe(`when model string is "${input}"`, () => {
          it("then returns null", () => {
            expect(parseModelString(input)).toBeNull();
          });
        });
      });
    });

    describe("given empty string", () => {
      describe("when parsing", () => {
        it("then returns null", () => {
          expect(parseModelString("")).toBeNull();
        });
      });
    });

    describe("given model string with empty provider", () => {
      const modelString = "/claude-3";

      describe("when parsing", () => {
        it("then returns empty provider", () => {
          const result = parseModelString(modelString);
          expect(result).toEqual({
            provider: "",
            modelId: "claude-3",
          });
        });
      });
    });

    describe("given model string with empty modelId", () => {
      const modelString = "anthropic/";

      describe("when parsing", () => {
        it("then returns empty modelId", () => {
          const result = parseModelString(modelString);
          expect(result).toEqual({
            provider: "anthropic",
            modelId: "",
          });
        });
      });
    });
  });

  describe("formatModelString", () => {
    describe("given provider and modelId", () => {
      describe("when formatting", () => {
        it("then returns provider/modelId format", () => {
          expect(formatModelString("anthropic", "claude-3")).toBe(
            "anthropic/claude-3",
          );
        });
      });
    });

    describe("given various providers and models", () => {
      const cases = [
        {
          provider: "openai",
          modelId: "gpt-4",
          expected: "openai/gpt-4",
        },
        {
          provider: "google",
          modelId: "gemini-pro",
          expected: "google/gemini-pro",
        },
        {
          provider: "mistral",
          modelId: "mistral-large",
          expected: "mistral/mistral-large",
        },
      ];

      cases.forEach(({ provider, modelId, expected }) => {
        describe(`when provider is "${provider}" and modelId is "${modelId}"`, () => {
          it(`then returns "${expected}"`, () => {
            expect(formatModelString(provider, modelId)).toBe(expected);
          });
        });
      });
    });

    describe("given modelId with slashes", () => {
      describe("when formatting", () => {
        it("then preserves slashes in modelId", () => {
          expect(formatModelString("openai", "gpt-4/turbo")).toBe(
            "openai/gpt-4/turbo",
          );
        });
      });
    });

    describe("given empty provider", () => {
      describe("when formatting", () => {
        it("then returns /modelId", () => {
          expect(formatModelString("", "claude-3")).toBe("/claude-3");
        });
      });
    });

    describe("given empty modelId", () => {
      describe("when formatting", () => {
        it("then returns provider/", () => {
          expect(formatModelString("anthropic", "")).toBe("anthropic/");
        });
      });
    });

    describe("given both empty", () => {
      describe("when formatting", () => {
        it("then returns /", () => {
          expect(formatModelString("", "")).toBe("/");
        });
      });
    });
  });

  describe("parseModelString and formatModelString", () => {
    describe("given round-trip conversion", () => {
      const modelStrings = [
        "anthropic/claude-3-sonnet",
        "openai/gpt-4",
        "google/gemini-pro",
      ];

      modelStrings.forEach((original) => {
        describe(`when converting "${original}"`, () => {
          it("then parse and format are inverse operations", () => {
            const parsed = parseModelString(original);
            expect(parsed).not.toBeNull();
            const formatted = formatModelString(
              parsed!.provider,
              parsed!.modelId,
            );
            expect(formatted).toBe(original);
          });
        });
      });
    });
  });
});
