import { describe, it, expect } from "bun:test";
import {
  generateId,
  nowTs,
  serializeAgent,
  createAgentData,
  formatModelName,
  parseModelString,
  mapModelsToInfo,
  findPreferredModel,
  parseOutputLines,
  appendOutput,
  isValidAgentStatus,
  canAgentReceiveInstruction,
  canAgentBeStarted,
  canAgentBeStopped,
  canAgentBeMerged,
  transitionToRunning,
  transitionToStopped,
  transitionToWaiting,
  transitionToError,
  buildWorkspacePath,
  generateNameFromInstruction,
  type Agent,
} from "./core";

// Test fixtures
function createTestAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "test-id",
    name: "test-agent",
    status: "pending",
    instruction: "test instruction",
    workspace: "/test/workspace",
    basePath: "/test",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    output: "",
    modifiedFiles: [],
    diffStat: "",
    model: "test-model",
    provider: "test-provider",
    ...overrides,
  };
}

describe("Core", () => {
  describe("generateId", () => {
    describe("when called", () => {
      it("then returns a string", () => {
        const id = generateId();
        expect(typeof id).toBe("string");
      });

      it("then returns an 8-character string", () => {
        const id = generateId();
        expect(id.length).toBe(8);
      });

      it("then returns unique values on subsequent calls", () => {
        const ids = new Set(Array.from({ length: 100 }, () => generateId()));
        expect(ids.size).toBe(100);
      });

      it("then returns alphanumeric characters only", () => {
        const id = generateId();
        expect(id).toMatch(/^[a-z0-9]+$/);
      });
    });
  });

  describe("nowTs", () => {
    describe("when called", () => {
      it("then returns an ISO 8601 timestamp", () => {
        const ts = nowTs();
        expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
      });

      it("then returns a valid date", () => {
        const ts = nowTs();
        const date = new Date(ts);
        expect(date.toString()).not.toBe("Invalid Date");
      });
    });
  });

  describe("serializeAgent", () => {
    describe("given an agent with a session", () => {
      const agent = createTestAgent({ session: { some: "data" } });

      describe("when serializing", () => {
        it("then removes the session property", () => {
          const serialized = serializeAgent(agent);
          expect("session" in serialized).toBe(false);
        });

        it("then preserves all other properties", () => {
          const serialized = serializeAgent(agent);
          expect(serialized.id).toBe(agent.id);
          expect(serialized.name).toBe(agent.name);
          expect(serialized.status).toBe(agent.status);
          expect(serialized.instruction).toBe(agent.instruction);
        });
      });
    });

    describe("given an agent without a session", () => {
      const agent = createTestAgent();

      describe("when serializing", () => {
        it("then returns agent data without session", () => {
          const serialized = serializeAgent(agent);
          expect("session" in serialized).toBe(false);
          expect(serialized.id).toBe(agent.id);
        });
      });
    });
  });

  describe("createAgentData", () => {
    describe("given valid parameters", () => {
      describe("when creating agent data", () => {
        it("then returns an agent with correct properties", () => {
          const agent = createAgentData(
            "abc123",
            "my-agent",
            "do something",
            "/workspace/abc123",
            "/workspace",
            "anthropic",
            "claude-3",
          );

          expect(agent.id).toBe("abc123");
          expect(agent.name).toBe("my-agent");
          expect(agent.instruction).toBe("do something");
          expect(agent.workspace).toBe("/workspace/abc123");
          expect(agent.basePath).toBe("/workspace");
          expect(agent.provider).toBe("anthropic");
          expect(agent.model).toBe("claude-3");
        });

        it("then sets status to pending", () => {
          const agent = createAgentData(
            "id",
            "name",
            "instruction",
            "/ws",
            "/base",
            "provider",
            "model",
          );
          expect(agent.status).toBe("pending");
        });

        it("then initializes output as empty string", () => {
          const agent = createAgentData(
            "id",
            "name",
            "instruction",
            "/ws",
            "/base",
            "provider",
            "model",
          );
          expect(agent.output).toBe("");
        });

        it("then sets timestamps", () => {
          const agent = createAgentData(
            "id",
            "name",
            "instruction",
            "/ws",
            "/base",
            "provider",
            "model",
          );
          expect(agent.createdAt).toBeTruthy();
          expect(agent.updatedAt).toBeTruthy();
          expect(agent.createdAt).toBe(agent.updatedAt);
        });
      });
    });

    describe("given empty name", () => {
      describe("when creating agent data", () => {
        it("then defaults to 'unnamed'", () => {
          const agent = createAgentData(
            "id",
            "",
            "instruction",
            "/ws",
            "/base",
            "provider",
            "model",
          );
          expect(agent.name).toBe("unnamed");
        });
      });
    });

    describe("given empty instruction", () => {
      describe("when creating agent data", () => {
        it("then sets instruction to empty string", () => {
          const agent = createAgentData(
            "id",
            "name",
            "",
            "/ws",
            "/base",
            "provider",
            "model",
          );
          expect(agent.instruction).toBe("");
        });
      });
    });
  });

  describe("formatModelName", () => {
    describe("given provider and modelId", () => {
      describe("when formatting", () => {
        it("then returns provider/modelId format", () => {
          expect(formatModelName("anthropic", "claude-3")).toBe(
            "anthropic/claude-3",
          );
        });
      });
    });

    describe("given modelId with slashes", () => {
      describe("when formatting", () => {
        it("then preserves slashes in modelId", () => {
          expect(formatModelName("openai", "gpt-4/turbo")).toBe(
            "openai/gpt-4/turbo",
          );
        });
      });
    });
  });

  describe("parseModelString", () => {
    describe("given valid model string", () => {
      describe("when parsing", () => {
        it("then extracts provider and modelId", () => {
          const result = parseModelString("anthropic/claude-3");
          expect(result).toEqual({
            provider: "anthropic",
            modelId: "claude-3",
          });
        });
      });
    });

    describe("given model string with multiple slashes", () => {
      describe("when parsing", () => {
        it("then keeps slashes in modelId", () => {
          const result = parseModelString("openai/gpt-4/turbo/preview");
          expect(result).toEqual({
            provider: "openai",
            modelId: "gpt-4/turbo/preview",
          });
        });
      });
    });

    describe("given invalid model string without slash", () => {
      describe("when parsing", () => {
        it("then returns null", () => {
          const result = parseModelString("invalid");
          expect(result).toBeNull();
        });
      });
    });

    describe("given empty string", () => {
      describe("when parsing", () => {
        it("then returns null", () => {
          const result = parseModelString("");
          expect(result).toBeNull();
        });
      });
    });
  });

  describe("mapModelsToInfo", () => {
    describe("given array of models", () => {
      const models = [
        { provider: "anthropic", id: "claude-3" },
        { provider: "openai", id: "gpt-4" },
      ];

      describe("when mapping", () => {
        it("then returns ModelInfo array", () => {
          const result = mapModelsToInfo(models);
          expect(result).toEqual([
            {
              provider: "anthropic",
              modelId: "claude-3",
              name: "anthropic/claude-3",
            },
            { provider: "openai", modelId: "gpt-4", name: "openai/gpt-4" },
          ]);
        });
      });
    });

    describe("given empty array", () => {
      describe("when mapping", () => {
        it("then returns empty array", () => {
          const result = mapModelsToInfo([]);
          expect(result).toEqual([]);
        });
      });
    });
  });

  describe("findPreferredModel", () => {
    const models = [
      { id: "model-a", name: "A" },
      { id: "model-b", name: "B" },
      { id: "model-c", name: "C" },
    ];

    describe("given preferred model exists", () => {
      describe("when finding", () => {
        it("then returns the preferred model", () => {
          const result = findPreferredModel(models, "model-b");
          expect(result).toEqual({ id: "model-b", name: "B" });
        });
      });
    });

    describe("given preferred model does not exist", () => {
      describe("when finding", () => {
        it("then returns undefined", () => {
          const result = findPreferredModel(models, "nonexistent");
          expect(result).toBeUndefined();
        });
      });
    });

    describe("given empty models array", () => {
      describe("when finding", () => {
        it("then returns undefined", () => {
          const result = findPreferredModel([], "any");
          expect(result).toBeUndefined();
        });
      });
    });
  });

  describe("parseOutputLines", () => {
    describe("given multiline output", () => {
      describe("when parsing", () => {
        it("then returns array of non-empty lines", () => {
          const output = "line1\nline2\nline3";
          expect(parseOutputLines(output)).toEqual(["line1", "line2", "line3"]);
        });
      });
    });

    describe("given output with empty lines", () => {
      describe("when parsing", () => {
        it("then filters out empty lines", () => {
          const output = "line1\n\nline2\n\n\nline3\n";
          expect(parseOutputLines(output)).toEqual(["line1", "line2", "line3"]);
        });
      });
    });

    describe("given empty output", () => {
      describe("when parsing", () => {
        it("then returns empty array", () => {
          expect(parseOutputLines("")).toEqual([]);
        });
      });
    });
  });

  describe("appendOutput", () => {
    describe("given current output and event", () => {
      describe("when appending", () => {
        it("then returns output with JSON-stringified event and newline", () => {
          const current = "existing\n";
          const event = { type: "test", data: 123 };
          const result = appendOutput(current, event);
          expect(result).toBe('existing\n{"type":"test","data":123}\n');
        });
      });
    });

    describe("given empty current output", () => {
      describe("when appending", () => {
        it("then returns just the event line", () => {
          const result = appendOutput("", { type: "start" });
          expect(result).toBe('{"type":"start"}\n');
        });
      });
    });
  });

  describe("isValidAgentStatus", () => {
    const validStatuses = [
      "pending",
      "running",
      "completed",
      "waiting",
      "stopped",
      "error",
    ];

    validStatuses.forEach((status) => {
      describe(`given "${status}"`, () => {
        it("then returns true", () => {
          expect(isValidAgentStatus(status)).toBe(true);
        });
      });
    });

    describe("given invalid status", () => {
      it("then returns false", () => {
        expect(isValidAgentStatus("invalid")).toBe(false);
        expect(isValidAgentStatus("")).toBe(false);
        expect(isValidAgentStatus("PENDING")).toBe(false);
      });
    });
  });

  describe("canAgentReceiveInstruction", () => {
    const allowedStatuses: Agent["status"][] = ["running", "waiting"];
    const disallowedStatuses: Agent["status"][] = [
      "pending",
      "completed",
      "stopped",
      "error",
    ];

    allowedStatuses.forEach((status) => {
      describe(`given agent with status "${status}"`, () => {
        it("then returns true", () => {
          const agent = createTestAgent({ status });
          expect(canAgentReceiveInstruction(agent)).toBe(true);
        });
      });
    });

    disallowedStatuses.forEach((status) => {
      describe(`given agent with status "${status}"`, () => {
        it("then returns false", () => {
          const agent = createTestAgent({ status });
          expect(canAgentReceiveInstruction(agent)).toBe(false);
        });
      });
    });
  });

  describe("canAgentBeStarted", () => {
    const allowedStatuses: Agent["status"][] = ["pending", "stopped"];
    const disallowedStatuses: Agent["status"][] = [
      "running",
      "completed",
      "waiting",
      "error",
    ];

    allowedStatuses.forEach((status) => {
      describe(`given agent with status "${status}"`, () => {
        it("then returns true", () => {
          const agent = createTestAgent({ status });
          expect(canAgentBeStarted(agent)).toBe(true);
        });
      });
    });

    disallowedStatuses.forEach((status) => {
      describe(`given agent with status "${status}"`, () => {
        it("then returns false", () => {
          const agent = createTestAgent({ status });
          expect(canAgentBeStarted(agent)).toBe(false);
        });
      });
    });
  });

  describe("canAgentBeStopped", () => {
    describe("given agent with status running", () => {
      it("then returns true", () => {
        const agent = createTestAgent({ status: "running" });
        expect(canAgentBeStopped(agent)).toBe(true);
      });
    });

    const nonStoppableStatuses: Agent["status"][] = [
      "pending",
      "completed",
      "waiting",
      "stopped",
      "error",
    ];

    nonStoppableStatuses.forEach((status) => {
      describe(`given agent with status "${status}"`, () => {
        it("then returns false", () => {
          const agent = createTestAgent({ status });
          expect(canAgentBeStopped(agent)).toBe(false);
        });
      });
    });
  });

  describe("canAgentBeMerged", () => {
    const mergeableStatuses: Agent["status"][] = [
      "completed",
      "waiting",
      "stopped",
    ];
    const nonMergeableStatuses: Agent["status"][] = [
      "pending",
      "running",
      "error",
    ];

    mergeableStatuses.forEach((status) => {
      describe(`given agent with status "${status}"`, () => {
        it("then returns true", () => {
          const agent = createTestAgent({ status });
          expect(canAgentBeMerged(agent)).toBe(true);
        });
      });
    });

    nonMergeableStatuses.forEach((status) => {
      describe(`given agent with status "${status}"`, () => {
        it("then returns false", () => {
          const agent = createTestAgent({ status });
          expect(canAgentBeMerged(agent)).toBe(false);
        });
      });
    });
  });

  describe("transitionToRunning", () => {
    describe("given a pending agent", () => {
      const agent = createTestAgent({ status: "pending" });

      describe("when transitioning", () => {
        it("then returns agent with running status", () => {
          const result = transitionToRunning(agent);
          expect(result.status).toBe("running");
        });

        it("then updates the timestamp", () => {
          const result = transitionToRunning(agent);
          expect(result.updatedAt).not.toBe(agent.updatedAt);
        });

        it("then does not mutate original agent", () => {
          transitionToRunning(agent);
          expect(agent.status).toBe("pending");
        });
      });
    });
  });

  describe("transitionToStopped", () => {
    describe("given a running agent", () => {
      const agent = createTestAgent({ status: "running" });

      describe("when transitioning", () => {
        it("then returns agent with stopped status", () => {
          const result = transitionToStopped(agent);
          expect(result.status).toBe("stopped");
        });

        it("then updates the timestamp", () => {
          const result = transitionToStopped(agent);
          expect(result.updatedAt).not.toBe(agent.updatedAt);
        });
      });
    });
  });

  describe("transitionToWaiting", () => {
    describe("given a running agent", () => {
      const agent = createTestAgent({ status: "running" });

      describe("when transitioning", () => {
        it("then returns agent with waiting status", () => {
          const result = transitionToWaiting(agent);
          expect(result.status).toBe("waiting");
        });
      });
    });
  });

  describe("transitionToError", () => {
    describe("given an agent and error message", () => {
      const agent = createTestAgent({ status: "running", output: "" });

      describe("when transitioning", () => {
        it("then returns agent with error status", () => {
          const result = transitionToError(agent, "Something failed");
          expect(result.status).toBe("error");
        });

        it("then appends error to output", () => {
          const result = transitionToError(agent, "Something failed");
          expect(result.output).toContain("Something failed");
          expect(result.output).toContain('"type":"error"');
        });

        it("then updates the timestamp", () => {
          const result = transitionToError(agent, "error");
          expect(result.updatedAt).not.toBe(agent.updatedAt);
        });
      });
    });

    describe("given agent with existing output", () => {
      const agent = createTestAgent({
        output: '{"type":"start"}\n',
      });

      describe("when transitioning to error", () => {
        it("then appends to existing output", () => {
          const result = transitionToError(agent, "Failed");
          expect(result.output).toContain('{"type":"start"}');
          expect(result.output).toContain("Failed");
        });
      });
    });
  });

  describe("buildWorkspacePath", () => {
    describe("given basePath and id", () => {
      describe("when building path", () => {
        it("then returns correct workspace path", () => {
          expect(buildWorkspacePath("/home/user/project", "abc123")).toBe(
            "/home/user/project/workspaces/abc123",
          );
        });
      });
    });

    describe("given basePath with trailing slash", () => {
      describe("when building path", () => {
        it("then handles it correctly", () => {
          expect(buildWorkspacePath("/home/user/project/", "abc123")).toBe(
            "/home/user/project//workspaces/abc123",
          );
        });
      });
    });
  });

  describe("generateNameFromInstruction", () => {
    describe("given normal instruction", () => {
      describe("when generating name", () => {
        it("then returns kebab-case from first 3 words", () => {
          expect(generateNameFromInstruction("Fix the login bug")).toBe(
            "fix-the-login",
          );
        });
      });
    });

    describe("given instruction with special characters", () => {
      describe("when generating name", () => {
        it("then removes special characters", () => {
          expect(generateNameFromInstruction("Fix the @login! bug #123")).toBe(
            "fix-the-login",
          );
        });
      });
    });

    describe("given instruction longer than 20 chars", () => {
      describe("when generating name", () => {
        it("then truncates to 20 characters", () => {
          const result = generateNameFromInstruction(
            "implement authentication system",
          );
          expect(result.length).toBeLessThanOrEqual(20);
        });
      });
    });

    describe("given empty instruction", () => {
      describe("when generating name", () => {
        it("then returns 'task'", () => {
          expect(generateNameFromInstruction("")).toBe("task");
        });
      });
    });

    describe("given whitespace-only instruction", () => {
      describe("when generating name", () => {
        it("then returns 'task'", () => {
          expect(generateNameFromInstruction("   ")).toBe("task");
        });
      });
    });

    describe("given instruction with numbers", () => {
      describe("when generating name", () => {
        it("then preserves numbers", () => {
          expect(generateNameFromInstruction("Fix bug 123")).toBe(
            "fix-bug-123",
          );
        });
      });
    });

    describe("given single word instruction", () => {
      describe("when generating name", () => {
        it("then returns that word", () => {
          expect(generateNameFromInstruction("Refactor")).toBe("refactor");
        });
      });
    });
  });
});
