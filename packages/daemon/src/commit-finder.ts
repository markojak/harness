/**
 * Commit Finder - locate which Claude session created a given commit
 * 
 * Flow:
 * 1. User enters commit hash
 * 2. Find which repo contains it (fast parallel git check)
 * 3. Get files changed in commit
 * 4. Search sessions that touched those files
 * 5. Score by content similarity
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { findSessionsByFilePaths } from "./ripgrep.js";
import { getAllSessionCwds } from "./search.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

const execAsync = promisify(exec);

const CLAUDE_PROJECTS_DIR = `${process.env.HOME}/.claude/projects`;

export interface CommitInfo {
  hash: string;
  repo: string;
  repoPath: string;
  message: string;
  author: string;
  date: string;
  files: string[];
}

export interface SessionMatch {
  sessionId: string;
  projectName: string;
  score: number;
  matchedFiles: string[];
  filepath: string;
}

/**
 * Decode the encoded directory name back to a path
 */
/**
 * Decode encoded directory name (used for display purposes only).
 * Note: This is lossy for directory names containing dashes.
 */
function decodeEncodedDir(encoded: string): string {
  return encoded.replace(/^-/, "/").replace(/-/g, "/");
}

/**
 * Get all known git roots from indexed session cwds.
 * Uses actual cwd paths from the search index (all providers).
 */
async function getKnownGitRoots(): Promise<string[]> {
  const roots = new Set<string>();

  try {
    // Get all unique cwds from indexed sessions
    const cwds = getAllSessionCwds();

    for (const cwd of cwds) {
      // Walk up to find .git
      let current = cwd;
      while (current && current !== "/") {
        if (existsSync(join(current, ".git"))) {
          roots.add(current);
          break;
        }
        current = dirname(current);
      }
    }
  } catch (err) {
    console.error("[CommitFinder] Error getting git roots:", err);
  }

  return Array.from(roots);
}

/**
 * Check if a commit exists in a repo
 */
async function commitExistsInRepo(
  hash: string,
  repoPath: string
): Promise<boolean> {
  try {
    await execAsync(`git -C ${JSON.stringify(repoPath)} cat-file -t ${hash}`, {
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Find which repo contains a commit (parallel check)
 */
export async function findRepoForCommit(hash: string): Promise<string | null> {
  const roots = await getKnownGitRoots();

  // Check all repos in parallel
  const results = await Promise.all(
    roots.map(async (repoPath) => {
      const exists = await commitExistsInRepo(hash, repoPath);
      return exists ? repoPath : null;
    })
  );

  return results.find((r) => r !== null) || null;
}

/**
 * Get commit details
 */
export async function getCommitInfo(
  hash: string,
  repoPath: string
): Promise<CommitInfo | null> {
  try {
    // Get commit metadata
    const { stdout: meta } = await execAsync(
      `git -C ${JSON.stringify(repoPath)} log -1 --format="%H%n%s%n%an%n%aI" ${hash}`,
      { timeout: 5000 }
    );

    const [fullHash, message, author, date] = meta.trim().split("\n");

    // Get changed files
    const { stdout: filesRaw } = await execAsync(
      `git -C ${JSON.stringify(repoPath)} show --name-only --format="" ${hash}`,
      { timeout: 5000 }
    );

    const files = filesRaw.trim().split("\n").filter(Boolean);

    // Get repo name from path
    const repo = repoPath.split("/").pop() || repoPath;

    return {
      hash: fullHash || hash,
      repo,
      repoPath,
      message: message || "",
      author: author || "",
      date: date || "",
      files,
    };
  } catch {
    return null;
  }
}

/**
 * Find sessions that might have created a commit
 */
export async function findSessionsForCommit(
  commitInfo: CommitInfo
): Promise<SessionMatch[]> {
  const { files, repoPath } = commitInfo;

  // Build full paths for the changed files
  const fullPaths = files.map((f) => join(repoPath, f));

  // Find sessions that touched any of these files (single batch search)
  const fileToSessions = await findSessionsByFilePaths(fullPaths);
  
  const allSessionIds = new Set<string>();
  for (const sessionIds of fileToSessions.values()) {
    sessionIds.forEach((id) => allSessionIds.add(id));
  }

  // Parse commit date for timestamp scoring
  const commitDate = commitInfo.date ? new Date(commitInfo.date).getTime() : Date.now();

  // Score each session
  const matches: SessionMatch[] = [];

  for (const sessionId of allSessionIds) {
    const matchedFiles: string[] = [];

    for (const [filePath, sessionIds] of fileToSessions) {
      if (sessionIds.includes(sessionId)) {
        // Use relative path for display
        const relativePath = filePath.replace(repoPath + "/", "");
        matchedFiles.push(relativePath);
      }
    }

    // Find session file path
    const sessionFile = await findSessionFile(sessionId);

    if (sessionFile) {
      // Get session timestamp from file modification time
      let sessionTime = Date.now();
      try {
        const fileStat = await stat(sessionFile);
        sessionTime = fileStat.mtime.getTime();
      } catch {
        // Use current time as fallback
      }

      // Calculate time difference from commit
      const timeDiff = Math.abs(commitDate - sessionTime);

      // Base score = percentage of commit files touched
      let score = matchedFiles.length / files.length;

      // Timestamp boost:
      // - Within 24h of commit: 1.5x boost
      // - Within 1 week: 1.2x boost
      // - Older: no boost
      if (timeDiff < ONE_DAY_MS) {
        score *= 1.5;
      } else if (timeDiff < ONE_WEEK_MS) {
        score *= 1.2;
      }

      // Cap at 1.0
      score = Math.min(score, 1.0);

      // Extract project name from path
      const parts = sessionFile.split("/");
      const encoded = parts[parts.length - 2] || "";
      const decoded = decodeEncodedDir(encoded);
      const projectName = decoded.split("/").pop() || "unknown";

      matches.push({
        sessionId,
        projectName,
        score,
        matchedFiles,
        filepath: sessionFile,
      });
    }
  }

  // Sort by score (descending)
  matches.sort((a, b) => b.score - a.score);

  return matches;
}

/**
 * Find the JSONL file for a session ID
 */
async function findSessionFile(sessionId: string): Promise<string | null> {
  try {
    const projectDirs = await readdir(CLAUDE_PROJECTS_DIR);

    for (const projectDir of projectDirs) {
      const filePath = join(
        CLAUDE_PROJECTS_DIR,
        projectDir,
        `${sessionId}.jsonl`
      );
      try {
        await stat(filePath);
        return filePath;
      } catch {
        // File doesn't exist in this project
      }
    }
  } catch {
    // Projects dir doesn't exist
  }

  return null;
}

/**
 * Main entry point: find sessions for a commit hash
 */
export async function findCommit(hash: string): Promise<{
  commit: CommitInfo | null;
  sessions: SessionMatch[];
  error?: string;
}> {
  // Validate hash format (at least 7 chars, hex)
  if (!/^[a-f0-9]{7,40}$/i.test(hash)) {
    return {
      commit: null,
      sessions: [],
      error: "Invalid commit hash format",
    };
  }

  // Find the repo
  const repoPath = await findRepoForCommit(hash);

  if (!repoPath) {
    return {
      commit: null,
      sessions: [],
      error: "Commit not found in any known repository",
    };
  }

  // Get commit info
  const commit = await getCommitInfo(hash, repoPath);

  if (!commit) {
    return {
      commit: null,
      sessions: [],
      error: "Failed to read commit details",
    };
  }

  // Find matching sessions
  const sessions = await findSessionsForCommit(commit);

  return { commit, sessions };
}
