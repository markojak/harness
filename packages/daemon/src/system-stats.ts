import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, extname, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));

// MIME types for static file serving
const MIME_TYPES: Record<string, string> = {
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
function findUiDist(): string | null {
  const possiblePaths = [
    join(__dirname, "../ui"),              // From dist/daemon/ to dist/ui/ (npm package)
    join(__dirname, "../../ui"),           // Alternative layout
    join(__dirname, "../../../dist/ui"),   // From packages/daemon/dist to root dist/ui
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
import { type CostSummary, formatCost, formatTokens } from "./cost-tracker.js";
import { indexAllSessions, type IndexedSession, type IndexedProject } from "./indexer.js";
import * as bookmarks from "./bookmarks.js";
import * as search from "./search.js";
import { extractSessionDetail } from "./session-detail.js";
import { getDeps } from "./deps.js";
import { getActiveJobs, getRunningJobs, type Job } from "./jobs.js";
import { getErrors, type AppError } from "./errors.js";
import { findCommit, findRepoForCommit, getCommitInfo } from "./commit-finder.js";

// Config management
const DATA_DIR = join(process.env.HOME || "", ".harness");
const CONFIG_PATH = join(DATA_DIR, "config.json");

interface ProviderConfig {
  enabled: boolean;
  path: string;
}

interface HarnessConfig {
  providers: {
    claude: ProviderConfig;
    codex: ProviderConfig;
    opencode: ProviderConfig;
    antigravity: ProviderConfig;
  };
  port: number;
  host: string;
  resumeFlags: string;
  hiddenProjects: string[]; // Array of projectIds to hide
}

const HOME = process.env.HOME || "";

const DEFAULT_CONFIG: HarnessConfig = {
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
    antigravity: {
      enabled: true,
      path: join(HOME, ".gemini/antigravity"),
    },
  },
  port: 4450,
  host: "127.0.0.1",
  resumeFlags: "",
  hiddenProjects: [],
};

export function getConfig(): HarnessConfig {
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
          antigravity: { ...DEFAULT_CONFIG.providers.antigravity, ...parsed.providers?.antigravity },
        },
      };
    }
  } catch {
    // Return default
  }
  return DEFAULT_CONFIG;
}

export function saveConfig(config: Partial<HarnessConfig>): void {
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

export function getProviderPath(provider: "claude" | "codex" | "opencode" | "antigravity"): string {
  const config = getConfig();
  return config.providers[provider].path;
}

export function isProviderEnabled(provider: "claude" | "codex" | "opencode" | "antigravity"): boolean {
  const config = getConfig();
  return config.providers[provider].enabled;
}

interface SystemStats {
  cpuUsage: number;
  memUsage: number;
  uptime: string;
}

// Shared state for cost tracking (set by watcher)
let todayCostSummary: CostSummary = {
  totalTokens: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  estimatedCost: 0,
};

export function updateTodayCost(summary: CostSummary): void {
  todayCostSummary = summary;
}

export function getTodayCost(): { cost: string; tokens: string; raw: CostSummary } {
  return {
    cost: formatCost(todayCostSummary.estimatedCost),
    tokens: formatTokens(todayCostSummary.totalTokens),
    raw: todayCostSummary,
  };
}

let lastCpuInfo = os.cpus();
let lastCpuTime = Date.now();

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function getCpuUsage(): number {
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
    const total =
      cpu.times.user -
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

  if (totalTick === 0) return 0;
  return Math.round(((totalTick - totalIdle) / totalTick) * 100);
}

function getSystemStats(): SystemStats {
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

export function startStatsServer(port: number = 4451): void {
  // Security: Define allowed origins for CORS (localhost only)
  const allowedOrigins = [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    `http://localhost:${port - 1}`,
    `http://127.0.0.1:${port - 1}`,
  ];

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Security: CORS with origin whitelist instead of wildcard
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else if (!origin) {
      // Allow requests without origin (same-origin, curl, etc.)
      res.setHeader("Access-Control-Allow-Origin", `http://localhost:${port}`);
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
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

    // Proxy stream requests to durable streams server
    if (req.url?.startsWith("/stream/")) {
      const streamPath = req.url.replace("/stream", "");
      const proxyReq = httpRequest({
        hostname: "127.0.0.1",
        port: port - 1, // Stream server is on port - 1 (4450 vs 4451)
        path: streamPath,
        method: req.method,
        headers: {
          ...req.headers,
          host: `127.0.0.1:${port - 1}`,
        },
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on("error", (err) => {
        console.error("[Proxy] Error:", err.message);
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Stream proxy error" }));
      });

      req.pipe(proxyReq);
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
      } catch (error) {
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
      } catch (error) {
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
      } catch (error) {
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
        } catch (error) {
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
          } else {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Not found" }));
          }
        } catch (error) {
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
      const provider = url.searchParams.get("provider") || undefined;
      
      const results = search.searchSessions(query, limit, provider);
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
      } catch (error) {
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
      } catch (error) {
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
        } catch (error) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(error) }));
        }
      });
      return;
    }

    // Hide/Unhide project API
    if (req.url === "/projects/hide" && req.method === "POST") {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", async () => {
        try {
          const { projectId } = JSON.parse(body);
          if (!projectId) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "projectId is required" }));
            return;
          }
          
          const config = getConfig();
          if (!config.hiddenProjects.includes(projectId)) {
            config.hiddenProjects.push(projectId);
            saveConfig(config);
          }
          
          // Also remove from search index
          search.deleteProjectSessions(projectId);
          
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, hidden: config.hiddenProjects }));
        } catch (error) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: String(error) }));
        }
      });
      return;
    }

    if (req.url === "/projects/unhide" && req.method === "POST") {
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", () => {
        try {
          const { projectId } = JSON.parse(body);
          if (!projectId) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "projectId is required" }));
            return;
          }
          
          const config = getConfig();
          config.hiddenProjects = config.hiddenProjects.filter(p => p !== projectId);
          saveConfig(config);
          
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, hidden: config.hiddenProjects }));
        } catch (error) {
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
      
      // Security: Decode URI and normalize path to prevent traversal attacks
      try {
        filePath = decodeURIComponent(filePath);
      } catch {
        // Invalid URI encoding
        res.writeHead(400);
        res.end("Bad request");
        return;
      }
      
      // Security: Use resolve() to get absolute path, then verify it's within UI_DIST
      // This prevents ../ traversal attacks even with encoded characters
      const resolvedUiDist = resolve(UI_DIST);
      const fullPath = resolve(resolvedUiDist, "." + filePath);
      
      // Security: Verify the resolved path is still within UI_DIST
      if (!fullPath.startsWith(resolvedUiDist + "/") && fullPath !== resolvedUiDist) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      
      if (existsSync(fullPath)) {
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
        } catch {
          // Fall through to 404
        }
      }
      
      // SPA fallback - serve index.html for client-side routing
      if (!filePath.includes(".")) {
        const indexPath = resolve(resolvedUiDist, "index.html");
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
