/**
 * OpenCode provider - parses sessions from ~/.local/share/opencode/storage/
 *
 * OpenCode stores data in a more complex structure:
 * - storage/project/*.json - project metadata (worktree paths)
 * - storage/session/{project_hash}/{session_id}.json - session metadata
 * - storage/message/{session_id}/*.json - individual messages
 */
import type { ProviderSession, SessionEvent } from "./types.js";
/**
 * List all OpenCode sessions
 */
export declare function listOpenCodeSessions(options?: {
    since?: number;
    projectFilter?: string;
}): Promise<ProviderSession[]>;
/**
 * Parse session events (transcript)
 */
export declare function parseOpenCodeEvents(sessionId: string): Promise<SessionEvent[]>;
/**
 * Get watch paths for OpenCode
 */
export declare function getOpenCodeWatchPaths(): string[];
/**
 * Check if OpenCode is installed
 */
export declare function isOpenCodeInstalled(): Promise<boolean>;
