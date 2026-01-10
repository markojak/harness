# ▪ Harness AI

**A visual cockpit for all your coding agents.**

Harness gives you real-time visibility into every Claude Code session running across your entire stack. Monitor multiple agents, track costs, search session history, and never lose context on what your AI is doing.

![Harness Dashboard](https://github.com/markojak/harness-ai/raw/main/docs/screenshot.png)

## Why Harness?

When you're running multiple Claude Code sessions across different projects, terminals, and machines, it's easy to lose track:

- Which agent is working on what?
- How much have I spent today?
- Where was that auth refactor I did last week?
- Did that background task finish?

Harness answers all of this with a terminal-native dashboard that feels like `htop` for your AI coding assistants.

## Features

- **Real-time monitoring** — See all active sessions across projects
- **Kanban view** — Sessions organized by status (Working, Approval, Waiting, Idle)
- **Cost tracking** — Daily spend and token usage at a glance
- **Full-text search** — Find any session by content, powered by SQLite FTS5
- **Commit finder** — Discover which session created a specific git commit
- **Session transcripts** — Review full conversation history with syntax highlighting
- **Bookmarks** — Star important sessions for quick access
- **CLI tools** — Quick stats and search without leaving the terminal

---

## Installation

### npm (recommended)

```bash
npm install -g harness-ai
harness
```

### pnpm

```bash
pnpm add -g harness-ai
harness
```

### From source

```bash
git clone https://github.com/markojak/harness-ai.git
cd harness-ai
pnpm install
pnpm build
node bin/cli.js
```

### Homebrew (coming soon)

```bash
brew install harness-ai
```

---

## Requirements

### Required

| Dependency | Version | Purpose |
|------------|---------|---------|
| Node.js | ≥20.0.0 | Runtime |
| Claude Code | Any | Session data source |

### Recommended

| Dependency | Version | Install | Purpose |
|------------|---------|---------|---------|
| ripgrep | ≥14.0.0 | `brew install ripgrep` | 10x faster search |
| git | ≥2.30.0 | `xcode-select --install` | Commit finder, branch info |

### Check your setup

```bash
harness doctor
```

```
▪ harness doctor

  ✓ Node.js: v22.0.0
  ✓ Data directory: ~/.harness
  ✓ Claude projects: ~/.claude/projects
  ✓ ripgrep: ripgrep 14.1.0
  ✓ git: git version 2.43.0
  ✓ Daemon running: yes

  ℹ 1800 sessions across 23 projects
```

---

## Quick Start

```bash
# Start the dashboard (opens browser)
harness

# Quick stats without UI
harness stats

# Search sessions
harness search "authentication"

# List recent sessions
harness sessions --since 7d

# Check system health
harness doctor
```

---

## CLI Reference

### Commands

| Command | Description |
|---------|-------------|
| `harness` | Start dashboard (default) |
| `harness stats` | Show quick stats |
| `harness sessions` | List recent sessions |
| `harness search <query>` | Full-text search |
| `harness export <id>` | Export session to markdown |
| `harness doctor` | Check system health |
| `harness config` | View/edit configuration |
| `harness index` | Manage search index |
| `harness version` | Show version |
| `harness help` | Show help |

### Start Options

```bash
harness --port 5000      # Custom port (default: 4450)
harness --no-open        # Don't open browser
harness --headless       # API only, no UI serving
harness --watch ~/other  # Watch custom projects directory
```

### Filter Options

```bash
harness sessions --since 24h      # Last 24 hours
harness sessions --since 7d       # Last 7 days
harness sessions --project myapp  # Filter by project
harness sessions --branch main    # Filter by git branch
harness sessions --active         # Only active sessions
```

### Output Options

```bash
harness stats --json           # JSON output for scripting
harness sessions --json        # JSON session list
harness export <id> --json     # JSON transcript
```

---

## Configuration

Configuration is stored in `~/.harness/config.json`.

```json
{
  "port": 4450,
  "resumeFlags": "--continue",
  "watchDir": "~/.claude/projects"
}
```

### Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `port` | number | 4450 | Daemon port |
| `resumeFlags` | string | "" | Custom flags for session resume |
| `watchDir` | string | ~/.claude/projects | Projects directory to watch |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI (bin/cli.js)                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────────┐    │
│  │      Daemon         │    │          UI             │    │
│  │  (packages/daemon)  │    │    (packages/ui)        │    │
│  │                     │    │                         │    │
│  │  • Session watcher  │◄──►│  • React dashboard      │    │
│  │  • SQLite FTS5      │    │  • Durable streams      │    │
│  │  • Cost tracking    │    │  • Session panel        │    │
│  │  • Commit finder    │    │  • Commit search        │    │
│  │  • Status API       │    │                         │    │
│  └─────────────────────┘    └─────────────────────────┘    │
│            │                                                │
│            ▼                                                │
│  ┌─────────────────────┐                                   │
│  │  ~/.claude/projects │  Claude Code session logs         │
│  └─────────────────────┘                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

- **Daemon** — Watches session files, maintains search index, serves API
- **UI** — React dashboard with real-time updates via Durable Streams
- **CLI** — Thin wrapper that starts daemon and provides quick commands

### Data Storage

| Location | Contents |
|----------|----------|
| `~/.claude/projects/` | Claude Code session JSONL files (read-only) |
| `~/.harness/` | Harness data directory |
| `~/.harness/harness.db` | SQLite database (FTS index, bookmarks) |
| `~/.harness/config.json` | User configuration |

---

## Dependencies

### Runtime Dependencies

| Package | Version | License | Purpose |
|---------|---------|---------|---------|
| better-sqlite3 | ^12.6.0 | MIT | SQLite with FTS5 support |
| chokidar | ^4.0.3 | MIT | File system watching |
| @durable-streams/* | ^0.1.5 | MIT | Real-time streaming |
| @anthropic-ai/sdk | ^0.71.2 | MIT | AI summaries (optional) |
| dotenv | ^17.2.3 | BSD-2 | Environment config |
| zod | ^4.3.5 | MIT | Schema validation |
| xstate | ^5.25.0 | MIT | State machines |

### UI Dependencies

| Package | Version | License | Purpose |
|---------|---------|---------|---------|
| react | ^19.2.0 | MIT | UI framework |
| @radix-ui/themes | ^3.2.1 | MIT | Component library |
| @tanstack/react-router | ^1.146.2 | MIT | Routing |
| @tanstack/db | ^0.5.18 | MIT | Client-side DB |

### System Dependencies

| Tool | Required | Install | Purpose |
|------|----------|---------|---------|
| Node.js ≥20 | ✅ Yes | nodejs.org | Runtime |
| ripgrep | ⭐ Recommended | `brew install ripgrep` | Fast search |
| git | ⭐ Recommended | `xcode-select --install` | Commit finder |
| SQLite | Bundled | — | Included in better-sqlite3 |

---

## Development

### Setup

```bash
git clone https://github.com/markojak/harness-ai.git
cd harness-ai
pnpm install
```

### Development mode

```bash
# Start daemon + UI with hot reload
pnpm start

# Or separately:
pnpm --filter @claude-code-ui/daemon start
pnpm --filter @claude-code-ui/ui dev
```

### Build

```bash
pnpm build
```

### Test

```bash
pnpm test
```

### Project Structure

```
harness-ai/
├── bin/
│   └── cli.js              # CLI entry point
├── packages/
│   ├── daemon/             # Backend service
│   │   └── src/
│   │       ├── serve.ts    # Main entry
│   │       ├── watcher.ts  # Session file watcher
│   │       ├── search.ts   # FTS5 search
│   │       ├── commit-finder.ts
│   │       ├── ripgrep.ts
│   │       └── ...
│   └── ui/                 # React dashboard
│       └── src/
│           ├── routes/     # Pages
│           ├── components/ # UI components
│           └── hooks/      # React hooks
├── DESIGN.md               # Visual design guide
├── FEATURES-V2.md          # Feature spec
└── README.md               # This file
```

---

## Contributing

We welcome contributions! Here's how to get started:

### Reporting Issues

- Check existing issues first
- Include `harness doctor` output
- Describe steps to reproduce

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Follow the code style (run `pnpm lint`)
4. Write tests for new features
5. Update documentation
6. Submit PR with clear description

### Code Style

- TypeScript strict mode
- Functional React components
- Terminal-native aesthetic (see `DESIGN.md`)
- No unnecessary dependencies

### Areas for Contribution

- [ ] Multi-machine sync
- [ ] Plugin system for other AI tools
- [ ] Session replay timeline
- [ ] VS Code extension
- [ ] Windows support
- [ ] More export formats

---

## Troubleshooting

### "Daemon not running"

```bash
# Check if port is in use
lsof -i :4450

# Kill existing process
pkill -f "harness"

# Restart
harness
```

### "ripgrep missing"

Search will work but be slower. Install for 10x speedup:

```bash
# macOS
brew install ripgrep

# Ubuntu/Debian
apt install ripgrep

# Windows
choco install ripgrep
```

### "No sessions found"

Harness reads from `~/.claude/projects/`. Ensure:
1. Claude Code is installed
2. You've run at least one session
3. Check path: `ls ~/.claude/projects/`

### Port conflict

```bash
harness --port 5000
```

---

## Roadmap

- [x] Real-time session monitoring
- [x] Full-text search
- [x] Commit finder
- [x] CLI tools
- [ ] Session replay
- [ ] Multi-device sync
- [ ] Cost budgets & alerts
- [ ] Plugin API
- [ ] VS Code integration

---

## License

MIT © 2025

---

## Acknowledgments

- [Claude Code](https://claude.ai) — The AI coding assistant
- [omarchy](https://github.com/getomni/omarchy) — Terminal aesthetic inspiration
- [Durable Streams](https://github.com/durable-streams) — Real-time data sync

---

<p align="center">
  <strong>▪ harness</strong> — see what your agents are doing
</p>
