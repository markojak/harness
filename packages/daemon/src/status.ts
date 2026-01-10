import type {
  LogEntry,
  StatusResult,
  SessionStatus,
} from "./types.js";
import {
  deriveStatusFromMachine,
  machineStatusToResult,
} from "./status-machine.js";

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
export function deriveStatus(entries: LogEntry[]): StatusResult {
  // Use the state machine for status derivation
  const { status: machineStatus, context } = deriveStatusFromMachine(entries);
  return machineStatusToResult(machineStatus, context);
}

/**
 * Compare two status results to detect meaningful changes.
 */
export function statusChanged(
  prev: StatusResult | null | undefined,
  next: StatusResult
): boolean {
  if (!prev) return true;

  return (
    prev.status !== next.status ||
    prev.lastRole !== next.lastRole ||
    prev.hasPendingToolUse !== next.hasPendingToolUse
  );
}

/**
 * Format status for display.
 */
export function formatStatus(result: StatusResult): string {
  const icons: Record<SessionStatus, string> = {
    working: "🟢",
    waiting: result.hasPendingToolUse ? "🟠" : "🟡",
    idle: "⚪",
  };

  const labels: Record<SessionStatus, string> = {
    working: "Working",
    waiting: result.hasPendingToolUse ? "Tool pending" : "Waiting for input",
    idle: "Idle",
  };

  return `${icons[result.status]} ${labels[result.status]}`;
}

/**
 * Get a short status string for logging.
 */
export function getStatusKey(result: StatusResult): string {
  if (result.status === "waiting" && result.hasPendingToolUse) {
    return "waiting:tool";
  }
  return result.status;
}
