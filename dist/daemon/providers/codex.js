/**
 * Codex (OpenAI) provider - parses sessions from ~/.codex/sessions/
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
const CODEX_SESSIONS_DIR = `${process.env.HOME}/.codex/sessions`;
/**
 * Recursively find all JSONL files in the sessions directory
 */
async function findCodexSessionFiles(dir) {
    const files = [];
    try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                // Recurse into subdirectories (YYYY/MM/DD structure)
                const subFiles = await findCodexSessionFiles(fullPath);
                files.push(...subFiles);
            }
            else if (entry.name.endsWith(".jsonl") || entry.name.endsWith(".json")) {
                files.push(fullPath);
            }
        }
    }
    catch {
        // Directory doesn't exist or can't be read
    }
    return files;
}
/**
 * Extract project name from cwd
 */
function getProjectName(cwd) {
    if (!cwd)
        return "unknown";
    return cwd.split("/").pop() || cwd;
}
/**
 * Extract session ID from filename
 * Format: rollout-{datetime}-{session-id}.jsonl
 */
function extractSessionId(filename) {
    // Pattern: rollout-2026-01-04T20-26-10-019b8bf9-ebd5-7132-9674-28c09ef06cba.jsonl
    const match = filename.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    return match?.[1] || filename.replace(/\.(jsonl|json)$/, "");
}
/**
 * List all Codex sessions
 */
export async function listCodexSessions(options) {
    const sessions = [];
    const { since, projectFilter } = options || {};
    try {
        const sessionFiles = await findCodexSessionFiles(CODEX_SESSIONS_DIR);
        for (const filepath of sessionFiles) {
            const fileStat = await stat(filepath).catch(() => null);
            if (!fileStat)
                continue;
            // Apply time filter
            if (since && fileStat.mtime.getTime() < since)
                continue;
            const session = await parseCodexSession(filepath);
            if (!session)
                continue;
            // Apply project filter
            if (projectFilter && !session.projectName.toLowerCase().includes(projectFilter.toLowerCase())) {
                continue;
            }
            sessions.push(session);
        }
    }
    catch {
        // Sessions dir doesn't exist
    }
    return sessions;
}
/**
 * Parse a single Codex session file
 */
export async function parseCodexSession(filepath) {
    try {
        const content = await readFile(filepath, "utf-8");
        const lines = content.trim().split("\n").filter(Boolean);
        if (lines.length === 0)
            return null;
        const fileStat = await stat(filepath);
        const filename = filepath.split("/").pop() || "";
        const sessionId = extractSessionId(filename);
        // Extract metadata from lines
        let originalPrompt = "";
        let cwd = "";
        let gitBranch = "";
        let gitCommit = "";
        let model = "codex";
        let lastTimestamp = fileStat.mtime.toISOString();
        let messageCount = 0;
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                // Session metadata
                if (parsed.type === "session_meta" && parsed.payload) {
                    const meta = parsed.payload;
                    cwd = meta.cwd || cwd;
                    if (meta.git) {
                        gitBranch = meta.git.branch || "";
                        gitCommit = meta.git.commit_hash || "";
                    }
                    if (meta.model_provider) {
                        model = meta.model_provider;
                    }
                    if (meta.timestamp) {
                        lastTimestamp = meta.timestamp;
                    }
                }
                // Response items (messages)
                if (parsed.type === "response_item" && parsed.payload) {
                    messageCount++;
                    const payload = parsed.payload;
                    // Extract first user message as prompt
                    if (payload.role === "user" && !originalPrompt) {
                        const textContent = payload.content?.find((c) => c.type === "input_text" || c.type === "text");
                        originalPrompt = textContent?.text || "";
                    }
                }
                // Direct message format (older sessions)
                if (parsed.type === "message") {
                    messageCount++;
                    if (parsed.role === "user" && !originalPrompt) {
                        const textContent = parsed.content?.find((c) => c.type === "input_text" || c.type === "text");
                        originalPrompt = textContent?.text || "";
                    }
                }
                // Track timestamps
                if (parsed.timestamp) {
                    lastTimestamp = parsed.timestamp;
                }
            }
            catch {
                // Skip malformed lines
            }
        }
        // Determine if active
        const lastActivity = new Date(lastTimestamp).getTime();
        const isActive = Date.now() - lastActivity < 5 * 60 * 1000;
        return {
            provider: "codex",
            sessionId,
            projectName: getProjectName(cwd),
            cwd,
            originalPrompt: originalPrompt.slice(0, 500),
            gitBranch,
            gitCommit,
            model,
            status: {
                state: isActive ? "working" : "idle",
                lastActivityAt: lastTimestamp,
                isActive,
            },
            lastActivityAt: lastTimestamp,
            messageCount,
            filepath,
        };
    }
    catch {
        return null;
    }
}
/**
 * Parse session events (transcript)
 */
export async function parseCodexEvents(filepath) {
    const events = [];
    try {
        const content = await readFile(filepath, "utf-8");
        const lines = content.trim().split("\n").filter(Boolean);
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                // Skip session_meta
                if (parsed.type === "session_meta")
                    continue;
                // Response items
                if (parsed.type === "response_item" && parsed.payload) {
                    const payload = parsed.payload;
                    if (payload.role === "user") {
                        const textContent = payload.content?.find((c) => c.type === "input_text" || c.type === "text");
                        events.push({
                            type: "user",
                            timestamp: parsed.timestamp || "",
                            content: textContent?.text || "",
                        });
                    }
                    else if (payload.role === "assistant") {
                        const textContent = payload.content?.find((c) => c.type === "text" || c.type === "output_text");
                        events.push({
                            type: "assistant",
                            timestamp: parsed.timestamp || "",
                            content: textContent?.text || "",
                        });
                    }
                }
                // Direct message format
                if (parsed.type === "message") {
                    if (parsed.role === "user") {
                        const textContent = parsed.content?.find((c) => c.type === "input_text" || c.type === "text");
                        events.push({
                            type: "user",
                            timestamp: parsed.timestamp || "",
                            content: textContent?.text || "",
                        });
                    }
                    else if (parsed.role === "assistant") {
                        const textContent = parsed.content?.find((c) => c.type === "text");
                        events.push({
                            type: "assistant",
                            timestamp: parsed.timestamp || "",
                            content: textContent?.text || "",
                        });
                    }
                }
                // Tool use
                if (parsed.type === "function_call" || parsed.type === "tool_use") {
                    events.push({
                        type: "tool",
                        timestamp: parsed.timestamp || "",
                        toolName: parsed.name || "function",
                        content: JSON.stringify(parsed.arguments || parsed.input || {}).slice(0, 500),
                    });
                }
            }
            catch {
                // Skip malformed lines
            }
        }
    }
    catch {
        // File read error
    }
    return events;
}
/**
 * Watch paths for Codex sessions
 */
export function getCodexWatchPaths() {
    return [CODEX_SESSIONS_DIR];
}
/**
 * Check if Codex is installed
 */
export async function isCodexInstalled() {
    try {
        await stat(CODEX_SESSIONS_DIR);
        return true;
    }
    catch {
        return false;
    }
}
