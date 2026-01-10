/**
 * Claude Code provider - parses sessions from ~/.claude/projects/
 */
import type { ProviderSession, SessionEvent } from "./types.js";
/**
 * List all Claude sessions
 */
export declare function listClaudeSessions(options?: {
    since?: number;
    projectFilter?: string;
}): Promise<ProviderSession[]>;
/**
 * Parse a single Claude session file
 */
export declare function parseClaudeSession(filepath: string, projectName?: string): Promise<ProviderSession | null>;
/**
 * Parse session events (transcript)
 */
export declare function parseClaudeEvents(filepath: string): Promise<SessionEvent[]>;
/**
 * Watch for Claude session changes
 */
export declare function getClaudeWatchPaths(): string[];
