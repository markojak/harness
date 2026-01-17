/**
 * Antigravity (Google Gemini/DeepMind) session watcher
 *
 * Watches for changes in Antigravity session files and emits events
 * when sessions are created, updated, or deleted.
 */
import { EventEmitter } from "node:events";
export interface AntigravitySessionState {
    sessionId: string;
    filepath: string;
    projectName: string | null;
    projectPath: string | null;
    status: "active" | "idle" | "working" | "unknown";
    lastActivity: Date;
    createdAt: Date;
    artifacts: string[];
    provider: "antigravity";
}
export interface AntigravitySessionEvent {
    type: "created" | "updated" | "deleted";
    session: AntigravitySessionState;
}
export declare class AntigravityWatcher extends EventEmitter {
    private annotationWatcher;
    private brainWatcher;
    private conversationWatcher;
    private sessions;
    private debounceTimers;
    private debounceMs;
    constructor(options?: {
        debounceMs?: number;
    });
    start(): Promise<void>;
    stop(): Promise<void>;
    /**
     * Get all current sessions.
     */
    getSessions(): AntigravitySessionState[];
    /**
     * Get a specific session by ID.
     */
    getSession(sessionId: string): AntigravitySessionState | undefined;
    private extractSessionIdFromPath;
    private debouncedHandleAnnotation;
    private debouncedUpdateSession;
    private handleAnnotationChange;
    private handleNewSession;
    private handleSessionDeleted;
    private updateSession;
}
