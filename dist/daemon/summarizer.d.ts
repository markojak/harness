/**
 * AI-powered session summarization using Claude Sonnet
 */
import type { SessionState } from "./watcher.js";
/**
 * Generate an AI summary of the session's current state
 */
export declare function generateAISummary(session: SessionState): Promise<string>;
/**
 * Generate the high-level goal of the session
 * Cached but regenerated if session grows significantly
 */
export declare function generateGoal(session: SessionState): Promise<string>;
/**
 * Clear the summary cache for a session
 */
export declare function clearSummaryCache(sessionId: string): void;
