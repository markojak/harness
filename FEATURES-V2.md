# Claude Code Session Tracker v2

## Overview

Enhanced session tracker with search, analytics, and a terminal-inspired UI.

---

## Design

### Local-First

- Runs entirely locally, no cloud dependencies
- SQLite + sqlite-vec for persistence and vector search
- All data stays on machine

---

## Visual Refactor

Complete UI overhaul inspired by Factory.ai — dark, terminal-like, clean lines.

### Color Palette

```css
:root {
  /* Backgrounds */
  --bg-primary: #0a0a0a; /* Main background */
  --bg-secondary: #111111; /* Cards, panels */
  --bg-tertiary: #1a1a1a; /* Elevated elements */
  --bg-hover: #222222; /* Hover states */

  /* Borders */
  --border-subtle: #1f1f1f; /* Subtle dividers */
  --border-default: #2a2a2a; /* Default borders */
  --border-strong: #3a3a3a; /* Emphasized borders */

  /* Text */
  --text-primary: #e0e0e0; /* Primary text */
  --text-secondary: #888888; /* Secondary/muted */
  --text-tertiary: #555555; /* Disabled/placeholder */

  /* Accents */
  --accent-green: #00ff88; /* Success, working */
  --accent-cyan: #00d4ff; /* Links, interactive */
  --accent-orange: #ff9500; /* Warnings, needs approval */
  --accent-red: #ff4444; /* Errors */
  --accent-yellow: #ffcc00; /* Waiting */

  /* Status colors (terminal-style) */
  --status-working: #00ff88;
  --status-approval: #ff9500;
  --status-waiting: #ffcc00;
  --status-idle: #555555;
}
```

### Typography

```css
@font-face {
  font-family: "Berkeley Mono";
  src: url("/fonts/BerkeleyMono-Regular.otf") format("opentype");
  font-weight: 400;
}
@font-face {
  font-family: "Berkeley Mono";
  src: url("/fonts/BerkeleyMono-Medium.otf") format("opentype");
  font-weight: 500;
}
@font-face {
  font-family: "Berkeley Mono";
  src: url("/fonts/BerkeleyMono-SemiBold.otf") format("opentype");
  font-weight: 600;
}
@font-face {
  font-family: "Berkeley Mono";
  src: url("/fonts/BerkeleyMono-Bold.otf") format("opentype");
  font-weight: 700;
}

body {
  font-family: "Berkeley Mono", monospace;
  font-size: 13px;
  line-height: 1.5;
  letter-spacing: -0.01em;
}
```

### Component Styling

#### Cards

```css
.session-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 4px; /* Minimal radius */
  padding: 12px 16px;
  transition: border-color 0.15s;
}
.session-card:hover {
  border-color: var(--border-default);
}
```

#### Status Indicators

Terminal-style dots or blocks, not rounded badges:

```css
.status-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: var(--status-working);
  /* No border-radius — square pixels */
}

/* Or use text characters */
.status-text::before {
  content: "●"; /* or ▪ ▸ ◆ */
  margin-right: 6px;
  color: var(--status-working);
}
```

#### Grid Lines

Subtle grid pattern for backgrounds:

```css
.grid-bg {
  background-image:
    linear-gradient(var(--border-subtle) 1px, transparent 1px),
    linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px);
  background-size: 24px 24px;
}
```

#### Navigation

Minimal, tab-style:

```
┌─────────────────────────────────────────────────────────────┐
│  ▪ Sessions    Tools    Costs    Search    Bookmarks        │
└─────────────────────────────────────────────────────────────┘
```

### Layout Changes

**Current:** Radix UI defaults with purple accent, rounded corners, light feel
**New:**

1. **Header:** Minimal. Project name, tab navigation, search input
2. **Sidebar (optional):** Project list for filtering
3. **Main area:** Kanban or list view, dense but readable
4. **No shadows** — use borders only
5. **Tight spacing** — 8px/12px/16px rhythm

### Session Card Redesign

```
┌────────────────────────────────────────────────────────────┐
│ ● working                                    14:32 · 8m ago │
│                                                             │
│ Add authentication middleware to API routes                 │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Edited src/middleware/auth.ts                           │ │
│ │ Created tests/auth.test.ts                              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ main → feature/auth                   $0.12 · 847 tokens    │
└────────────────────────────────────────────────────────────┘
```

### Remove/Replace

| Current (Radix)        | New               |
| ---------------------- | ----------------- |
| Purple accent          | Green/cyan        |
| Rounded corners (8px+) | Minimal (2-4px)   |
| Card shadows           | Border only       |
| Default Radix theme    | Custom dark theme |
| System fonts           | Berkeley Mono     |

### Implementation

1. Create `/packages/ui/src/styles/` with CSS variables and base styles
2. Copy Berkeley Mono fonts to `/packages/ui/public/fonts/`
3. Override Radix theme tokens or strip Radix styling
4. Update components one by one

---

## Project Grouping

Sessions should be grouped by **git repository root**, not working directory.

### Current Behavior

```
/code/myrepo/app       → grouped by: "owner/myrepo" (GitHub) or "Other"
/code/myrepo/packages  → grouped by: "owner/myrepo" (GitHub) or "Other"
```

### Desired Behavior

```
/code/myrepo/app           → gitRootPath: /code/myrepo → project: "myrepo"
/code/myrepo/packages/api  → gitRootPath: /code/myrepo → project: "myrepo"
/code/other/foo            → gitRootPath: /code/other  → project: "other"
```

### Implementation

Add to `SessionState`:

```typescript
interface SessionState {
  // ... existing fields
  gitRootPath: string | null; // Filesystem path to .git parent
  projectName: string; // Display name: gitRepoId || basename(gitRootPath) || basename(cwd)
}
```

The `findGitDir()` function already walks up — just need to expose the parent of `.git` as `gitRootPath`.

---

## New Features

### 1. Search

#### Ripgrep-style (Fast Text Search)

- Search across all session JSONL logs
- Find by session ID, prompt content, tool names, file paths
- Filter by project, date range

```bash
# CLI
claude-sessions search "authentication middleware" --project myrepo --since 7d
```

#### Semantic Search

- Embed session summaries using Claude/OpenAI embeddings
- Store in sqlite-vec
- Natural language queries: _"sessions where I fixed TypeScript errors"_

### 2. Cost Tracking

Integrate [`ccusage`](https://github.com/ryoppippi/ccusage) for token/cost data.

Display per-session:

- Input/output tokens
- Estimated cost
- Model used

Aggregate views:

- Cost per project (last 7d, 30d, all time)
- Cost trend over time
- Most expensive sessions

### 3. Tool Usage Stats

Parse all `tool_use` blocks from session logs.

**Metrics:**

- Usage count per tool
- Approval rate (approved vs rejected)
- Average time to approval
- Tools by project

**MCP/Skill Discovery:**

- Read `~/.claude/settings.json` for installed MCPs
- Cross-reference with actual usage
- Surface underused tools: _"mcp\_\_memory installed 45 days ago, used 0 times"_

**UI:**

```
┌────────────────────────────────────────────────────┐
│ Tool Usage (last 30 days)                          │
├────────────────────────────────────────────────────┤
│ Read        ████████████████████████████  847      │
│ Edit        ███████████████               412      │
│ Bash        ██████████████                389      │
│ mcp__github ██                             47      │
│                                                    │
│ ⚠️  Underused:                                     │
│ • mcp__memory (0 uses)                            │
│ • mcp__sqlite (2 uses)                            │
└────────────────────────────────────────────────────┘
```

### 4. Session Replay

Timeline view for stepping through a session's events.

**UI:**

```
┌─────────────────────────────────────────────────────────────┐
│ Session: "Add user authentication"                          │
├─────────────────────────────────────────────────────────────┤
│ ◀ ●━━━━━━━━○━━━━━━━━━━○━━━━━━━○━━━━━━━●━━━━━━━━━━━━━━━━━▶  │
│   14:02    14:08      14:15    14:22   14:31               │
│   Start    Edit       Bash     ⚠️ Wait   Done               │
├─────────────────────────────────────────────────────────────┤
│ [14:22] Tool: Write → src/middleware/auth.ts                │
│ Status: waiting_for_approval                                │
│                                                             │
│ + export const authMiddleware = async (req, res) => {       │
│ +   const token = req.headers.authorization;                │
└─────────────────────────────────────────────────────────────┘
```

**Events to show:**

- User prompts
- Tool calls (with approval status)
- Status transitions
- Commits made

### 5. Commit Finder

Given a commit SHA or file path, find which session(s) produced it.

**Implementation:**

- Index: `(gitRootPath, commitSha, timestamp)` → `sessionId`
- Match by: commit timestamp within session timeframe + same branch
- Also index file paths from Write/Edit tool calls

**Queries:**

```bash
claude-sessions find-commit abc123f
claude-sessions find-file src/auth.ts --since 2w
```

### 6. Diff View

Reconstruct file changes from Edit/Write tool calls.

**Simple approach:**

1. Parse all Edit/Write `tool_use` blocks for the session
2. Group by file path
3. Show final state vs original (or chain of edits)

**UI:**

- File list sidebar
- Unified diff view
- Mark rejected/rolled-back changes differently

### 7. Bookmarks + Notes

Save sessions for later reference with personal notes.

**Data model:**

```typescript
interface Bookmark {
  id: string;
  sessionId: string;
  projectName: string;
  title: string; // Auto-filled from session goal
  notes: string; // User's notes
  tags: string[]; // Optional categorization
  createdAt: string;
  updatedAt: string;
}
```

**Storage:** SQLite table (persists across daemon restarts)

**UI:**

- Star icon on session cards
- Dedicated "Bookmarks" tab
- Search/filter bookmarks
- Edit notes inline

---

## Data Model

### SQLite Schema

```sql
-- Projects (derived from git roots)
CREATE TABLE projects (
  id TEXT PRIMARY KEY,           -- gitRootPath or hash
  name TEXT NOT NULL,            -- Display name
  gitRepoId TEXT,                -- owner/repo if GitHub
  gitRepoUrl TEXT,
  lastActivityAt TEXT
);

-- Session index (lightweight, for search)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,           -- sessionId
  projectId TEXT REFERENCES projects(id),
  filepath TEXT NOT NULL,        -- Path to JSONL
  originalPrompt TEXT,
  summary TEXT,                  -- AI-generated
  summaryEmbedding BLOB,         -- For vector search
  startedAt TEXT,
  lastActivityAt TEXT,
  status TEXT,
  totalTokens INTEGER,
  estimatedCost REAL
);

-- Tool usage
CREATE TABLE tool_uses (
  id INTEGER PRIMARY KEY,
  sessionId TEXT REFERENCES sessions(id),
  toolName TEXT NOT NULL,
  approved BOOLEAN,
  timestamp TEXT,
  durationMs INTEGER
);

-- Bookmarks
CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  sessionId TEXT REFERENCES sessions(id),
  title TEXT,
  notes TEXT,
  tags TEXT,                     -- JSON array
  createdAt TEXT,
  updatedAt TEXT
);

-- Commits (for commit finder)
CREATE TABLE commits (
  sha TEXT PRIMARY KEY,
  projectId TEXT REFERENCES projects(id),
  sessionId TEXT REFERENCES sessions(id),
  timestamp TEXT,
  message TEXT
);

-- Vector search index
CREATE VIRTUAL TABLE session_embeddings USING vec0(
  embedding float[1536]
);
```

---

## Dependencies

| Package                                                   | Purpose                   |
| --------------------------------------------------------- | ------------------------- |
| `better-sqlite3`                                          | SQLite driver             |
| `sqlite-vec`                                              | Vector search extension   |
| `ccusage`                                                 | Claude Code cost tracking |
| Existing: `chokidar`, `xstate`, `@tanstack/*`, `radix-ui` |                           |

---

## Migration Path

1. Keep existing Durable Streams architecture for real-time updates
2. Add SQLite as persistent index (daemon writes on session updates)
3. UI queries SQLite for search/analytics, streams for live status
4. Gradual UI reskin to Factory.ai aesthetic

---

## Distribution

### Package Identity

| Field        | Value        |
| ------------ | ------------ |
| npm package  | `harness-ai` |
| CLI command  | `harness`    |
| Display name | Harness      |

### Installation

```bash
# Global install
npm i -g harness-ai

# Run directly
npx harness-ai

# Then just:
harness
```

### Package Structure

```
harness-ai/
├── bin/
│   └── cli.js              # Entry point
├── dist/
│   ├── daemon/             # Bundled daemon
│   └── ui/                 # Built UI assets
├── fonts/
│   └── BerkeleyMono-*.otf  # Licensed font (included)
├── package.json
└── README.md
```

### package.json

```json
{
  "name": "harness-ai",
  "version": "0.1.0",
  "description": "Real-time dashboard for Claude Code sessions",
  "bin": {
    "harness": "./bin/cli.js"
  },
  "files": ["bin", "dist", "fonts"],
  "engines": {
    "node": ">=20"
  },
  "keywords": [
    "claude",
    "claude-code",
    "ai",
    "dashboard",
    "sessions",
    "developer-tools"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org/harness-ai"
  },
  "license": "MIT"
}
```

### CLI Entry Point

```javascript
#!/usr/bin/env node
// bin/cli.js

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import open from "open";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);

const commands = {
  start: async () => {
    // Start daemon
    const daemon = spawn("node", [join(__dirname, "../dist/daemon/serve.js")], {
      stdio: "inherit",
      detached: false,
    });

    // Give daemon a moment to start, then open UI
    setTimeout(() => {
      const port = process.env.HARNESS_PORT || 5173;
      open(`http://localhost:${port}`);
    }, 1000);

    console.log("🔧 Harness running at http://localhost:5173");
    console.log("   Press Ctrl+C to stop\n");
  },

  search: async (query) => {
    // CLI search mode
    const { search } = await import("../dist/daemon/search.js");
    const results = await search(query, { limit: 20 });
    // ... format and print results
  },

  version: () => {
    const pkg = require("../package.json");
    console.log(`harness v${pkg.version}`);
  },

  help: () => {
    console.log(`
Usage: harness [command]

Commands:
  (default)     Start dashboard
  search <q>    Search sessions
  stats         Show tool usage stats
  version       Show version
  help          Show this help
    `);
  },
};

const cmd = args[0] || "start";
if (commands[cmd]) {
  commands[cmd](...args.slice(1));
} else {
  commands.start();
}
```

### Build Process

```bash
# Build script (scripts/build.sh)
#!/bin/bash
set -e

# Clean
rm -rf dist

# Build daemon
pnpm --filter @claude-code-ui/daemon build
cp -r packages/daemon/dist dist/daemon

# Build UI
pnpm --filter @claude-code-ui/ui build
cp -r packages/ui/dist dist/ui

# Copy fonts
mkdir -p fonts
cp ~/Library/Fonts/BerkeleyMono-{Regular,Medium,SemiBold,Bold}.otf fonts/

# Bundle for distribution
npm pack
```

### Native Dependencies

`better-sqlite3` and `sqlite-vec` require compilation. Options:

1. **Prebuilds** (recommended): Use `prebuild-install` to ship precompiled binaries
2. **Optional peer dep**: Make SQLite features optional, gracefully degrade
3. **Pure JS fallback**: Use `sql.js` (WASM) for broader compat, slightly slower

```json
{
  "optionalDependencies": {
    "better-sqlite3": "^11.0.0"
  },
  "dependencies": {
    "sql.js": "^1.10.0"
  }
}
```

### Future: Homebrew

```ruby
# Formula/harness.rb
class Harness < Formula
  desc "Real-time dashboard for Claude Code sessions"
  homepage "https://github.com/your-org/harness-ai"
  url "https://registry.npmjs.org/harness-ai/-/harness-ai-0.1.0.tgz"
  sha256 "..."

  depends_on "node@20"

  def install
    system "npm", "install", "--production"
    bin.install "bin/cli.js" => "harness"
  end
end
```

---

## Open Questions

- [ ] Embedding model: Claude API vs local (e.g., `nomic-embed-text`)?
- [ ] How far back to index? All history or rolling window?
- [ ] Should bookmarks sync across machines? (probably not for v1)
- [ ] License: MIT or something else?
- [ ] Org/repo name for GitHub?
