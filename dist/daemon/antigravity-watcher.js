/**
 * Antigravity (Google Gemini/DeepMind) session watcher
 *
 * Watches for changes in Antigravity session files and emits events
 * when sessions are created, updated, or deleted.
 */
import { watch } from "chokidar";
import { EventEmitter } from "node:events";
import { basename } from "node:path";
import { existsSync } from "node:fs";
import { ANNOTATIONS_DIR, BRAIN_DIR, CONVERSATIONS_DIR, parseAnnotation, getSessionArtifacts, getSessionCreatedAt, getActiveProjects, isAntigravityAvailable, } from "./antigravity-parser.js";
import { log } from "./log.js";
export class AntigravityWatcher extends EventEmitter {
    annotationWatcher = null;
    brainWatcher = null;
    conversationWatcher = null;
    sessions = new Map();
    debounceTimers = new Map();
    debounceMs;
    constructor(options = {}) {
        super();
        this.debounceMs = options.debounceMs ?? 500;
    }
    async start() {
        if (!isAntigravityAvailable()) {
            log("AntigravityWatcher", "Antigravity not installed, skipping");
            return;
        }
        log("AntigravityWatcher", "Starting Antigravity session watcher");
        // Watch annotations directory for activity updates
        if (existsSync(ANNOTATIONS_DIR)) {
            this.annotationWatcher = watch(ANNOTATIONS_DIR, {
                persistent: true,
                ignoreInitial: false,
                depth: 0,
            });
            this.annotationWatcher
                .on("add", (path) => {
                if (path.endsWith(".pbtxt")) {
                    this.handleAnnotationChange(path);
                }
            })
                .on("change", (path) => {
                if (path.endsWith(".pbtxt")) {
                    this.debouncedHandleAnnotation(path);
                }
            })
                .on("error", (error) => {
                log("AntigravityWatcher", `Annotation watcher error: ${error instanceof Error ? error.message : String(error)}`);
            });
        }
        // Watch brain directory for artifact changes
        if (existsSync(BRAIN_DIR)) {
            this.brainWatcher = watch(BRAIN_DIR, {
                persistent: true,
                ignoreInitial: false,
                depth: 2,
            });
            this.brainWatcher
                .on("add", (path) => {
                const sessionId = this.extractSessionIdFromPath(path, BRAIN_DIR);
                if (sessionId) {
                    this.debouncedUpdateSession(sessionId);
                }
            })
                .on("change", (path) => {
                const sessionId = this.extractSessionIdFromPath(path, BRAIN_DIR);
                if (sessionId) {
                    this.debouncedUpdateSession(sessionId);
                }
            })
                .on("error", (error) => {
                log("AntigravityWatcher", `Brain watcher error: ${error instanceof Error ? error.message : String(error)}`);
            });
        }
        // Watch conversations directory for new sessions
        if (existsSync(CONVERSATIONS_DIR)) {
            this.conversationWatcher = watch(CONVERSATIONS_DIR, {
                persistent: true,
                ignoreInitial: false,
                depth: 0,
            });
            this.conversationWatcher
                .on("add", (path) => {
                if (path.endsWith(".pb")) {
                    const sessionId = basename(path, ".pb");
                    this.handleNewSession(sessionId);
                }
            })
                .on("change", (path) => {
                if (path.endsWith(".pb")) {
                    const sessionId = basename(path, ".pb");
                    this.debouncedUpdateSession(sessionId);
                }
            })
                .on("unlink", (path) => {
                if (path.endsWith(".pb")) {
                    const sessionId = basename(path, ".pb");
                    this.handleSessionDeleted(sessionId);
                }
            })
                .on("error", (error) => {
                log("AntigravityWatcher", `Conversation watcher error: ${error instanceof Error ? error.message : String(error)}`);
            });
        }
        // Wait for initial scan
        await Promise.all([
            this.annotationWatcher ? new Promise(resolve => this.annotationWatcher.on("ready", resolve)) : Promise.resolve(),
            this.brainWatcher ? new Promise(resolve => this.brainWatcher.on("ready", resolve)) : Promise.resolve(),
            this.conversationWatcher ? new Promise(resolve => this.conversationWatcher.on("ready", resolve)) : Promise.resolve(),
        ]);
        log("AntigravityWatcher", `Watching ${this.sessions.size} Antigravity sessions`);
    }
    async stop() {
        // Clear all debounce timers
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
        // Close watchers
        await Promise.all([
            this.annotationWatcher?.close(),
            this.brainWatcher?.close(),
            this.conversationWatcher?.close(),
        ]);
        this.annotationWatcher = null;
        this.brainWatcher = null;
        this.conversationWatcher = null;
    }
    /**
     * Get all current sessions.
     */
    getSessions() {
        return Array.from(this.sessions.values());
    }
    /**
     * Get a specific session by ID.
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    extractSessionIdFromPath(path, baseDir) {
        // Extract session ID from path like /brain/<session-id>/file.md
        const relativePath = path.replace(baseDir + "/", "");
        const parts = relativePath.split("/");
        if (parts.length >= 1 && /^[a-f0-9-]{36}$/.test(parts[0])) {
            return parts[0];
        }
        return null;
    }
    debouncedHandleAnnotation(path) {
        const sessionId = basename(path, ".pbtxt");
        this.debouncedUpdateSession(sessionId);
    }
    debouncedUpdateSession(sessionId) {
        // Clear existing timer
        const existing = this.debounceTimers.get(sessionId);
        if (existing) {
            clearTimeout(existing);
        }
        // Set new debounce timer
        const timer = setTimeout(() => {
            this.debounceTimers.delete(sessionId);
            this.updateSession(sessionId);
        }, this.debounceMs);
        this.debounceTimers.set(sessionId, timer);
    }
    async handleAnnotationChange(path) {
        const sessionId = basename(path, ".pbtxt");
        await this.updateSession(sessionId);
    }
    async handleNewSession(sessionId) {
        await this.updateSession(sessionId, true);
    }
    handleSessionDeleted(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            this.sessions.delete(sessionId);
            this.emit("session", {
                type: "deleted",
                session,
            });
        }
    }
    async updateSession(sessionId, isNew = false) {
        try {
            // Get annotation data
            const annotationPath = `${ANNOTATIONS_DIR}/${sessionId}.pbtxt`;
            const annotation = existsSync(annotationPath)
                ? await parseAnnotation(annotationPath)
                : null;
            // Get artifacts
            const artifacts = await getSessionArtifacts(sessionId);
            // Get creation time
            const createdAt = await getSessionCreatedAt(sessionId);
            // Determine last activity
            let lastActivity = annotation?.lastUserViewTime || createdAt;
            // Check conversation file modification time
            const { stat } = await import("node:fs/promises");
            const convPath = `${CONVERSATIONS_DIR}/${sessionId}.pb`;
            if (existsSync(convPath)) {
                try {
                    const stats = await stat(convPath);
                    if (stats.mtime > lastActivity) {
                        lastActivity = stats.mtime;
                    }
                }
                catch {
                    // Ignore
                }
            }
            // Determine status based on activity
            const now = new Date();
            const minutesSinceActivity = (now.getTime() - lastActivity.getTime()) / 60000;
            let status = "unknown";
            if (minutesSinceActivity < 2) {
                status = "working";
            }
            else if (minutesSinceActivity < 10) {
                status = "active";
            }
            else if (minutesSinceActivity < 60) {
                status = "idle";
            }
            // Try to find project name from code_tracker
            const projects = await getActiveProjects();
            let projectName = null;
            let projectPath = null;
            // Find most recently modified project that matches this session's timing (closest match)
            let minTimeDiff = 96 * 60 * 60 * 1000;
            for (const [, project] of projects) {
                const timeDiff = Math.abs(project.lastModified.getTime() - lastActivity.getTime());
                if (timeDiff < minTimeDiff) { // Within 24 hours
                    minTimeDiff = timeDiff;
                    projectName = project.name;
                    projectPath = project.path;
                }
            }
            const session = {
                sessionId,
                filepath: convPath,
                projectName,
                projectPath,
                status,
                lastActivity,
                createdAt,
                artifacts,
                provider: "antigravity",
            };
            const existingSession = this.sessions.get(sessionId);
            this.sessions.set(sessionId, session);
            // Emit event
            const eventType = isNew || !existingSession ? "created" : "updated";
            this.emit("session", {
                type: eventType,
                session,
            });
        }
        catch (error) {
            log("AntigravityWatcher", `Error updating session ${sessionId}: ${error}`);
        }
    }
}
