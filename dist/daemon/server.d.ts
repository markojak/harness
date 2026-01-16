#!/usr/bin/env node
/**
 * Durable Streams server for session state.
 */
import { type PRInfo } from "./schema.js";
import type { SessionState } from "./watcher.js";
import type { AntigravitySessionState } from "./antigravity-watcher.js";
export interface StreamServerOptions {
    port?: number;
}
export declare class StreamServer {
    private server;
    private stream;
    private port;
    private streamUrl;
    private sessionCache;
    constructor(options?: StreamServerOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    getStreamUrl(): string;
    /**
     * Convert SessionState to Session schema and publish to stream
     */
    publishSession(sessionState: SessionState, operation: "insert" | "update" | "delete"): Promise<void>;
    /**
     * Publish session with updated PR info (called from PR update callback)
     */
    publishSessionWithPR(sessionState: SessionState, pr: PRInfo | null): Promise<void>;
    /**
     * Publish an Antigravity session to the stream
     */
    publishAntigravitySession(sessionState: AntigravitySessionState, operation: "insert" | "update" | "delete"): Promise<void>;
}
