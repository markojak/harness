/**
 * OpenCode provider - parses sessions from ~/.local/share/opencode/storage/
 *
 * OpenCode stores data in a more complex structure:
 * - storage/project/*.json - project metadata (worktree paths)
 * - storage/session/{project_hash}/{session_id}.json - session metadata
 * - storage/message/{session_id}/*.json - individual messages
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
const OPENCODE_BASE_DIR = `${process.env.HOME}/.local/share/opencode`;
const OPENCODE_STORAGE_DIR = `${OPENCODE_BASE_DIR}/storage`;
/**
 * Load all projects from storage/project/
 */
async function loadProjects() {
    const projects = new Map();
    const projectDir = join(OPENCODE_STORAGE_DIR, "project");
    try {
        const files = await readdir(projectDir);
        for (const file of files.filter(f => f.endsWith(".json") && f !== "global.json")) {
            try {
                const content = await readFile(join(projectDir, file), "utf-8");
                const project = JSON.parse(content);
                if (project.id) {
                    projects.set(project.id, project);
                }
            }
            catch { }
        }
    }
    catch { }
    return projects;
}
/**
 * List all OpenCode sessions
 */
export async function listOpenCodeSessions(options) {
    const sessions = [];
    const { since, projectFilter } = options || {};
    try {
        // Load projects first for worktree paths
        const projects = await loadProjects();
        const sessionDir = join(OPENCODE_STORAGE_DIR, "session");
        // Session dirs are organized by project hash
        const projectDirs = await readdir(sessionDir).catch(() => []);
        for (const projectHash of projectDirs) {
            const projectPath = join(sessionDir, projectHash);
            const projectStat = await stat(projectPath).catch(() => null);
            if (!projectStat?.isDirectory())
                continue;
            // Get project info
            const project = projects.get(projectHash);
            const projectName = project?.worktree?.split("/").pop() || projectHash.slice(0, 8);
            const cwd = project?.worktree || "";
            // Apply project filter
            if (projectFilter && !projectName.toLowerCase().includes(projectFilter.toLowerCase())) {
                continue;
            }
            // Read session files in this project
            const sessionFiles = await readdir(projectPath).catch(() => []);
            for (const sessionFile of sessionFiles.filter(f => f.endsWith(".json"))) {
                try {
                    const sessionPath = join(projectPath, sessionFile);
                    const fileStat = await stat(sessionPath);
                    // Apply time filter
                    if (since && fileStat.mtime.getTime() < since)
                        continue;
                    const content = await readFile(sessionPath, "utf-8");
                    const sessionData = JSON.parse(content);
                    // Get message count from message directory
                    const messageDir = join(OPENCODE_STORAGE_DIR, "message", sessionData.id);
                    let messageCount = 0;
                    let originalPrompt = "";
                    let lastActivityAt = fileStat.mtime.toISOString();
                    // Track the model used (can vary per session in OpenCode)
                    let modelProvider;
                    let modelId;
                    try {
                        const messages = await readdir(messageDir);
                        messageCount = messages.filter(f => f.endsWith(".json")).length;
                        // Read first message for prompt
                        if (messages.length > 0) {
                            const firstMsg = messages.sort()[0];
                            const msgContent = await readFile(join(messageDir, firstMsg), "utf-8");
                            const msg = JSON.parse(msgContent);
                            if (msg.role === "user" && msg.content) {
                                originalPrompt = msg.content.slice(0, 500);
                            }
                        }
                        // Read last message for activity time and model info
                        if (messages.length > 0) {
                            const sortedMessages = messages.filter(f => f.endsWith(".json")).sort();
                            const lastMsg = sortedMessages.pop();
                            const lastMsgPath = join(messageDir, lastMsg);
                            const lastMsgStat = await stat(lastMsgPath);
                            lastActivityAt = lastMsgStat.mtime.toISOString();
                            // Try to extract model info from recent assistant messages
                            // Check last few messages to find one with model info
                            for (let i = sortedMessages.length - 1; i >= Math.max(0, sortedMessages.length - 5); i--) {
                                try {
                                    const msgContent = await readFile(join(messageDir, sortedMessages[i]), "utf-8");
                                    const msg = JSON.parse(msgContent);
                                    if (msg.model?.providerID && msg.model?.modelID) {
                                        modelProvider = msg.model.providerID;
                                        modelId = msg.model.modelID;
                                        break;
                                    }
                                }
                                catch { }
                            }
                            // Also check the last message
                            if (!modelId) {
                                try {
                                    const msgContent = await readFile(lastMsgPath, "utf-8");
                                    const msg = JSON.parse(msgContent);
                                    if (msg.model?.providerID && msg.model?.modelID) {
                                        modelProvider = msg.model.providerID;
                                        modelId = msg.model.modelID;
                                    }
                                }
                                catch { }
                            }
                        }
                    }
                    catch { }
                    // Check if active
                    const lastActivity = new Date(lastActivityAt).getTime();
                    const isActive = Date.now() - lastActivity < 5 * 60 * 1000;
                    const session = {
                        provider: "opencode",
                        sessionId: sessionData.id,
                        projectName,
                        cwd,
                        originalPrompt: sessionData.title || originalPrompt,
                        gitBranch: undefined,
                        model: modelId || "unknown",
                        modelProvider: modelProvider,
                        modelId: modelId,
                        status: {
                            state: isActive ? "working" : "idle",
                            lastActivityAt,
                            isActive,
                        },
                        lastActivityAt,
                        messageCount,
                        filepath: sessionPath,
                    };
                    sessions.push(session);
                }
                catch { }
            }
        }
    }
    catch { }
    return sessions;
}
/**
 * Parse session events (transcript)
 */
export async function parseOpenCodeEvents(sessionId) {
    const events = [];
    const messageDir = join(OPENCODE_STORAGE_DIR, "message", sessionId);
    try {
        const files = await readdir(messageDir);
        const messageFiles = files.filter(f => f.endsWith(".json")).sort();
        for (const file of messageFiles) {
            try {
                const content = await readFile(join(messageDir, file), "utf-8");
                const msg = JSON.parse(content);
                const timestamp = msg.time?.created
                    ? new Date(msg.time.created).toISOString()
                    : "";
                if (msg.role === "user") {
                    events.push({
                        type: "user",
                        timestamp,
                        content: msg.content || "",
                    });
                }
                else if (msg.role === "assistant") {
                    events.push({
                        type: "assistant",
                        timestamp,
                        content: msg.content || "",
                    });
                }
                // Handle tool/edit events
                if (msg.type === "edit" || msg.agent) {
                    events.push({
                        type: "tool",
                        timestamp,
                        toolName: msg.agent || msg.type || "tool",
                        content: msg.content?.slice(0, 500) || "",
                    });
                }
            }
            catch { }
        }
    }
    catch { }
    return events;
}
/**
 * Get watch paths for OpenCode
 */
export function getOpenCodeWatchPaths() {
    return [OPENCODE_STORAGE_DIR];
}
/**
 * Check if OpenCode is installed
 */
export async function isOpenCodeInstalled() {
    try {
        await stat(OPENCODE_STORAGE_DIR);
        return true;
    }
    catch {
        return false;
    }
}
