/**
 * Dependency checker - validates external tools are available
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface DepStatus {
  ok: boolean;
  version?: string;
  install?: string;
}

export interface DepsStatus {
  ripgrep: DepStatus;
  git: DepStatus;
  sqlite: DepStatus;
}

async function checkCommand(
  cmd: string,
  versionFlag: string = "--version"
): Promise<{ ok: boolean; version?: string }> {
  try {
    const { stdout } = await execAsync(`${cmd} ${versionFlag}`, {
      timeout: 5000,
    });
    // Extract first line, clean up
    const version = stdout.split("\n")[0]?.trim() || "installed";
    return { ok: true, version };
  } catch {
    return { ok: false };
  }
}

export async function checkDeps(): Promise<DepsStatus> {
  const [ripgrep, git, sqlite] = await Promise.all([
    checkCommand("rg"),
    checkCommand("git"),
    checkCommand("sqlite3"),
  ]);

  return {
    ripgrep: {
      ...ripgrep,
      install: ripgrep.ok ? undefined : "brew install ripgrep",
    },
    git: {
      ...git,
      install: git.ok ? undefined : "xcode-select --install",
    },
    sqlite: {
      ...sqlite,
      // SQLite is usually bundled, but just in case
      install: sqlite.ok ? undefined : "brew install sqlite",
    },
  };
}

// Cache deps check for 60 seconds
let cachedDeps: DepsStatus | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000;

export async function getDeps(): Promise<DepsStatus> {
  const now = Date.now();
  if (cachedDeps && now - cacheTime < CACHE_TTL) {
    return cachedDeps;
  }
  cachedDeps = await checkDeps();
  cacheTime = now;
  return cachedDeps;
}

export function hasRipgrep(): boolean {
  return cachedDeps?.ripgrep.ok ?? false;
}

export async function hasRipgrepAsync(): Promise<boolean> {
  const deps = await getDeps();
  return deps.ripgrep.ok;
}
