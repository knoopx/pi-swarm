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
  canAgentBeDeleted,
  canAgentBeReset,
  transitionToRunning,
  transitionToStopped,
  transitionToWaiting,
  transitionToError,
  transitionToCompleted,
  resetAgentForRetry,
  clearAgentOutput,
  filterAgentsByStatus,
  getCleanupCandidates,
  getStaleAgents,
  getAgentIds,
  buildWorkspacePath,
  buildSessionsDir,
  buildAgentSessionDir,
  buildAgentMetadataPath,
  determineAgentAction,
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
            "/home/user/project/.pi/swarm/workspaces/abc123",
          );
        });
      });
    });

    describe("given basePath with trailing slash", () => {
      describe("when building path", () => {
        it("then includes double slash from trailing slash", () => {
          // Note: trailing slash in basePath results in double slash
          expect(buildWorkspacePath("/home/user/project/", "abc123")).toBe(
            "/home/user/project//.pi/swarm/workspaces/abc123",
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

  describe("transitionToCompleted", () => {
    describe("given a waiting agent", () => {
      const agent = createTestAgent({ status: "waiting" });

      describe("when transitioning to completed", () => {
        it("then returns agent with completed status", () => {
          const result = transitionToCompleted(agent);
          expect(result.status).toBe("completed");
        });

        it("then updates the updatedAt timestamp", () => {
          const result = transitionToCompleted(agent);
          expect(result.updatedAt).not.toBe(agent.updatedAt);
        });

        it("then does not mutate original agent", () => {
          transitionToCompleted(agent);
          expect(agent.status).toBe("waiting");
        });
      });
    });
  });

  describe("resetAgentForRetry", () => {
    describe("given an error agent with output", () => {
      const agent = createTestAgent({
        status: "error",
        output: '{"type":"error"}\n',
        modifiedFiles: ["file1.ts", "file2.ts"],
        diffStat: "2 files changed",
      });

      describe("when resetting for retry", () => {
        it("then sets status to pending", () => {
          const result = resetAgentForRetry(agent);
          expect(result.status).toBe("pending");
        });

        it("then clears output", () => {
          const result = resetAgentForRetry(agent);
          expect(result.output).toBe("");
        });

        it("then clears modifiedFiles", () => {
          const result = resetAgentForRetry(agent);
          expect(result.modifiedFiles).toEqual([]);
        });

        it("then clears diffStat", () => {
          const result = resetAgentForRetry(agent);
          expect(result.diffStat).toBe("");
        });

        it("then updates timestamp", () => {
          const result = resetAgentForRetry(agent);
          expect(result.updatedAt).not.toBe(agent.updatedAt);
        });

        it("then preserves other properties", () => {
          const result = resetAgentForRetry(agent);
          expect(result.id).toBe(agent.id);
          expect(result.name).toBe(agent.name);
          expect(result.instruction).toBe(agent.instruction);
        });
      });
    });
  });

  describe("clearAgentOutput", () => {
    describe("given agent with output", () => {
      const agent = createTestAgent({
        output: '{"type":"test"}\n{"type":"test2"}\n',
      });

      describe("when clearing output", () => {
        it("then sets output to empty string", () => {
          const result = clearAgentOutput(agent);
          expect(result.output).toBe("");
        });

        it("then updates timestamp", () => {
          const result = clearAgentOutput(agent);
          expect(result.updatedAt).not.toBe(agent.updatedAt);
        });

        it("then preserves other properties", () => {
          const result = clearAgentOutput(agent);
          expect(result.status).toBe(agent.status);
          expect(result.instruction).toBe(agent.instruction);
        });
      });
    });
  });

  describe("canAgentBeDeleted", () => {
    const deletableStatuses: Agent["status"][] = [
      "pending",
      "completed",
      "waiting",
      "stopped",
      "error",
    ];

    deletableStatuses.forEach((status) => {
      describe(`given agent with status "${status}"`, () => {
        it("then returns true", () => {
          const agent = createTestAgent({ status });
          expect(canAgentBeDeleted(agent)).toBe(true);
        });
      });
    });

    describe("given agent with status running", () => {
      it("then returns false", () => {
        const agent = createTestAgent({ status: "running" });
        expect(canAgentBeDeleted(agent)).toBe(false);
      });
    });
  });

  describe("canAgentBeReset", () => {
    const resettableStatuses: Agent["status"][] = [
      "error",
      "stopped",
      "completed",
    ];
    const nonResettableStatuses: Agent["status"][] = [
      "pending",
      "running",
      "waiting",
    ];

    resettableStatuses.forEach((status) => {
      describe(`given agent with status "${status}"`, () => {
        it("then returns true", () => {
          const agent = createTestAgent({ status });
          expect(canAgentBeReset(agent)).toBe(true);
        });
      });
    });

    nonResettableStatuses.forEach((status) => {
      describe(`given agent with status "${status}"`, () => {
        it("then returns false", () => {
          const agent = createTestAgent({ status });
          expect(canAgentBeReset(agent)).toBe(false);
        });
      });
    });
  });

  describe("filterAgentsByStatus", () => {
    const agents = [
      createTestAgent({ id: "1", status: "pending" }),
      createTestAgent({ id: "2", status: "running" }),
      createTestAgent({ id: "3", status: "completed" }),
      createTestAgent({ id: "4", status: "error" }),
      createTestAgent({ id: "5", status: "waiting" }),
    ];

    describe("given single status filter", () => {
      it("then returns only agents with that status", () => {
        const result = filterAgentsByStatus(agents, ["running"]);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe("2");
      });
    });

    describe("given multiple status filter", () => {
      it("then returns agents with any of those statuses", () => {
        const result = filterAgentsByStatus(agents, ["completed", "error"]);
        expect(result).toHaveLength(2);
        expect(result.map((a) => a.id)).toEqual(["3", "4"]);
      });
    });

    describe("given empty status filter", () => {
      it("then returns empty array", () => {
        const result = filterAgentsByStatus(agents, []);
        expect(result).toHaveLength(0);
      });
    });

    describe("given empty agents array", () => {
      it("then returns empty array", () => {
        const result = filterAgentsByStatus([], ["running"]);
        expect(result).toHaveLength(0);
      });
    });
  });

  describe("getCleanupCandidates", () => {
    describe("given mixed status agents", () => {
      const agents = [
        createTestAgent({ id: "1", status: "pending" }),
        createTestAgent({ id: "2", status: "running" }),
        createTestAgent({ id: "3", status: "completed" }),
        createTestAgent({ id: "4", status: "error" }),
        createTestAgent({ id: "5", status: "waiting" }),
        createTestAgent({ id: "6", status: "stopped" }),
      ];

      it("then returns only completed and error agents", () => {
        const result = getCleanupCandidates(agents);
        expect(result).toHaveLength(2);
        expect(result.map((a) => a.id)).toEqual(["3", "4"]);
      });
    });

    describe("given no cleanup candidates", () => {
      const agents = [
        createTestAgent({ id: "1", status: "pending" }),
        createTestAgent({ id: "2", status: "running" }),
      ];

      it("then returns empty array", () => {
        const result = getCleanupCandidates(agents);
        expect(result).toHaveLength(0);
      });
    });

    describe("given empty agents array", () => {
      it("then returns empty array", () => {
        const result = getCleanupCandidates([]);
        expect(result).toHaveLength(0);
      });
    });
  });

  describe("getStaleAgents", () => {
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000).toISOString();

    describe("given agents with various update times", () => {
      const agents = [
        createTestAgent({ id: "1", updatedAt: twoHoursAgo }),
        createTestAgent({ id: "2", updatedAt: oneHourAgo }),
        createTestAgent({ id: "3", updatedAt: fiveMinutesAgo }),
      ];

      describe("when threshold is 90 minutes", () => {
        const thresholdMs = 90 * 60 * 1000;

        it("then returns agents older than threshold", () => {
          const result = getStaleAgents(agents, thresholdMs);
          expect(result).toHaveLength(1);
          expect(result[0].id).toBe("1");
        });
      });

      describe("when threshold is 30 minutes", () => {
        const thresholdMs = 30 * 60 * 1000;

        it("then returns agents older than threshold", () => {
          const result = getStaleAgents(agents, thresholdMs);
          expect(result).toHaveLength(2);
          expect(result.map((a) => a.id)).toEqual(["1", "2"]);
        });
      });

      describe("when threshold is 3 hours", () => {
        const thresholdMs = 3 * 60 * 60 * 1000;

        it("then returns no agents", () => {
          const result = getStaleAgents(agents, thresholdMs);
          expect(result).toHaveLength(0);
        });
      });
    });

    describe("given empty agents array", () => {
      it("then returns empty array", () => {
        const result = getStaleAgents([], 60000);
        expect(result).toHaveLength(0);
      });
    });
  });

  describe("getAgentIds", () => {
    describe("given multiple agents", () => {
      const agents = [
        createTestAgent({ id: "agent-1" }),
        createTestAgent({ id: "agent-2" }),
        createTestAgent({ id: "agent-3" }),
      ];

      it("then returns array of ids", () => {
        const result = getAgentIds(agents);
        expect(result).toEqual(["agent-1", "agent-2", "agent-3"]);
      });
    });

    describe("given empty agents array", () => {
      it("then returns empty array", () => {
        const result = getAgentIds([]);
        expect(result).toEqual([]);
      });
    });

    describe("given single agent", () => {
      const agents = [createTestAgent({ id: "single-agent" })];

      it("then returns array with single id", () => {
        const result = getAgentIds(agents);
        expect(result).toEqual(["single-agent"]);
      });
    });
  });

  describe("buildSessionsDir", () => {
    describe("given a base path", () => {
      describe("when building sessions dir", () => {
        it("then returns path under .pi/swarm/sessions", () => {
          expect(buildSessionsDir("/home/user/project")).toBe(
            "/home/user/project/.pi/swarm/sessions",
          );
        });
      });
    });

    describe("given root path", () => {
      describe("when building sessions dir", () => {
        it("then handles root path (with double slash)", () => {
          // Note: root path results in double slash, same as buildWorkspacePath
          expect(buildSessionsDir("/")).toBe("//.pi/swarm/sessions");
        });
      });
    });
  });

  describe("buildAgentSessionDir", () => {
    describe("given base path and agent id", () => {
      describe("when building agent session dir", () => {
        it("then returns path with agent id as subdirectory", () => {
          expect(buildAgentSessionDir("/home/user/project", "abc123")).toBe(
            "/home/user/project/.pi/swarm/sessions/abc123",
          );
        });
      });
    });

    describe("given various agent ids", () => {
      const cases = [
        { agentId: "a1b2c3d4", expected: "/proj/.pi/swarm/sessions/a1b2c3d4" },
        {
          agentId: "test-agent",
          expected: "/proj/.pi/swarm/sessions/test-agent",
        },
        { agentId: "123", expected: "/proj/.pi/swarm/sessions/123" },
      ];

      cases.forEach(({ agentId, expected }) => {
        describe(`when agent id is "${agentId}"`, () => {
          it(`then returns ${expected}`, () => {
            expect(buildAgentSessionDir("/proj", agentId)).toBe(expected);
          });
        });
      });
    });
  });

  describe("buildAgentMetadataPath", () => {
    describe("given base path and agent id", () => {
      describe("when building metadata path", () => {
        it("then returns path to agent.json", () => {
          expect(buildAgentMetadataPath("/home/user/project", "abc123")).toBe(
            "/home/user/project/.pi/swarm/sessions/abc123/agent.json",
          );
        });
      });
    });

    describe("given different base paths", () => {
      const cases = [
        {
          basePath: "/",
          agentId: "agent1",
          // Note: root path results in double slash, same as buildWorkspacePath
          expected: "//.pi/swarm/sessions/agent1/agent.json",
        },
        {
          basePath: "/home/user",
          agentId: "xyz",
          expected: "/home/user/.pi/swarm/sessions/xyz/agent.json",
        },
      ];

      cases.forEach(({ basePath, agentId, expected }) => {
        describe(`when base path is "${basePath}"`, () => {
          it(`then returns ${expected}`, () => {
            expect(buildAgentMetadataPath(basePath, agentId)).toBe(expected);
          });
        });
      });
    });
  });

  describe("determineAgentAction", () => {
    describe("given agent with active session", () => {
      describe("when status is running", () => {
        it("then returns continue_active", () => {
          const result = determineAgentAction(true, "running");
          expect(result).toBe("continue_active");
        });
      });

      describe("when status is waiting", () => {
        it("then returns continue_active", () => {
          const result = determineAgentAction(true, "waiting");
          expect(result).toBe("continue_active");
        });
      });

      describe("when status is stopped", () => {
        it("then returns resume_session (session lost after stop)", () => {
          const result = determineAgentAction(true, "stopped");
          expect(result).toBe("resume_session");
        });
      });
    });

    describe("given agent without active session", () => {
      describe("when status is stopped", () => {
        it("then returns resume_session", () => {
          const result = determineAgentAction(false, "stopped");
          expect(result).toBe("resume_session");
        });
      });

      describe("when status is pending", () => {
        it("then returns start_fresh", () => {
          const result = determineAgentAction(false, "pending");
          expect(result).toBe("start_fresh");
        });
      });

      describe("when status is error", () => {
        it("then returns start_fresh", () => {
          const result = determineAgentAction(false, "error");
          expect(result).toBe("start_fresh");
        });
      });

      describe("when status is completed", () => {
        it("then returns start_fresh", () => {
          const result = determineAgentAction(false, "completed");
          expect(result).toBe("start_fresh");
        });
      });

      describe("when status is running (edge case - session lost)", () => {
        it("then returns start_fresh", () => {
          const result = determineAgentAction(false, "running");
          expect(result).toBe("start_fresh");
        });
      });

      describe("when status is waiting (edge case - session lost)", () => {
        it("then returns start_fresh", () => {
          const result = determineAgentAction(false, "waiting");
          expect(result).toBe("start_fresh");
        });
      });
    });

    describe("agent action decision matrix", () => {
      const testCases: Array<{
        hasSession: boolean;
        status: Agent["status"];
        expected: "start_fresh" | "resume_session" | "continue_active";
        scenario: string;
      }> = [
        // Active session scenarios
        {
          hasSession: true,
          status: "running",
          expected: "continue_active",
          scenario: "active + running",
        },
        {
          hasSession: true,
          status: "waiting",
          expected: "continue_active",
          scenario: "active + waiting",
        },
        {
          hasSession: true,
          status: "stopped",
          expected: "resume_session",
          scenario: "active + stopped",
        },
        {
          hasSession: true,
          status: "pending",
          expected: "start_fresh",
          scenario: "active + pending",
        },
        {
          hasSession: true,
          status: "error",
          expected: "start_fresh",
          scenario: "active + error",
        },
        {
          hasSession: true,
          status: "completed",
          expected: "start_fresh",
          scenario: "active + completed",
        },
        // No session scenarios
        {
          hasSession: false,
          status: "stopped",
          expected: "resume_session",
          scenario: "no session + stopped",
        },
        {
          hasSession: false,
          status: "pending",
          expected: "start_fresh",
          scenario: "no session + pending",
        },
        {
          hasSession: false,
          status: "error",
          expected: "start_fresh",
          scenario: "no session + error",
        },
        {
          hasSession: false,
          status: "completed",
          expected: "start_fresh",
          scenario: "no session + completed",
        },
        {
          hasSession: false,
          status: "running",
          expected: "start_fresh",
          scenario: "no session + running",
        },
        {
          hasSession: false,
          status: "waiting",
          expected: "start_fresh",
          scenario: "no session + waiting",
        },
      ];

      testCases.forEach(({ hasSession, status, expected, scenario }) => {
        describe(`given ${scenario}`, () => {
          it(`then returns ${expected}`, () => {
            expect(determineAgentAction(hasSession, status)).toBe(expected);
          });
        });
      });
    });
  });
});
