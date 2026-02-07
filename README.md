# Pi Swarm

Multi-agent orchestration for pi coding agents. Each agent works in an isolated jujutsu workspace, and you can merge changes back to the main workspace when ready.

## Features

- **Parallel Agents**: Run multiple pi agents simultaneously
- **Isolated Workspaces**: Each agent works in its own jujutsu workspace
- **Real-time Updates**: See agent output, modified files, and diffs in real-time
- **Intercept & Instruct**: Send new instructions to running agents
- **Merge Changes**: Incorporate agent changes back to main workspace with jj squash
- **Code Review**: Review diffs and add inline comments before merging

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React Frontend                          │
│  (Agent cards, status, output, diffs, review mode)          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Bun + Pi SDK Backend                      │
│  (REST API, Agent Sessions, Workspace Management)           │
└─────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │   Agent 1     │ │   Agent 2     │ │   Agent N     │
    │ (jj workspace)│ │ (jj workspace)│ │ (jj workspace)│
    │  Pi Session   │ │  Pi Session   │ │  Pi Session   │
    └───────────────┘ └───────────────┘ └───────────────┘
```

## Prerequisites

- [jujutsu](https://github.com/jj-vcs/jj) (jj)
- [Bun](https://bun.sh)
- [pi coding agent](https://github.com/badlogic/pi-mono)

## Quick Start

1. **Install dependencies**:

   ```bash
   cd pi-swarm
   bun install
   cd frontend && bun install
   cd ../backend && bun install
   ```

2. **Build frontend**:

   ```bash
   bun run build
   ```

3. **Start the server**:

   ```bash
   bun run start
   ```

4. **Open in browser**: http://localhost:3001

## Development

For development with hot-reload:

```bash
# Start both backend and frontend in dev mode
bun run dev
```

Or run them separately:

```bash
# Terminal 1: Backend (with watch mode)
cd backend && bun run dev

# Terminal 2: Frontend (Vite dev server)
cd frontend && bun run dev
```

Then open http://localhost:5173 (Vite proxies API calls to backend).

## API Endpoints

| Method | Endpoint                   | Description              |
| ------ | -------------------------- | ------------------------ |
| GET    | `/api/agents`              | List all agents          |
| GET    | `/api/agents/:id`          | Get agent with status    |
| POST   | `/api/agents`              | Create new agent         |
| POST   | `/api/agents/:id/start`    | Start agent execution    |
| POST   | `/api/agents/:id/stop`     | Stop running agent       |
| POST   | `/api/agents/:id/instruct` | Send new instruction     |
| GET    | `/api/agents/:id/diff`     | Get full workspace diff  |
| POST   | `/api/agents/:id/merge`    | Merge changes to main    |
| DELETE | `/api/agents/:id`          | Delete agent & workspace |

## How It Works

1. **Create Agent**: Specify a name and instruction
2. **Workspace Creation**: A jujutsu workspace is created linked to the base repo
3. **Agent Execution**: Pi SDK creates an agent session in the workspace
4. **Monitor Progress**: View output, modified files, and diffs in real-time
5. **Intercept**: Send new instructions to modify agent behavior
6. **Review**: Add inline comments on the diff
7. **Merge**: Use `jj squash` to incorporate changes back to main workspace

## Workspace Structure

```
pi-swarm/
├── workspaces/           # Agent workspaces
│   ├── abc12345/         # Agent workspace (jj workspace)
│   │   └── ...           # Working files
│   └── def67890/
├── backend/
│   └── server.ts         # Bun API server with Pi SDK
└── frontend/
    └── dist/             # Built frontend
```

## Future Improvements

- [ ] WebSocket/SSE for real-time streaming instead of polling
- [ ] Agent task queue with dependencies
- [ ] Conflict detection before merge
- [ ] Agent templates/presets
- [ ] Persistent state across restarts
