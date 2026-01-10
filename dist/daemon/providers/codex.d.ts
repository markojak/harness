/**
 * Codex (OpenAI) provider - parses sessions from ~/.codex/sessions/
 */
import type { ProviderSession, SessionEvent } from "./types.js";
/**
 * List all Codex sessions
 */
export declare function listCodexSessions(options?: {
    since?: number;
    projectFilter?: string;
}): Promise<ProviderSession[]>;
/**
 * Parse a single Codex session file
 */
export declare function parseCodexSession(filepath: string): Promise<ProviderSession | null>;
/**
 * Parse session events (transcript)
 */
export declare function parseCodexEvents(filepath: string): Promise<SessionEvent[]>;
/**
 * Watch paths for Codex sessions
 */
export declare function getCodexWatchPaths(): string[];
/**
 * Check if Codex is installed
 */
export declare function isCodexInstalled(): Promise<boolean>;
