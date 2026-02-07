import { describe, it, expect, beforeEach } from "bun:test";
import {
  createSuccessResponse,
  createErrorResponse,
  formatResponse,
  formatBroadcastEvent,
  formatModelInfo,
  formatModelsInfo,
  createInitMessage,
  createAgentCreatedEvent,
  createAgentUpdatedEvent,
  createAgentDeletedEvent,
  createAgentEventBroadcast,
  isValidCommand,
  isValidWsRequest,
  extractAgentId,
  extractInstruction,
  extractModelParams,
  extractCreateAgentParams,
  routeCommand,
  broadcastToClients,
  parseWsMessage,
  type WsRequest,
  type WsClient,
  type CommandContext,
} from "./server-logic";
import type { Agent } from "./core";

// Test fixtures
function createTestAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "test-agent-id",
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
    model: "claude-3",
    provider: "anthropic",
    ...overrides,
  };
}

function createMockWsClient(): WsClient & { messages: string[] } {
  const messages: string[] = [];
  return {
    messages,
    send: (data: string) => {
      messages.push(data);
    },
  };
}

function createFailingWsClient(): WsClient {
  return {
    send: () => {
      throw new Error("Connection closed");
    },
  };
}

describe("server-logic", () => {
  describe("createSuccessResponse", () => {
    describe("given request id and data", () => {
      describe("when creating success response", () => {
        it("then returns response with success true", () => {
          const response = createSuccessResponse("req-1", { foo: "bar" });
          expect(response.success).toBe(true);
        });

        it("then includes request id", () => {
          const response = createSuccessResponse("req-123", { foo: "bar" });
          expect(response.id).toBe("req-123");
        });

        it("then includes data", () => {
          const response = createSuccessResponse("req-1", { foo: "bar" });
          expect(response.data).toEqual({ foo: "bar" });
        });

        it("then sets type to response", () => {
          const response = createSuccessResponse("req-1", { foo: "bar" });
          expect(response.type).toBe("response");
        });
      });
    });

    describe("given request id without data", () => {
      describe("when creating success response", () => {
        it("then data is undefined", () => {
          const response = createSuccessResponse("req-1");
          expect(response.data).toBeUndefined();
        });
      });
    });
  });

  describe("createErrorResponse", () => {
    describe("given request id and error message", () => {
      describe("when creating error response", () => {
        it("then returns response with success false", () => {
          const response = createErrorResponse("req-1", "Something went wrong");
          expect(response.success).toBe(false);
        });

        it("then includes request id", () => {
          const response = createErrorResponse("req-123", "Error");
          expect(response.id).toBe("req-123");
        });

        it("then includes error message", () => {
          const response = createErrorResponse("req-1", "Something went wrong");
          expect(response.error).toBe("Something went wrong");
        });

        it("then sets type to response", () => {
          const response = createErrorResponse("req-1", "Error");
          expect(response.type).toBe("response");
        });
      });
    });
  });

  describe("formatResponse", () => {
    describe("given a response object", () => {
      describe("when formatting", () => {
        it("then returns valid JSON string", () => {
          const response = createSuccessResponse("req-1", { data: "test" });
          const formatted = formatResponse(response);
          expect(() => JSON.parse(formatted)).not.toThrow();
        });

        it("then JSON parses back to original", () => {
          const response = createErrorResponse("req-1", "Error message");
          const formatted = formatResponse(response);
          expect(JSON.parse(formatted)).toEqual(response);
        });
      });
    });
  });

  describe("formatBroadcastEvent", () => {
    describe("given an event object", () => {
      describe("when formatting", () => {
        it("then returns valid JSON string", () => {
          const event = { type: "agent_updated", agentId: "123" };
          const formatted = formatBroadcastEvent(event);
          expect(() => JSON.parse(formatted)).not.toThrow();
        });

        it("then preserves all event properties", () => {
          const event = {
            type: "agent_event",
            agentId: "123",
            event: { type: "tool_call", data: "test" },
          };
          const formatted = formatBroadcastEvent(event);
          expect(JSON.parse(formatted)).toEqual(event);
        });
      });
    });
  });

  describe("formatModelInfo", () => {
    describe("given a model object", () => {
      describe("when formatting", () => {
        it("then returns ModelInfo structure", () => {
          const model = { provider: "anthropic", id: "claude-3" };
          const info = formatModelInfo(model);
          expect(info).toEqual({
            provider: "anthropic",
            modelId: "claude-3",
            name: "anthropic/claude-3",
          });
        });
      });
    });

    describe("given various providers", () => {
      const cases = [
        {
          model: { provider: "openai", id: "gpt-4" },
          expected: {
            provider: "openai",
            modelId: "gpt-4",
            name: "openai/gpt-4",
          },
        },
        {
          model: { provider: "google", id: "gemini-pro" },
          expected: {
            provider: "google",
            modelId: "gemini-pro",
            name: "google/gemini-pro",
          },
        },
      ];

      cases.forEach(({ model, expected }) => {
        describe(`when provider is ${model.provider}`, () => {
          it(`then formats as ${expected.name}`, () => {
            expect(formatModelInfo(model)).toEqual(expected);
          });
        });
      });
    });
  });

  describe("formatModelsInfo", () => {
    describe("given array of models", () => {
      describe("when formatting", () => {
        it("then returns array of ModelInfo", () => {
          const models = [
            { provider: "anthropic", id: "claude-3" },
            { provider: "openai", id: "gpt-4" },
          ];
          const result = formatModelsInfo(models);
          expect(result).toHaveLength(2);
          expect(result[0].name).toBe("anthropic/claude-3");
          expect(result[1].name).toBe("openai/gpt-4");
        });
      });
    });

    describe("given empty array", () => {
      describe("when formatting", () => {
        it("then returns empty array", () => {
          expect(formatModelsInfo([])).toEqual([]);
        });
      });
    });
  });

  describe("createInitMessage", () => {
    describe("given agents and models", () => {
      describe("when creating init message", () => {
        it("then returns JSON string with type init", () => {
          const agents = [createTestAgent()];
          const models = [
            {
              provider: "anthropic",
              modelId: "claude-3",
              name: "anthropic/claude-3",
            },
          ];
          const message = createInitMessage(agents, models);
          const parsed = JSON.parse(message);
          expect(parsed.type).toBe("init");
        });

        it("then includes serialized agents without session", () => {
          const agent = createTestAgent({ session: {} as never });
          const message = createInitMessage([agent], []);
          const parsed = JSON.parse(message);
          expect(parsed.agents[0]).not.toHaveProperty("session");
          expect(parsed.agents[0].id).toBe(agent.id);
        });

        it("then includes models", () => {
          const models = [
            {
              provider: "anthropic",
              modelId: "claude-3",
              name: "anthropic/claude-3",
            },
          ];
          const message = createInitMessage([], models);
          const parsed = JSON.parse(message);
          expect(parsed.models).toEqual(models);
        });
      });
    });
  });

  describe("createAgentCreatedEvent", () => {
    describe("given an agent", () => {
      describe("when creating event", () => {
        it("then returns event with type agent_created", () => {
          const agent = createTestAgent();
          const event = createAgentCreatedEvent(agent);
          expect(event.type).toBe("agent_created");
        });

        it("then includes serialized agent", () => {
          const agent = createTestAgent({ id: "agent-123" });
          const event = createAgentCreatedEvent(agent);
          expect(event.agent.id).toBe("agent-123");
        });

        it("then excludes session from agent", () => {
          const agent = createTestAgent({ session: {} as never });
          const event = createAgentCreatedEvent(agent);
          expect(event.agent).not.toHaveProperty("session");
        });
      });
    });
  });

  describe("createAgentUpdatedEvent", () => {
    describe("given an agent", () => {
      describe("when creating event", () => {
        it("then returns event with type agent_updated", () => {
          const agent = createTestAgent();
          const event = createAgentUpdatedEvent(agent);
          expect(event.type).toBe("agent_updated");
        });

        it("then includes serialized agent", () => {
          const agent = createTestAgent({ status: "running" });
          const event = createAgentUpdatedEvent(agent);
          expect(event.agent.status).toBe("running");
        });
      });
    });
  });

  describe("createAgentDeletedEvent", () => {
    describe("given an agent id", () => {
      describe("when creating event", () => {
        it("then returns event with type agent_deleted", () => {
          const event = createAgentDeletedEvent("agent-123");
          expect(event.type).toBe("agent_deleted");
        });

        it("then includes agent id", () => {
          const event = createAgentDeletedEvent("agent-123");
          expect(event.agentId).toBe("agent-123");
        });
      });
    });
  });

  describe("createAgentEventBroadcast", () => {
    describe("given agent id and event data", () => {
      describe("when creating broadcast", () => {
        it("then returns broadcast with type agent_event", () => {
          const broadcast = createAgentEventBroadcast("agent-1", {
            type: "tool_call",
          });
          expect(broadcast.type).toBe("agent_event");
        });

        it("then includes agent id", () => {
          const broadcast = createAgentEventBroadcast("agent-123", {});
          expect(broadcast.agentId).toBe("agent-123");
        });

        it("then includes event data", () => {
          const eventData = { type: "tool_call", toolName: "Read" };
          const broadcast = createAgentEventBroadcast("agent-1", eventData);
          expect(broadcast.event).toEqual(eventData);
        });
      });
    });
  });

  describe("isValidCommand", () => {
    describe("given valid command types", () => {
      const validCommands = [
        "create_agent",
        "start_agent",
        "stop_agent",
        "instruct_agent",
        "set_model",
        "get_diff",
        "merge_agent",
        "delete_agent",
        "fetch_agent",
      ];

      validCommands.forEach((cmd) => {
        describe(`when command is "${cmd}"`, () => {
          it("then returns true", () => {
            expect(isValidCommand(cmd)).toBe(true);
          });
        });
      });
    });

    describe("given invalid command types", () => {
      const invalidCommands = [
        "invalid_command",
        "CREATE_AGENT",
        "unknown",
        "",
        "agent_create",
      ];

      invalidCommands.forEach((cmd) => {
        describe(`when command is "${cmd}"`, () => {
          it("then returns false", () => {
            expect(isValidCommand(cmd)).toBe(false);
          });
        });
      });
    });
  });

  describe("isValidWsRequest", () => {
    describe("given valid request", () => {
      describe("when validating", () => {
        it("then returns true for valid request", () => {
          const request = { id: "req-1", type: "create_agent" };
          expect(isValidWsRequest(request)).toBe(true);
        });

        it("then returns true with additional properties", () => {
          const request = {
            id: "req-1",
            type: "create_agent",
            name: "test",
            extra: "data",
          };
          expect(isValidWsRequest(request)).toBe(true);
        });
      });
    });

    describe("given invalid request", () => {
      const invalidCases = [
        { input: null, reason: "null" },
        { input: undefined, reason: "undefined" },
        { input: "string", reason: "string" },
        { input: 123, reason: "number" },
        { input: { type: "test" }, reason: "missing id" },
        { input: { id: "test" }, reason: "missing type" },
        { input: { id: 123, type: "test" }, reason: "id not string" },
        { input: { id: "test", type: 123 }, reason: "type not string" },
      ];

      invalidCases.forEach(({ input, reason }) => {
        describe(`when input is ${reason}`, () => {
          it("then returns false", () => {
            expect(isValidWsRequest(input)).toBe(false);
          });
        });
      });
    });
  });

  describe("extractAgentId", () => {
    describe("given message with valid agentId", () => {
      describe("when extracting", () => {
        it("then returns the agent id", () => {
          const message: WsRequest = {
            id: "req-1",
            type: "start_agent",
            agentId: "agent-123",
          };
          expect(extractAgentId(message)).toBe("agent-123");
        });
      });
    });

    describe("given message without agentId", () => {
      describe("when extracting", () => {
        it("then returns null", () => {
          const message: WsRequest = { id: "req-1", type: "start_agent" };
          expect(extractAgentId(message)).toBeNull();
        });
      });
    });

    describe("given message with empty agentId", () => {
      describe("when extracting", () => {
        it("then returns null", () => {
          const message: WsRequest = {
            id: "req-1",
            type: "start_agent",
            agentId: "",
          };
          expect(extractAgentId(message)).toBeNull();
        });
      });
    });

    describe("given message with non-string agentId", () => {
      describe("when extracting", () => {
        it("then returns null", () => {
          const message: WsRequest = {
            id: "req-1",
            type: "start_agent",
            agentId: 123 as unknown as string,
          };
          expect(extractAgentId(message)).toBeNull();
        });
      });
    });
  });

  describe("extractInstruction", () => {
    describe("given message with instruction", () => {
      describe("when extracting", () => {
        it("then returns the instruction", () => {
          const message: WsRequest = {
            id: "req-1",
            type: "instruct_agent",
            instruction: "Fix the bug",
          };
          expect(extractInstruction(message)).toBe("Fix the bug");
        });
      });
    });

    describe("given message without instruction", () => {
      describe("when extracting", () => {
        it("then returns empty string", () => {
          const message: WsRequest = { id: "req-1", type: "instruct_agent" };
          expect(extractInstruction(message)).toBe("");
        });
      });
    });

    describe("given message with non-string instruction", () => {
      describe("when extracting", () => {
        it("then returns empty string", () => {
          const message: WsRequest = {
            id: "req-1",
            type: "instruct_agent",
            instruction: 123 as unknown as string,
          };
          expect(extractInstruction(message)).toBe("");
        });
      });
    });
  });

  describe("extractModelParams", () => {
    describe("given message with provider and model", () => {
      describe("when extracting", () => {
        it("then returns both params", () => {
          const message: WsRequest = {
            id: "req-1",
            type: "set_model",
            provider: "anthropic",
            model: "claude-3",
          };
          expect(extractModelParams(message)).toEqual({
            provider: "anthropic",
            model: "claude-3",
          });
        });
      });
    });

    describe("given message missing provider", () => {
      describe("when extracting", () => {
        it("then returns null", () => {
          const message: WsRequest = {
            id: "req-1",
            type: "set_model",
            model: "claude-3",
          };
          expect(extractModelParams(message)).toBeNull();
        });
      });
    });

    describe("given message missing model", () => {
      describe("when extracting", () => {
        it("then returns null", () => {
          const message: WsRequest = {
            id: "req-1",
            type: "set_model",
            provider: "anthropic",
          };
          expect(extractModelParams(message)).toBeNull();
        });
      });
    });
  });

  describe("extractCreateAgentParams", () => {
    describe("given message with all params", () => {
      describe("when extracting", () => {
        it("then returns all params", () => {
          const message: WsRequest = {
            id: "req-1",
            type: "create_agent",
            name: "my-agent",
            instruction: "Do something",
            provider: "anthropic",
            model: "claude-3",
          };
          expect(extractCreateAgentParams(message)).toEqual({
            name: "my-agent",
            instruction: "Do something",
            provider: "anthropic",
            model: "claude-3",
          });
        });
      });
    });

    describe("given message with minimal params", () => {
      describe("when extracting", () => {
        it("then returns defaults for missing params", () => {
          const message: WsRequest = { id: "req-1", type: "create_agent" };
          expect(extractCreateAgentParams(message)).toEqual({
            name: "unnamed",
            instruction: "",
            provider: undefined,
            model: undefined,
          });
        });
      });
    });
  });

  describe("routeCommand", () => {
    let context: CommandContext;
    let testAgent: Agent;

    beforeEach(() => {
      testAgent = createTestAgent({ id: "existing-agent" });
      const agentsMap = new Map<string, Agent>();
      agentsMap.set("existing-agent", testAgent);

      context = {
        agents: agentsMap,
        getAgent: (id) => agentsMap.get(id),
      };
    });

    describe("given invalid command type", () => {
      describe("when routing", () => {
        it("then returns error", () => {
          const message: WsRequest = { id: "req-1", type: "invalid" };
          const result = routeCommand("invalid", message, context);
          expect(result.valid).toBe(false);
          if (!result.valid) {
            expect(result.error).toBe("Unknown command: invalid");
          }
        });
      });
    });

    describe("given create_agent command", () => {
      describe("when routing", () => {
        it("then returns valid without agent", () => {
          const message: WsRequest = {
            id: "req-1",
            type: "create_agent",
            name: "new-agent",
          };
          const result = routeCommand("create_agent", message, context);
          expect(result.valid).toBe(true);
          if (result.valid) {
            expect(result.agent).toBeUndefined();
            expect(result.params).toEqual({
              name: "new-agent",
              instruction: "",
              provider: undefined,
              model: undefined,
            });
          }
        });
      });
    });

    describe("given command requiring agent", () => {
      describe("when agent exists", () => {
        it("then returns valid with agent", () => {
          const message: WsRequest = {
            id: "req-1",
            type: "start_agent",
            agentId: "existing-agent",
          };
          const result = routeCommand("start_agent", message, context);
          expect(result.valid).toBe(true);
          if (result.valid) {
            expect(result.agent).toBe(testAgent);
          }
        });
      });

      describe("when agent does not exist", () => {
        it("then returns error", () => {
          const message: WsRequest = {
            id: "req-1",
            type: "start_agent",
            agentId: "nonexistent",
          };
          const result = routeCommand("start_agent", message, context);
          expect(result.valid).toBe(false);
          if (!result.valid) {
            expect(result.error).toBe("Agent not found");
          }
        });
      });

      describe("when agent id is missing", () => {
        it("then returns error", () => {
          const message: WsRequest = { id: "req-1", type: "start_agent" };
          const result = routeCommand("start_agent", message, context);
          expect(result.valid).toBe(false);
          if (!result.valid) {
            expect(result.error).toBe("Missing agent ID");
          }
        });
      });
    });

    describe("given instruct_agent command", () => {
      describe("when routing", () => {
        it("then extracts instruction param", () => {
          const message: WsRequest = {
            id: "req-1",
            type: "instruct_agent",
            agentId: "existing-agent",
            instruction: "Do this",
          };
          const result = routeCommand("instruct_agent", message, context);
          expect(result.valid).toBe(true);
          if (result.valid) {
            expect(result.params).toEqual({ instruction: "Do this" });
          }
        });
      });
    });

    describe("given set_model command", () => {
      describe("when model params are valid", () => {
        it("then extracts model params", () => {
          const message: WsRequest = {
            id: "req-1",
            type: "set_model",
            agentId: "existing-agent",
            provider: "openai",
            model: "gpt-4",
          };
          const result = routeCommand("set_model", message, context);
          expect(result.valid).toBe(true);
          if (result.valid) {
            expect(result.params).toEqual({
              provider: "openai",
              model: "gpt-4",
            });
          }
        });
      });

      describe("when model params are missing", () => {
        it("then returns error", () => {
          const message: WsRequest = {
            id: "req-1",
            type: "set_model",
            agentId: "existing-agent",
          };
          const result = routeCommand("set_model", message, context);
          expect(result.valid).toBe(false);
          if (!result.valid) {
            expect(result.error).toBe("Missing provider or model");
          }
        });
      });
    });
  });

  describe("broadcastToClients", () => {
    describe("given multiple connected clients", () => {
      describe("when broadcasting event", () => {
        it("then sends to all clients", () => {
          const clients = new Set<WsClient>();
          const client1 = createMockWsClient();
          const client2 = createMockWsClient();
          clients.add(client1);
          clients.add(client2);

          const event = { type: "agent_updated", agentId: "123" };
          const result = broadcastToClients(clients, event);

          expect(result.sent).toBe(2);
          expect(result.failed).toBe(0);
          expect(client1.messages).toHaveLength(1);
          expect(client2.messages).toHaveLength(1);
        });

        it("then sends JSON formatted event", () => {
          const clients = new Set<WsClient>();
          const client = createMockWsClient();
          clients.add(client);

          const event = { type: "test", data: "value" };
          broadcastToClients(clients, event);

          expect(JSON.parse(client.messages[0])).toEqual(event);
        });
      });
    });

    describe("given some failing clients", () => {
      describe("when broadcasting event", () => {
        it("then removes failed clients from set", () => {
          const clients = new Set<WsClient>();
          const goodClient = createMockWsClient();
          const badClient = createFailingWsClient();
          clients.add(goodClient);
          clients.add(badClient);

          broadcastToClients(clients, { type: "test" });

          expect(clients.size).toBe(1);
          expect(clients.has(goodClient)).toBe(true);
          expect(clients.has(badClient)).toBe(false);
        });

        it("then reports correct sent/failed counts", () => {
          const clients = new Set<WsClient>();
          clients.add(createMockWsClient());
          clients.add(createFailingWsClient());
          clients.add(createMockWsClient());
          clients.add(createFailingWsClient());

          const result = broadcastToClients(clients, { type: "test" });

          expect(result.sent).toBe(2);
          expect(result.failed).toBe(2);
        });
      });
    });

    describe("given empty client set", () => {
      describe("when broadcasting event", () => {
        it("then returns zero counts", () => {
          const clients = new Set<WsClient>();
          const result = broadcastToClients(clients, { type: "test" });
          expect(result.sent).toBe(0);
          expect(result.failed).toBe(0);
        });
      });
    });
  });

  describe("parseWsMessage", () => {
    describe("given valid JSON string", () => {
      describe("when parsing", () => {
        it("then returns parsed WsRequest", () => {
          const json = JSON.stringify({ id: "req-1", type: "test" });
          const result = parseWsMessage(json);
          expect(result).toEqual({ id: "req-1", type: "test" });
        });
      });
    });

    describe("given valid object", () => {
      describe("when parsing", () => {
        it("then returns the object if valid", () => {
          const obj = { id: "req-1", type: "test", extra: "data" };
          const result = parseWsMessage(obj);
          expect(result).toEqual(obj);
        });
      });
    });

    describe("given invalid JSON string", () => {
      describe("when parsing", () => {
        it("then returns error", () => {
          const result = parseWsMessage("not valid json");
          expect("error" in result).toBe(true);
          if ("error" in result) {
            expect(result.error).toContain("Failed to parse message");
          }
        });
      });
    });

    describe("given object missing required fields", () => {
      describe("when parsing", () => {
        it("then returns error for missing id", () => {
          const result = parseWsMessage({ type: "test" });
          expect("error" in result).toBe(true);
          if ("error" in result) {
            expect(result.error).toContain("Invalid message format");
          }
        });

        it("then returns error for missing type", () => {
          const result = parseWsMessage({ id: "req-1" });
          expect("error" in result).toBe(true);
        });
      });
    });
  });
});
