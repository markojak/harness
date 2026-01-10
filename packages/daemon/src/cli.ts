#!/usr/bin/env node

import { SessionWatcher, type SessionEvent, type SessionState } from "./watcher.js";
import { formatStatus, getStatusKey } from "./status.js";

// Parse CLI args
const args = process.argv.slice(2);
const showOnlyRecent = args.includes("--recent") || args.includes("-r");
const showOnlyActive = args.includes("--active") || args.includes("-a");
const helpRequested = args.includes("--help") || args.includes("-h");

const RECENT_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

// ANSI colors
const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
};

function formatTime(isoString: string): string {
  if (!isoString) return "unknown";
  const date = new Date(isoString);
  return date.toLocaleTimeString();
}

function formatRelativeTime(isoString: string): string {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = Date.now();
  const diffMs = now - date.getTime();

  if (diffMs < 1000) return "just now";
  if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s ago`;
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
  return `${Math.floor(diffMs / 3600000)}h ago`;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

function formatPrompt(prompt: string): string {
  // Remove newlines and extra whitespace
  return truncate(prompt.replace(/\s+/g, " ").trim(), 60);
}

function formatCwd(cwd: string): string {
  // Shorten home directory
  const home = process.env.HOME ?? "";
  if (cwd.startsWith(home)) {
    return "~" + cwd.slice(home.length);
  }
  return cwd;
}

function formatRepoLabel(session: SessionState): string {
  if (session.gitRepoId) {
    return `${colors.blue}${session.gitRepoId}${colors.reset}`;
  }
  return `${colors.gray}(no repo)${colors.reset}`;
}

function logSessionEvent(event: SessionEvent): void {
  const { type, session, previousStatus } = event;
  const timestamp = new Date().toLocaleTimeString();

  const cwdShort = formatCwd(session.cwd);
  const status = formatStatus(session.status);
  const prompt = formatPrompt(session.originalPrompt);
  const branch = session.gitBranch ? `${colors.magenta}${session.gitBranch}${colors.reset}` : "";
  const repo = formatRepoLabel(session);
  const lastActivity = formatRelativeTime(session.status.lastActivityAt);
  const msgCount = session.status.messageCount;

  console.log();

  switch (type) {
    case "created":
      console.log(
        `${colors.gray}${timestamp}${colors.reset} ${colors.green}[NEW]${colors.reset} ${colors.cyan}${session.sessionId.slice(0, 8)}${colors.reset} ${repo}`
      );
      console.log(`  ${colors.bold}${cwdShort}${colors.reset} ${branch}`);
      console.log(`  ${colors.dim}"${prompt}"${colors.reset}`);
      console.log(`  ${status} | ${msgCount} msgs | ${lastActivity}`);
      break;

    case "updated":
      const prevStatusKey = previousStatus ? getStatusKey(previousStatus) : "?";
      const newStatusKey = getStatusKey(session.status);
      console.log(
        `${colors.gray}${timestamp}${colors.reset} ${colors.yellow}[CHG]${colors.reset} ${colors.cyan}${session.sessionId.slice(0, 8)}${colors.reset} ${repo} ${colors.dim}${prevStatusKey} → ${newStatusKey}${colors.reset}`
      );
      console.log(`  ${colors.bold}${cwdShort}${colors.reset} ${branch}`);
      console.log(`  ${status} | ${msgCount} msgs | ${lastActivity}`);
      break;

    case "deleted":
      console.log(
        `${colors.gray}${timestamp}${colors.reset} ${colors.blue}[DEL]${colors.reset} ${colors.cyan}${session.sessionId.slice(0, 8)}${colors.reset}`
      );
      console.log(`  ${colors.dim}${cwdShort}${colors.reset}`);
      break;
  }
}

const IDLE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour - match UI setting

function isSessionIdle(session: SessionState): boolean {
  const elapsed = Date.now() - new Date(session.status.lastActivityAt).getTime();
  return elapsed > IDLE_THRESHOLD_MS;
}

function shouldShowSession(session: SessionState): boolean {
  if (showOnlyActive && isSessionIdle(session)) {
    return false;
  }
  if (showOnlyRecent) {
    const lastActivity = new Date(session.status.lastActivityAt).getTime();
    if (Date.now() - lastActivity > RECENT_THRESHOLD_MS) {
      return false;
    }
  }
  return true;
}

function logInitialSessions(sessions: Map<string, SessionState>): void {
  // Filter sessions
  const filteredSessions = Array.from(sessions.values()).filter(shouldShowSession);

  // Sort by last activity (most recent first)
  filteredSessions.sort((a, b) => {
    const aTime = new Date(a.status.lastActivityAt).getTime();
    const bTime = new Date(b.status.lastActivityAt).getTime();
    return bTime - aTime;
  });

  console.log();
  const filterLabel = showOnlyActive ? "Active" : showOnlyRecent ? "Recent" : "All";
  console.log(`${colors.bold}=== ${filterLabel} Sessions (${filteredSessions.length}) ===${colors.reset}`);
  console.log();

  if (filteredSessions.length === 0) {
    console.log(`  ${colors.dim}No sessions found${colors.reset}`);
    return;
  }

  // Group by GitHub repo (or "Other" for non-GitHub sessions)
  const byRepo = new Map<string, SessionState[]>();
  const OTHER_KEY = "__other__";

  for (const session of filteredSessions) {
    const key = session.gitRepoId ?? OTHER_KEY;
    const existing = byRepo.get(key) ?? [];
    existing.push(session);
    byRepo.set(key, existing);
  }

  // Sort repos: GitHub repos first (alphabetically), then "Other"
  const sortedKeys = Array.from(byRepo.keys()).sort((a, b) => {
    if (a === OTHER_KEY) return 1;
    if (b === OTHER_KEY) return -1;
    return a.localeCompare(b);
  });

  for (const repoKey of sortedKeys) {
    const repoSessions = byRepo.get(repoKey)!;

    // Print repo header
    if (repoKey === OTHER_KEY) {
      console.log(`${colors.bold}${colors.gray}Other (no GitHub repo)${colors.reset}`);
    } else {
      console.log(`${colors.bold}${colors.blue}${repoKey}${colors.reset}`);
    }

    // Group sessions within repo by cwd (for repos with multiple worktrees)
    const byCwd = new Map<string, SessionState[]>();
    for (const session of repoSessions) {
      const existing = byCwd.get(session.cwd) ?? [];
      existing.push(session);
      byCwd.set(session.cwd, existing);
    }

    for (const [cwd, cwdSessions] of byCwd) {
      const cwdShort = formatCwd(cwd);
      // Only show cwd if there are multiple directories for this repo
      if (byCwd.size > 1) {
        console.log(`  ${colors.dim}${cwdShort}${colors.reset}`);
      }

      for (const session of cwdSessions) {
        const status = formatStatus(session.status);
        const prompt = formatPrompt(session.originalPrompt);
        const branch = session.gitBranch
          ? ` ${colors.magenta}(${session.gitBranch})${colors.reset}`
          : "";
        const lastActivity = formatRelativeTime(session.status.lastActivityAt);
        const indent = byCwd.size > 1 ? "    " : "  ";

        console.log(
          `${indent}${colors.cyan}${session.sessionId.slice(0, 8)}${colors.reset}${branch} ${status}`
        );
        console.log(`${indent}  ${colors.dim}"${prompt}"${colors.reset}`);
        console.log(`${indent}  ${colors.gray}${session.status.messageCount} msgs | ${lastActivity}${colors.reset}`);
      }
    }
    console.log();
  }
}

function printHelp(): void {
  console.log(`${colors.bold}Claude Code Session Watcher${colors.reset}`);
  console.log();
  console.log("Watches Claude Code session logs and displays real-time status updates.");
  console.log();
  console.log(`${colors.bold}Usage:${colors.reset}`);
  console.log("  pnpm watch [options]");
  console.log();
  console.log(`${colors.bold}Options:${colors.reset}`);
  console.log("  -r, --recent   Only show sessions active in the last hour");
  console.log("  -a, --active   Only show non-idle sessions (working/waiting)");
  console.log("  -h, --help     Show this help message");
  console.log();
  console.log(`${colors.bold}Status Icons:${colors.reset}`);
  console.log("  ${colors.green}Working${colors.reset}    Claude is generating a response");
  console.log("  ${colors.yellow}Waiting${colors.reset}    Waiting for your input");
  console.log("  ${colors.yellow}Approval${colors.reset}   Waiting for tool approval");
  console.log("  ${colors.gray}Idle${colors.reset}       No activity for 5+ minutes");
}

async function main(): Promise<void> {
  if (helpRequested) {
    printHelp();
    process.exit(0);
  }

  console.log(`${colors.bold}Claude Code Session Watcher${colors.reset}`);
  console.log(`${colors.dim}Watching ~/.claude/projects/**/*.jsonl${colors.reset}`);
  console.log();

  const watcher = new SessionWatcher({ debounceMs: 300 });

  watcher.on("session", (event: SessionEvent) => {
    logSessionEvent(event);
  });

  watcher.on("error", (error: Error) => {
    console.error(`${colors.yellow}[ERROR]${colors.reset}`, error.message);
  });

  // Handle shutdown
  process.on("SIGINT", () => {
    console.log();
    console.log(`${colors.dim}Shutting down...${colors.reset}`);
    watcher.stop();
    process.exit(0);
  });

  // Start watching
  await watcher.start();

  // Log initial state
  logInitialSessions(watcher.getSessions());

  console.log();
  console.log(`${colors.dim}Watching for changes... (Ctrl+C to exit)${colors.reset}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
