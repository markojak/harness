#!/usr/bin/env node
/**
 * Durable Streams server for session state.
 */
import { DurableStreamTestServer } from "@durable-streams/server";
import { DurableStream } from "@durable-streams/client";
import { sessionsStateSchema } from "./schema.js";
import { generateAISummary, generateGoal } from "./summarizer.js";
import { queuePRCheck, getCachedPR, setOnPRUpdate, stopAllPolling, clearPRForSession } from "./github.js";
import { log } from "./log.js";
const DEFAULT_PORT = 4450;
const SESSIONS_STREAM_PATH = "/sessions";
export class StreamServer {
    server;
    stream = null;
    port;
    streamUrl;
    // Track sessions for PR update callbacks
    sessionCache = new Map();
    constructor(options = {}) {
        this.port = options.port ?? DEFAULT_PORT;
        // Use in-memory storage during development (no dataDir = in-memory)
        const host = process.env.HOST || "127.0.0.1";
        this.server = new DurableStreamTestServer({
            port: this.port,
            host,
        });
        this.streamUrl = `http://${host}:${this.port}${SESSIONS_STREAM_PATH}`;
    }
    async start() {
        await this.server.start();
        const host = process.env.HOST || "127.0.0.1";
        log("Server", `Durable Streams server running on http://${host}:${this.port}`);
        // Create or connect to the sessions stream
        try {
            this.stream = await DurableStream.create({
                url: this.streamUrl,
                contentType: "application/json",
            });
        }
        catch (error) {
            // Stream might already exist, try to connect
            if (error.code === "CONFLICT_EXISTS") {
                this.stream = await DurableStream.connect({ url: this.streamUrl });
            }
            else {
                throw error;
            }
        }
        // Set up PR update callback
        setOnPRUpdate(async (sessionId, pr) => {
            log("PR", `Received PR update for session ${sessionId.slice(0, 8)}: ${pr ? `PR #${pr.number}` : "no PR"}`);
            const sessionState = this.sessionCache.get(sessionId);
            if (sessionState) {
                await this.publishSessionWithPR(sessionState, pr);
            }
            else {
                log("PR", `No cached session state for ${sessionId.slice(0, 8)}`);
            }
        });
    }
    async stop() {
        stopAllPolling();
        await this.server.stop();
        this.stream = null;
    }
    getStreamUrl() {
        return this.streamUrl;
    }
    /**
     * Convert SessionState to Session schema and publish to stream
     */
    async publishSession(sessionState, operation) {
        if (!this.stream) {
            throw new Error("Server not started");
        }
        // Check if branch changed by comparing with cached session
        const cachedSession = this.sessionCache.get(sessionState.sessionId);
        const oldBranch = cachedSession?.gitBranch ?? null;
        const branchChanged = oldBranch !== null && oldBranch !== sessionState.gitBranch;
        if (branchChanged) {
            log("PR", `Branch changed for ${sessionState.sessionId.slice(0, 8)}: ${oldBranch} → ${sessionState.gitBranch}`);
            clearPRForSession(sessionState.sessionId, oldBranch, sessionState.cwd);
        }
        // Cache session state for PR update callbacks
        this.sessionCache.set(sessionState.sessionId, sessionState);
        // Generate AI goal and summary (goals are cached, summaries update more frequently)
        const [goal, summary] = await Promise.all([
            generateGoal(sessionState),
            generateAISummary(sessionState),
        ]);
        // Get cached PR info if available (will be null if branch just changed)
        const pr = sessionState.gitBranch
            ? getCachedPR(sessionState.cwd, sessionState.gitBranch)
            : null;
        // Queue PR check if we have a branch (will update via callback)
        if (sessionState.gitBranch) {
            log("PR", `Session ${sessionState.sessionId.slice(0, 8)} has branch: ${sessionState.gitBranch}`);
            queuePRCheck(sessionState.cwd, sessionState.gitBranch, sessionState.sessionId);
        }
        else {
            log("PR", `Session ${sessionState.sessionId.slice(0, 8)} has no branch`);
        }
        const session = {
            sessionId: sessionState.sessionId,
            provider: "claude", // Currently only watching Claude sessions
            cwd: sessionState.cwd,
            gitBranch: sessionState.gitBranch,
            gitRepoUrl: sessionState.gitRepoUrl,
            gitRepoId: sessionState.gitRepoId,
            originalPrompt: sessionState.originalPrompt,
            status: sessionState.status.status,
            lastActivityAt: sessionState.status.lastActivityAt,
            messageCount: sessionState.status.messageCount,
            hasPendingToolUse: sessionState.status.hasPendingToolUse,
            pendingTool: extractPendingTool(sessionState),
            goal,
            summary,
            recentOutput: extractRecentOutput(sessionState.entries),
            pr,
        };
        // Create the event using the schema helpers
        let event;
        if (operation === "insert") {
            event = sessionsStateSchema.sessions.insert({ value: session });
        }
        else if (operation === "update") {
            event = sessionsStateSchema.sessions.update({ value: session });
        }
        else {
            event = sessionsStateSchema.sessions.delete({
                key: session.sessionId,
                oldValue: session,
            });
        }
        await this.stream.append(event);
    }
    /**
     * Publish session with updated PR info (called from PR update callback)
     */
    async publishSessionWithPR(sessionState, pr) {
        if (!this.stream) {
            throw new Error("Server not started");
        }
        // Generate AI goal and summary
        const [goal, summary] = await Promise.all([
            generateGoal(sessionState),
            generateAISummary(sessionState),
        ]);
        const session = {
            sessionId: sessionState.sessionId,
            provider: "claude", // Currently only watching Claude sessions
            cwd: sessionState.cwd,
            gitBranch: sessionState.gitBranch,
            gitRepoUrl: sessionState.gitRepoUrl,
            gitRepoId: sessionState.gitRepoId,
            originalPrompt: sessionState.originalPrompt,
            status: sessionState.status.status,
            lastActivityAt: sessionState.status.lastActivityAt,
            messageCount: sessionState.status.messageCount,
            hasPendingToolUse: sessionState.status.hasPendingToolUse,
            pendingTool: extractPendingTool(sessionState),
            goal,
            summary,
            recentOutput: extractRecentOutput(sessionState.entries),
            pr,
        };
        const event = sessionsStateSchema.sessions.update({ value: session });
        await this.stream.append(event);
    }
    /**
     * Publish an Antigravity session to the stream
     */
    async publishAntigravitySession(sessionState, operation) {
        if (!this.stream) {
            throw new Error("Server not started");
        }
        // Map Antigravity status to session status
        const statusMap = {
            working: "working",
            active: "working",
            idle: "idle",
            unknown: "idle",
        };
        const session = {
            sessionId: sessionState.sessionId,
            provider: "antigravity",
            cwd: sessionState.projectPath || "~/.gemini/antigravity",
            gitBranch: null,
            gitRepoUrl: null,
            gitRepoId: sessionState.projectName ? `antigravity/${sessionState.projectName}` : null,
            originalPrompt: sessionState.artifacts.length > 0
                ? `Working on ${sessionState.artifacts.length} artifacts`
                : "Antigravity session",
            status: statusMap[sessionState.status] || "idle",
            lastActivityAt: sessionState.lastActivity.toISOString(),
            messageCount: 0,
            hasPendingToolUse: false,
            pendingTool: null,
            goal: sessionState.projectName || "Antigravity Session",
            summary: sessionState.artifacts.length > 0
                ? `Artifacts: ${sessionState.artifacts.slice(0, 3).join(", ")}${sessionState.artifacts.length > 3 ? "..." : ""}`
                : "Active Antigravity conversation",
            recentOutput: [],
            pr: null,
        };
        let event;
        if (operation === "insert") {
            event = sessionsStateSchema.sessions.insert({ value: session });
        }
        else if (operation === "update") {
            event = sessionsStateSchema.sessions.update({ value: session });
        }
        else {
            event = sessionsStateSchema.sessions.delete({
                key: session.sessionId,
                oldValue: session,
            });
        }
        await this.stream.append(event);
    }
}
/**
 * Extract recent output from entries for live view
 * Returns the last few meaningful messages in chronological order
 */
function extractRecentOutput(entries, maxItems = 8) {
    const output = [];
    // Get the last N entries that are messages (user or assistant)
    const messageEntries = entries
        .filter((e) => e.type === "user" || e.type === "assistant")
        .slice(-20); // Look at last 20 messages to find good content
    for (const entry of messageEntries) {
        if (entry.type === "assistant") {
            // Get first text block if any
            const textBlock = entry.message.content.find((b) => b.type === "text" && b.text.trim());
            if (textBlock && textBlock.type === "text") {
                output.push({
                    role: "assistant",
                    content: textBlock.text.slice(0, 500),
                });
            }
            // Get tool uses
            const toolUses = entry.message.content.filter((b) => b.type === "tool_use");
            for (const tool of toolUses.slice(0, 2)) { // Max 2 tools per message
                if (tool.type === "tool_use") {
                    output.push({
                        role: "tool",
                        content: formatToolUse(tool.name, tool.input),
                    });
                }
            }
        }
        else if (entry.type === "user") {
            // User prompts (string content, not tool results)
            if (typeof entry.message.content === "string" && entry.message.content.trim()) {
                output.push({
                    role: "user",
                    content: entry.message.content.slice(0, 300),
                });
            }
        }
    }
    // Return only the last maxItems
    return output.slice(-maxItems);
}
/**
 * Format tool use for display
 */
function formatToolUse(tool, input) {
    switch (tool) {
        case "Read":
            return `📖 Reading ${shortenPath(input.file_path)}`;
        case "Edit":
            return `✏️ Editing ${shortenPath(input.file_path)}`;
        case "Write":
            return `📝 Writing ${shortenPath(input.file_path)}`;
        case "Bash":
            return `▶️ Running: ${input.command?.slice(0, 60)}`;
        case "Grep":
            return `🔍 Searching for "${input.pattern}"`;
        case "Glob":
            return `📁 Finding files: ${input.pattern}`;
        case "Task":
            return `🤖 Spawning agent: ${input.description || "task"}`;
        default:
            return `🔧 ${tool}`;
    }
}
/**
 * Shorten file path for display
 */
function shortenPath(filepath) {
    if (!filepath)
        return "file";
    const parts = filepath.split("/");
    return parts.length > 2 ? `.../${parts.slice(-2).join("/")}` : filepath;
}
/**
 * Extract pending tool info from session state
 */
function extractPendingTool(session) {
    if (!session.status.hasPendingToolUse) {
        return null;
    }
    // Find the last assistant message with tool_use (excluding Task - subagents run automatically)
    const entries = session.entries;
    for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (entry.type === "assistant") {
            for (const block of entry.message.content) {
                if (block.type === "tool_use" && block.name !== "Task") {
                    const tool = block.name;
                    // Extract target based on tool type
                    let target = "";
                    const input = block.input;
                    if (tool === "Edit" || tool === "Read" || tool === "Write") {
                        target = input.file_path ?? "";
                    }
                    else if (tool === "Bash") {
                        target = input.command ?? "";
                    }
                    else if (tool === "Grep" || tool === "Glob") {
                        target = input.pattern ?? "";
                    }
                    else {
                        target = JSON.stringify(input).slice(0, 50);
                    }
                    return { tool, target };
                }
            }
        }
    }
    return null;
}
