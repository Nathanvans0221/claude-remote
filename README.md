# Claude Remote v2

Access Claude Code from anywhere — phone, tablet, any browser. Full multi-turn sessions with real-time streaming, project awareness, and session continuity across devices.

## Quick Start (Local)

```bash
npm run install:all
npm run build:web
npm run dev          # API on :3001, Web on :5173
```

Open http://localhost:5173 — password: `clauderemote`

## Architecture

```
Phone/Browser ──► React PWA ──► Express API ──► Claude Code CLI
                     │              │                │
                     │         WebSocket         --resume
                     │         (streaming)       (multi-turn)
                     │              │                │
                     └──────── SQLite ◄─────────────┘
                           (sessions + messages)
```

## Features

- **Multi-turn sessions** — conversations persist, Claude `--resume` for context continuity
- **Real-time streaming** — WebSocket pushes Claude output as it generates
- **Project picker** — all registered projects auto-discovered, correct CWD + CLAUDE.md
- **Password auth** — token-based, stored in localStorage
- **Mobile-first PWA** — installable, responsive, dark theme
- **Tool visibility** — see which tools Claude is using in real-time
- **Session management** — create, switch, delete sessions from any device

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + TypeScript + Tailwind CSS + Vite |
| Backend | Express + SQLite (better-sqlite3) + ws |
| Streaming | WebSocket (ws library) |
| Claude | CLI spawn with `--output-format stream-json` + `--resume` |

## Access from Phone (Same Network)

Your WSL2 machine forwards ports to Windows. On your phone:

1. Find Windows IP: `ipconfig` → look for your WiFi adapter IP (e.g., 192.168.1.x)
2. Open `http://192.168.1.x:3001` on your phone
3. Login with the password

## Deploy to VM (24/7 Access)

```bash
ssh root@YOUR_VM_IP
# Setup
git clone https://github.com/Nathanvans0221/claude-remote.git
cd claude-remote
chmod +x deploy/*.sh
./deploy/setup-vm.sh

# Auth Claude
claude auth login

# Install as service
sudo ./deploy/install-service.sh
```

Then open `http://YOUR_VM_IP:3001` from anywhere.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_REMOTE_PASSWORD` | `clauderemote` | Login password |
| `PORT` | `3001` | Server port |
| `PROJECTS_DIR` | `/mnt/c/Users/NathanvanWingerden` | Base projects directory |
| `CLAUDE_BIN` | `claude` | Path to Claude CLI |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth` | Login → get token |
| GET | `/api/projects` | List available projects |
| GET | `/api/sessions` | List sessions |
| POST | `/api/sessions` | Create session |
| GET | `/api/sessions/:id` | Get session + messages |
| DELETE | `/api/sessions/:id` | Delete session |
| POST | `/api/sessions/:id/messages` | Send message |
| POST | `/api/sessions/:id/reset` | Reset stuck session |
| GET | `/api/status` | Server health |
| WS | `/ws?token=xxx` | Real-time streaming |
