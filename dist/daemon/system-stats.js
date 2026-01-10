import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
const __dirname = dirname(fileURLToPath(import.meta.url));
// MIME types for static file serving
const MIME_TYPES = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".otf": "font/otf",
    ".ttf": "font/ttf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
};
// Try to find UI dist folder
function findUiDist() {
    const possiblePaths = [
        join(__dirname, "../ui"), // From dist/daemon/ to dist/ui/ (npm package)
        join(__dirname, "../../ui"), // Alternative layout
        join(__dirname, "../../../dist/ui"), // From packages/daemon/dist to root dist/ui
        join(__dirname, "../../../packages/ui/dist"), // Development
    ];
    for (const p of possiblePaths) {
        const indexPath = join(p, "index.html");
        if (existsSync(indexPath)) {
            console.log(`[UI] Serving from: ${p}`);
            return p;
        }
    }
    console.log(`[UI] Not found in: ${possiblePaths.join(", ")}`);
    return null;
}
const UI_DIST = findUiDist();
import { formatCost, formatTokens } from "./cost-tracker.js";
import { indexAllSessions } from "./indexer.js";
import * as bookmarks from "./bookmarks.js";
import * as search from "./search.js";
import { extractSessionDetail } from "./session-detail.js";
import { getDeps } from "./deps.js";
import { getActiveJobs, getRunningJobs } from "./jobs.js";
import { getErrors } from "./errors.js";
import { findCommit, findRepoForCommit } from "./commit-finder.js";
// Config management
const DATA_DIR = join(process.env.HOME || "", ".harness");
const CONFIG_PATH = join(DATA_DIR, "config.json");
const HOME = process.env.HOME || "";
const DEFAULT_CONFIG = {
    providers: {
        claude: {
            enabled: true,
            path: join(HOME, ".claude/projects"),
        },
        codex: {
            enabled: true,
            path: join(HOME, ".codex/sessions"),
        },
        opencode: {
            enabled: true,
            path: join(HOME, ".local/share/opencode/storage"),
        },
    },
    port: 4450,
    host: "127.0.0.1",
    resumeFlags: "",
};
export function getConfig() {
    try {
        if (existsSync(CONFIG_PATH)) {
            const content = readFileSync(CONFIG_PATH, "utf-8");
            const parsed = JSON.parse(content);
            // Deep merge with defaults
            return {
                ...DEFAULT_CONFIG,
                ...parsed,
                providers: {
                    claude: { ...DEFAULT_CONFIG.providers.claude, ...parsed.providers?.claude },
                    codex: { ...DEFAULT_CONFIG.providers.codex, ...parsed.providers?.codex },
                    opencode: { ...DEFAULT_CONFIG.providers.opencode, ...parsed.providers?.opencode },
                },
            };
        }
    }
    catch {
        // Return default
    }
    return DEFAULT_CONFIG;
}
export function saveConfig(config) {
    mkdirSync(DATA_DIR, { recursive: true });
    const current = getConfig();
    const merged = {
        ...current,
        ...config,
        providers: config.providers ? {
            ...current.providers,
            ...config.providers,
        } : current.providers,
    };
    writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
}
export function getProviderPath(provider) {
    const config = getConfig();
    return config.providers[provider].path;
}
export function isProviderEnabled(provider) {
    const config = getConfig();
    return config.providers[provider].enabled;
}
// Shared state for cost tracking (set by watcher)
let todayCostSummary = {
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    estimatedCost: 0,
};
export function updateTodayCost(summary) {
    todayCostSummary = summary;
}
export function getTodayCost() {
    return {
        cost: formatCost(todayCostSummary.estimatedCost),
        tokens: formatTokens(todayCostSummary.totalTokens),
        raw: todayCostSummary,
    };
}
let lastCpuInfo = os.cpus();
let lastCpuTime = Date.now();
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0)
        return `${days}d ${hours}h`;
    if (hours > 0)
        return `${hours}h ${mins}m`;
    return `${mins}m`;
}
function getCpuUsage() {
    const cpus = os.cpus();
    const now = Date.now();
    const elapsed = now - lastCpuTime;
    if (elapsed < 100) {
        // Too soon, return cached estimate
        return 0;
    }
    let totalIdle = 0;
    let totalTick = 0;
    for (let i = 0; i < cpus.length; i++) {
        const cpu = cpus[i];
        const lastCpu = lastCpuInfo[i];
        const idle = cpu.times.idle - lastCpu.times.idle;
        const total = cpu.times.user -
            lastCpu.times.user +
            (cpu.times.nice - lastCpu.times.nice) +
            (cpu.times.sys - lastCpu.times.sys) +
            idle +
            (cpu.times.irq - lastCpu.times.irq);
        totalIdle += idle;
        totalTick += total;
    }
    lastCpuInfo = cpus;
    lastCpuTime = now;
    if (totalTick === 0)
        return 0;
    return Math.round(((totalTick - totalIdle) / totalTick) * 100);
}
function getSystemStats() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = Math.round((usedMem / totalMem) * 100);
    return {
        cpuUsage: getCpuUsage(),
        memUsage,
        uptime: formatUptime(os.uptime()),
    };
}
export function startStatsServer(port = 4451) {
    const server = createServer(async (req, res) => {
        // CORS headers
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        if (req.method === "OPTIONS") {
            res.writeHead(204);
            res.end();
            return;
        }
        if (req.url === "/system-stats" && req.method === "GET") {
            const stats = getSystemStats();
            const costData = getTodayCost();
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                ...stats,
                todayCost: costData.cost,
                todayTokens: costData.tokens,
                costDetails: costData.raw,
            }));
            return;
        }
        // Status API - deps, jobs, errors for StatusIndicator
        if (req.url === "/status" && req.method === "GET") {
            const deps = await getDeps();
            const jobs = getActiveJobs();
            const errors = getErrors();
            const runningJobs = getRunningJobs();
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                deps,
                jobs,
                errors,
                ready: jobs.length === 0 && errors.length === 0,
                hasRunningJobs: runningJobs.length > 0,
                hasErrors: errors.length > 0,
            }));
            return;
        }
        // Commit finder API
        if (req.url?.startsWith("/commit/") && req.method === "GET") {
            const hash = req.url.split("/")[2]?.split("?")[0];
            if (!hash) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Missing commit hash" }));
                return;
            }
            try {
                const result = await findCommit(hash);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(result));
            }
            catch (error) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: String(error) }));
            }
            return;
        }
        // Quick commit repo lookup (for live search)
        if (req.url?.startsWith("/commit-repo/") && req.method === "GET") {
            const hash = req.url.split("/")[2]?.split("?")[0];
            if (!hash || hash.length < 4) {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ repo: null }));
                return;
            }
            try {
                const repoPath = await findRepoForCommit(hash);
                const repoName = repoPath?.split("/").pop() || null;
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ repo: repoName, repoPath }));
            }
            catch (error) {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ repo: null, error: String(error) }));
            }
            return;
        }
        if (req.url === "/index" && req.method === "GET") {
            try {
                const { sessions, projects } = await indexAllSessions();
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ sessions, projects }));
            }
            catch (error) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: String(error) }));
            }
            return;
        }
        // Bookmarks API
        if (req.url === "/bookmarks" && req.method === "GET") {
            const list = bookmarks.listBookmarks();
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(list));
            return;
        }
        if (req.url === "/bookmarks" && req.method === "POST") {
            let body = "";
            req.on("data", chunk => body += chunk);
            req.on("end", () => {
                try {
                    const data = JSON.parse(body);
                    const bookmark = bookmarks.addBookmark(data);
                    res.writeHead(201, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(bookmark));
                }
                catch (error) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: String(error) }));
                }
            });
            return;
        }
        if (req.url?.startsWith("/bookmarks/") && req.method === "DELETE") {
            const id = req.url.split("/")[2];
            const removed = bookmarks.removeBookmark(id);
            res.writeHead(removed ? 200 : 404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ removed }));
            return;
        }
        if (req.url?.startsWith("/bookmarks/session/") && req.method === "GET") {
            const sessionId = req.url.split("/")[3];
            const bookmark = bookmarks.getBookmarkBySession(sessionId);
            res.writeHead(bookmark ? 200 : 404, { "Content-Type": "application/json" });
            res.end(JSON.stringify(bookmark));
            return;
        }
        if (req.url?.startsWith("/bookmarks/session/") && req.method === "DELETE") {
            const sessionId = req.url.split("/")[3];
            const removed = bookmarks.removeBookmarkBySession(sessionId);
            res.writeHead(removed ? 200 : 404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ removed }));
            return;
        }
        if (req.url?.startsWith("/bookmarks/") && req.method === "PATCH") {
            const id = req.url.split("/")[2];
            let body = "";
            req.on("data", chunk => body += chunk);
            req.on("end", () => {
                try {
                    const data = JSON.parse(body);
                    const bookmark = bookmarks.updateBookmark(id, data);
                    if (bookmark) {
                        res.writeHead(200, { "Content-Type": "application/json" });
                        res.end(JSON.stringify(bookmark));
                    }
                    else {
                        res.writeHead(404, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ error: "Not found" }));
                    }
                }
                catch (error) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: String(error) }));
                }
            });
            return;
        }
        // Search API
        if (req.url?.startsWith("/search") && req.method === "GET") {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const query = url.searchParams.get("q") || "";
            const limit = parseInt(url.searchParams.get("limit") || "50", 10);
            const results = search.searchSessions(query, limit);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(results));
            return;
        }
        if (req.url === "/search/stats" && req.method === "GET") {
            const stats = search.getSearchStats();
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(stats));
            return;
        }
        if (req.url === "/search/reindex" && req.method === "POST") {
            try {
                const { sessions } = await indexAllSessions();
                const indexed = search.bulkIndexSessions(sessions);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ indexed, total: sessions.length }));
            }
            catch (error) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: String(error) }));
            }
            return;
        }
        // Session detail
        if (req.url?.startsWith("/session/") && req.method === "GET") {
            const sessionId = req.url.split("/")[2];
            try {
                // Find the session filepath from index
                const { sessions } = await indexAllSessions();
                const session = sessions.find(s => s.sessionId === sessionId);
                if (!session) {
                    res.writeHead(404, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "Session not found" }));
                    return;
                }
                const detail = await extractSessionDetail(session.filepath);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(detail));
            }
            catch (error) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: String(error) }));
            }
            return;
        }
        // Config API
        if (req.url === "/config" && req.method === "GET") {
            const config = getConfig();
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(config));
            return;
        }
        if (req.url === "/config" && req.method === "POST") {
            let body = "";
            req.on("data", chunk => body += chunk);
            req.on("end", () => {
                try {
                    const data = JSON.parse(body);
                    saveConfig(data);
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: true }));
                }
                catch (error) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: String(error) }));
                }
            });
            return;
        }
        // Serve static UI files (for npm distribution)
        if (UI_DIST && req.method === "GET") {
            let filePath = req.url === "/" ? "/index.html" : req.url || "/index.html";
            // Remove query string
            filePath = filePath.split("?")[0];
            const fullPath = join(UI_DIST, filePath);
            // Security: don't serve files outside UI_DIST
            if (fullPath.startsWith(UI_DIST) && existsSync(fullPath)) {
                try {
                    const stat = statSync(fullPath);
                    if (stat.isFile()) {
                        const ext = extname(fullPath);
                        const contentType = MIME_TYPES[ext] || "application/octet-stream";
                        const content = readFileSync(fullPath);
                        res.writeHead(200, { "Content-Type": contentType });
                        res.end(content);
                        return;
                    }
                }
                catch {
                    // Fall through to 404
                }
            }
            // SPA fallback - serve index.html for client-side routing
            if (!filePath.includes(".")) {
                const indexPath = join(UI_DIST, "index.html");
                if (existsSync(indexPath)) {
                    const content = readFileSync(indexPath);
                    res.writeHead(200, { "Content-Type": "text/html" });
                    res.end(content);
                    return;
                }
            }
        }
        res.writeHead(404);
        res.end("Not found");
    });
    const host = process.env.HOST || "127.0.0.1";
    server.listen(port, host, () => {
        // Silent start - logged by main serve.ts
    });
}
