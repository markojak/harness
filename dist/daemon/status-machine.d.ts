/**
 * XState state machine for session status detection.
 *
 * This replaces the ad-hoc if-statements with a proper state machine
 * that makes transitions explicit and testable.
 */
import type { LogEntry } from "./types.js";
export interface StatusContext {
    lastActivityAt: string;
    messageCount: number;
    hasPendingToolUse: boolean;
    pendingToolIds: string[];
}
export type StatusEvent = {
    type: "USER_PROMPT";
    timestamp: string;
} | {
    type: "TOOL_RESULT";
    timestamp: string;
    toolUseIds: string[];
} | {
    type: "ASSISTANT_STREAMING";
    timestamp: string;
} | {
    type: "ASSISTANT_TOOL_USE";
    timestamp: string;
    toolUseIds: string[];
} | {
    type: "TURN_END";
    timestamp: string;
} | {
    type: "STALE_TIMEOUT";
};
export type StatusState = "working" | "waiting_for_approval" | "waiting_for_input";
/**
 * State machine for session status.
 *
 * States:
 * - working: Claude is actively processing
 * - waiting_for_approval: Tool use needs user approval
 * - waiting_for_input: Claude finished, waiting for user
 *
 * Note: "idle" status is determined by the UI based on elapsed time since lastActivityAt
 */
export declare const statusMachine: import("xstate").StateMachine<StatusContext, {
    type: "USER_PROMPT";
    timestamp: string;
} | {
    type: "TOOL_RESULT";
    timestamp: string;
    toolUseIds: string[];
} | {
    type: "ASSISTANT_STREAMING";
    timestamp: string;
} | {
    type: "ASSISTANT_TOOL_USE";
    timestamp: string;
    toolUseIds: string[];
} | {
    type: "TURN_END";
    timestamp: string;
} | {
    type: "STALE_TIMEOUT";
}, {}, never, never, never, never, "working" | "waiting_for_approval" | "waiting_for_input", string, import("xstate").NonReducibleUnknown, import("xstate").NonReducibleUnknown, import("xstate").EventObject, import("xstate").MetaObject, {
    id: "sessionStatus";
    states: {
        readonly working: {};
        readonly waiting_for_approval: {};
        readonly waiting_for_input: {};
    };
}>;
/**
 * Convert a log entry to a status event.
 */
export declare function logEntryToEvent(entry: LogEntry): StatusEvent | null;
/**
 * Derive status by running all log entries through the state machine.
 */
export declare function deriveStatusFromMachine(entries: LogEntry[]): {
    status: StatusState;
    context: StatusContext;
};
/**
 * Map machine status to the existing StatusResult format for compatibility.
 * Note: "idle" status is determined by the UI based on elapsed time.
 */
export declare function machineStatusToResult(machineStatus: StatusState, context: StatusContext): {
    status: "working" | "waiting";
    lastRole: "user" | "assistant";
    hasPendingToolUse: boolean;
    lastActivityAt: string;
    messageCount: number;
};
