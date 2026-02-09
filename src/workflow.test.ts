import { describe, it, expect, beforeEach } from "vitest";
import {
  // Agent creation
  generateId,
  createAgentData,
  generateNameFromInstruction,
  // State transitions
  transitionToRunning,
  transitionToStopped,
  transitionToWaiting,
  transitionToError,
  transitionToCompleted,
  resetAgentForRetry,
  clearAgentOutput,
  // Validation
  canAgentBeStarted,
  canAgentBeStopped,
  canAgentBeMerged,
  canAgentBeDeleted,
  canAgentBeReset,
  canAgentReceiveInstruction,
  validateMerge,
  getMergeDescription,
  // Action determination
  determineAgentAction,
  // Path helpers
  buildWorkspacePath,
  buildAgentSessionDir,
  buildAgentMetadataPath,
  // Batch operations
  filterAgentsByStatus,
  getCleanupCandidates,
  getAgentIds,
  appendOutput,
  serializeAgent,
  type Agent,
} from "./core";

import {
  createSuccessResponse,
  createErrorResponse,
  createAgentCreatedEvent,
  createAgentUpdatedEvent,
  createAgentDeletedEvent,
  routeCommand,
  parseWsMessage,
  extractCreateAgentParams,
  type CommandContext,
  type WsRequest,
} from "./server-logic";

// ===== Test Fixtures =====

function createTestAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "test-id",
    name: "test-agent",
    status: "pending",
    instruction: "test instruction",
    workspace: "/project/.pi/swarm/workspaces/test-id",
    basePath: "/project",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    output: "",
    modifiedFiles: [],
    diffStat: "",
    model: "claude-3",
    provider: "anthropic",
    ...overrides,
  };
}

function createCommandContext(agents: Agent[] = []): CommandContext {
  const agentsMap = new Map<string, Agent>(agents.map((a) => [a.id, a]));
  return {
    agents: agentsMap,
    getAgent: (id) => agentsMap.get(id),
  };
}

// ===== Workflow Tests =====

describe("Task Workflow", () => {
  describe("Complete Task Lifecycle", () => {
    describe("given a new task request", () => {
      const basePath = "/home/user/project";
      const instruction = "Implement user authentication";

      describe("when creating and completing a task successfully", () => {
        it("then follows pending → running → completed lifecycle", () => {
          // Step 1: Create agent
          const id = generateId();
          const name = generateNameFromInstruction(instruction);
          const workspace = buildWorkspacePath(basePath, id);

          const agent = createAgentData(
            id,
            name,
            instruction,
            workspace,
            basePath,
            "anthropic",
            "claude-3",
          );

          expect(agent.status).toBe("pending");
          expect(agent.name).toBe("implement-user-authe"); // 3 words, truncated at 20 chars
          expect(agent.workspace).toContain("/.pi/swarm/workspaces/");

          // Step 2: Start agent
          expect(canAgentBeStarted(agent)).toBe(true);
          const runningAgent = transitionToRunning(agent);
          expect(runningAgent.status).toBe("running");
          expect(runningAgent.updatedAt).toBeTruthy(); // Timestamp is set

          // Step 3: Agent working
          expect(canAgentBeStopped(runningAgent)).toBe(true);
          expect(canAgentReceiveInstruction(runningAgent)).toBe(true);

          // Step 4: Agent waits for input
          const waitingAgent = transitionToWaiting(runningAgent);
          expect(waitingAgent.status).toBe("waiting");
          expect(canAgentReceiveInstruction(waitingAgent)).toBe(true);

          // Step 5: Complete the task (after merge)
          const completedAgent = transitionToCompleted(waitingAgent);
          expect(completedAgent.status).toBe("completed");

          // Verify final state
          expect(canAgentBeStarted(completedAgent)).toBe(false);
          expect(canAgentBeStopped(completedAgent)).toBe(false);
          expect(canAgentBeMerged(completedAgent)).toBe(true);
          expect(canAgentBeDeleted(completedAgent)).toBe(true);
        });
      });

      describe("when task encounters an error", () => {
        it("then follows pending → running → error lifecycle", () => {
          const id = generateId();
          const agent = createAgentData(
            id,
            "error-task",
            instruction,
            buildWorkspacePath(basePath, id),
            basePath,
            "anthropic",
            "claude-3",
          );

          // Start
          const runningAgent = transitionToRunning(agent);
          expect(runningAgent.status).toBe("running");

          // Error occurs
          const errorAgent = transitionToError(
            runningAgent,
            "API rate limit exceeded",
          );
          expect(errorAgent.status).toBe("error");
          expect(errorAgent.output).toContain("API rate limit exceeded");
          expect(errorAgent.output).toContain('"type":"error"');

          // Can't continue but can reset
          expect(canAgentBeStopped(errorAgent)).toBe(false);
          expect(canAgentBeMerged(errorAgent)).toBe(false);
          expect(canAgentBeReset(errorAgent)).toBe(true);
        });
      });

      describe("when task is stopped and resumed", () => {
        it("then follows pending → running → stopped → running lifecycle", () => {
          const id = generateId();
          const agent = createAgentData(
            id,
            "resumable-task",
            instruction,
            buildWorkspacePath(basePath, id),
            basePath,
            "anthropic",
            "claude-3",
          );

          // Start
          const runningAgent = transitionToRunning(agent);

          // Stop
          expect(canAgentBeStopped(runningAgent)).toBe(true);
          const stoppedAgent = transitionToStopped(runningAgent);
          expect(stoppedAgent.status).toBe("stopped");

          // Verify stopped state
          expect(canAgentBeStarted(stoppedAgent)).toBe(true);
          expect(canAgentBeMerged(stoppedAgent)).toBe(true);
          expect(canAgentReceiveInstruction(stoppedAgent)).toBe(false);

          // Determine action when resuming
          const action = determineAgentAction(false, "stopped");
          expect(action).toBe("resume_session");

          // Resume
          const resumedAgent = transitionToRunning(stoppedAgent);
          expect(resumedAgent.status).toBe("running");
        });
      });
    });
  });

  describe("Error Recovery Workflow", () => {
    describe("given an agent in error state with accumulated output", () => {
      const errorAgent = createTestAgent({
        status: "error",
        output:
          '{"type":"start"}\n{"type":"tool_call"}\n{"type":"error","message":"Failed"}\n',
        modifiedFiles: ["src/auth.ts", "src/login.ts"],
        diffStat: "2 files changed, 50 insertions(+), 10 deletions(-)",
      });

      describe("when retrying the task", () => {
        it("then resets agent to pristine pending state", () => {
          expect(canAgentBeReset(errorAgent)).toBe(true);
          const resetAgent = resetAgentForRetry(errorAgent);

          expect(resetAgent.status).toBe("pending");
          expect(resetAgent.output).toBe("");
          expect(resetAgent.modifiedFiles).toEqual([]);
          expect(resetAgent.diffStat).toBe("");
          expect(resetAgent.updatedAt).not.toBe(errorAgent.updatedAt);

          // Preserved fields
          expect(resetAgent.id).toBe(errorAgent.id);
          expect(resetAgent.name).toBe(errorAgent.name);
          expect(resetAgent.instruction).toBe(errorAgent.instruction);
          expect(resetAgent.workspace).toBe(errorAgent.workspace);
        });

        it("then allows agent to be started again", () => {
          const resetAgent = resetAgentForRetry(errorAgent);
          expect(canAgentBeStarted(resetAgent)).toBe(true);
        });
      });
    });

    describe("given agents that cannot be reset", () => {
      const nonResettableStatuses: Agent["status"][] = [
        "pending",
        "running",
        "waiting",
      ];

      nonResettableStatuses.forEach((status) => {
        describe(`when agent status is "${status}"`, () => {
          it("then reset is not allowed", () => {
            const agent = createTestAgent({ status });
            expect(canAgentBeReset(agent)).toBe(false);
          });
        });
      });
    });
  });

  describe("Merge Workflow", () => {
    describe("given a completed agent with changes", () => {
      const completedAgent = createTestAgent({
        id: "merge-ready",
        status: "completed",
        instruction: "Add login feature",
        modifiedFiles: ["src/auth.ts", "src/routes/login.ts"],
        diffStat: "2 files changed, 150 insertions(+), 5 deletions(-)",
      });

      describe("when validating merge preconditions", () => {
        it("then validation passes", () => {
          const validation = validateMerge(completedAgent);
          expect(validation.valid).toBe(true);
          expect(validation.error).toBeUndefined();
        });
      });

      describe("when merge description is provided", () => {
        it("then uses the provided description", () => {
          const desc = getMergeDescription(
            "feat: Add user login with OAuth",
            completedAgent.instruction,
          );
          expect(desc).toBe("feat: Add user login with OAuth");
        });
      });

      describe("when merge description is empty", () => {
        it("then falls back to agent instruction", () => {
          const desc = getMergeDescription("", completedAgent.instruction);
          expect(desc).toBe("Add login feature");
        });
      });

      describe("when both description and instruction are empty", () => {
        it("then uses default message", () => {
          const emptyAgent = createTestAgent({
            status: "completed",
            instruction: "",
          });
          const desc = getMergeDescription("", emptyAgent.instruction);
          expect(desc).toBe("Merged agent changes");
        });
      });
    });

    describe("given agents in non-mergeable states", () => {
      const nonMergeableStatuses: Agent["status"][] = [
        "pending",
        "running",
        "error",
      ];

      nonMergeableStatuses.forEach((status) => {
        describe(`when agent status is "${status}"`, () => {
          it("then merge validation fails with descriptive error", () => {
            const agent = createTestAgent({ status });
            const validation = validateMerge(agent);

            expect(validation.valid).toBe(false);
            expect(validation.error).toContain(status);
            expect(validation.error).toContain("Cannot merge");
          });
        });
      });
    });

    describe("merge decision matrix", () => {
      const statuses: Agent["status"][] = [
        "pending",
        "running",
        "completed",
        "waiting",
        "stopped",
        "error",
      ];

      const expectedMergeable: Record<Agent["status"], boolean> = {
        pending: false,
        running: false,
        completed: true,
        waiting: true,
        stopped: true,
        error: false,
      };

      statuses.forEach((status) => {
        describe(`given agent with status "${status}"`, () => {
          it(`then canAgentBeMerged returns ${expectedMergeable[status]}`, () => {
            const agent = createTestAgent({ status });
            expect(canAgentBeMerged(agent)).toBe(expectedMergeable[status]);
          });
        });
      });
    });
  });

  describe("Workspace Management", () => {
    describe("given a project base path", () => {
      const basePath = "/home/user/my-project";

      describe("when creating workspace paths for agent", () => {
        it("then workspace path follows swarm convention", () => {
          const agentId = "abc12345";
          const workspace = buildWorkspacePath(basePath, agentId);
          expect(workspace).toBe(
            "/home/user/my-project/.pi/swarm/workspaces/abc12345",
          );
        });

        it("then session directory follows swarm convention", () => {
          const agentId = "abc12345";
          const sessionDir = buildAgentSessionDir(basePath, agentId);
          expect(sessionDir).toBe(
            "/home/user/my-project/.pi/swarm/sessions/abc12345",
          );
        });

        it("then metadata path points to agent.json", () => {
          const agentId = "abc12345";
          const metaPath = buildAgentMetadataPath(basePath, agentId);
          expect(metaPath).toBe(
            "/home/user/my-project/.pi/swarm/sessions/abc12345/agent.json",
          );
        });
      });

      describe("when multiple agents are created", () => {
        it("then each agent gets unique workspace", () => {
          const ids = [generateId(), generateId(), generateId()];
          const workspaces = ids.map((id) => buildWorkspacePath(basePath, id));
          const uniqueWorkspaces = new Set(workspaces);
          expect(uniqueWorkspaces.size).toBe(3);
        });
      });
    });

    describe("agent session state management", () => {
      describe("given an active running agent", () => {
        it("then determines continue_active action", () => {
          const action = determineAgentAction(true, "running");
          expect(action).toBe("continue_active");
        });
      });

      describe("given a stopped agent with no active session", () => {
        it("then determines resume_session action", () => {
          const action = determineAgentAction(false, "stopped");
          expect(action).toBe("resume_session");
        });
      });

      describe("given a pending agent", () => {
        it("then determines start_fresh action", () => {
          const action = determineAgentAction(false, "pending");
          expect(action).toBe("start_fresh");
        });
      });

      describe("action decision matrix", () => {
        const cases = [
          {
            hasSession: true,
            status: "running" as const,
            expected: "continue_active" as const,
          },
          {
            hasSession: true,
            status: "waiting" as const,
            expected: "continue_active" as const,
          },
          {
            hasSession: true,
            status: "stopped" as const,
            expected: "resume_session" as const,
          },
          {
            hasSession: false,
            status: "stopped" as const,
            expected: "resume_session" as const,
          },
          {
            hasSession: false,
            status: "pending" as const,
            expected: "start_fresh" as const,
          },
          {
            hasSession: false,
            status: "error" as const,
            expected: "start_fresh" as const,
          },
          {
            hasSession: false,
            status: "completed" as const,
            expected: "start_fresh" as const,
          },
        ];

        cases.forEach(({ hasSession, status, expected }) => {
          describe(`given hasSession=${hasSession} and status="${status}"`, () => {
            it(`then returns "${expected}"`, () => {
              expect(determineAgentAction(hasSession, status)).toBe(expected);
            });
          });
        });
      });
    });
  });

  describe("Multi-Agent Orchestration", () => {
    describe("given multiple agents in various states", () => {
      const agents: Agent[] = [
        createTestAgent({ id: "agent-1", status: "pending" }),
        createTestAgent({ id: "agent-2", status: "running" }),
        createTestAgent({ id: "agent-3", status: "completed" }),
        createTestAgent({ id: "agent-4", status: "error" }),
        createTestAgent({ id: "agent-5", status: "waiting" }),
        createTestAgent({ id: "agent-6", status: "stopped" }),
        createTestAgent({ id: "agent-7", status: "completed" }),
      ];

      describe("when filtering by status", () => {
        it("then returns only agents matching status", () => {
          const running = filterAgentsByStatus(agents, ["running"]);
          expect(running).toHaveLength(1);
          expect(running[0].id).toBe("agent-2");
        });

        it("then supports multiple status filters", () => {
          const finishedOrError = filterAgentsByStatus(agents, [
            "completed",
            "error",
          ]);
          expect(finishedOrError).toHaveLength(3);
          expect(finishedOrError.map((a) => a.id)).toContain("agent-3");
          expect(finishedOrError.map((a) => a.id)).toContain("agent-4");
          expect(finishedOrError.map((a) => a.id)).toContain("agent-7");
        });
      });

      describe("when identifying cleanup candidates", () => {
        it("then returns completed and error agents", () => {
          const candidates = getCleanupCandidates(agents);
          expect(candidates).toHaveLength(3);
          const ids = candidates.map((a) => a.id);
          expect(ids).toContain("agent-3");
          expect(ids).toContain("agent-4");
          expect(ids).toContain("agent-7");
        });
      });

      describe("when extracting agent IDs for batch operations", () => {
        it("then returns array of IDs", () => {
          const ids = getAgentIds(agents);
          expect(ids).toEqual([
            "agent-1",
            "agent-2",
            "agent-3",
            "agent-4",
            "agent-5",
            "agent-6",
            "agent-7",
          ]);
        });
      });

      describe("when identifying mergeable agents", () => {
        it("then finds all agents that can be merged", () => {
          const mergeable = agents.filter(canAgentBeMerged);
          expect(mergeable).toHaveLength(4);
          const ids = mergeable.map((a) => a.id);
          expect(ids).toContain("agent-3"); // completed
          expect(ids).toContain("agent-5"); // waiting
          expect(ids).toContain("agent-6"); // stopped
          expect(ids).toContain("agent-7"); // completed
        });
      });

      describe("when identifying deletable agents", () => {
        it("then finds all non-running agents", () => {
          const deletable = agents.filter(canAgentBeDeleted);
          expect(deletable).toHaveLength(6);
          expect(deletable.map((a) => a.id)).not.toContain("agent-2");
        });
      });
    });
  });

  describe("Agent Output Management", () => {
    describe("given an agent accumulating output events", () => {
      let agent: Agent;

      beforeEach(() => {
        agent = createTestAgent({ output: "" });
      });

      describe("when appending events", () => {
        it("then builds output log with newline-delimited JSON", () => {
          let output = agent.output;
          output = appendOutput(output, { type: "start", timestamp: 1 });
          output = appendOutput(output, { type: "tool_call", tool: "Read" });
          output = appendOutput(output, { type: "complete" });

          const lines = output.trim().split("\n");
          expect(lines).toHaveLength(3);
          expect(JSON.parse(lines[0]).type).toBe("start");
          expect(JSON.parse(lines[1]).type).toBe("tool_call");
          expect(JSON.parse(lines[2]).type).toBe("complete");
        });
      });

      describe("when clearing output for restart", () => {
        it("then removes all output while preserving other state", () => {
          const agentWithOutput = {
            ...agent,
            status: "running" as const,
            output: '{"type":"event1"}\n{"type":"event2"}\n',
          };

          const cleared = clearAgentOutput(agentWithOutput);
          expect(cleared.output).toBe("");
          expect(cleared.status).toBe("running");
          expect(cleared.id).toBe(agent.id);
        });
      });
    });
  });

  describe("WebSocket Request/Response Workflow", () => {
    describe("given a create_agent request", () => {
      const request = JSON.stringify({
        id: "req-1",
        type: "create_agent",
        name: "feature-agent",
        instruction: "Build the feature",
        provider: "anthropic",
        model: "claude-3-sonnet",
      });

      describe("when parsing and routing request", () => {
        it("then extracts all creation parameters", () => {
          const parsed = parseWsMessage(request);
          expect("error" in parsed).toBe(false);
          if (!("error" in parsed)) {
            const params = extractCreateAgentParams(parsed);
            expect(params.name).toBe("feature-agent");
            expect(params.instruction).toBe("Build the feature");
            expect(params.provider).toBe("anthropic");
            expect(params.model).toBe("claude-3-sonnet");
          }
        });

        it("then routes to create_agent without requiring existing agent", () => {
          const parsed = parseWsMessage(request) as WsRequest;
          const context = createCommandContext([]);
          const result = routeCommand("create_agent", parsed, context);
          expect(result.valid).toBe(true);
        });
      });
    });

    describe("given agent operation requests", () => {
      let context: CommandContext;
      let existingAgent: Agent;

      beforeEach(() => {
        existingAgent = createTestAgent({
          id: "existing-agent",
          status: "pending",
        });
        context = createCommandContext([existingAgent]);
      });

      describe("when start_agent request targets existing agent", () => {
        it("then routes successfully with agent reference", () => {
          const request: WsRequest = {
            id: "req-2",
            type: "start_agent",
            agentId: "existing-agent",
          };
          const result = routeCommand("start_agent", request, context);
          expect(result.valid).toBe(true);
          if (result.valid) {
            expect(result.agent).toBe(existingAgent);
          }
        });
      });

      describe("when request targets non-existent agent", () => {
        it("then returns agent not found error", () => {
          const request: WsRequest = {
            id: "req-3",
            type: "start_agent",
            agentId: "ghost-agent",
          };
          const result = routeCommand("start_agent", request, context);
          expect(result.valid).toBe(false);
          if (!result.valid) {
            expect(result.error).toBe("Agent not found");
          }
        });
      });

      describe("when request is missing agent ID", () => {
        it("then returns missing agent ID error", () => {
          const request: WsRequest = { id: "req-4", type: "stop_agent" };
          const result = routeCommand("stop_agent", request, context);
          expect(result.valid).toBe(false);
          if (!result.valid) {
            expect(result.error).toBe("Missing agent ID");
          }
        });
      });
    });

    describe("response generation", () => {
      describe("when operation succeeds", () => {
        it("then creates success response with data", () => {
          const agent = createTestAgent();
          const response = createSuccessResponse("req-1", {
            agent: serializeAgent(agent),
          });
          expect(response.success).toBe(true);
          expect(response.id).toBe("req-1");
          expect(response.data).toBeDefined();
        });
      });

      describe("when operation fails", () => {
        it("then creates error response with message", () => {
          const response = createErrorResponse(
            "req-2",
            "Agent is already running",
          );
          expect(response.success).toBe(false);
          expect(response.error).toBe("Agent is already running");
        });
      });
    });
  });

  describe("Event Broadcasting Workflow", () => {
    describe("given agent state changes", () => {
      describe("when agent is created", () => {
        it("then generates agent_created event", () => {
          const agent = createTestAgent({ id: "new-agent" });
          const event = createAgentCreatedEvent(agent);
          expect(event.type).toBe("agent_created");
          expect(event.agent.id).toBe("new-agent");
          expect(event.agent).not.toHaveProperty("session");
        });
      });

      describe("when agent state changes", () => {
        it("then generates agent_updated event", () => {
          const agent = createTestAgent({ status: "running" });
          const event = createAgentUpdatedEvent(agent);
          expect(event.type).toBe("agent_updated");
          expect(event.agent.status).toBe("running");
        });
      });

      describe("when agent is deleted", () => {
        it("then generates agent_deleted event with just ID", () => {
          const event = createAgentDeletedEvent("deleted-agent");
          expect(event.type).toBe("agent_deleted");
          expect(event.agentId).toBe("deleted-agent");
        });
      });
    });

    describe("serialization for broadcast", () => {
      describe("given agent with session data", () => {
        it("then session is excluded from serialized agent", () => {
          const agent = createTestAgent({
            session: { socket: "mock" } as unknown,
          });
          const serialized = serializeAgent(agent);
          expect(serialized).not.toHaveProperty("session");
          expect(serialized.id).toBe(agent.id);
          expect(serialized.status).toBe(agent.status);
        });
      });
    });
  });

  describe("Name Generation from Instruction", () => {
    describe("given various instruction formats", () => {
      const cases = [
        {
          instruction: "Fix the login bug",
          expected: "fix-the-login",
          scenario: "normal instruction",
        },
        {
          instruction: "Add OAuth2 authentication!",
          expected: "add-oauth2-authentic",
          scenario: "with special characters",
        },
        {
          instruction: "refactor",
          expected: "refactor",
          scenario: "single word",
        },
        {
          instruction: "",
          expected: "task",
          scenario: "empty string",
        },
        {
          instruction: "   ",
          expected: "task",
          scenario: "whitespace only",
        },
        {
          instruction: "UPPERCASE INSTRUCTION TEXT",
          expected: "uppercase-instructio",
          scenario: "uppercase text",
        },
        {
          instruction: "Create API endpoint for /users/profile",
          expected: "create-api-endpoint",
          scenario: "with URL-like content",
        },
      ];

      cases.forEach(({ instruction, expected, scenario }) => {
        describe(`given ${scenario}`, () => {
          it(`then generates "${expected}"`, () => {
            const result = generateNameFromInstruction(instruction);
            expect(result).toBe(expected);
          });
        });
      });
    });

    describe("name generation constraints", () => {
      it("then limits name to 20 characters", () => {
        const longInstruction =
          "implement comprehensive authentication system with role based access";
        const name = generateNameFromInstruction(longInstruction);
        expect(name.length).toBeLessThanOrEqual(20);
      });

      it("then uses only first 3 words", () => {
        const instruction = "one two three four five six";
        const name = generateNameFromInstruction(instruction);
        expect(name).toBe("one-two-three");
      });

      it("then produces lowercase alphanumeric with hyphens", () => {
        const name = generateNameFromInstruction("Test @#$ Special 123 Chars!");
        expect(name).toMatch(/^[a-z0-9-]+$/);
      });
    });
  });

  describe("Complete Integration Scenario", () => {
    describe("given end-to-end task completion flow", () => {
      const basePath = "/home/developer/webapp";

      it("then agent progresses through full lifecycle with proper state management", () => {
        // === Phase 1: Task Creation ===
        const instruction = "Add user profile page with avatar upload";
        const id = generateId();
        const name = generateNameFromInstruction(instruction);
        const workspace = buildWorkspacePath(basePath, id);

        const agent = createAgentData(
          id,
          name,
          instruction,
          workspace,
          basePath,
          "anthropic",
          "claude-3-opus",
        );

        expect(agent.status).toBe("pending");
        expect(canAgentBeStarted(agent)).toBe(true);

        // Verify workspace paths
        expect(agent.workspace).toContain(id);
        expect(buildAgentMetadataPath(basePath, id)).toContain(id);

        // === Phase 2: Task Execution ===
        let currentAgent = transitionToRunning(agent);
        expect(currentAgent.status).toBe("running");
        expect(canAgentBeStopped(currentAgent)).toBe(true);

        // Simulate output accumulation
        currentAgent = {
          ...currentAgent,
          output: appendOutput(currentAgent.output, {
            type: "tool_start",
            tool: "Read",
          }),
        };
        currentAgent = {
          ...currentAgent,
          output: appendOutput(currentAgent.output, {
            type: "tool_result",
            success: true,
          }),
        };

        // === Phase 3: Awaiting User Input ===
        currentAgent = transitionToWaiting(currentAgent);
        expect(currentAgent.status).toBe("waiting");
        expect(canAgentReceiveInstruction(currentAgent)).toBe(true);
        expect(canAgentBeMerged(currentAgent)).toBe(true);

        // Simulate file modifications
        currentAgent = {
          ...currentAgent,
          modifiedFiles: [
            "src/pages/Profile.tsx",
            "src/components/AvatarUpload.tsx",
          ],
          diffStat: "2 files changed, 200 insertions(+), 5 deletions(-)",
        };

        // === Phase 4: Merge Preparation ===
        const validation = validateMerge(currentAgent);
        expect(validation.valid).toBe(true);

        const mergeDesc = getMergeDescription(
          "feat: add user profile with avatar",
          instruction,
        );
        expect(mergeDesc).toBe("feat: add user profile with avatar");

        // === Phase 5: Task Completion ===
        currentAgent = transitionToCompleted(currentAgent);
        expect(currentAgent.status).toBe("completed");

        // Final state assertions
        expect(canAgentBeStarted(currentAgent)).toBe(false);
        expect(canAgentBeStopped(currentAgent)).toBe(false);
        expect(canAgentBeDeleted(currentAgent)).toBe(true);
        expect(canAgentBeReset(currentAgent)).toBe(true);

        // Verify output contains all events
        const outputLines = currentAgent.output.trim().split("\n");
        expect(outputLines.length).toBe(2);
      });
    });

    describe("given task failure and recovery flow", () => {
      const basePath = "/home/developer/api";

      it("then handles error recovery through retry", () => {
        // Create and start agent
        const id = generateId();
        const agent = createAgentData(
          id,
          "api-task",
          "Fix database connection",
          buildWorkspacePath(basePath, id),
          basePath,
          "openai",
          "gpt-4",
        );

        let currentAgent = transitionToRunning(agent);
        currentAgent = {
          ...currentAgent,
          output: appendOutput(currentAgent.output, { type: "start" }),
          modifiedFiles: ["src/db.ts"],
        };

        // Error occurs
        currentAgent = transitionToError(
          currentAgent,
          "Database connection timeout",
        );
        expect(currentAgent.status).toBe("error");
        expect(currentAgent.output).toContain("timeout");

        // Retry
        expect(canAgentBeReset(currentAgent)).toBe(true);
        const retryAgent = resetAgentForRetry(currentAgent);

        expect(retryAgent.status).toBe("pending");
        expect(retryAgent.output).toBe("");
        expect(retryAgent.modifiedFiles).toEqual([]);
        expect(canAgentBeStarted(retryAgent)).toBe(true);

        // Second attempt succeeds
        currentAgent = transitionToRunning(retryAgent);
        currentAgent = transitionToWaiting(currentAgent);
        currentAgent = transitionToCompleted(currentAgent);

        expect(currentAgent.status).toBe("completed");
      });
    });
  });
});
