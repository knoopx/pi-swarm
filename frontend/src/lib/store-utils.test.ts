import { describe, it, expect } from "vitest";
import {
  handleAgentCreated,
  handleAgentUpdated,
  handleAgentDeleted,
  handleAgentEvent,
  selectAgentById,
  selectRunningAgents,
  selectAgentsByStatus,
  isSpecAgent,
  generateAgentName,
  parseModelString,
  formatModelString,
  type StoreState,
} from "./store-utils";
import { createConversationState } from "./conversation-state";
import type { Agent } from "../types";

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
    conversation: createConversationState(),
    modifiedFiles: [],
    diffStat: "",
    model: "test-model",
    provider: "test-provider",
    ...overrides,
  };
}

function createTestState(overrides: Partial<StoreState> = {}): StoreState {
  return {
    agents: [],
    selectedId: null,
    ...overrides,
  };
}

describe("store-utils", () => {
  describe("handleAgentCreated", () => {
    describe("given empty agents list", () => {
      const state = createTestState();
      const agent = createTestAgent({ id: "new-agent" });

      describe("when agent is created", () => {
        it("then adds agent to list", () => {
          const newState = handleAgentCreated(state, agent);
          expect(newState.agents).toHaveLength(1);
          expect(newState.agents[0].id).toBe("new-agent");
        });

        it("then does not mutate original state", () => {
          handleAgentCreated(state, agent);
          expect(state.agents).toHaveLength(0);
        });
      });
    });

    describe("given agent already exists", () => {
      const existingAgent = createTestAgent({ id: "existing-id" });
      const state = createTestState({ agents: [existingAgent] });

      describe("when same agent is created again", () => {
        it("then does not add duplicate", () => {
          const duplicateAgent = createTestAgent({ id: "existing-id" });
          const newState = handleAgentCreated(state, duplicateAgent);
          expect(newState.agents).toHaveLength(1);
        });

        it("then returns same state reference", () => {
          const duplicateAgent = createTestAgent({ id: "existing-id" });
          const newState = handleAgentCreated(state, duplicateAgent);
          expect(newState).toBe(state);
        });
      });
    });

    describe("given existing agents", () => {
      const existingAgent = createTestAgent({ id: "existing" });
      const state = createTestState({ agents: [existingAgent] });

      describe("when new agent is created", () => {
        it("then appends to list", () => {
          const newAgent = createTestAgent({ id: "new" });
          const newState = handleAgentCreated(state, newAgent);
          expect(newState.agents).toHaveLength(2);
          expect(newState.agents[0].id).toBe("existing");
          expect(newState.agents[1].id).toBe("new");
        });
      });
    });
  });

  describe("handleAgentUpdated", () => {
    describe("given agent exists", () => {
      const agent = createTestAgent({ id: "agent-1", status: "pending" });
      const state = createTestState({ agents: [agent] });

      describe("when agent is updated", () => {
        it("then updates the agent properties", () => {
          const newState = handleAgentUpdated(state, {
            id: "agent-1",
            status: "running",
          });
          expect(newState.agents[0].status).toBe("running");
        });

        it("then preserves other properties", () => {
          const newState = handleAgentUpdated(state, {
            id: "agent-1",
            status: "running",
          });
          expect(newState.agents[0].name).toBe("test-agent");
          expect(newState.agents[0].instruction).toBe("test instruction");
        });

        it("then does not mutate original state", () => {
          handleAgentUpdated(state, { id: "agent-1", status: "running" });
          expect(state.agents[0].status).toBe("pending");
        });
      });
    });

    describe("given agent does not exist", () => {
      const state = createTestState({ agents: [] });

      describe("when update is received", () => {
        it("then does not add agent", () => {
          const newState = handleAgentUpdated(state, {
            id: "nonexistent",
            status: "running",
          });
          expect(newState.agents).toHaveLength(0);
        });
      });
    });

    describe("given multiple agents", () => {
      const agents = [
        createTestAgent({ id: "agent-1", name: "Agent 1" }),
        createTestAgent({ id: "agent-2", name: "Agent 2" }),
        createTestAgent({ id: "agent-3", name: "Agent 3" }),
      ];
      const state = createTestState({ agents });

      describe("when middle agent is updated", () => {
        it("then updates only that agent", () => {
          const newState = handleAgentUpdated(state, {
            id: "agent-2",
            name: "Updated Agent 2",
          });
          expect(newState.agents[0].name).toBe("Agent 1");
          expect(newState.agents[1].name).toBe("Updated Agent 2");
          expect(newState.agents[2].name).toBe("Agent 3");
        });
      });
    });
  });

  describe("handleAgentDeleted", () => {
    describe("given agent exists", () => {
      const agent = createTestAgent({ id: "agent-1" });
      const state = createTestState({ agents: [agent] });

      describe("when agent is deleted", () => {
        it("then removes agent from list", () => {
          const newState = handleAgentDeleted(state, "agent-1");
          expect(newState.agents).toHaveLength(0);
        });
      });
    });

    describe("given deleted agent is selected", () => {
      const agent = createTestAgent({ id: "agent-1" });
      const state = createTestState({ agents: [agent], selectedId: "agent-1" });

      describe("when agent is deleted", () => {
        it("then clears selectedId", () => {
          const newState = handleAgentDeleted(state, "agent-1");
          expect(newState.selectedId).toBeNull();
        });
      });
    });

    describe("given different agent is selected", () => {
      const agents = [
        createTestAgent({ id: "agent-1" }),
        createTestAgent({ id: "agent-2" }),
      ];
      const state = createTestState({ agents, selectedId: "agent-2" });

      describe("when other agent is deleted", () => {
        it("then preserves selectedId", () => {
          const newState = handleAgentDeleted(state, "agent-1");
          expect(newState.selectedId).toBe("agent-2");
        });
      });
    });

    describe("given agent does not exist", () => {
      const state = createTestState({ agents: [] });

      describe("when delete is received", () => {
        it("then does nothing", () => {
          const newState = handleAgentDeleted(state, "nonexistent");
          expect(newState.agents).toHaveLength(0);
        });
      });
    });
  });

  describe("handleAgentEvent", () => {
    describe("given agent exists", () => {
      const agent = createTestAgent({ id: "agent-1", output: "" });
      const state = createTestState({ agents: [agent] });

      describe("when event is received", () => {
        it("then appends JSON event to output", () => {
          const event = { type: "test", data: 123 };
          const newState = handleAgentEvent(state, "agent-1", event);
          expect(newState.agents[0].output).toBe(
            '{"type":"test","data":123}\n',
          );
        });
      });
    });

    describe("given agent has existing output", () => {
      const agent = createTestAgent({
        id: "agent-1",
        output: '{"type":"previous"}\n',
      });
      const state = createTestState({ agents: [agent] });

      describe("when new event is received", () => {
        it("then appends to existing output", () => {
          const event = { type: "new" };
          const newState = handleAgentEvent(state, "agent-1", event);
          expect(newState.agents[0].output).toBe(
            '{"type":"previous"}\n{"type":"new"}\n',
          );
        });
      });
    });

    describe("given agent does not exist", () => {
      const state = createTestState({ agents: [] });

      describe("when event is received", () => {
        it("then does nothing", () => {
          const newState = handleAgentEvent(state, "nonexistent", {});
          expect(newState.agents).toHaveLength(0);
        });
      });
    });
  });

  describe("selectAgentById", () => {
    const agents = [
      createTestAgent({ id: "agent-1" }),
      createTestAgent({ id: "agent-2" }),
    ];

    describe("given valid id", () => {
      it("then returns the agent", () => {
        const agent = selectAgentById(agents, "agent-1");
        expect(agent?.id).toBe("agent-1");
      });
    });

    describe("given invalid id", () => {
      it("then returns undefined", () => {
        const agent = selectAgentById(agents, "nonexistent");
        expect(agent).toBeUndefined();
      });
    });

    describe("given null id", () => {
      it("then returns undefined", () => {
        const agent = selectAgentById(agents, null);
        expect(agent).toBeUndefined();
      });
    });

    describe("given empty agents array", () => {
      it("then returns undefined", () => {
        const agent = selectAgentById([], "any-id");
        expect(agent).toBeUndefined();
      });
    });
  });

  describe("selectRunningAgents", () => {
    describe("given mixed status agents", () => {
      const agents = [
        createTestAgent({ id: "1", status: "pending" }),
        createTestAgent({ id: "2", status: "running" }),
        createTestAgent({ id: "3", status: "running" }),
        createTestAgent({ id: "4", status: "completed" }),
      ];

      it("then returns only running agents", () => {
        const running = selectRunningAgents(agents);
        expect(running).toHaveLength(2);
        expect(running.every((a) => a.status === "running")).toBe(true);
      });
    });

    describe("given no running agents", () => {
      const agents = [
        createTestAgent({ id: "1", status: "pending" }),
        createTestAgent({ id: "2", status: "completed" }),
      ];

      it("then returns empty array", () => {
        const running = selectRunningAgents(agents);
        expect(running).toHaveLength(0);
      });
    });
  });

  describe("selectAgentsByStatus", () => {
    const agents = [
      createTestAgent({ id: "1", status: "pending" }),
      createTestAgent({ id: "2", status: "running" }),
      createTestAgent({ id: "3", status: "completed" }),
      createTestAgent({ id: "4", status: "completed" }),
    ];

    const statusCases: Array<{
      status: Agent["status"];
      expectedCount: number;
    }> = [
      { status: "pending", expectedCount: 1 },
      { status: "running", expectedCount: 1 },
      { status: "completed", expectedCount: 2 },
      { status: "waiting", expectedCount: 0 },
      { status: "stopped", expectedCount: 0 },
      { status: "error", expectedCount: 0 },
    ];

    statusCases.forEach(({ status, expectedCount }) => {
      describe(`given status "${status}"`, () => {
        it(`then returns ${expectedCount} agents`, () => {
          const result = selectAgentsByStatus(agents, status);
          expect(result).toHaveLength(expectedCount);
        });
      });
    });
  });

  describe("isSpecAgent", () => {
    describe("given agent with spec- prefix", () => {
      const agent = createTestAgent({ name: "spec-abc123" });

      it("then returns true", () => {
        expect(isSpecAgent(agent)).toBe(true);
      });
    });

    describe("given agent without spec- prefix", () => {
      const agent = createTestAgent({ name: "my-task" });

      it("then returns false", () => {
        expect(isSpecAgent(agent)).toBe(false);
      });
    });

    describe("given agent with spec in middle of name", () => {
      const agent = createTestAgent({ name: "my-spec-task" });

      it("then returns false", () => {
        expect(isSpecAgent(agent)).toBe(false);
      });
    });
  });

  describe("generateAgentName", () => {
    describe("given normal instruction", () => {
      it("then returns kebab-case from first 3 words", () => {
        expect(generateAgentName("Fix the login bug")).toBe("fix-the-login");
      });
    });

    describe("given instruction with special characters", () => {
      it("then removes special characters", () => {
        expect(generateAgentName("Fix the @login! bug #123")).toBe(
          "fix-the-login",
        );
      });
    });

    describe("given instruction longer than 20 chars result", () => {
      it("then truncates to 20 characters", () => {
        const result = generateAgentName("implement authentication system");
        expect(result.length).toBeLessThanOrEqual(20);
      });
    });

    describe("given empty instruction", () => {
      it("then returns 'task'", () => {
        expect(generateAgentName("")).toBe("task");
      });
    });

    describe("given whitespace-only instruction", () => {
      it("then returns 'task'", () => {
        expect(generateAgentName("   ")).toBe("task");
      });
    });

    describe("given instruction with numbers", () => {
      it("then preserves numbers", () => {
        expect(generateAgentName("Fix bug 123")).toBe("fix-bug-123");
      });
    });

    describe("given single word instruction", () => {
      it("then returns that word", () => {
        expect(generateAgentName("Refactor")).toBe("refactor");
      });
    });

    describe("given instruction with multiple spaces", () => {
      it("then handles multiple spaces correctly", () => {
        expect(generateAgentName("Fix   the   bug")).toBe("fix-the-bug");
      });
    });
  });

  describe("parseModelString", () => {
    describe("given valid model string", () => {
      it("then extracts provider and modelId", () => {
        const result = parseModelString("anthropic/claude-3");
        expect(result).toEqual({
          provider: "anthropic",
          modelId: "claude-3",
        });
      });
    });

    describe("given model string with multiple slashes", () => {
      it("then keeps slashes in modelId", () => {
        const result = parseModelString("openai/gpt-4/turbo/preview");
        expect(result).toEqual({
          provider: "openai",
          modelId: "gpt-4/turbo/preview",
        });
      });
    });

    describe("given invalid model string without slash", () => {
      it("then returns null", () => {
        const result = parseModelString("invalid");
        expect(result).toBeNull();
      });
    });

    describe("given empty string", () => {
      it("then returns null", () => {
        const result = parseModelString("");
        expect(result).toBeNull();
      });
    });
  });

  describe("formatModelString", () => {
    describe("given provider and modelId", () => {
      it("then returns provider/modelId format", () => {
        expect(formatModelString("anthropic", "claude-3")).toBe(
          "anthropic/claude-3",
        );
      });
    });

    describe("given modelId with slashes", () => {
      it("then preserves slashes in modelId", () => {
        expect(formatModelString("openai", "gpt-4/turbo")).toBe(
          "openai/gpt-4/turbo",
        );
      });
    });
  });
});
