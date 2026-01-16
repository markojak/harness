# ▪ Harness

**A unified cockpit for your AI coding agents.**

Harness gives you real-time visibility into every AI coding session across Claude Code, OpenAI Codex CLI, and OpenCode. Monitor multiple agents, track which models you're using, search session history, and never lose context on what your AI assistants are doing.

## Supported Providers

| Provider        | Tool                                                        | Session Location                   |
| --------------- | ----------------------------------------------------------- | ---------------------------------- |
| **Claude**      | [Claude Code](https://claude.ai/code)                       | `~/.claude/projects/`              |
| **Codex**       | [Codex CLI](https://github.com/openai/codex)                | `~/.codex/sessions/`               |
| **OpenCode**    | [OpenCode](https://github.com/opencode-ai/opencode)         | `~/.local/share/opencode/storage/` |
| **Antigravity** | [Antigravity](https://deepmind.google/technologies/gemini/) | `~/.gemini/antigravity/`           |

OpenCode sessions display the actual model used (Claude, GPT-4, Gemini, etc.) since OpenCode supports multiple providers.

## Why Harness?

When you're running multiple AI coding sessions across different tools, projects, and terminals, it's easy to lose track:

- Which agent is working on what?
- What model did I use for that refactor?
- Where was that auth fix I did last week?
- Did that background task finish?

Harness answers all of this with a terminal-native dashboard that feels like `htop` for your AI coding assistants.

## Features

- **Multi-provider support** — Claude Code, Codex CLI, and OpenCode in one view
- **Real-time monitoring** — See all active sessions across projects
- **Model tracking** — See which AI model each session is using
- **Kanban view** — Sessions organized by status (Working, Approval, Waiting, Idle)
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
git clone https://github.com/markojak/harness.git
cd harness
pnpm install
pnpm build
node bin/cli.js
```

---

## Configuration

Harness stores configuration in `~/.harness/config.json`. Create this file to customize provider paths or other settings.

### Default Paths

Harness auto-detects sessions from these default locations:

```json
{
  "providers": {
    "claude": {
      "enabled": true,
      "path": "~/.claude/projects"
    },
    "codex": {
      "enabled": true,
      "path": "~/.codex/sessions"
    },
    "opencode": {
      "enabled": true,
      "path": "~/.local/share/opencode/storage"
    }
  }
}
```

### Custom Configuration

Override paths if your tools store sessions elsewhere:

```json
{
  "providers": {
    "claude": {
      "enabled": true,
      "path": "/custom/path/to/claude/projects"
    },
    "codex": {
      "enabled": false
    },
    "opencode": {
      "enabled": true,
      "path": "~/.local/share/opencode/storage"
    },
    "antigravity": {
      "enabled": true,
      "path": "~/.gemini/antigravity"
    }
  },
  "port": 4450,
  "resumeFlags": "--continue"
}
```

### Configuration Options

| Key                             | Type    | Default                         | Description                     |
| ------------------------------- | ------- | ------------------------------- | ------------------------------- |
| `providers.claude.enabled`      | boolean | true                            | Enable Claude Code sessions     |
| `providers.claude.path`         | string  | ~/.claude/projects              | Claude session directory        |
| `providers.codex.enabled`       | boolean | true                            | Enable Codex CLI sessions       |
| `providers.codex.path`          | string  | ~/.codex/sessions               | Codex session directory         |
| `providers.opencode.enabled`    | boolean | true                            | Enable OpenCode sessions        |
| `providers.opencode.path`       | string  | ~/.local/share/opencode/storage | OpenCode storage directory      |
| `providers.antigravity.enabled` | boolean | true                            | Enable Antigravity sessions     |
| `providers.antigravity.path`    | string  | ~/.gemini/antigravity           | Antigravity session directory   |
| `port`                          | number  | 4450                            | Dashboard server port           |
| `resumeFlags`                   | string  | ""                              | Custom flags for session resume |

---

## Requirements

### Required

| Dependency | Version | Purpose |
| ---------- | ------- | ------- |
| Node.js    | ≥20.0.0 | Runtime |

### Recommended

| Dependency | Version | Install                  | Purpose                    |
| ---------- | ------- | ------------------------ | -------------------------- |
| ripgrep    | ≥14.0.0 | `brew install ripgrep`   | 10x faster search          |
| git        | ≥2.30.0 | `xcode-select --install` | Commit finder, branch info |

### Check your setup

```bash
harness doctor
```

```
▪ harness doctor

  ✓ Node.js: v22.0.0
  ✓ Data directory: ~/.harness

  Providers:
  ✓ Claude: ~/.claude/projects (250 sessions)
  ✓ Codex: ~/.codex/sessions (372 sessions)
  ✓ OpenCode: ~/.local/share/opencode/storage (23 sessions)

  Dependencies:
  ✓ ripgrep: ripgrep 14.1.0
  ✓ git: git version 2.43.0

  ✓ Daemon running: yes
  ℹ 645 sessions across 3 providers
```

---

## Quick Start

```bash
# Start the dashboard (opens browser)
harness

# Quick stats without UI
harness stats

# Search sessions across all providers
harness search "authentication"

# List recent sessions
harness sessions --since 7d

# Filter by provider
harness sessions --provider claude
harness sessions --provider codex
harness sessions --provider opencode

# Check system health
harness doctor
```

---

## CLI Reference

### Commands

| Command                  | Description                |
| ------------------------ | -------------------------- |
| `harness`                | Start dashboard (default)  |
| `harness stats`          | Show quick stats           |
| `harness sessions`       | List recent sessions       |
| `harness search <query>` | Full-text search           |
| `harness export <id>`    | Export session to markdown |
| `harness doctor`         | Check system health        |
| `harness config`         | View/edit configuration    |
| `harness index`          | Manage search index        |
| `harness version`        | Show version               |
| `harness help`           | Show help                  |

### Start Options

```bash
harness --port 5000      # Custom port (default: 4450)
harness --no-open        # Don't open browser
harness --headless       # API only, no UI serving
```

### Filter Options

```bash
harness sessions --since 24h          # Last 24 hours
harness sessions --since 7d           # Last 7 days
harness sessions --project myapp      # Filter by project
harness sessions --branch main        # Filter by git branch
harness sessions --provider claude    # Filter by provider
harness sessions --active             # Only active sessions
```

### Output Options

```bash
harness stats --json           # JSON output for scripting
harness sessions --json        # JSON session list
harness export <id> --json     # JSON transcript
```

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
│  │  • Multi-provider   │    │  • Durable streams      │    │
│  │  • SQLite FTS5      │    │  • Session panel        │    │
│  │  • Commit finder    │    │  • Provider icons       │    │
│  │  • Status API       │    │                         │    │
│  └─────────────────────┘    └─────────────────────────┘    │
│            │                                                │
│            ▼                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Session Sources                    │   │
│  ├─────────────────┬─────────────────┬─────────────────┤   │
│  │ ~/.claude/      │ ~/.codex/       │ ~/.local/share/ │   │
│  │ projects/       │ sessions/       │ opencode/       │   │
│  │                 │                 │ storage/        │   │
│  │ Claude Code     │ Codex CLI       │ OpenCode        │   │
│  └─────────────────┴─────────────────┴─────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

- **Daemon** — Watches session files from all providers, maintains search index, serves API
- **UI** — React dashboard with real-time updates via Durable Streams
- **CLI** — Thin wrapper that starts daemon and provides quick commands
- **Providers** — Parsers for each AI tool's session format

### Data Storage

| Location                           | Contents                               |
| ---------------------------------- | -------------------------------------- |
| `~/.claude/projects/`              | Claude Code sessions (JSONL)           |
| `~/.codex/sessions/`               | Codex CLI sessions (JSONL)             |
| `~/.local/share/opencode/storage/` | OpenCode sessions (JSON)               |
| `~/.harness/`                      | Harness data directory                 |
| `~/.harness/harness.db`            | SQLite database (FTS index, bookmarks) |
| `~/.harness/config.json`           | User configuration                     |

---

## Development

### Setup

```bash
git clone https://github.com/markojak/harness.git
cd harness
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

### Adding a New Provider

1. Create parser in `packages/daemon/src/providers/`
2. Add to `Provider` type in `types.ts`
3. Register in `providers/index.ts`
4. Add icon in `packages/ui/src/components/ProviderIcon.tsx`
5. Update config schema

### Project Structure

```
harness/
├── bin/
│   └── cli.js              # CLI entry point
├── packages/
│   ├── daemon/             # Backend service
│   │   └── src/
│   │       ├── serve.ts    # Main entry
│   │       ├── watcher.ts  # Session file watcher
│   │       ├── providers/  # Provider parsers
│   │       │   ├── claude.ts
│   │       │   ├── codex.ts
│   │       │   └── opencode.ts
│   │       ├── search.ts   # FTS5 search
│   │       └── ...
│   └── ui/                 # React dashboard
│       └── src/
│           ├── routes/     # Pages
│           ├── components/ # UI components
│           └── hooks/      # React hooks
└── README.md
```

---

## Troubleshooting

### "No sessions found"

Check that at least one provider has sessions:

```bash
# Claude Code
ls ~/.claude/projects/

# Codex CLI
ls ~/.codex/sessions/

# OpenCode
ls ~/.local/share/opencode/storage/session/
```

### "Provider not detected"

Verify paths in your config:

```bash
cat ~/.harness/config.json
```

Or check with:

```bash
harness doctor
```

### Port conflict

```bash
harness --port 5000
```

### "ripgrep missing"

Search will work but be slower. Install for 10x speedup:

```bash
# macOS
brew install ripgrep

# Ubuntu/Debian
apt install ripgrep
```

---

## Roadmap

- [x] Multi-provider support (Claude, Codex, OpenCode)
- [x] Real-time session monitoring
- [x] Full-text search
- [x] Commit finder
- [x] CLI tools
- [x] Model tracking for OpenCode
- [x] Cost tracking (Claude only currently)
- [ ] Session detail view
- [ ] Session replay
- [ ] Cost tracking for Codex and OpenCode
- [ ] Plugin API for custom providers

### Current Limitations

- **Cost tracking** — Currently only tracks costs for Claude Code sessions. Codex and OpenCode cost tracking coming soon.

---

## License

MIT © 2025

---

<p align="center">
  <strong>▪ harness</strong> — see what your agents are doing
</p>
