import type { LogEntry, SessionMetadata } from "./types.js";
export interface TailResult {
    entries: LogEntry[];
    newPosition: number;
    hadPartialLine: boolean;
}
/**
 * Incrementally read new JSONL entries from a file starting at a byte offset.
 * Handles partial lines at EOF safely.
 */
export declare function tailJSONL(filepath: string, fromByte?: number): Promise<TailResult>;
/**
 * Extract session metadata from log entries.
 * Looks for cwd, sessionId, gitBranch from first entries,
 * and original prompt from first user message.
 */
export declare function extractMetadata(entries: LogEntry[]): SessionMetadata | null;
/**
 * Decode Claude's encoded directory name back to a path.
 * e.g., "-Users-kyle-code-electric" -> "/Users/kyle/code/electric"
 */
export declare function decodeProjectDir(encodedDir: string): string;
/**
 * Extract session ID from a filepath.
 * e.g., "~/.claude/projects/-Users-kyle/abc123.jsonl" -> "abc123"
 */
export declare function extractSessionId(filepath: string): string;
/**
 * Extract the encoded directory from a filepath.
 * e.g., "~/.claude/projects/-Users-kyle-code/abc123.jsonl" -> "-Users-kyle-code"
 */
export declare function extractEncodedDir(filepath: string): string;
