/**
 * Ripgrep wrapper for fast content search across session logs
 * Falls back to Node.js if ripgrep is not available
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { hasRipgrepAsync } from "./deps.js";

const execAsync = promisify(exec);

const CLAUDE_PROJECTS_DIR = `${process.env.HOME}/.claude/projects`;

export interface SearchMatch {
  file: string;
  line: number;
  content: string;
}

/**
 * Search for a pattern across all session JSONL files using ripgrep
 */
async function ripgrepSearch(
  pattern: string,
  options: { maxResults?: number; filesOnly?: boolean } = {}
): Promise<SearchMatch[]> {
  const { maxResults = 100, filesOnly = false } = options;

  try {
    const flags = [
      "--json",
      "--max-count", "10",           // Max matches per file
      "-g", "*.jsonl",               // Only JSONL files
      "--max-filesize", "50M",       // Skip huge files
    ];

    if (filesOnly) {
      flags.push("-l");              // Files only, no content
    }

    const cmd = `rg ${flags.join(" ")} ${JSON.stringify(pattern)} ${CLAUDE_PROJECTS_DIR}`;
    
    const { stdout } = await execAsync(cmd, {
      maxBuffer: 50 * 1024 * 1024,   // 50MB buffer
      timeout: 30_000,                // 30s timeout
    });

    const matches: SearchMatch[] = [];
    
    for (const line of stdout.split("\n").filter(Boolean)) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === "match") {
          matches.push({
            file: parsed.data.path.text,
            line: parsed.data.line_number,
            content: parsed.data.lines.text?.slice(0, 500) || "",
          });
          if (matches.length >= maxResults) break;
        }
      } catch {
        // Skip malformed JSON lines
      }
    }

    return matches;
  } catch (error: any) {
    // Exit code 1 means no matches (not an error)
    if (error.code === 1) return [];
    throw error;
  }
}

/**
 * Fallback: Node.js-based search (slower)
 */
async function nodeSearch(
  pattern: string,
  options: { maxResults?: number } = {}
): Promise<SearchMatch[]> {
  const { maxResults = 100 } = options;
  const matches: SearchMatch[] = [];
  const regex = new RegExp(pattern, "i");

  try {
    const projectDirs = await readdir(CLAUDE_PROJECTS_DIR);

    for (const projectDir of projectDirs) {
      if (matches.length >= maxResults) break;

      const projectPath = join(CLAUDE_PROJECTS_DIR, projectDir);
      
      try {
        const files = await readdir(projectPath);
        const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));

        for (const file of jsonlFiles) {
          if (matches.length >= maxResults) break;

          const filePath = join(projectPath, file);
          try {
            const content = await readFile(filePath, "utf-8");
            const lines = content.split("\n");

            for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
              if (regex.test(lines[i])) {
                matches.push({
                  file: filePath,
                  line: i + 1,
                  content: lines[i].slice(0, 500),
                });
              }
            }
          } catch {
            // Skip unreadable files
          }
        }
      } catch {
        // Skip unreadable directories
      }
    }
  } catch {
    // Projects dir doesn't exist
  }

  return matches;
}

/**
 * Search session logs - uses ripgrep if available, falls back to Node.js
 */
export async function searchLogs(
  pattern: string,
  options: { maxResults?: number; filesOnly?: boolean } = {}
): Promise<SearchMatch[]> {
  if (await hasRipgrepAsync()) {
    return ripgrepSearch(pattern, options);
  }
  return nodeSearch(pattern, options);
}

/**
 * Find sessions that touched a specific file path
 */
export async function findSessionsByFilePath(
  filePath: string
): Promise<string[]> {
  // Search for the file path in tool_use blocks (Edit, Write)
  const matches = await searchLogs(filePath, { filesOnly: true });
  
  // Extract unique session IDs from file paths
  const sessionIds = new Set<string>();
  for (const match of matches) {
    // Path format: ~/.claude/projects/{encoded-dir}/{session-id}.jsonl
    const parts = match.file.split("/");
    const filename = parts[parts.length - 1];
    const sessionId = filename?.replace(".jsonl", "");
    if (sessionId) {
      sessionIds.add(sessionId);
    }
  }

  return Array.from(sessionIds);
}

/**
 * Find sessions that touched ANY of the given file paths (batch search)
 * Returns map of filePath -> sessionIds
 */
export async function findSessionsByFilePaths(
  filePaths: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  
  if (filePaths.length === 0) return result;

  // Initialize result map
  for (const fp of filePaths) {
    result.set(fp, []);
  }

  // Build regex pattern for all file names (just the basename for speed)
  const fileNames = filePaths.map(fp => fp.split("/").pop()).filter(Boolean);
  const pattern = fileNames.join("|");
  
  if (!pattern) return result;

  // Single ripgrep call for all files
  const matches = await searchLogs(pattern, { maxResults: 500 });

  // Map matches back to file paths and sessions
  for (const match of matches) {
    // Extract session ID from match file path
    const parts = match.file.split("/");
    const filename = parts[parts.length - 1];
    const sessionId = filename?.replace(".jsonl", "");
    if (!sessionId) continue;

    // Check which original file paths this match relates to
    for (const fp of filePaths) {
      const baseName = fp.split("/").pop();
      if (baseName && match.content.includes(baseName)) {
        result.get(fp)?.push(sessionId);
      }
    }
  }

  // Dedupe session IDs for each file
  for (const [fp, sessions] of result) {
    result.set(fp, [...new Set(sessions)]);
  }

  return result;
}
