/**
 * Claude Code provider - parses sessions from ~/.claude/projects/
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { ProviderSession, SessionEvent } from "./types.js";

const CLAUDE_PROJECTS_DIR = `${process.env.HOME}/.claude/projects`;

/**
 * Decode the encoded directory name back to a path
 */
function decodeProjectDir(encoded: string): string {
  return encoded.replace(/^-/, "/").replace(/-/g, "/");
}

/**
 * Get the project name from an encoded directory
 */
function getProjectName(encoded: string): string {
  const decoded = decodeProjectDir(encoded);
  return decoded.split("/").pop() || decoded;
}

/**
 * List all Claude sessions
 */
export async function listClaudeSessions(options?: {
  since?: number;
  projectFilter?: string;
}): Promise<ProviderSession[]> {
  const sessions: ProviderSession[] = [];
  const { since, projectFilter } = options || {};

  try {
    const projectDirs = await readdir(CLAUDE_PROJECTS_DIR);

    for (const projectDir of projectDirs) {
      const projectName = getProjectName(projectDir);
      
      // Apply project filter
      if (projectFilter && !projectName.toLowerCase().includes(projectFilter.toLowerCase())) {
        continue;
      }

      const projectPath = join(CLAUDE_PROJECTS_DIR, projectDir);
      const files = await readdir(projectPath).catch(() => []);

      for (const file of files.filter(f => f.endsWith(".jsonl"))) {
        const filepath = join(projectPath, file);
        const fileStat = await stat(filepath).catch(() => null);
        if (!fileStat) continue;

        // Apply time filter
        if (since && fileStat.mtime.getTime() < since) continue;

        const session = await parseClaudeSession(filepath, projectName);
        if (session) {
          sessions.push(session);
        }
      }
    }
  } catch (err) {
    // Projects dir doesn't exist
  }

  return sessions;
}

/**
 * Parse a single Claude session file
 */
export async function parseClaudeSession(
  filepath: string,
  projectName?: string
): Promise<ProviderSession | null> {
  try {
    const content = await readFile(filepath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    if (lines.length === 0) return null;

    const fileStat = await stat(filepath);
    const sessionId = filepath.split("/").pop()?.replace(".jsonl", "") || "";

    // Extract metadata from lines
    let originalPrompt = "";
    let goal = "";
    let cwd = "";
    let gitBranch = "";
    let lastTimestamp = fileStat.mtime.toISOString();

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);

        // Extract prompt from first user message
        if ((parsed.type === "human" || parsed.type === "user") && !originalPrompt) {
          originalPrompt = parsed.message?.content?.[0]?.text || "";
        }

        // Extract cwd
        if (parsed.cwd && !cwd) {
          cwd = parsed.cwd;
        }

        // Extract summary/goal
        if (parsed.type === "summary" && parsed.summary) {
          goal = parsed.summary;
        }

        // Track last timestamp
        if (parsed.timestamp) {
          lastTimestamp = parsed.timestamp;
        }
      } catch {
        // Skip malformed lines
      }
    }

    // Determine if active (activity in last 5 minutes)
    const lastActivity = new Date(lastTimestamp).getTime();
    const isActive = Date.now() - lastActivity < 5 * 60 * 1000;

    // Infer project name from filepath if not provided
    if (!projectName) {
      const parts = filepath.split("/");
      const encodedDir = parts[parts.length - 2] || "";
      projectName = getProjectName(encodedDir);
    }

    return {
      provider: "claude",
      sessionId,
      projectName,
      cwd: cwd || "",
      originalPrompt: originalPrompt.slice(0, 500),
      goal: goal.slice(0, 200),
      gitBranch,
      model: "claude",
      status: {
        state: isActive ? "working" : "idle",
        lastActivityAt: lastTimestamp,
        isActive,
      },
      lastActivityAt: lastTimestamp,
      messageCount: lines.length,
      filepath,
    };
  } catch {
    return null;
  }
}

/**
 * Parse session events (transcript)
 */
export async function parseClaudeEvents(filepath: string): Promise<SessionEvent[]> {
  const events: SessionEvent[] = [];

  try {
    const content = await readFile(filepath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);

        if (parsed.type === "human" || parsed.type === "user") {
          events.push({
            type: "user",
            timestamp: parsed.timestamp || "",
            content: parsed.message?.content?.[0]?.text || "",
          });
        } else if (parsed.type === "assistant") {
          const text = parsed.message?.content
            ?.filter((c: any) => c.type === "text")
            ?.map((c: any) => c.text)
            .join("\n") || "";
          
          events.push({
            type: "assistant",
            timestamp: parsed.timestamp || "",
            content: text,
          });
        } else if (parsed.type === "tool_use" || parsed.type === "tool_result") {
          events.push({
            type: "tool",
            timestamp: parsed.timestamp || "",
            toolName: parsed.name || parsed.tool_name || "tool",
            content: JSON.stringify(parsed.input || parsed.content || {}).slice(0, 500),
          });
        }
      } catch {
        // Skip malformed lines
      }
    }
  } catch {
    // File read error
  }

  return events;
}

/**
 * Watch for Claude session changes
 */
export function getClaudeWatchPaths(): string[] {
  return [CLAUDE_PROJECTS_DIR];
}
