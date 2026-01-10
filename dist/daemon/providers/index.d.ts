/**
 * Provider index - unified interface for all AI coding agents
 */
export * from "./types.js";
export * from "./claude.js";
export * from "./codex.js";
export * from "./opencode.js";
import type { Provider, ProviderSession, SessionEvent } from "./types.js";
/**
 * List all sessions from all providers
 */
export declare function listAllSessions(options?: {
    since?: number;
    projectFilter?: string;
    providers?: Provider[];
}): Promise<ProviderSession[]>;
/**
 * Get session by ID (searches all providers)
 */
export declare function getSession(sessionId: string): Promise<ProviderSession | null>;
/**
 * Get session events (transcript)
 */
export declare function getSessionEvents(session: ProviderSession): Promise<SessionEvent[]>;
/**
 * Get all watch paths for file watching
 */
export declare function getAllWatchPaths(): string[];
/**
 * Get provider statistics
 */
export declare function getProviderStats(): Promise<{
    claude: {
        installed: boolean;
        sessionCount: number;
    };
    codex: {
        installed: boolean;
        sessionCount: number;
    };
    opencode: {
        installed: boolean;
        sessionCount: number;
    };
}>;
