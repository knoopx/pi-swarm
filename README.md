# Pi Swarm

Multi-agent orchestration for pi coding agents. Each agent works in an isolated jujutsu workspace, and you can merge changes back to the main workspace when ready.

![Screenshot](./screenshot.png)

## Features

- **Parallel Agents**: Run multiple pi agents simultaneously
- **Isolated Workspaces**: Each agent works in its own jujutsu workspace
- **Real-time Updates**: See agent output, modified files, and diffs in real-time
- **Intercept & Instruct**: Send new instructions to running agents
- **Merge Changes**: Incorporate agent changes to main workspace with jj squash
- **Code Review**: Review diffs before merging
- **Jujutsu Integration**: View jj status and revision log per agent
- **Persistent State**: Agent state persists across restarts

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

1. **Create Agent**: Specify an instruction (name is auto-generated)
2. **Workspace Creation**: A jujutsu workspace is created linked to the base repo
3. **Agent Execution**: Pi SDK creates an agent session in the workspace
4. **Monitor Progress**: View output, modified files, jj status/log in real-time
5. **Intercept**: Send new instructions to modify agent behavior
6. **Review**: Review the diff before merging
7. **Merge**: Use `jj squash` to incorporate changes back to main workspace

## Project Structure

```
pi-swarm/
├── .pi/swarm/                # Swarm data directory
│   ├── agents.json           # Persisted agent state
│   └── workspaces/           # Agent workspaces
│       ├── abc12345/         # Agent workspace (jj workspace)
│       └── def67890/
├── backend/
│   ├── server.ts             # Elysia API server with Pi SDK
│   ├── core.ts               # Core types and helpers
│   └── core.test.ts          # Backend tests
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── ai-elements/  # Conversation display components
│   │   │   └── ui/           # shadcn/ui components
│   │   ├── lib/              # Utilities and state management
│   │   ├── store.ts          # Zustand store
│   │   └── App.tsx           # Main app component
│   └── dist/                 # Built frontend (production)
└── package.json              # Root package with dev scripts
```

## Future Improvements

- [ ] WebSocket/SSE for real-time streaming instead of polling
- [ ] Agent task queue with dependencies
- [ ] Conflict detection before merge
- [ ] Agent templates/presets
