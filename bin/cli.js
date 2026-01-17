#!/usr/bin/env node

import { spawn, execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Colors
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

const SPINNER_FRAMES = ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"];
let spinnerFrame = 0;
let spinnerInterval = null;

function startSpinner(message) {
  process.stdout.write(`${c.cyan}${SPINNER_FRAMES[0]}${c.reset} ${message}`);
  spinnerInterval = setInterval(() => {
    spinnerFrame = (spinnerFrame + 1) % SPINNER_FRAMES.length;
    process.stdout.write(
      `\r${c.cyan}${SPINNER_FRAMES[spinnerFrame]}${c.reset} ${message}`,
    );
  }, 80);
}

function stopSpinner(success = true) {
  if (spinnerInterval) {
    clearInterval(spinnerInterval);
    spinnerInterval = null;
    const icon = success ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
    process.stdout.write(`\r${icon}\n`);
  }
}

// Parse CLI arguments
function parseArgs(args) {
  const result = {
    command: null,
    flags: {},
    positional: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        result.flags[key] = next;
        i++;
      } else {
        result.flags[key] = true;
      }
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);
      result.flags[key] = true;
    } else if (!result.command) {
      result.command = arg;
    } else {
      result.positional.push(arg);
    }
  }

  return result;
}

// Get package version
function getVersion() {
  try {
    const pkgPath = join(__dirname, "../package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

// Config file path
const CONFIG_PATH = join(process.env.HOME || "", ".harness", "config.json");
const DATA_DIR = join(process.env.HOME || "", ".harness");

// Default provider paths
const DEFAULT_PATHS = {
  claude: join(process.env.HOME || "", ".claude", "projects"),
  codex: join(process.env.HOME || "", ".codex", "sessions"),
  opencode: join(
    process.env.HOME || "",
    ".local",
    "share",
    "opencode",
    "storage",
  ),
  antigravity: join(process.env.HOME || "", ".gemini", "antigravity"),
};

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadConfig() {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch {}
  return {};
}

function getProviderPath(provider) {
  const config = loadConfig();
  return config.providers?.[provider]?.path || DEFAULT_PATHS[provider];
}

function isProviderEnabled(provider) {
  const config = loadConfig();
  // Default to enabled if not specified
  return config.providers?.[provider]?.enabled !== false;
}

function isCustomPath(provider) {
  const config = loadConfig();
  return (
    config.providers?.[provider]?.path &&
    config.providers[provider].path !== DEFAULT_PATHS[provider]
  );
}

function saveConfig(config) {
  ensureDataDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// ============= COMMANDS =============

async function cmdHelp() {
  console.log(`
${c.green}▪ harness${c.reset} - AI Coding Session Dashboard

${c.bold}Usage:${c.reset}
  harness [command] [options]

${c.bold}Commands:${c.reset}
  ${c.cyan}start${c.reset}             Start dashboard (default)
  ${c.cyan}stats${c.reset}             Show quick stats
  ${c.cyan}sessions${c.reset}          List recent sessions
  ${c.cyan}search${c.reset} <query>    Search sessions
  ${c.cyan}export${c.reset} <id>       Export session to markdown
  ${c.cyan}doctor${c.reset}            Check system health
  ${c.cyan}config${c.reset}            Show/edit configuration
  ${c.cyan}index${c.reset}             Manage search index
  ${c.cyan}version${c.reset}           Show version
  ${c.cyan}help${c.reset}              Show this help

${c.bold}Start Options:${c.reset}
  --port <n>          Port for daemon (default: 4450)
  --host <addr>       Bind address (default: 127.0.0.1, use 0.0.0.0 for network)
  --no-open           Don't open browser
  --headless          API only, no UI

${c.bold}Filter Options:${c.reset}
  --provider <name>   Filter by provider (claude, codex, opencode)
  --project <name>    Filter by project name
  --since <time>      Filter by time (e.g., 24h, 7d, 1w)
  --active            Only show active sessions
  --branch <name>     Filter by git branch

${c.bold}Output Options:${c.reset}
  --json              Output as JSON

${c.bold}Providers:${c.reset}
  ${c.yellow}C${c.reset} Claude          Claude Code (~/.claude/projects)
  ${c.green}X${c.reset} Codex           Codex CLI (~/.codex/sessions)
  ${c.cyan}O${c.reset} OpenCode        OpenCode (~/.local/share/opencode)
  ${c.bold}A${c.reset} Antigravity     Gemini/DeepMind (~/.gemini/antigravity)

${c.bold}Examples:${c.reset}
  harness                           Start dashboard
  harness stats                     Quick stats overview
  harness sessions --since 7d       Sessions from last week
  harness sessions --provider claude Only Claude sessions
  harness search "auth"             Search for auth-related
  harness doctor                    Check if everything works
`);
}

async function cmdVersion() {
  console.log(`harness v${getVersion()}`);
}

async function cmdStats(flags) {
  const useJson = flags.json;

  try {
    // Try to get stats from running daemon first
    const response = await fetch("http://127.0.0.1:4451/system-stats").catch(
      () => null,
    );

    let stats;
    if (response?.ok) {
      stats = await response.json();
    } else {
      // Calculate stats directly
      stats = await calculateStatsDirectly();
    }

    if (useJson) {
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    console.log(`
${c.green}▪ harness${c.reset} stats

${c.bold}Sessions${c.reset}
  Total indexed:  ${stats.sessionCount || "—"}
  Active now:     ${stats.activeCount || 0}
  Projects:       ${stats.projectCount || "—"}

${c.bold}Today${c.reset}
  Cost:           ${stats.todayCost || "$0.00"}
  Tokens:         ${formatNumber(stats.todayTokens || 0)}

${c.bold}System${c.reset}
  CPU:            ${stats.cpuUsage ? Math.round(stats.cpuUsage) + "%" : "—"}
  Memory:         ${stats.memUsage ? Math.round(stats.memUsage) + "%" : "—"}
  Uptime:         ${stats.uptime || "—"}
`);
  } catch (err) {
    console.error(`${c.red}Error:${c.reset} ${err.message}`);
    process.exit(1);
  }
}

async function calculateStatsDirectly() {
  let sessionCount = 0;
  let projectCount = 0;

  // Count across all enabled providers
  const providers = ["claude", "codex", "opencode"];

  for (const provider of providers) {
    if (!isProviderEnabled(provider)) continue;
    const path = getProviderPath(provider);
    if (!existsSync(path)) continue;

    const count = await countProviderSessions(provider, path);
    sessionCount += count;
    projectCount++; // Count each provider as a "project" for simplicity
  }

  return { sessionCount, projectCount, activeCount: 0 };
}

async function cmdSessions(flags) {
  const useJson = flags.json;
  const since = parseSince(flags.since || "24h");
  const projectFilter = flags.project;
  const branchFilter = flags.branch;
  const activeOnly = flags.active;
  const providerFilter = flags.provider;

  try {
    const sessions = await getSessionsDirectly({
      since,
      projectFilter,
      branchFilter,
      activeOnly,
      providerFilter,
    });

    if (useJson) {
      console.log(JSON.stringify(sessions, null, 2));
      return;
    }

    if (sessions.length === 0) {
      console.log(`${c.dim}No sessions found${c.reset}`);
      return;
    }

    // Group by provider for display
    const byProvider = { claude: 0, codex: 0, opencode: 0 };
    for (const s of sessions)
      byProvider[s.provider] = (byProvider[s.provider] || 0) + 1;
    const providerSummary = Object.entries(byProvider)
      .filter(([, count]) => count > 0)
      .map(([p, count]) => `${p}: ${count}`)
      .join(", ");

    console.log(
      `${c.green}▪${c.reset} ${sessions.length} sessions ${c.dim}(${providerSummary})${c.reset}\n`,
    );

    const providerIcons = { claude: "C", codex: "X", opencode: "O" };
    const providerColors = {
      claude: c.yellow,
      codex: c.green,
      opencode: c.cyan,
    };

    for (const s of sessions.slice(0, 20)) {
      const status = s.isActive
        ? `${c.green}●${c.reset}`
        : `${c.dim}○${c.reset}`;
      const time = formatRelativeTime(s.lastActivityAt);
      const prompt =
        (s.originalPrompt || "").slice(0, 50) +
        (s.originalPrompt?.length > 50 ? "..." : "");
      const pIcon = `${providerColors[s.provider] || c.dim}${providerIcons[s.provider] || "?"}${c.reset}`;

      console.log(
        `${status} ${pIcon} ${c.cyan}${s.sessionId.slice(0, 8)}${c.reset} ${c.dim}${time}${c.reset}`,
      );
      console.log(
        `  ${s.projectName}${s.gitBranch ? ` · ${s.gitBranch}` : ""}`,
      );
      console.log(`  ${c.dim}${prompt}${c.reset}`);
      console.log();
    }

    if (sessions.length > 20) {
      console.log(`${c.dim}... and ${sessions.length - 20} more${c.reset}`);
    }
  } catch (err) {
    console.error(`${c.red}Error:${c.reset} ${err.message}`);
    process.exit(1);
  }
}

async function getSessionsDirectly({
  since,
  projectFilter,
  branchFilter,
  activeOnly,
  providerFilter,
}) {
  const { readdir, readFile, stat } = await import("node:fs/promises");
  const sessions = [];

  const providers = ["claude", "codex", "opencode"];

  for (const provider of providers) {
    if (!isProviderEnabled(provider)) continue;
    if (providerFilter && provider !== providerFilter) continue;

    const basePath = getProviderPath(provider);
    if (!existsSync(basePath)) continue;

    try {
      if (provider === "claude") {
        const projects = await readdir(basePath);
        for (const projectDir of projects) {
          const projectPath = join(basePath, projectDir);
          const files = await readdir(projectPath).catch(() => []);

          for (const file of files.filter((f) => f.endsWith(".jsonl"))) {
            const filePath = join(projectPath, file);
            const fileStat = await stat(filePath).catch(() => null);
            if (!fileStat) continue;
            if (since && fileStat.mtime.getTime() < since) continue;

            try {
              const content = await readFile(filePath, "utf-8");
              const lines = content.trim().split("\n").filter(Boolean);
              if (lines.length === 0) continue;

              const firstLine = JSON.parse(lines[0]);
              const lastLine = JSON.parse(lines[lines.length - 1]);
              const projectName = decodeProjectDir(projectDir);

              if (
                projectFilter &&
                !projectName.toLowerCase().includes(projectFilter.toLowerCase())
              )
                continue;

              const isActive =
                Date.now() - fileStat.mtime.getTime() < 5 * 60 * 1000;
              if (activeOnly && !isActive) continue;

              sessions.push({
                sessionId: file.replace(".jsonl", ""),
                provider: "claude",
                projectName,
                originalPrompt: firstLine.message?.content?.[0]?.text || "",
                lastActivityAt:
                  lastLine.timestamp || fileStat.mtime.toISOString(),
                isActive,
                messageCount: lines.length,
              });
            } catch {}
          }
        }
      } else if (provider === "codex") {
        const sessionFiles = await findCodexFilesForCli(basePath);
        for (const filePath of sessionFiles) {
          const fileStat = await stat(filePath).catch(() => null);
          if (!fileStat) continue;
          if (since && fileStat.mtime.getTime() < since) continue;

          try {
            const content = await readFile(filePath, "utf-8");
            const lines = content.trim().split("\n").filter(Boolean);
            if (lines.length === 0) continue;

            const firstLine = JSON.parse(lines[0]);
            const projectName = firstLine.cwd?.split("/").pop() || "unknown";

            if (
              projectFilter &&
              !projectName.toLowerCase().includes(projectFilter.toLowerCase())
            )
              continue;

            const isActive =
              Date.now() - fileStat.mtime.getTime() < 5 * 60 * 1000;
            if (activeOnly && !isActive) continue;

            sessions.push({
              sessionId:
                filePath
                  .split("/")
                  .pop()
                  ?.replace(/\.(jsonl|json)$/, "") || "",
              provider: "codex",
              projectName,
              originalPrompt: firstLine.content || "",
              lastActivityAt: fileStat.mtime.toISOString(),
              isActive,
              messageCount: lines.length,
            });
          } catch {}
        }
      } else if (provider === "opencode") {
        const sessionDir = join(basePath, "session");
        if (existsSync(sessionDir)) {
          const projects = await readdir(sessionDir).catch(() => []);
          for (const proj of projects) {
            const files = await readdir(join(sessionDir, proj)).catch(() => []);
            for (const file of files.filter((f) => f.endsWith(".json"))) {
              const filePath = join(sessionDir, proj, file);
              const fileStat = await stat(filePath).catch(() => null);
              if (!fileStat) continue;
              if (since && fileStat.mtime.getTime() < since) continue;

              try {
                const content = await readFile(filePath, "utf-8");
                const session = JSON.parse(content);
                const projectName =
                  session.title ||
                  session.directory?.split("/").pop() ||
                  "unknown";

                if (
                  projectFilter &&
                  !projectName
                    .toLowerCase()
                    .includes(projectFilter.toLowerCase())
                )
                  continue;

                const isActive =
                  Date.now() - fileStat.mtime.getTime() < 5 * 60 * 1000;
                if (activeOnly && !isActive) continue;

                // Count messages
                const messageDir = join(basePath, "message", session.id);
                let messageCount = 0;
                try {
                  const messages = await readdir(messageDir);
                  messageCount = messages.filter((f) =>
                    f.endsWith(".json"),
                  ).length;
                } catch {}

                sessions.push({
                  sessionId: session.id,
                  provider: "opencode",
                  projectName,
                  originalPrompt: session.title || "",
                  lastActivityAt: fileStat.mtime.toISOString(),
                  isActive,
                  messageCount,
                });
              } catch {}
            }
          }
        }
      }
    } catch {}
  }

  // Sort by last activity
  sessions.sort(
    (a, b) =>
      new Date(b.lastActivityAt).getTime() -
      new Date(a.lastActivityAt).getTime(),
  );

  return sessions;
}

async function findCodexFilesForCli(basePath) {
  const { readdir } = await import("node:fs/promises");
  const files = [];

  try {
    const years = await readdir(basePath).catch(() => []);
    for (const year of years) {
      if (!/^\d{4}$/.test(year)) continue;
      const months = await readdir(join(basePath, year)).catch(() => []);
      for (const month of months) {
        const days = await readdir(join(basePath, year, month)).catch(() => []);
        for (const day of days) {
          const dayFiles = await readdir(
            join(basePath, year, month, day),
          ).catch(() => []);
          for (const f of dayFiles.filter(
            (f) => f.endsWith(".jsonl") || f.endsWith(".json"),
          )) {
            files.push(join(basePath, year, month, day, f));
          }
        }
      }
    }
  } catch {}

  return files;
}

function decodeProjectDir(encoded) {
  const decoded = encoded.replace(/^-/, "/").replace(/-/g, "/");
  return decoded.split("/").pop() || decoded;
}

async function cmdSearch(query, flags) {
  if (!query) {
    console.error(`${c.red}Error:${c.reset} Search query required`);
    console.log(`Usage: harness search <query>`);
    process.exit(1);
  }

  const useJson = flags.json;

  try {
    // Try daemon first
    const response = await fetch(
      `http://127.0.0.1:4451/search?q=${encodeURIComponent(query)}`,
    ).catch(() => null);

    let results = [];
    if (response?.ok) {
      results = await response.json();
    } else {
      // Fall back to grep
      results = await searchDirectly(query);
    }

    if (useJson) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    if (results.length === 0) {
      console.log(`${c.dim}No results for "${query}"${c.reset}`);
      return;
    }

    console.log(
      `${c.green}▪${c.reset} ${results.length} results for "${query}"\n`,
    );

    const providerIcons = { claude: "C", codex: "X", opencode: "O" };
    const providerColors = {
      claude: c.yellow,
      codex: c.green,
      opencode: c.cyan,
    };

    for (const r of results.slice(0, 10)) {
      const pIcon = r.provider
        ? `${providerColors[r.provider] || c.dim}${providerIcons[r.provider] || "?"}${c.reset} `
        : "";
      console.log(
        `${pIcon}${c.cyan}${r.sessionId?.slice(0, 8) || "—"}${c.reset} ${r.projectName || "—"}`,
      );
      if (r.snippet) {
        console.log(`  ${c.dim}${r.snippet.slice(0, 80)}${c.reset}`);
      }
      console.log();
    }
  } catch (err) {
    console.error(`${c.red}Error:${c.reset} ${err.message}`);
    process.exit(1);
  }
}

async function searchDirectly(query) {
  const results = [];
  const providers = ["claude", "codex", "opencode"];

  // Security: Validate and sanitize query input
  // Only allow alphanumeric, spaces, and basic punctuation
  const sanitizedQuery = query.replace(/[^\w\s\-_.@#]/g, "");
  if (!sanitizedQuery || sanitizedQuery.length < 2) {
    return results;
  }

  for (const provider of providers) {
    if (!isProviderEnabled(provider)) continue;
    const basePath = getProviderPath(provider);
    if (!existsSync(basePath)) continue;

    try {
      // Security: Use spawnSync with argument array instead of shell string
      const glob = provider === "opencode" ? "*.json" : "*.jsonl";
      const rgResult = spawnSync(
        "rg",
        ["-l", "-i", "--max-count", "10", "-g", glob, sanitizedQuery, basePath],
        {
          encoding: "utf-8",
          timeout: 10000,
          maxBuffer: 10 * 1024 * 1024,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      if (rgResult.status !== 0 && rgResult.status !== 1) {
        // status 1 means no matches, which is fine
        continue;
      }

      const output = rgResult.stdout || "";
      const matches = output
        .trim()
        .split("\n")
        .filter(Boolean)
        .slice(0, 10)
        .map((filepath) => {
          const parts = filepath.split("/");
          const sessionId = parts.pop()?.replace(/\.(jsonl|json)$/, "") || "";
          const projectDir = parts.pop() || "";
          return {
            sessionId,
            provider,
            projectName:
              provider === "claude" ? decodeProjectDir(projectDir) : projectDir,
            filepath,
          };
        });

      results.push(...matches);
    } catch {}
  }

  return results.slice(0, 20);
}

async function cmdExport(sessionId, flags) {
  if (!sessionId) {
    console.error(`${c.red}Error:${c.reset} Session ID required`);
    console.log(`Usage: harness export <session-id>`);
    process.exit(1);
  }

  const useJson = flags.json;

  try {
    // Try daemon first
    const response = await fetch(
      `http://127.0.0.1:4451/session/${sessionId}`,
    ).catch(() => null);

    let session;
    if (response?.ok) {
      session = await response.json();
    } else {
      session = await loadSessionDirectly(sessionId);
    }

    if (!session) {
      console.error(`${c.red}Error:${c.reset} Session not found: ${sessionId}`);
      process.exit(1);
    }

    if (useJson) {
      console.log(JSON.stringify(session, null, 2));
      return;
    }

    // Output as markdown
    console.log(`# Session ${sessionId.slice(0, 8)}`);
    console.log();
    if (session.goal) console.log(`**Goal:** ${session.goal}`);
    if (session.originalPrompt)
      console.log(`**Prompt:** ${session.originalPrompt}`);
    console.log();
    console.log(`## Transcript`);
    console.log();

    for (const event of session.events || []) {
      const time = event.timestamp
        ? new Date(event.timestamp).toLocaleTimeString()
        : "";
      if (event.type === "user") {
        console.log(`### 👤 User ${time}`);
        console.log(event.content);
        console.log();
      } else if (event.type === "assistant") {
        console.log(`### 🤖 Assistant ${time}`);
        console.log(event.content);
        console.log();
      } else if (event.type === "tool") {
        console.log(`### 🔧 ${event.toolName} ${time}`);
        console.log(`\`\`\`\n${event.content?.slice(0, 500) || ""}\n\`\`\``);
        console.log();
      }
    }
  } catch (err) {
    console.error(`${c.red}Error:${c.reset} ${err.message}`);
    process.exit(1);
  }
}

async function loadSessionDirectly(sessionId) {
  const { readdir, readFile } = await import("node:fs/promises");
  const providers = ["claude", "codex", "opencode"];

  for (const provider of providers) {
    if (!isProviderEnabled(provider)) continue;
    const basePath = getProviderPath(provider);
    if (!existsSync(basePath)) continue;

    try {
      if (provider === "claude") {
        const projects = await readdir(basePath);
        for (const projectDir of projects) {
          const projectPath = join(basePath, projectDir);
          const files = await readdir(projectPath).catch(() => []);

          const matchingFile = files.find(
            (f) => f.startsWith(sessionId) && f.endsWith(".jsonl"),
          );
          if (!matchingFile) continue;

          const content = await readFile(
            join(projectPath, matchingFile),
            "utf-8",
          );
          const lines = content.trim().split("\n").filter(Boolean);

          const events = [];
          let originalPrompt = "";

          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.type === "human" || parsed.type === "user") {
                const text = parsed.message?.content?.[0]?.text || "";
                if (!originalPrompt) originalPrompt = text;
                events.push({
                  type: "user",
                  content: text,
                  timestamp: parsed.timestamp,
                });
              } else if (parsed.type === "assistant") {
                const text =
                  parsed.message?.content
                    ?.map((c) => c.text || "")
                    .join("\n") || "";
                events.push({
                  type: "assistant",
                  content: text,
                  timestamp: parsed.timestamp,
                });
              }
            } catch {}
          }

          return { sessionId, provider: "claude", originalPrompt, events };
        }
      } else if (provider === "codex") {
        const sessionFiles = await findCodexFilesForCli(basePath);
        for (const filePath of sessionFiles) {
          if (!filePath.includes(sessionId)) continue;

          const content = await readFile(filePath, "utf-8");
          const lines = content.trim().split("\n").filter(Boolean);

          const events = [];
          let originalPrompt = "";

          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.role === "user") {
                if (!originalPrompt) originalPrompt = parsed.content || "";
                events.push({
                  type: "user",
                  content: parsed.content || "",
                  timestamp: parsed.timestamp,
                });
              } else if (parsed.role === "assistant") {
                events.push({
                  type: "assistant",
                  content: parsed.content || "",
                  timestamp: parsed.timestamp,
                });
              }
            } catch {}
          }

          return { sessionId, provider: "codex", originalPrompt, events };
        }
      } else if (provider === "opencode") {
        const sessionDir = join(basePath, "session");
        if (!existsSync(sessionDir)) continue;

        const projects = await readdir(sessionDir).catch(() => []);
        for (const proj of projects) {
          const files = await readdir(join(sessionDir, proj)).catch(() => []);
          const matchingFile = files.find(
            (f) => f.includes(sessionId) && f.endsWith(".json"),
          );
          if (!matchingFile) continue;

          const sessionContent = await readFile(
            join(sessionDir, proj, matchingFile),
            "utf-8",
          );
          const session = JSON.parse(sessionContent);

          // Load messages
          const messageDir = join(basePath, "message", session.id);
          const events = [];
          let originalPrompt = session.title || "";

          try {
            const messageFiles = await readdir(messageDir);
            for (const msgFile of messageFiles
              .filter((f) => f.endsWith(".json"))
              .sort()) {
              const msgContent = await readFile(
                join(messageDir, msgFile),
                "utf-8",
              );
              const msg = JSON.parse(msgContent);
              if (msg.role === "user") {
                if (!originalPrompt) originalPrompt = msg.content || "";
                events.push({
                  type: "user",
                  content: msg.content || "",
                  timestamp: msg.time?.created,
                });
              } else if (msg.role === "assistant") {
                events.push({
                  type: "assistant",
                  content: msg.content || "",
                  timestamp: msg.time?.created,
                });
              }
            }
          } catch {}

          return {
            sessionId: session.id,
            provider: "opencode",
            originalPrompt,
            events,
          };
        }
      }
    } catch {}
  }

  return null;
}

async function cmdDoctor() {
  console.log(`${c.green}▪ harness${c.reset} doctor\n`);

  // Basic checks
  console.log(
    `  ${c.green}✓${c.reset} Node.js: ${c.dim}${process.version}${c.reset}`,
  );
  console.log(
    `  ${existsSync(DATA_DIR) ? c.green + "✓" : c.yellow + "○"}${c.reset} Data directory: ${c.dim}${DATA_DIR}${c.reset}`,
  );

  // Provider checks
  console.log(`\n${c.bold}Providers:${c.reset}`);

  const providerStats = { total: 0, providers: 0 };
  const providers = ["claude", "codex", "opencode"];

  for (const provider of providers) {
    const path = getProviderPath(provider);
    const enabled = isProviderEnabled(provider);
    const custom = isCustomPath(provider);
    const exists = existsSync(path);

    if (!enabled) {
      console.log(
        `  ${c.dim}○${c.reset} ${provider}: ${c.dim}disabled${c.reset}`,
      );
      continue;
    }

    if (exists) {
      // Count sessions
      const count = await countProviderSessions(provider, path);
      providerStats.total += count;
      providerStats.providers++;

      const pathLabel = custom ? `${path} ${c.cyan}(custom)${c.reset}` : path;
      console.log(
        `  ${c.green}✓${c.reset} ${provider}: ${c.dim}${pathLabel}${c.reset} ${c.gray}(${count} sessions)${c.reset}`,
      );
    } else {
      const pathLabel = custom ? `${path} ${c.cyan}(custom)${c.reset}` : path;
      console.log(
        `  ${c.yellow}○${c.reset} ${provider}: ${c.dim}${pathLabel}${c.reset} ${c.gray}(not found)${c.reset}`,
      );
    }
  }

  // Dependencies
  console.log(`\n${c.bold}Dependencies:${c.reset}`);

  try {
    const rgVersion = execSync("rg --version", { encoding: "utf-8" }).split(
      "\n",
    )[0];
    console.log(
      `  ${c.green}✓${c.reset} ripgrep: ${c.dim}${rgVersion}${c.reset}`,
    );
  } catch {
    console.log(
      `  ${c.yellow}○${c.reset} ripgrep: ${c.dim}not found (search will be slower)${c.reset}`,
    );
  }

  try {
    const gitVersion = execSync("git --version", { encoding: "utf-8" }).trim();
    console.log(`  ${c.green}✓${c.reset} git: ${c.dim}${gitVersion}${c.reset}`);
  } catch {
    console.log(`  ${c.yellow}○${c.reset} git: ${c.dim}not found${c.reset}`);
  }

  // Daemon status
  console.log(`\n${c.bold}Status:${c.reset}`);

  try {
    const r = await fetch("http://127.0.0.1:4451/status");
    if (r.ok) {
      console.log(`  ${c.green}✓${c.reset} Daemon: ${c.dim}running${c.reset}`);
    } else {
      console.log(
        `  ${c.yellow}○${c.reset} Daemon: ${c.dim}not running${c.reset}`,
      );
    }
  } catch {
    console.log(
      `  ${c.yellow}○${c.reset} Daemon: ${c.dim}not running${c.reset}`,
    );
  }

  // Summary
  console.log(
    `\n  ${c.cyan}ℹ${c.reset} ${providerStats.total} sessions across ${providerStats.providers} provider${providerStats.providers !== 1 ? "s" : ""}`,
  );

  // Config info
  const config = loadConfig();
  if (Object.keys(config).length > 0) {
    console.log(
      `  ${c.cyan}ℹ${c.reset} Config: ${c.dim}${CONFIG_PATH}${c.reset}`,
    );
  }

  // Suggestions
  const suggestions = [];

  if (!existsSync(DATA_DIR)) {
    suggestions.push(`Run ${c.cyan}harness${c.reset} to create data directory`);
  }

  try {
    execSync("rg --version", { stdio: "ignore" });
  } catch {
    suggestions.push(
      `Install ripgrep for 10x faster search: ${c.cyan}brew install ripgrep${c.reset}`,
    );
  }

  if (providerStats.providers === 0) {
    suggestions.push(
      `No providers found. Install Claude Code, Codex CLI, or OpenCode to get started.`,
    );
  }

  if (suggestions.length > 0) {
    console.log(`\n${c.bold}Suggestions:${c.reset}`);
    for (const s of suggestions) {
      console.log(`  • ${s}`);
    }
  }
}

async function countProviderSessions(provider, basePath) {
  const { readdir } = await import("node:fs/promises");
  let count = 0;

  try {
    if (provider === "claude") {
      const projects = await readdir(basePath);
      for (const proj of projects) {
        const files = await readdir(join(basePath, proj)).catch(() => []);
        count += files.filter((f) => f.endsWith(".jsonl")).length;
      }
    } else if (provider === "codex") {
      // Codex has nested date structure
      const years = await readdir(basePath).catch(() => []);
      for (const year of years) {
        const months = await readdir(join(basePath, year)).catch(() => []);
        for (const month of months) {
          const days = await readdir(join(basePath, year, month)).catch(
            () => [],
          );
          for (const day of days) {
            const files = await readdir(join(basePath, year, month, day)).catch(
              () => [],
            );
            count += files.filter(
              (f) => f.endsWith(".jsonl") || f.endsWith(".json"),
            ).length;
          }
        }
      }
    } else if (provider === "opencode") {
      const sessionDir = join(basePath, "session");
      if (existsSync(sessionDir)) {
        const projects = await readdir(sessionDir).catch(() => []);
        for (const proj of projects) {
          const files = await readdir(join(sessionDir, proj)).catch(() => []);
          count += files.filter((f) => f.endsWith(".json")).length;
        }
      }
    }
  } catch {}

  return count;
}

async function cmdConfig(flags) {
  const config = loadConfig();

  if (flags.json) {
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  console.log(`${c.green}▪ harness${c.reset} config\n`);
  console.log(`Config file: ${c.dim}${CONFIG_PATH}${c.reset}\n`);

  if (Object.keys(config).length === 0) {
    console.log(`${c.dim}No configuration set${c.reset}`);
    console.log(`\nAvailable options:`);
    console.log(`  port          Daemon port (default: 4450)`);
    console.log(`  resumeFlags   Custom flags for resume command`);
    console.log(`  watchDir      Custom projects directory`);
    return;
  }

  for (const [key, value] of Object.entries(config)) {
    console.log(`  ${key}: ${c.cyan}${JSON.stringify(value)}${c.reset}`);
  }
}

async function cmdIndex(flags) {
  const rebuild = flags.rebuild;

  if (rebuild) {
    console.log(`${c.cyan}⣾${c.reset} Rebuilding search index...`);

    // Try to trigger daemon reindex
    try {
      const response = await fetch("http://127.0.0.1:4451/index/rebuild", {
        method: "POST",
      });
      if (response.ok) {
        console.log(`${c.green}✓${c.reset} Index rebuild triggered`);
        return;
      }
    } catch {}

    console.log(
      `${c.yellow}⚠${c.reset} Daemon not running. Start with ${c.cyan}harness${c.reset} to rebuild index.`,
    );
    return;
  }

  // Show index stats
  try {
    const response = await fetch("http://127.0.0.1:4451/search/stats");
    if (response.ok) {
      const stats = await response.json();
      console.log(`${c.green}▪${c.reset} Search index`);
      console.log(`  Indexed: ${stats.indexed} sessions`);
      console.log(`  Last indexed: ${stats.lastIndexed || "never"}`);
      return;
    }
  } catch {}

  const stats = await calculateStatsDirectly();
  console.log(`${c.green}▪${c.reset} Search index`);
  console.log(`  Sessions available: ${stats.sessionCount}`);
  console.log(`  ${c.dim}Start daemon to build index${c.reset}`);
}

async function cmdStart(flags) {
  const port = parseInt(flags.port) || 4450;
  const host = flags.host || "127.0.0.1";
  const noOpen = flags["no-open"];
  const headless = flags.headless;
  const watchDir = flags.watch;

  ensureDataDir();

  console.log(`${c.green}▪ harness${c.reset} session tracker\n`);

  startSpinner("Starting daemon...");

  // Build environment
  const env = { ...process.env };
  if (port !== 4450) env.PORT = String(port);
  if (host !== "127.0.0.1") env.HOST = host;
  // Note: --watch is deprecated, use config file for custom paths
  if (watchDir) {
    console.log(
      `${c.yellow}Warning:${c.reset} --watch is deprecated. Use ~/.harness/config.json to set provider paths.`,
    );
  }

  // Start daemon
  const daemonPath = join(__dirname, "../dist/daemon/serve.js");
  const daemon = spawn("node", [daemonPath], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
    env,
  });

  let daemonReady = false;

  daemon.stdout.on("data", (data) => {
    const output = data.toString();
    if (
      (output.includes("Ready") || output.includes("Stats URL")) &&
      !daemonReady
    ) {
      daemonReady = true;
      stopSpinner(true);

      const uiPort = port + 1;
      const displayHost = host === "0.0.0.0" ? "localhost" : host;
      console.log(
        `${c.green}✓${c.reset} Dashboard: ${c.cyan}http://${displayHost}:${uiPort}${c.reset}`,
      );
      if (host === "0.0.0.0") {
        console.log(`${c.dim}  Listening on all interfaces${c.reset}`);
      }

      if (!noOpen && !headless) {
        // Open browser
        const openCmd =
          process.platform === "darwin"
            ? "open"
            : process.platform === "win32"
              ? "start"
              : "xdg-open";
        try {
          execSync(`${openCmd} http://localhost:${uiPort}`, {
            stdio: "ignore",
          });
        } catch {}
      }

      console.log(`${c.dim}Press Ctrl+C to stop${c.reset}\n`);
    }

    if (!headless) {
      process.stdout.write(output);
    }
  });

  daemon.stderr.on("data", (data) => {
    const output = data.toString();
    if (
      !output.includes("ExperimentalWarning") &&
      !output.includes("Anthropic")
    ) {
      process.stderr.write(output);
    }
  });

  daemon.on("error", (err) => {
    stopSpinner(false);
    console.error(`${c.red}Failed to start:${c.reset} ${err.message}`);
    process.exit(1);
  });

  daemon.on("close", (code) => {
    if (code !== 0 && code !== null) {
      process.exit(code);
    }
  });

  process.on("SIGINT", () => {
    console.log(`\n${c.dim}Shutting down...${c.reset}`);
    daemon.kill();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    daemon.kill();
    process.exit(0);
  });
}

// ============= HELPERS =============

function parseSince(value) {
  if (!value) return null;

  const match = value.match(/^(\d+)(h|d|w|m)$/);
  if (!match) return null;

  const num = parseInt(match[1]);
  const unit = match[2];

  const ms = {
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    m: 30 * 24 * 60 * 60 * 1000,
  }[unit];

  return Date.now() - num * ms;
}

function formatRelativeTime(isoString) {
  const date = new Date(isoString);
  const now = Date.now();
  const diff = now - date.getTime();

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

// ============= MAIN =============

async function main() {
  const args = process.argv.slice(2);
  const { command, flags, positional } = parseArgs(args);

  // Handle help flags anywhere
  if (flags.help || flags.h) {
    await cmdHelp();
    return;
  }

  // Handle version flags anywhere
  if (flags.version || flags.v) {
    await cmdVersion();
    return;
  }

  // Route to commands
  switch (command) {
    case null:
    case "start":
      await cmdStart(flags);
      break;
    case "help":
      await cmdHelp();
      break;
    case "version":
      await cmdVersion();
      break;
    case "stats":
      await cmdStats(flags);
      break;
    case "sessions":
      await cmdSessions(flags);
      break;
    case "search":
      await cmdSearch(positional[0], flags);
      break;
    case "export":
      await cmdExport(positional[0], flags);
      break;
    case "doctor":
      await cmdDoctor();
      break;
    case "config":
      await cmdConfig(flags);
      break;
    case "index":
      await cmdIndex(flags);
      break;
    default:
      console.error(`${c.red}Unknown command:${c.reset} ${command}`);
      console.log(`Run ${c.cyan}harness help${c.reset} for usage`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`${c.red}Error:${c.reset} ${err.message}`);
  process.exit(1);
});
