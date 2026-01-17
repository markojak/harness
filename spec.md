# Claude Code Session Tracker

A real-time dashboard for tracking Claude Code sessions across repositories, using Durable Streams for live updates.

## Overview

This app watches Claude Code session logs, streams them to a Durable Streams server, and presents them in a Kanban-style UI organized by repository.

**Key Features:**

- Real-time session status (working / waiting / idle)
- Original prompt display
- Working directory and git branch context
- Per-repository board organization

---

## 1. Claude Code Session Log Format

### Location

```
~/.claude/projects/<encoded-directory>/<session-id>.jsonl
```

The `<encoded-directory>` is the working directory with `/` replaced by `-`:

```
/Users/kyle/code/electricsql → -Users-kyle-code-electricsql
```

### Entry Types

The JSONL file contains multiple entry types, distinguished by the `type` field:

| Type                    | Description                                   |
| ----------------------- | --------------------------------------------- |
| `user`                  | User prompts and tool results                 |
| `assistant`             | Claude responses (text, tool calls, thinking) |
| `system`                | Hook summaries and system events              |
| `queue-operation`       | Queued prompts (enqueue/dequeue)              |
| `file-history-snapshot` | File state tracking for undo                  |

### Type Definitions

```typescript
// Discriminated union for all entry types
type LogEntry =
  | UserEntry
  | AssistantEntry
  | SystemEntry
  | QueueOperationEntry
  | FileHistorySnapshotEntry;

// Common fields on message entries
interface BaseMessageEntry {
  parentUuid: string | null;
  uuid: string;
  sessionId: string;
  timestamp: string; // ISO-8601
  cwd: string; // Working directory
  version: string; // Claude Code version
  gitBranch: string; // Empty string if not in git repo
  isSidechain: boolean;
  userType: "external" | string;
}

// User entry - prompts and tool results
interface UserEntry extends BaseMessageEntry {
  type: "user";
  message: {
    role: "user";
    content: string | ToolResultBlock[]; // String for prompts, array for tool results
  };
  toolUseResult?: string; // Raw tool output (when content is tool_result)
  thinkingMetadata?: {
    level: string;
    disabled: boolean;
    triggers: string[];
  };
  todos?: TodoItem[];
}

// Assistant entry - Claude responses
interface AssistantEntry extends BaseMessageEntry {
  type: "assistant";
  slug?: string; // e.g., "majestic-squishing-stroustrup"
  requestId: string;
  message: {
    role: "assistant";
    model: string;
    id: string;
    content: AssistantContentBlock[];
    stop_reason: string | null;
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
}

// Content block types
interface TextBlock {
  type: "text";
  text: string;
}

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ThinkingBlock {
  type: "thinking";
  thinking: string;
  signature: string;
}

interface ToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

type AssistantContentBlock = TextBlock | ToolUseBlock | ThinkingBlock;

// System entry - hooks and system events
interface SystemEntry {
  type: "system";
  subtype: "stop_hook_summary" | string;
  parentUuid: string;
  uuid: string;
  timestamp: string;
  sessionId: string;
  cwd: string;
  version: string;
  gitBranch: string;
  hookCount: number;
  hookInfos: unknown[];
  hookErrors: unknown[];
  preventedContinuation: boolean;
  stopReason: string;
  hasOutput: boolean;
  level: "suggestion" | string;
  toolUseID?: string;
}

// Queue operation entry
interface QueueOperationEntry {
  type: "queue-operation";
  operation: "enqueue" | "dequeue";
  timestamp: string;
  sessionId: string;
  content: string;
}

// File history snapshot
interface FileHistorySnapshotEntry {
  type: "file-history-snapshot";
  messageId: string;
  snapshot: {
    messageId: string;
    trackedFileBackups: Record<string, unknown>;
    timestamp: string;
  };
  isSnapshotUpdate: boolean;
}

interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed";
}
```

### Important Notes

- Log retention: 30 days by default. Extend via `~/.claude/settings.json`:
  ```json
  { "logRetentionDays": 99999 }
  ```
- `gitBranch` is empty string `""` when not in a git repo (not `null` or missing)
- User prompt content is a **string**, not an array
- Tool result content is an **array** with a single `tool_result` block

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Node.js Daemon                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │   Chokidar  │───▶│    JSONL     │───▶│     Status       │   │
│  │   Watcher   │    │    Parser    │    │    Analyzer      │   │
│  │   (v5)      │    │              │    │                  │   │
│  └─────────────┘    └──────────────┘    └──────────────────┘   │
│         │                  │                     │              │
│         ▼                  ▼                     ▼              │
│  ~/.claude/projects/   Extract:              Derive:           │
│    **/*.jsonl          - cwd                 - status          │
│                        - prompt (string!)    - lastRole        │
│                        - gitBranch           - hasPendingTool  │
│                                                                 │
│                    ┌──────────────────┐                        │
│                    │  Durable Stream  │                        │
│                    │  Writer          │                        │
│                    └──────────────────┘                        │
│                           │                                     │
│                           ▼                                     │
│              @durable-streams/server (port 4437)               │
│              - /sessions/{id}      (full session data)         │
│              - /__registry__       (session metadata)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    React UI (TanStack Router)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                   Kanban Board                          │    │
│  │  ┌──────────┐   ┌──────────────┐   ┌──────────────┐   │    │
│  │  │   TODO   │   │     WIP      │   │     DONE     │   │    │
│  │  │          │   │              │   │              │   │    │
│  │  │ (manual) │   │ 🟢 working   │   │ (archived)   │   │    │
│  │  │          │   │ 🟡 waiting   │   │              │   │    │
│  │  │          │   │ 🟠 approval  │   │              │   │    │
│  │  └──────────┘   └──────────────┘   └──────────────┘   │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                 │
│  @durable-streams/client with subscribeJson() for live updates │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation

### 3.1 Requirements

```json
{
  "engines": {
    "node": ">=20.19.0"
  }
}
```

Chokidar v5 is ESM-only and requires Node.js 20.19+.

### 3.2 File Watcher (Daemon)

```typescript
import { watch } from "chokidar";
import { debounce } from "lodash-es";

const CLAUDE_PROJECTS_DIR = `${process.env.HOME}/.claude/projects`;

// Track byte positions for incremental reads
const filePositions = new Map<string, number>();

// Debounce handlers per file to avoid overwhelming during rapid tool execution
const debouncedHandlers = new Map<string, ReturnType<typeof debounce>>();

const watcher = watch(`${CLAUDE_PROJECTS_DIR}/**/*.jsonl`, {
  ignored: /^\./,
  persistent: true,
  ignoreInitial: false,
  awaitWriteFinish: {
    stabilityThreshold: 300,
    pollInterval: 100,
  },
});

watcher
  .on("add", (path) => handleNewSession(path))
  .on("change", (path) => {
    if (!debouncedHandlers.has(path)) {
      debouncedHandlers.set(
        path,
        debounce(() => handleSessionUpdate(path), 200),
      );
    }
    debouncedHandlers.get(path)!();
  })
  .on("unlink", (path) => handleSessionDeleted(path));
```

### 3.3 Incremental JSONL Parser

```typescript
import { open, stat } from "node:fs/promises";

interface TailResult {
  entries: LogEntry[];
  newPosition: number;
  hadPartialLine: boolean;
}

async function tailJSONL(
  filepath: string,
  fromByte: number = 0,
): Promise<TailResult> {
  const handle = await open(filepath, "r");
  const fileStat = await stat(filepath);

  if (fromByte >= fileStat.size) {
    await handle.close();
    return { entries: [], newPosition: fromByte, hadPartialLine: false };
  }

  const buffer = Buffer.alloc(fileStat.size - fromByte);
  await handle.read(buffer, 0, buffer.length, fromByte);
  await handle.close();

  const content = buffer.toString("utf8");
  const lines = content.split("\n");

  const entries: LogEntry[] = [];
  let bytesConsumed = 0;
  let hadPartialLine = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLastLine = i === lines.length - 1;

    // Last line might be partial if it doesn't end with newline
    if (isLastLine && !content.endsWith("\n") && line.length > 0) {
      hadPartialLine = true;
      break;
    }

    if (!line.trim()) {
      bytesConsumed += line.length + 1; // +1 for newline
      continue;
    }

    try {
      entries.push(JSON.parse(line) as LogEntry);
      bytesConsumed += Buffer.byteLength(line, "utf8") + 1;
    } catch {
      // Malformed JSON - skip but count bytes
      bytesConsumed += Buffer.byteLength(line, "utf8") + 1;
    }
  }

  return {
    entries,
    newPosition: fromByte + bytesConsumed,
    hadPartialLine,
  };
}
```

### 3.4 Session Metadata Extraction

```typescript
interface SessionMetadata {
  sessionId: string;
  cwd: string;
  gitBranch: string | null; // null if empty string
  originalPrompt: string;
  startedAt: string;
}

function extractMetadata(entries: LogEntry[]): SessionMetadata | null {
  let cwd: string | undefined;
  let gitBranch: string | undefined;
  let originalPrompt: string | undefined;
  let sessionId: string | undefined;
  let startedAt: string | undefined;

  for (const entry of entries) {
    // Get cwd and sessionId from first entry with these fields
    if ("cwd" in entry && !cwd) {
      cwd = entry.cwd;
    }
    if ("sessionId" in entry && !sessionId) {
      sessionId = entry.sessionId;
    }
    if ("gitBranch" in entry && gitBranch === undefined) {
      gitBranch = entry.gitBranch;
    }
    if ("timestamp" in entry && !startedAt) {
      startedAt = entry.timestamp;
    }

    // Get original prompt from first user message
    if (entry.type === "user" && !originalPrompt) {
      const content = entry.message.content;
      if (typeof content === "string") {
        originalPrompt =
          content.length > 300 ? content.slice(0, 300) + "..." : content;
      }
    }

    // Stop once we have everything
    if (cwd && sessionId && originalPrompt && startedAt) break;
  }

  if (!cwd || !sessionId || !startedAt) return null;

  return {
    sessionId,
    cwd,
    gitBranch: gitBranch === "" ? null : (gitBranch ?? null),
    originalPrompt: originalPrompt ?? "(no prompt found)",
    startedAt,
  };
}
```

### 3.5 Status Detection

```typescript
type SessionStatus = "working" | "waiting" | "idle";

interface StatusResult {
  status: SessionStatus;
  lastRole: "user" | "assistant";
  hasPendingToolUse: boolean;
  lastActivityAt: string;
}

function deriveStatus(
  entries: LogEntry[],
  idleThresholdMs = 5 * 60 * 1000,
): StatusResult {
  // Filter to message entries only
  const messageEntries = entries.filter(
    (e): e is UserEntry | AssistantEntry =>
      e.type === "user" || e.type === "assistant",
  );

  if (messageEntries.length === 0) {
    return {
      status: "waiting",
      lastRole: "user",
      hasPendingToolUse: false,
      lastActivityAt: "",
    };
  }

  const lastEntry = messageEntries[messageEntries.length - 1];
  const lastActivityAt = lastEntry.timestamp;

  // Check for idle
  const lastActivityTime = new Date(lastActivityAt).getTime();
  const now = Date.now();
  if (now - lastActivityTime > idleThresholdMs) {
    return {
      status: "idle",
      lastRole: lastEntry.type === "user" ? "user" : "assistant",
      hasPendingToolUse: false,
      lastActivityAt,
    };
  }

  // Check for pending tool use - only look at the LAST assistant message
  let hasPendingToolUse = false;

  if (lastEntry.type === "assistant") {
    const toolUseIds = new Set<string>();

    // Collect tool_use IDs from last assistant message
    for (const block of lastEntry.message.content) {
      if (block.type === "tool_use") {
        toolUseIds.add(block.id);
      }
    }

    // Check if any have results (look at subsequent entries, but there shouldn't be any)
    // Since lastEntry is the last, any tool_use in it is pending
    hasPendingToolUse = toolUseIds.size > 0;
  }

  // Determine status based on last role
  if (lastEntry.type === "user") {
    // User just sent something - Claude should be working
    // But check if it's a tool_result (then Claude is about to respond)
    const content = lastEntry.message.content;
    const isToolResult =
      Array.isArray(content) && content.some((b) => b.type === "tool_result");

    return {
      status: "working",
      lastRole: "user",
      hasPendingToolUse: false,
      lastActivityAt,
    };
  }

  // Last entry is assistant
  return {
    status: hasPendingToolUse ? "waiting" : "waiting",
    lastRole: "assistant",
    hasPendingToolUse,
    lastActivityAt,
  };
}
```

### 3.6 Durable Streams Integration

```typescript
import { DurableStream } from "@durable-streams/client";

const STREAMS_SERVER = "http://localhost:4437";

// Create or connect to a session stream
async function getSessionStream(sessionId: string): Promise<DurableStream> {
  const url = `${STREAMS_SERVER}/v1/stream/sessions/${sessionId}`;

  try {
    return await DurableStream.create({
      url,
      contentType: "application/json",
    });
  } catch (e) {
    // Already exists
    return DurableStream.connect({ url });
  }
}

// Append entries to session stream
async function appendToSession(
  sessionId: string,
  entries: LogEntry[],
): Promise<void> {
  const stream = await getSessionStream(sessionId);

  for (const entry of entries) {
    await stream.append(entry);
  }
}

// Registry stream for session discovery
async function updateRegistry(update: RegistryUpdate): Promise<void> {
  const url = `${STREAMS_SERVER}/v1/stream/__registry__`;

  let registry: DurableStream;
  try {
    registry = await DurableStream.create({
      url,
      contentType: "application/json",
    });
  } catch {
    registry = DurableStream.connect({ url });
  }

  await registry.append(update);
}

type RegistryUpdate =
  | {
      type: "session_created";
      sessionId: string;
      cwd: string;
      gitBranch: string | null;
      originalPrompt: string;
      createdAt: string;
    }
  | {
      type: "session_updated";
      sessionId: string;
      status: SessionStatus;
      lastRole: string;
      hasPendingToolUse: boolean;
      messageCount: number;
      lastActivityAt: string;
    }
  | { type: "session_archived"; sessionId: string; archivedAt: string }
  | { type: "session_expired"; sessionId: string; expiredAt: string };
```

### 3.7 React UI - Stream Subscription

```typescript
import { DurableStream } from "@durable-streams/client";
import { useEffect, useState, useCallback } from "react";

function useRegistryStream() {
  const [sessions, setSessions] = useState<Map<string, SessionState>>(
    new Map(),
  );

  useEffect(() => {
    const stream = DurableStream.connect({
      url: "http://localhost:4437/v1/stream/__registry__",
    });

    const controller = new AbortController();

    (async () => {
      const res = await stream.stream({
        live: "sse",
        signal: controller.signal,
      });

      res.subscribeJson(async (batch) => {
        setSessions((prev) => {
          const next = new Map(prev);

          for (const update of batch.items as RegistryUpdate[]) {
            if (update.type === "session_created") {
              next.set(update.sessionId, {
                sessionId: update.sessionId,
                cwd: update.cwd,
                gitBranch: update.gitBranch,
                originalPrompt: update.originalPrompt,
                status: "working",
                lastActivityAt: update.createdAt,
                messageCount: 0,
                hasPendingToolUse: false,
              });
            } else if (update.type === "session_updated") {
              const existing = next.get(update.sessionId);
              if (existing) {
                next.set(update.sessionId, {
                  ...existing,
                  status: update.status,
                  messageCount: update.messageCount,
                  hasPendingToolUse: update.hasPendingToolUse,
                  lastActivityAt: update.lastActivityAt,
                });
              }
            } else if (
              update.type === "session_archived" ||
              update.type === "session_expired"
            ) {
              next.delete(update.sessionId);
            }
          }

          return next;
        });
      });
    })();

    return () => controller.abort();
  }, []);

  return sessions;
}

interface SessionState {
  sessionId: string;
  cwd: string;
  gitBranch: string | null;
  originalPrompt: string;
  status: SessionStatus;
  lastActivityAt: string;
  messageCount: number;
  hasPendingToolUse: boolean;
}
```

---

## 4. Data Model

### Session State

```typescript
interface SessionRef {
  sessionId: string;
  streamPath: string;

  // Display fields
  cwd: string;
  gitBranch: string | null;
  originalPrompt: string;
  slug?: string; // From assistant entry, for fun display

  // GitHub repo info (for grouping)
  gitRepoUrl: string | null; // https://github.com/owner/repo
  gitRepoId: string | null; // owner/repo (used as grouping key)

  // Timestamps
  startedAt: string;
  lastActivityAt: string;

  // Status
  status: "working" | "waiting" | "idle" | "done";
  lastRole: "user" | "assistant";
  hasPendingToolUse: boolean;

  // Stats
  messageCount: number;
  tokenUsage?: {
    input: number;
    output: number;
  };
}
```

### Board State

```typescript
interface Board {
  id: string;
  repoPath: string; // Local path, e.g., /Users/kyle/code/electric
  repoName?: string; // GitHub repo name if detected

  columns: {
    todo: TodoItem[]; // Manual ideas
    wip: SessionRef[]; // Active sessions
    done: SessionRef[]; // Archived sessions
  };
}

interface TodoItem {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
}
```

### Status Display

| Last Role | Pending Tool | Activity      | Icon | Label               |
| --------- | ------------ | ------------- | ---- | ------------------- |
| user      | -            | recent        | 🟢   | Working             |
| assistant | no           | recent        | 🟡   | Waiting for input   |
| assistant | yes          | recent        | 🟠   | Needs tool approval |
| any       | any          | stale (>5min) | ⚪   | Idle                |

---

## 5. Routes

Use URL-safe encoding for paths with slashes:

```
/                                    # Board list
/boards/:boardId                     # Kanban view (boardId = URL-encoded cwd)
/boards/:boardId/sessions/:sessionId # Session detail
```

Example:

```
/boards/-Users-kyle-code-electric/sessions/abc123
```

The `boardId` uses the same encoding as Claude's project directories (slashes → dashes).

---

## 6. Daemon Startup / Backfill

On daemon startup, scan existing sessions efficiently:

```typescript
async function backfillExistingSessions(): Promise<void> {
  const projectDirs = await fs.readdir(CLAUDE_PROJECTS_DIR);

  for (const encodedDir of projectDirs) {
    const dirPath = path.join(CLAUDE_PROJECTS_DIR, encodedDir);
    const files = await fs.readdir(dirPath);

    for (const file of files) {
      if (!file.endsWith(".jsonl")) continue;

      const filepath = path.join(dirPath, file);
      const sessionId = file.replace(".jsonl", "");

      // Read just enough to get metadata and current status
      const { entries } = await tailJSONL(filepath, 0);

      const metadata = extractMetadata(entries);
      if (!metadata) continue;

      const status = deriveStatus(entries);

      // Create summary in registry (don't replay full history to stream)
      await updateRegistry({
        type: "session_created",
        sessionId,
        cwd: metadata.cwd,
        gitBranch: metadata.gitBranch,
        originalPrompt: metadata.originalPrompt,
        createdAt: metadata.startedAt,
      });

      await updateRegistry({
        type: "session_updated",
        sessionId,
        status: status.status,
        lastRole: status.lastRole,
        hasPendingToolUse: status.hasPendingToolUse,
        messageCount: entries.filter(
          (e) => e.type === "user" || e.type === "assistant",
        ).length,
        lastActivityAt: status.lastActivityAt,
      });

      // Track position for incremental updates
      const stat = await fs.stat(filepath);
      filePositions.set(filepath, stat.size);
    }
  }
}
```

---

## 7. Antigravity Integration (Google Gemini)

### Locations

- **Sessions**: `~/.gemini/antigravity/conversations/*.pb`
- **Annotations**: `~/.gemini/antigravity/annotations/*.pbtxt`
- **Artifacts**: `~/.gemini/antigravity/brain/<session-id>/`
- **Project Tracker**: `~/.gemini/antigravity/code_tracker/active/`

### Data Model & Heuristics

Antigravity sessions are stored as Protobuf files. Since explicit project linking is abstract, Harness uses a heuristic matching algorithm:

1. **Session Activity**: Determined by `last_user_view_time` in annotations or file modification times.
2. **Project Linking**:
   - Scans `code_tracker/active` for project directories.
   - Compares project modification times with session activity.
   - **Rule**: Finds the project with the **minimum time difference** within a **96-hour window**.
   - Note: Antigravity performs background scans which update project timestamps; the 96h window ensures robust matching despite these updates.

---

## 8. File Structure

```
claude-code-ui/
├── packages/
│   ├── daemon/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── watcher.ts
│   │   │   ├── parser.ts
│   │   │   ├── status.ts
│   │   │   ├── streams.ts
│   │   │   └── types.ts
│   │   └── package.json
│   │
│   └── ui/
│       ├── src/
│       │   ├── routes/
│       │   │   ├── __root.tsx
│       │   │   ├── index.tsx
│       │   │   └── boards/
│       │   │       ├── $boardId.tsx
│       │   │       └── $boardId.sessions.$sessionId.tsx
│       │   ├── components/
│       │   │   ├── KanbanBoard.tsx
│       │   │   ├── SessionCard.tsx
│       │   │   └── SessionDetail.tsx
│       │   ├── hooks/
│       │   │   ├── useRegistry.ts
│       │   │   └── useSession.ts
│       │   └── main.tsx
│       └── package.json
│
├── package.json              # Workspace root
├── pnpm-workspace.yaml
└── spec.md
```

---

## 8. Tech Stack

| Component          | Technology              | Version   |
| ------------------ | ----------------------- | --------- |
| Runtime            | Node.js                 | >=20.19.0 |
| Package manager    | pnpm                    | latest    |
| File watching      | chokidar                | ^5.0.0    |
| Streams server     | @durable-streams/server | ^0.1.0    |
| Streams client     | @durable-streams/client | ^0.1.0    |
| Frontend framework | React                   | ^19.0.0   |
| Routing            | TanStack Router         | latest    |
| Styling            | Tailwind CSS            | ^4.0.0    |
| Build tool         | Vite                    | ^6.0.0    |

---

## 9. Implementation Order

1. **Daemon core** - File watcher + JSONL parser
2. **Status detection** - Derive session status from entries
3. **Streams integration** - Write to durable streams server
4. **Basic UI** - Board list + session cards
5. **Live updates** - SSE subscription to registry
6. **Session detail** - Full session view with messages
7. **Polish** - Filtering, search, manual TODO items
