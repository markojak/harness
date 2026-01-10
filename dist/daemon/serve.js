#!/usr/bin/env node
/**
 * Starts the session watcher and durable streams server.
 * Sessions are published to the stream for the UI to consume.
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
// Load .env from project root (handles both src and dist execution)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPaths = [
    path.resolve(__dirname, "../../../.env"), // from src/
    path.resolve(__dirname, "../../.env"), // from dist/
    path.resolve(process.cwd(), ".env"), // from cwd
];
for (const envPath of envPaths) {
    if (existsSync(envPath)) {
        dotenv.config({ path: envPath });
        break;
    }
}
import { SessionWatcher } from "./watcher.js";
import { StreamServer } from "./server.js";
import { formatStatus } from "./status.js";
import { startStatsServer, updateTodayCost } from "./system-stats.js";
import { aggregateUsage } from "./cost-tracker.js";
import { indexAllSessions } from "./indexer.js";
import { bulkIndexSessions, getSearchStats } from "./search.js";
import { getDeps } from "./deps.js";
import { setError } from "./errors.js";
import { runAsJob } from "./jobs.js";
const PORT = parseInt(process.env.PORT ?? "4450", 10);
const MAX_AGE_HOURS = parseInt(process.env.MAX_AGE_HOURS ?? "24", 10);
const MAX_AGE_MS = MAX_AGE_HOURS * 60 * 60 * 1000;
// ANSI colors
const colors = {
    reset: "\x1b[0m",
    dim: "\x1b[2m",
    bold: "\x1b[1m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    gray: "\x1b[90m",
};
/**
 * Check if a session is from today (for cost tracking)
 */
function isFromToday(session) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sessionStart = new Date(session.startedAt).getTime();
    return sessionStart >= today.getTime();
}
/**
 * Calculate today's cost from all sessions
 */
function calculateTodayCost(watcher) {
    const sessions = watcher.getSessions();
    const todaySessions = Array.from(sessions.values()).filter(isFromToday);
    // Aggregate all entries from today's sessions
    const allEntries = todaySessions.flatMap(s => s.entries);
    const summary = aggregateUsage(allEntries);
    updateTodayCost(summary);
}
/**
 * Check if a session is recent enough to include
 */
function isRecentSession(session) {
    const lastActivity = new Date(session.status.lastActivityAt).getTime();
    return Date.now() - lastActivity < MAX_AGE_MS;
}
async function main() {
    console.log(`${colors.bold}Claude Code Session Daemon${colors.reset}`);
    console.log(`${colors.dim}Showing sessions from last ${MAX_AGE_HOURS} hours${colors.reset}`);
    console.log();
    // Start the durable streams server
    const streamServer = new StreamServer({ port: PORT });
    await streamServer.start();
    // Start the system stats server
    startStatsServer(PORT + 1);
    console.log(`Stats URL: ${colors.cyan}http://127.0.0.1:${PORT + 1}/system-stats${colors.reset}`);
    console.log(`Stream URL: ${colors.cyan}${streamServer.getStreamUrl()}${colors.reset}`);
    console.log();
    // Start the session watcher
    const watcher = new SessionWatcher({ debounceMs: 300 });
    watcher.on("session", async (event) => {
        const { type, session } = event;
        // Only publish recent sessions
        if (!isRecentSession(session) && type !== "deleted") {
            return;
        }
        const timestamp = new Date().toLocaleTimeString();
        // Log to console - show directory name for easier identification
        const statusStr = formatStatus(session.status);
        const dirName = session.cwd.split("/").pop() || session.cwd;
        console.log(`${colors.gray}${timestamp}${colors.reset} ` +
            `${type === "created" ? colors.green : type === "deleted" ? colors.blue : colors.yellow}[${type.toUpperCase().slice(0, 3)}]${colors.reset} ` +
            `${colors.cyan}${session.sessionId.slice(0, 8)}${colors.reset} ` +
            `${colors.dim}${dirName}${colors.reset} ` +
            `${statusStr}`);
        // Publish to stream
        try {
            const operation = type === "created" ? "insert" : type === "deleted" ? "delete" : "update";
            await streamServer.publishSession(session, operation);
        }
        catch (error) {
            console.error(`${colors.yellow}[ERROR]${colors.reset} Failed to publish:`, error);
        }
    });
    watcher.on("error", (error) => {
        console.error(`${colors.yellow}[ERROR]${colors.reset}`, error.message);
    });
    // Handle shutdown
    process.on("SIGINT", async () => {
        console.log();
        console.log(`${colors.dim}Shutting down...${colors.reset}`);
        watcher.stop();
        await streamServer.stop();
        process.exit(0);
    });
    // Start watching
    await watcher.start();
    // Publish initial sessions (filtered to recent only)
    const allSessions = watcher.getSessions();
    const recentSessions = Array.from(allSessions.values()).filter(isRecentSession);
    console.log(`${colors.dim}Found ${recentSessions.length} recent sessions (of ${allSessions.size} total), publishing...${colors.reset}`);
    for (const session of recentSessions) {
        try {
            await streamServer.publishSession(session, "insert");
        }
        catch (error) {
            console.error(`${colors.yellow}[ERROR]${colors.reset} Failed to publish initial session:`, error);
        }
    }
    // Calculate initial today's cost
    calculateTodayCost(watcher);
    // Update cost periodically (every 30 seconds)
    setInterval(() => calculateTodayCost(watcher), 30_000);
    // Pre-warm deps cache FIRST (before any searches can happen)
    const deps = await getDeps();
    console.log(`${colors.dim}Dependencies: ripgrep=${deps.ripgrep.ok ? '✓' : '✗'} git=${deps.git.ok ? '✓' : '✗'}${colors.reset}`);
    // Set errors for missing deps
    if (!deps.ripgrep.ok) {
        setError("ripgrep", {
            type: "warning",
            message: "ripgrep missing",
            action: deps.ripgrep.install,
            actionLabel: "Install",
        });
    }
    if (!deps.git.ok) {
        setError("git", {
            type: "error",
            message: "git not found",
            action: deps.git.install,
            actionLabel: "Install",
        });
    }
    // Index all sessions for search (async, don't block startup)
    console.log(`${colors.dim}Indexing sessions for search...${colors.reset}`);
    runAsJob("Indexing sessions", async (updateProgress) => {
        const { sessions } = await indexAllSessions();
        const total = sessions.length;
        let indexed = 0;
        // Bulk index in batches for progress updates
        const batchSize = 50;
        for (let i = 0; i < sessions.length; i += batchSize) {
            const batch = sessions.slice(i, i + batchSize);
            bulkIndexSessions(batch);
            indexed += batch.length;
            updateProgress(indexed, total);
        }
        const stats = getSearchStats();
        console.log(`${colors.green}✓${colors.reset} Search index: ${stats.indexed} sessions indexed`);
        return stats;
    }).catch(err => {
        console.error(`${colors.yellow}[WARN]${colors.reset} Search indexing failed:`, err);
    });
    console.log();
    console.log(`${colors.green}✓${colors.reset} Ready - watching for changes`);
    console.log(`${colors.dim}Press Ctrl+C to exit${colors.reset}`);
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
