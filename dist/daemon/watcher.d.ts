import { EventEmitter } from "node:events";
import type { LogEntry, StatusResult } from "./types.js";
export interface PendingPermission {
    session_id: string;
    tool_name: string;
    tool_input?: Record<string, unknown>;
    pending_since: string;
}
export interface StopSignal {
    session_id: string;
    stopped_at: string;
}
export interface SessionEndSignal {
    session_id: string;
    ended_at: string;
}
export interface WorkingSignal {
    session_id: string;
    working_since: string;
}
export interface SessionState {
    sessionId: string;
    filepath: string;
    encodedDir: string;
    cwd: string;
    gitBranch: string | null;
    originalPrompt: string;
    startedAt: string;
    status: StatusResult;
    entries: LogEntry[];
    bytePosition: number;
    gitRepoUrl: string | null;
    gitRepoId: string | null;
    branchChanged?: boolean;
    pendingPermission?: PendingPermission;
    hasWorkingSignal?: boolean;
    hasStopSignal?: boolean;
    hasEndedSignal?: boolean;
}
export interface SessionEvent {
    type: "created" | "updated" | "deleted";
    session: SessionState;
    previousStatus?: StatusResult;
}
export declare class SessionWatcher extends EventEmitter {
    private watcher;
    private signalWatcher;
    private sessions;
    private pendingPermissions;
    private workingSignals;
    private stopSignals;
    private endedSignals;
    private debounceTimers;
    private debounceMs;
    private staleCheckInterval;
    constructor(options?: {
        debounceMs?: number;
    });
    /**
     * Check if a session has a pending permission request.
     */
    hasPendingPermission(sessionId: string): boolean;
    /**
     * Get pending permission for a session.
     */
    getPendingPermission(sessionId: string): PendingPermission | undefined;
    /**
     * Check if a session has a working signal (turn in progress).
     */
    hasWorkingSignal(sessionId: string): boolean;
    /**
     * Check if a session has received a stop signal (turn ended).
     */
    hasStopSignal(sessionId: string): boolean;
    /**
     * Check if a session has received an ended signal (session closed).
     */
    hasEndedSignal(sessionId: string): boolean;
    start(): Promise<void>;
    /**
     * Load any existing signal files on startup.
     */
    private loadExistingSignals;
    /**
     * Parse signal filename to extract session ID and signal type.
     * Format: <session_id>.<type>.json (e.g., abc123.permission.json)
     */
    private parseSignalFilename;
    /**
     * Handle a signal file being created/updated.
     */
    private handleSignalFile;
    /**
     * Handle a signal file being removed.
     */
    private handleSignalRemoved;
    stop(): void;
    /**
     * Clear a pending permission when tool completes (called when tool_result is seen).
     */
    clearPendingPermission(sessionId: string): Promise<void>;
    /**
     * Clear stop signal for a session (called when new user prompt is seen).
     */
    clearStopSignal(sessionId: string): Promise<void>;
    getSessions(): Map<string, SessionState>;
    /**
     * Periodically check for sessions that have gone stale.
     * This catches cases where Claude finishes responding but no turn_duration
     * event is written to the log file.
     */
    private checkStaleSessions;
    private debouncedHandleFile;
    private handleFile;
    private handleDelete;
}
