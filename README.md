# Pi Swarm

Multi-agent orchestration for Pi coding agents.

Each agent runs in an isolated Jujutsu workspace, streams output in real time, and can be merged back into your main workspace when ready.

![Screenshot](./screenshot.png)

## Features

- **Parallel agents** with configurable max concurrency (1-10)
- **Queueing scheduler** for pending agents when all slots are busy
- **Isolated jj workspaces** per agent
- **Real-time updates** over WebSocket (agent state + streamed events)
- **Steer running agents** with queued or immediate follow-up instructions
- **Interrupt running agents** and replace direction mid-flight
- **Model selection** per agent
- **Spec refinement flow** (create spec agent, accept refined spec into a new task)
- **Diff + merge workflow** with merge validation
- **Persistent sessions/state** on disk (`.pi/swarm`)

## Prerequisites

- [jujutsu](https://github.com/jj-vcs/jj) (`jj`)
- [Bun](https://bun.sh)
- [pi coding agent](https://github.com/badlogic/pi-mono)

## Installation

### Run directly with bunx

```bash
bunx github:knoopx/pi-swarm#release
```

### Install globally

```bash
bun add -g github:knoopx/pi-swarm#release
pi-swarm
```

## Development

1. Install dependencies:

```bash
bun install
cd src/frontend && bun install
```

2. Start dev mode (backend + Vite frontend):

```bash
bun run dev
```

3. Open:

- Swarm UI: http://localhost:3001

## Production build/run

```bash
bun run build
bun run start
```

## Runtime model

Pi Swarm uses a **single WebSocket endpoint** (`/ws`) for commands and real-time events.

- Initial connection sends an `init` payload with agents, models, completions, cwd, and max concurrency.
- Client commands use request/response envelopes:
  - request: `{ id, type, ...payload }`
  - response: `{ id, type: "response", success, data?, error? }`

## WebSocket Commands

| Command               | Payload                                             | Description                                 |
| --------------------- | --------------------------------------------------- | ------------------------------------------- |
| `create_agent`        | `name`, `instruction`, optional `provider`, `model` | Create a pending agent                      |
| `start_agent`         | `agentId`                                           | Start an agent (or leave queued if no slot) |
| `stop_agent`          | `agentId`                                           | Stop a running agent                        |
| `resume_agent`        | `agentId`, optional `instruction`                   | Resume a stopped agent                      |
| `instruct_agent`      | `agentId`, `instruction`, optional `queue`          | Send follow-up instruction                  |
| `interrupt_agent`     | `agentId`, `instruction`                            | Abort current run and redirect              |
| `set_model`           | `agentId`, `provider`, `model`                      | Change model for agent/session              |
| `get_diff`            | `agentId`                                           | Get full diff                               |
| `merge_agent`         | `agentId`                                           | Merge agent changes into base workspace     |
| `delete_agent`        | `agentId`                                           | Delete agent + workspace                    |
| `fetch_agent`         | `agentId`                                           | Fetch agent details + modified files/stat   |
| `get_completions`     | -                                                   | Get prompt/skill completions                |
| `get_workspace_files` | optional `agentId`                                  | Get file completions for workspace          |
| `set_max_concurrency` | `maxConcurrency`                                    | Set max concurrent running agents           |

## WebSocket Events

| Event                     | Description                        |
| ------------------------- | ---------------------------------- |
| `init`                    | Initial app state after connection |
| `agent_created`           | Agent created                      |
| `agent_updated`           | Agent status/metadata updated      |
| `agent_deleted`           | Agent deleted                      |
| `agent_event`             | Raw streamed session event         |
| `max_concurrency_changed` | Concurrency changed                |

## Agent lifecycle

```text
pending -> running -> waiting
   |         |         |
   |         v         v
   +------> error    stopped
```

- `pending`: created, waiting to run
- `running`: actively executing
- `waiting`: run finished, ready for follow-up/merge
- `stopped`: manually stopped, can be resumed
- `error`: failed, can be restarted with instruction

## Project structure

```text
pi-swarm/
├── bin/
│   └── pi-swarm.ts
├── src/
│   ├── server.ts
│   ├── ws-handlers.ts
│   ├── core.ts
│   ├── persistence.ts
│   ├── workspace.ts
│   ├── *.test.ts
│   └── frontend/
│       ├── package.json
│       └── src/
│           ├── App.tsx
│           ├── store.ts
│           ├── types.ts
│           ├── components/
│           ├── hooks/
│           └── lib/
└── README.md
```

## Testing

```bash
# backend tests
bun test

# frontend tests
cd src/frontend && bun test
```

## License

MIT
