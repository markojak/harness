/**
 * Provider index - unified interface for all AI coding agents
 */
export * from "./types.js";
export * from "./claude.js";
export * from "./codex.js";
export * from "./opencode.js";
import { listClaudeSessions, parseClaudeEvents, getClaudeWatchPaths } from "./claude.js";
import { listCodexSessions, parseCodexEvents, getCodexWatchPaths, isCodexInstalled } from "./codex.js";
import { listOpenCodeSessions, isOpenCodeInstalled } from "./opencode.js";
/**
 * List all sessions from all providers
 */
export async function listAllSessions(options) {
    const { since, projectFilter, providers = ["claude", "codex", "opencode"] } = options || {};
    const allSessions = [];
    // Fetch sessions from each provider in parallel
    const fetchers = [];
    if (providers.includes("claude")) {
        fetchers.push(listClaudeSessions({ since, projectFilter }));
    }
    if (providers.includes("codex")) {
        fetchers.push(listCodexSessions({ since, projectFilter }));
    }
    if (providers.includes("opencode")) {
        fetchers.push(listOpenCodeSessions({ since, projectFilter }));
    }
    const results = await Promise.all(fetchers);
    for (const sessions of results) {
        allSessions.push(...sessions);
    }
    // Sort by last activity (most recent first)
    allSessions.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
    return allSessions;
}
/**
 * Get session by ID (searches all providers)
 */
export async function getSession(sessionId) {
    // Try Claude first
    const claudeSessions = await listClaudeSessions();
    const claudeMatch = claudeSessions.find(s => s.sessionId === sessionId || s.sessionId.startsWith(sessionId));
    if (claudeMatch)
        return claudeMatch;
    // Try Codex
    const codexSessions = await listCodexSessions();
    const codexMatch = codexSessions.find(s => s.sessionId === sessionId || s.sessionId.startsWith(sessionId));
    if (codexMatch)
        return codexMatch;
    return null;
}
/**
 * Get session events (transcript)
 */
export async function getSessionEvents(session) {
    if (session.provider === "claude") {
        return parseClaudeEvents(session.filepath);
    }
    else if (session.provider === "codex") {
        return parseCodexEvents(session.filepath);
    }
    return [];
}
/**
 * Get all watch paths for file watching
 */
export function getAllWatchPaths() {
    return [...getClaudeWatchPaths(), ...getCodexWatchPaths()];
}
/**
 * Get provider statistics
 */
export async function getProviderStats() {
    const [claudeSessions, codexInstalled, codexSessions, opencodeInstalled, opencodeSessions] = await Promise.all([
        listClaudeSessions(),
        isCodexInstalled(),
        listCodexSessions(),
        isOpenCodeInstalled(),
        listOpenCodeSessions(),
    ]);
    return {
        claude: {
            installed: true, // Assumed if harness is running
            sessionCount: claudeSessions.length,
        },
        codex: {
            installed: codexInstalled,
            sessionCount: codexSessions.length,
        },
        opencode: {
            installed: opencodeInstalled,
            sessionCount: opencodeSessions.length,
        },
    };
}
