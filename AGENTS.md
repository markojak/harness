# AGENTS.md - Harness AI

> For AI coding assistants. Symlink CLAUDE.md / GEMINI.md → AGENTS.md if using Claude Code or Gemini.

## Project Overview

**Harness AI** is a universal dashboard for AI coding sessions. It watches session files from multiple providers (Claude Code, Codex CLI, OpenCode, Antigravity), indexes them for search, and provides a real-time web UI.

## First Steps

1. Read this file completely
2. Run `pnpm install && pnpm build` to verify setup
3. Run `node bin/cli.js doctor` to check health
4. For specific tasks, load the relevant skill from `skills/`

## Repository Structure

```
harness/
├── bin/cli.js              # CLI: start, stats, sessions, search, export, doctor, config
├── packages/
│   ├── daemon/             # Node.js backend
│   │   └── src/
│   │       ├── serve.ts            # Entry: watcher + servers
│   │       ├── watcher.ts          # Chokidar file watcher
│   │       ├── providers/          # Provider implementations
│   │       │   ├── index.ts        # Provider registry
│   │       │   ├── claude.ts       # ~/.claude/projects parser
│   │       │   ├── codex.ts        # ~/.codex/sessions parser
│   │       │   └── opencode.ts     # ~/.local/share/opencode parser
│   │       ├── search.ts           # FTS5 SQLite full-text search
│   │       ├── indexer.ts          # Session indexing logic
│   │       ├── system-stats.ts     # HTTP API server (all routes)
│   │       ├── server.ts           # Durable streams for real-time
│   │       ├── session-detail.ts   # Transcript extraction
│   │       ├── bookmarks.ts        # Bookmark persistence
│   │       └── github.ts           # PR/CI status integration
│   └── ui/                 # React frontend
│       └── src/
│           ├── App.tsx             # Main app, stream connection
│           ├── components/
│           │   ├── SessionCard.tsx     # Session list item
│           │   ├── SessionPanel.tsx    # Detail sidecar
│           │   ├── ProjectSection.tsx  # Kanban column
│           │   ├── SearchResults.tsx   # Search UI
│           │   └── ProviderIcon.tsx    # Provider badges
│           └── context/
│               └── BookmarksContext.tsx
├── dist/                   # npm bundle output
├── scripts/bundle.js       # Packaging for npm
├── skills/                 # Agent skills (task-specific guidance)
└── fonts/                  # Berkeley Mono fonts
```

## Tech Stack

| Layer           | Technology                                        |
| --------------- | ------------------------------------------------- |
| Runtime         | Node.js 22+                                       |
| Package Manager | pnpm (workspaces)                                 |
| Backend         | TypeScript, better-sqlite3, chokidar, xstate, zod |
| Frontend        | React 18, Vite 7, Tailwind CSS, Radix UI          |
| Streaming       | @durable-streams/\*                               |
| Build           | esbuild (daemon), Vite (UI)                       |

## Available Skills

Load these for specific tasks:

| Skill                           | When to Use                      |
| ------------------------------- | -------------------------------- |
| `skills/add-provider/SKILL.md`  | Adding support for a new AI tool |
| `skills/add-api/SKILL.md`       | Adding backend API endpoints     |
| `skills/add-component/SKILL.md` | Creating UI components           |

## Key Commands

```bash
# Development
pnpm install              # Install all deps
pnpm build                # Full build
pnpm dev                  # Dev server

# CLI
node bin/cli.js           # Start dashboard
node bin/cli.js doctor    # Health check
node bin/cli.js stats     # Quick overview
node bin/cli.js search "query"
node bin/cli.js export <session-id>
node bin/cli.js config    # Show config

# Testing
curl http://localhost:4451/system-stats
curl http://localhost:4451/search?q=test
curl http://localhost:4451/session/<id>
```

## API Endpoints (port 4451)

| Endpoint                     | Method   | Description                   |
| ---------------------------- | -------- | ----------------------------- |
| `/`                          | GET      | UI (static files)             |
| `/system-stats`              | GET      | CPU, memory, cost             |
| `/index`                     | GET      | All indexed projects/sessions |
| `/search?q=...&provider=...` | GET      | Full-text search              |
| `/session/:id`               | GET      | Session detail (transcript)   |
| `/bookmarks`                 | GET/POST | Bookmark management           |
| `/config`                    | GET/POST | Configuration                 |
| `/projects/hide`             | POST     | Hide project from UI          |

## Data Flow

```
Session Files → Watcher → Parser → Indexer → SQLite
                   ↓
              Stream Server → UI (real-time updates)
```

## Conventions

- **Formatting:** No linter configured; match existing style
- **Types:** Zod for runtime validation, TypeScript for static
- **Imports:** ES modules (`import`), relative paths within packages
- **Errors:** Log to console, set app errors via `setError()` for UI display
- **State:** XState machines for complex session status tracking

## Common Pitfalls

1. **better-sqlite3:** Native module, needs rebuild after Node upgrades (`npm rebuild better-sqlite3`)
2. **Monorepo builds:** Always build daemon before UI (UI imports daemon types)
3. **Port conflicts:** Daemon uses 4450 (streams) + 4451 (HTTP/UI)
4. **Large bundle:** UI is ~1.4MB; code splitting would help but not implemented

## Publishing Checklist

1. `npm version patch|minor|major`
2. `pnpm build` (runs automatically via prepublishOnly)
3. `npm publish`
4. `git push origin main`

## Sub-Agent Coordination

When spawning sub-agents for parallel work:

- **Backend changes:** Work in `packages/daemon/src/`
- **Frontend changes:** Work in `packages/ui/src/`
- **Both need build:** Run `pnpm build` from root after changes
- **Test with:** `node bin/cli.js doctor && node bin/cli.js stats`
