# Pi Swarm

Multi-agent orchestration for pi coding agents. Each agent works in an isolated jujutsu workspace, and you can merge changes back to the main workspace when ready.

![Screenshot](./screenshot.png)

## Features

- **Parallel Agents**: Run multiple pi agents simultaneously with configurable concurrency
- **Isolated Workspaces**: Each agent works in its own jujutsu workspace
- **Real-time Updates**: WebSocket-based streaming of agent output, modified files, and diffs
- **Intercept & Instruct**: Send new instructions to running agents
- **Merge Changes**: Incorporate agent changes to main workspace with jj squash
- **Code Review**: Review diffs before merging
- **Jujutsu Integration**: View jj status and revision log per agent
- **Persistent State**: Agent state and sessions persist across restarts
- **Model Selection**: Choose from available AI models across providers

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      React Frontend (Vite)                       │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────┐ ┌───────────┐  │
│  │ AgentCard   │ │ConversationLog│ │ DiffViewer │ │ReviewMode │  │
│  └─────────────┘ └──────────────┘ └────────────┘ └───────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ai-elements: conversation, message, thinking, tool, code    ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                    │ HTTP REST API    │ WebSocket Events
                    ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Elysia Backend (Bun)                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ server.ts: HTTP/WS Server, Agent Lifecycle, Persistence  │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐   │
│  │ core.ts: Types,     │  │ server-logic.ts: Business Logic │   │
│  │ Pure Functions,     │  │ WebSocket Message Handling      │   │
│  │ State Transitions   │  │                                 │   │
│  └─────────────────────┘  └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │ @mariozechner/pi-coding-agent │
              │   SessionManager, ModelRegistry│
              └───────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │   Agent 1     │ │   Agent 2     │ │   Agent N     │
    │ (jj workspace)│ │ (jj workspace)│ │ (jj workspace)│
    │  Pi Session   │ │  Pi Session   │ │  Pi Session   │
    └───────────────┘ └───────────────┘ └───────────────┘
```

### Agent States

```
pending ──▶ running ──▶ completed
              │              │
              ├──▶ waiting ──┤
              │              │
              ├──▶ stopped ──┤
              │              │
              └──▶ error ────┘
```

## Prerequisites

- [jujutsu](https://github.com/jj-vcs/jj) (jj)
- [Bun](https://bun.sh)
- [pi coding agent](https://github.com/badlogic/pi-mono)

## Installation

### Run directly with bunx (recommended)

```bash
bunx github:knoopx/pi-swarm#release
```

### Install globally

```bash
bun add -g github:knoopx/pi-swarm#release
pi-swarm
```

### Development

1. **Install dependencies**:

   ```bash
   bun install
   cd src/frontend && bun install
   ```

2. **Start dev server** (with hot reload):

   ```bash
   bun run dev
   ```

3. **Or build and start**:

   ```bash
   bun run build
   bun run start
   ```

4. **Open in browser**: http://localhost:3001

## API

### REST Endpoints

| Method | Endpoint                   | Description              |
| ------ | -------------------------- | ------------------------ |
| GET    | `/api/agents`              | List all agents          |
| GET    | `/api/agents/:id`          | Get agent details        |
| POST   | `/api/agents`              | Create new agent         |
| POST   | `/api/agents/:id/start`    | Start agent execution    |
| POST   | `/api/agents/:id/stop`     | Stop running agent       |
| POST   | `/api/agents/:id/instruct` | Send new instruction     |
| GET    | `/api/agents/:id/diff`     | Get full workspace diff  |
| POST   | `/api/agents/:id/merge`    | Merge changes to main    |
| DELETE | `/api/agents/:id`          | Delete agent & workspace |
| GET    | `/api/models`              | List available AI models |

### WebSocket Events

Connect to `/ws` for real-time updates:

| Event Type      | Description                          |
| --------------- | ------------------------------------ |
| `agents`        | Full agent list (initial connection) |
| `agent_created` | New agent created                    |
| `agent_updated` | Agent state changed                  |
| `agent_deleted` | Agent removed                        |
| `agent_output`  | Streaming agent output               |

## How It Works

1. **Create Agent**: Specify an instruction (name is auto-generated from instruction)
2. **Workspace Creation**: A jujutsu workspace is created linked to the base repo
3. **Agent Execution**: Pi SDK creates an agent session in the workspace
4. **Monitor Progress**: View output, modified files, jj status/log in real-time via WebSocket
5. **Intercept**: Send new instructions to modify agent behavior mid-execution
6. **Review**: Review the diff before merging
7. **Merge**: Use `jj squash` to incorporate changes back to main workspace

## Project Structure

```
pi-swarm/
├── bin/
│   └── pi-swarm.ts              # CLI entry point
├── src/
│   ├── server.ts                # Elysia HTTP/WS server, agent lifecycle
│   ├── core.ts                  # Pure functions, types, state transitions
│   ├── server-logic.ts          # Business logic helpers
│   ├── *.test.ts                # Unit tests
│   └── frontend/                # React + Vite frontend
│       └── src/
│           ├── main.tsx         # App entry point
│           ├── types.ts         # Frontend type definitions
│           ├── components/
│           │   ├── AgentCard.tsx
│           │   ├── ConversationLog.tsx
│           │   ├── CreateAgentForm.tsx
│           │   ├── DiffViewer.tsx
│           │   ├── ReviewMode.tsx
│           │   ├── ModelSelector.tsx
│           │   ├── FilesList.tsx
│           │   ├── ai-elements/      # Conversation rendering
│           │   │   ├── conversation.tsx
│           │   │   ├── message.tsx
│           │   │   ├── thinking.tsx
│           │   │   ├── tool.tsx
│           │   │   ├── code-block.tsx
│           │   │   └── prompt-input.tsx
│           │   └── ui/               # Reusable UI components
│           └── lib/
│               ├── conversation-state.ts  # Conversation state management
│               ├── parsing.ts             # Output parsing utilities
│               ├── events.ts              # WebSocket event handling
│               ├── store-utils.ts         # State store helpers
│               └── utils.ts               # General utilities
├── dist/                        # Built frontend (created on install)
└── .pi/swarm/                   # Runtime data (per-project)
    ├── sessions/                # Persisted agent sessions
    │   └── <agent-id>/
    │       └── agent.json       # Agent metadata
    └── workspaces/              # Agent jj workspaces
        └── <agent-id>/          # Isolated jj workspace
```

### Core Modules

| Module            | Responsibility                                              |
| ----------------- | ----------------------------------------------------------- |
| `server.ts`       | HTTP/WS API, agent lifecycle, session persistence           |
| `core.ts`         | Pure functions, `Agent` type, state transitions, validation |
| `server-logic.ts` | WebSocket message handling, testable business logic         |

### Frontend Components

| Component         | Purpose                                            |
| ----------------- | -------------------------------------------------- |
| `AgentCard`       | Individual agent display with controls             |
| `ConversationLog` | Renders agent conversation history                 |
| `CreateAgentForm` | New agent creation form                            |
| `DiffViewer`      | Code diff visualization                            |
| `ReviewMode`      | Pre-merge review interface                         |
| `ModelSelector`   | AI model picker dropdown                           |
| `ai-elements/*`   | Conversation rendering (messages, tools, thinking) |

## Testing

```bash
# Run all tests
bun test

# Watch mode
bun test --watch
```

## Future Improvements

- [ ] Agent task queue with dependencies
- [ ] Conflict detection before merge
- [ ] Agent templates/presets
- [ ] Multi-project support

## License

MIT
