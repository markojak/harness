/**
 * Full session indexer - scans ALL sessions, not just recent
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, basename, dirname } from "node:path";
import { existsSync } from "node:fs";
import { getGitInfo } from "./git.js";

import { getProviderPath, isProviderEnabled } from "./system-stats.js";

function getClaudeProjectsDir(): string {
  return getProviderPath("claude");
}

function getCodexSessionsDir(): string {
  return getProviderPath("codex");
}

function getOpenCodeStorageDir(): string {
  return getProviderPath("opencode");
}

export type Provider = "claude" | "codex" | "opencode";

// Minimum content length to include a session (chars) - filter out empty/minimal sessions
const MIN_CONTENT_LENGTH = 100;

export interface IndexedSession {
  sessionId: string;
  provider: Provider;
  filepath: string;
  projectId: string;        // git root path or encoded dir
  projectName: string;      // display name
  gitRepoId: string | null; // owner/repo if GitHub
  gitRepoUrl: string | null;
  cwd: string;
  gitBranch: string | null;
  originalPrompt: string;
  goal: string | null;
  startedAt: string;
  lastActivityAt: string;
  messageCount: number;
  isActive: boolean;        // has activity in last 5 min
  isAgent: boolean;         // is this a sub-agent session
  parentSessionId?: string | null; // parent session if agent
  // For OpenCode: track actual model used
  modelProvider?: string | null; // e.g., "anthropic", "openai", "google"
  modelId?: string | null;       // e.g., "claude-3-5-sonnet", "gpt-4o", "gemini-2.0-flash"
}

export interface IndexedProject {
  projectId: string;
  projectName: string;
  gitRepoId: string | null;
  gitRepoUrl: string | null;
  lastActivityAt: string;
  sessionCount: number;
  activeSessionCount: number;
  isActive: boolean;
}

interface SessionMetadata {
  sessionId: string;
  cwd: string;
  gitBranch: string;
  originalPrompt: string;
  goal: string | null;
  startedAt: string;
  lastActivityAt: string;
  messageCount: number;
  totalContentLength: number; // Total chars of text content
}

/**
 * Decode the encoded directory name back to a path
 */
function decodeEncodedDir(encoded: string): string {
  // -Users-foo-bar → /Users/foo/bar
  return encoded.replace(/^-/, "/").replace(/-/g, "/");
}

/**
 * Extract project name from path (last segment)
 */
function extractProjectName(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || "unknown";
}

/**
 * Find git root for a given path
 */
async function findGitRoot(cwd: string): Promise<string | null> {
  let current = cwd;
  while (current !== "/") {
    if (existsSync(join(current, ".git"))) {
      return current;
    }
    current = dirname(current);
  }
  return null;
}

/**
 * Parse session JSONL to extract metadata
 */
async function parseSessionMetadata(filepath: string): Promise<SessionMetadata | null> {
  try {
    const content = await readFile(filepath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    
    if (lines.length === 0) return null;

    let sessionId = "";
    let cwd = "";
    let gitBranch = "";
    let originalPrompt = "";
    let goal: string | null = null;
    let startedAt = "";
    let lastActivityAt = "";
    let messageCount = 0;
    let totalContentLength = 0;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        
        // Extract basic info from first entry
        if (!sessionId && entry.sessionId) {
          sessionId = entry.sessionId;
        }
        if (!cwd && entry.cwd) {
          cwd = entry.cwd;
        }
        if (!gitBranch && entry.gitBranch) {
          gitBranch = entry.gitBranch;
        }
        
        // Get timestamps
        if (entry.timestamp) {
          if (!startedAt) startedAt = entry.timestamp;
          lastActivityAt = entry.timestamp;
        }

        // Get original prompt (first user message)
        if (!originalPrompt && entry.type === "user" && typeof entry.message?.content === "string") {
          originalPrompt = entry.message.content.slice(0, 200);
        }

        // Get goal from summary
        if (!goal && entry.type === "summary" && entry.summary) {
          goal = entry.summary;
        }

        // Count messages and track content length
        if (entry.type === "user" || entry.type === "assistant") {
          messageCount++;
          // Track content for filtering
          if (entry.message?.content) {
            if (typeof entry.message.content === "string") {
              totalContentLength += entry.message.content.length;
            } else if (Array.isArray(entry.message.content)) {
              for (const block of entry.message.content) {
                if (block.text) totalContentLength += block.text.length;
              }
            }
          }
        }
      } catch {
        // Skip malformed lines
      }
    }

    if (!sessionId) {
      // Try to get session ID from filename
      sessionId = basename(filepath, ".jsonl");
    }

    return {
      sessionId,
      cwd,
      gitBranch,
      originalPrompt,
      goal,
      startedAt,
      lastActivityAt,
      messageCount,
      totalContentLength,
    };
  } catch (error) {
    console.error(`Failed to parse ${filepath}:`, error);
    return null;
  }
}

/**
 * Scan all sessions and build index
 */
export async function indexAllSessions(): Promise<{
  sessions: IndexedSession[];
  projects: IndexedProject[];
}> {
  const sessions: IndexedSession[] = [];
  const projectMap = new Map<string, {
    sessions: IndexedSession[];
    gitRepoId: string | null;
    gitRepoUrl: string | null;
    projectName: string;
  }>();

  try {
    const encodedDirs = await readdir(getClaudeProjectsDir());

    for (const encodedDir of encodedDirs) {
      const dirPath = join(getClaudeProjectsDir(), encodedDir);
      const dirStat = await stat(dirPath).catch(() => null);
      
      if (!dirStat?.isDirectory()) continue;

      const cwd = decodeEncodedDir(encodedDir);
      const files = await readdir(dirPath).catch(() => []);
      const jsonlFiles = files.filter(f => f.endsWith(".jsonl"));

      for (const file of jsonlFiles) {
        const filepath = join(dirPath, file);
        const metadata = await parseSessionMetadata(filepath);
        
        if (!metadata) continue;

        // Determine project (git root or cwd)
        const gitRoot = await findGitRoot(metadata.cwd || cwd);
        const projectId = gitRoot || metadata.cwd || cwd;
        const projectName = extractProjectName(projectId);

        // Get git info
        let gitRepoId: string | null = null;
        let gitRepoUrl: string | null = null;
        
        if (gitRoot) {
          try {
            const gitInfo = await getGitInfo(gitRoot);
            gitRepoId = gitInfo.repoId;
            gitRepoUrl = gitInfo.repoUrl;
          } catch {
            // No git info available
          }
        }

        // Check if active (activity in last 5 min)
        const lastActivity = new Date(metadata.lastActivityAt).getTime();
        const isActive = Date.now() - lastActivity < 5 * 60 * 1000;

        // Check if this is an agent/sub-agent session
        const isAgent = file.startsWith("agent-");
        // Try to extract parent session ID from agent filename (agent-{parentId}-{agentId}.jsonl)
        let parentSessionId: string | null = null;
        if (isAgent) {
          const match = file.match(/^agent-([a-f0-9-]+)-/);
          if (match) {
            parentSessionId = match[1];
          }
        }

        // Skip sessions with minimal content (unless active)
        if (!isActive && metadata.totalContentLength < MIN_CONTENT_LENGTH) {
          continue;
        }

        const session: IndexedSession = {
          sessionId: metadata.sessionId,
          provider: "claude",
          filepath,
          projectId,
          projectName,
          gitRepoId,
          gitRepoUrl,
          cwd: metadata.cwd || cwd,
          gitBranch: metadata.gitBranch || null,
          originalPrompt: metadata.originalPrompt,
          goal: metadata.goal,
          startedAt: metadata.startedAt,
          lastActivityAt: metadata.lastActivityAt,
          messageCount: metadata.messageCount,
          isActive,
          isAgent,
          parentSessionId,
        };

        sessions.push(session);

        // Group by project
        if (!projectMap.has(projectId)) {
          projectMap.set(projectId, {
            sessions: [],
            gitRepoId,
            gitRepoUrl,
            projectName,
          });
        }
        projectMap.get(projectId)!.sessions.push(session);
      }
    }
  } catch (error) {
    console.error("Failed to index Claude sessions:", error);
  }

  // Index Codex sessions
  try {
    await indexCodexSessions(sessions, projectMap);
  } catch (error) {
    console.error("Failed to index Codex sessions:", error);
  }

  // Index OpenCode sessions
  try {
    await indexOpenCodeSessions(sessions, projectMap);
  } catch (error) {
    console.error("Failed to index OpenCode sessions:", error);
  }

  // Build project summaries
  const projects: IndexedProject[] = [];
  
  for (const [projectId, data] of projectMap) {
    const sortedSessions = data.sessions.sort(
      (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
    );
    
    const activeCount = sortedSessions.filter(s => s.isActive).length;
    
    projects.push({
      projectId,
      projectName: data.gitRepoId || data.projectName,
      gitRepoId: data.gitRepoId,
      gitRepoUrl: data.gitRepoUrl,
      lastActivityAt: sortedSessions[0]?.lastActivityAt || "",
      sessionCount: sortedSessions.length,
      activeSessionCount: activeCount,
      isActive: activeCount > 0,
    });
  }

  // Sort projects by last activity
  projects.sort((a, b) => 
    new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
  );

  // Sort sessions by last activity
  sessions.sort((a, b) =>
    new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
  );

  return { sessions, projects };
}

/**
 * Get sessions for a specific project
 */
export function getProjectSessions(
  sessions: IndexedSession[],
  projectId: string
): IndexedSession[] {
  return sessions
    .filter(s => s.projectId === projectId)
    .sort((a, b) => 
      new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
    );
}

/**
 * Index Codex sessions from ~/.codex/sessions/
 */
async function indexCodexSessions(
  sessions: IndexedSession[],
  projectMap: Map<string, { sessions: IndexedSession[]; gitRepoId: string | null; gitRepoUrl: string | null; projectName: string }>
): Promise<void> {
  // Recursively find all JSONL files
  async function findCodexFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          const subFiles = await findCodexFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.name.endsWith(".jsonl")) {
          files.push(fullPath);
        }
      }
    } catch {}
    return files;
  }

  try {
    const sessionFiles = await findCodexFiles(getCodexSessionsDir());
    
    for (const filepath of sessionFiles) {
      try {
        const fileStat = await stat(filepath);
        const content = await readFile(filepath, "utf-8");
        const lines = content.trim().split("\n").filter(Boolean);
        
        if (lines.length === 0) continue;

        // Extract session ID from filename
        // Format: rollout-{datetime}-{session-id}.jsonl
        const filename = filepath.split("/").pop() || "";
        const match = filename.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
        const sessionId = match?.[1] || filename.replace(".jsonl", "");

        // Parse metadata from lines
        let cwd = "";
        let gitBranch: string | null = null;
        let gitCommit: string | null = null;
        let originalPrompt = "";
        let lastTimestamp = fileStat.mtime.toISOString();
        let startedAt = fileStat.birthtime.toISOString();
        let totalContentLength = 0;

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            
            // Session metadata
            if (parsed.type === "session_meta" && parsed.payload) {
              const meta = parsed.payload;
              cwd = meta.cwd || cwd;
              if (meta.git) {
                gitBranch = meta.git.branch || null;
                gitCommit = meta.git.commit_hash || null;
              }
              if (meta.timestamp) {
                startedAt = meta.timestamp;
              }
            }

            // Response items (messages) - track content length
            if (parsed.type === "response_item" && parsed.payload) {
              const textContent = parsed.payload.content?.find((c: any) => 
                c.type === "input_text" || c.type === "text" || c.type === "output_text"
              );
              if (textContent?.text) {
                totalContentLength += textContent.text.length;
              }
              
              // First user message as prompt
              if (parsed.payload.role === "user" && !originalPrompt) {
                originalPrompt = textContent?.text || "";
              }
            }

            // Track last timestamp
            if (parsed.timestamp) {
              lastTimestamp = parsed.timestamp;
            }
          } catch {}
        }

        // Derive project info from cwd - find git root to merge with parent repos
        const gitRoot = cwd ? await findGitRoot(cwd) : null;
        const projectId = gitRoot || cwd || `codex-${sessionId.slice(0, 8)}`;
        const projectName = projectId.split("/").pop() || "codex";

        // Check if active (last 5 min)
        const lastActivity = new Date(lastTimestamp).getTime();
        const isActive = Date.now() - lastActivity < 5 * 60 * 1000;

        // Skip sessions with minimal content (unless active)
        if (!isActive && totalContentLength < MIN_CONTENT_LENGTH) {
          continue;
        }

        // Extract git repo URL from cwd if possible
        let gitRepoId: string | null = null;
        let gitRepoUrl: string | null = null;
        // Could parse .git/config but keeping it simple for now

        const session: IndexedSession = {
          sessionId,
          provider: "codex",
          filepath,
          projectId,
          projectName,
          gitRepoId,
          gitRepoUrl,
          cwd,
          gitBranch,
          originalPrompt: originalPrompt.slice(0, 500),
          goal: null,
          startedAt,
          lastActivityAt: lastTimestamp,
          messageCount: lines.length,
          isActive,
          isAgent: false,
          parentSessionId: null,
        };

        sessions.push(session);

        // Group by project
        if (!projectMap.has(projectId)) {
          projectMap.set(projectId, {
            sessions: [],
            gitRepoId,
            gitRepoUrl,
            projectName,
          });
        }
        projectMap.get(projectId)!.sessions.push(session);
      } catch {}
    }
  } catch {}
}

/**
 * Index OpenCode sessions from ~/.local/share/opencode/storage/
 */
// OpenCode storage dir is now provided by config via getOpenCodeStorageDir()

async function indexOpenCodeSessions(
  sessions: IndexedSession[],
  projectMap: Map<string, { sessions: IndexedSession[]; gitRepoId: string | null; gitRepoUrl: string | null; projectName: string }>
): Promise<void> {
  // Load projects first
  const projects = new Map<string, { id: string; worktree: string }>();
  const projectDir = join(getOpenCodeStorageDir(), "project");
  
  try {
    const projectFiles = await readdir(projectDir);
    for (const file of projectFiles.filter(f => f.endsWith(".json") && f !== "global.json")) {
      try {
        const content = await readFile(join(projectDir, file), "utf-8");
        const project = JSON.parse(content);
        if (project.id) {
          projects.set(project.id, project);
        }
      } catch {}
    }
  } catch {}

  // Index sessions
  const sessionDir = join(getOpenCodeStorageDir(), "session");
  try {
    const projectDirs = await readdir(sessionDir);
    
    for (const projectHash of projectDirs) {
      const projectPath = join(sessionDir, projectHash);
      const projectStat = await stat(projectPath).catch(() => null);
      if (!projectStat?.isDirectory()) continue;

      const project = projects.get(projectHash);
      const cwd = project?.worktree || "";
      // Find git root to merge with parent repos
      const gitRoot = cwd ? await findGitRoot(cwd) : null;
      const projectId = gitRoot || cwd || `opencode-${projectHash.slice(0, 8)}`;
      const projectName = projectId.split("/").pop() || projectHash.slice(0, 8);

      const sessionFiles = await readdir(projectPath).catch(() => []);

      for (const sessionFile of sessionFiles.filter(f => f.endsWith(".json"))) {
        try {
          const sessionPath = join(projectPath, sessionFile);
          const fileStat = await stat(sessionPath);
          const content = await readFile(sessionPath, "utf-8");
          const sessionData = JSON.parse(content);

          // Get message count and model info
          const messageDir = join(getOpenCodeStorageDir(), "message", sessionData.id);
          let messageCount = 0;
          let originalPrompt = sessionData.title || "";
          let lastActivityAt = fileStat.mtime.toISOString();
          let modelProvider: string | null = null;
          let modelId: string | null = null;
          let totalContentLength = 0;

          try {
            const messages = await readdir(messageDir);
            const jsonMessages = messages.filter(f => f.endsWith(".json")).sort();
            messageCount = jsonMessages.length;

            if (jsonMessages.length > 0) {
              const lastMsg = jsonMessages[jsonMessages.length - 1];
              const lastMsgPath = join(messageDir, lastMsg);
              const lastMsgStat = await stat(lastMsgPath);
              lastActivityAt = lastMsgStat.mtime.toISOString();

              // Extract model info and content length from messages
              for (let i = jsonMessages.length - 1; i >= 0; i--) {
                try {
                  const msgContent = await readFile(join(messageDir, jsonMessages[i]), "utf-8");
                  const msg = JSON.parse(msgContent);
                  
                  // Track content length
                  if (msg.content) {
                    if (typeof msg.content === "string") {
                      totalContentLength += msg.content.length;
                    } else if (Array.isArray(msg.content)) {
                      for (const part of msg.content) {
                        if (part.text) totalContentLength += part.text.length;
                      }
                    }
                  }
                  
                  // Extract model info (only need from recent messages)
                  if (!modelProvider && msg.model?.providerID && msg.model?.modelID) {
                    modelProvider = msg.model.providerID;
                    modelId = msg.model.modelID;
                  }
                } catch {}
              }
            }
          } catch {}

          const lastActivity = new Date(lastActivityAt).getTime();
          const isActive = Date.now() - lastActivity < 5 * 60 * 1000;

          // Skip sessions with minimal content (unless active)
          if (!isActive && totalContentLength < MIN_CONTENT_LENGTH) {
            continue;
          }

          const session: IndexedSession = {
            sessionId: sessionData.id,
            provider: "opencode",
            filepath: sessionPath,
            projectId,
            projectName,
            gitRepoId: null,
            gitRepoUrl: null,
            cwd,
            gitBranch: null,
            originalPrompt: originalPrompt.slice(0, 500),
            goal: null,
            startedAt: fileStat.birthtime.toISOString(),
            lastActivityAt,
            messageCount,
            isActive,
            isAgent: false,
            parentSessionId: null,
            modelProvider,
            modelId,
          };

          sessions.push(session);

          if (!projectMap.has(projectId)) {
            projectMap.set(projectId, {
              sessions: [],
              gitRepoId: null,
              gitRepoUrl: null,
              projectName,
            });
          }
          projectMap.get(projectId)!.sessions.push(session);
        } catch {}
      }
    }
  } catch {}
}
