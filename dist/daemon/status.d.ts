import type { LogEntry, StatusResult } from "./types.js";
/**
 * Derive session status from log entries using XState state machine.
 *
 * Status logic:
 * - "working": Claude is actively processing (streaming or executing tools)
 * - "waiting": Claude finished, waiting for user input or approval
 *   - hasPendingToolUse: true if waiting for tool approval
 *
 * Note: "idle" status is determined by the UI based on elapsed time since lastActivityAt
 */
export declare function deriveStatus(entries: LogEntry[]): StatusResult;
/**
 * Compare two status results to detect meaningful changes.
 */
export declare function statusChanged(prev: StatusResult | null | undefined, next: StatusResult): boolean;
/**
 * Format status for display.
 */
export declare function formatStatus(result: StatusResult): string;
/**
 * Get a short status string for logging.
 */
export declare function getStatusKey(result: StatusResult): string;
