import { readFile, access, constants } from "node:fs/promises";
import { join, dirname } from "node:path";

export interface GitInfo {
  repoUrl: string | null;      // Full URL: https://github.com/owner/repo or git@github.com:owner/repo
  repoId: string | null;       // Normalized: owner/repo
  branch: string | null;       // Current branch name
  isGitRepo: boolean;
}

/**
 * Find the .git directory for a given path, walking up the tree.
 */
async function findGitDir(startPath: string): Promise<string | null> {
  let currentPath = startPath;
  const root = "/";

  while (currentPath !== root) {
    const gitPath = join(currentPath, ".git");
    try {
      await access(gitPath, constants.F_OK);
      return gitPath;
    } catch {
      currentPath = dirname(currentPath);
    }
  }

  return null;
}

/**
 * Parse a git remote URL and extract the repo identifier.
 * Handles both HTTPS and SSH formats:
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - https://github.com/owner/repo
 */
function parseGitUrl(url: string): { repoUrl: string; repoId: string } | null {
  // HTTPS format: https://github.com/owner/repo.git
  const httpsMatch = url.match(
    /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/\s]+?)(?:\.git)?$/i
  );
  if (httpsMatch) {
    const [, owner, repo] = httpsMatch;
    return {
      repoUrl: `https://github.com/${owner}/${repo}`,
      repoId: `${owner}/${repo}`,
    };
  }

  // SSH format: git@github.com:owner/repo.git
  const sshMatch = url.match(
    /^git@github\.com:([^/]+)\/([^/\s]+?)(?:\.git)?$/i
  );
  if (sshMatch) {
    const [, owner, repo] = sshMatch;
    return {
      repoUrl: `https://github.com/${owner}/${repo}`,
      repoId: `${owner}/${repo}`,
    };
  }

  // Not a GitHub URL
  return null;
}

/**
 * Read the current branch from .git/HEAD (internal use)
 */
async function _getCurrentBranchInternal(gitDir: string): Promise<string | null> {
  try {
    const headPath = join(gitDir, "HEAD");
    const headContent = await readFile(headPath, "utf-8");
    const trimmed = headContent.trim();

    // HEAD usually contains "ref: refs/heads/branch-name"
    const match = trimmed.match(/^ref: refs\/heads\/(.+)$/);
    if (match) {
      return match[1];
    }

    // Detached HEAD - return null or the short SHA
    return null;
  } catch {
    return null;
  }
}

/**
 * Read the git config file and extract the origin remote URL.
 */
async function getOriginUrl(gitDir: string): Promise<string | null> {
  try {
    const configPath = join(gitDir, "config");
    const configContent = await readFile(configPath, "utf-8");

    // Parse git config format - look for [remote "origin"] section
    const lines = configContent.split("\n");
    let inOriginSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Check for section header
      if (trimmed.startsWith("[")) {
        inOriginSection = trimmed.toLowerCase() === '[remote "origin"]';
        continue;
      }

      // Look for url = ... in origin section
      if (inOriginSection && trimmed.startsWith("url")) {
        const match = trimmed.match(/^url\s*=\s*(.+)$/);
        if (match) {
          return match[1].trim();
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get GitHub repo info for a directory.
 */
export async function getGitInfo(cwd: string): Promise<GitInfo> {
  const gitDir = await findGitDir(cwd);

  if (!gitDir) {
    return { repoUrl: null, repoId: null, branch: null, isGitRepo: false };
  }

  const [originUrl, branch] = await Promise.all([
    getOriginUrl(gitDir),
    _getCurrentBranchInternal(gitDir),
  ]);

  if (!originUrl) {
    // It's a git repo but has no origin remote
    return { repoUrl: null, repoId: null, branch, isGitRepo: true };
  }

  const parsed = parseGitUrl(originUrl);

  if (!parsed) {
    // It's a git repo with an origin, but not GitHub
    return { repoUrl: originUrl, repoId: null, branch, isGitRepo: true };
  }

  return {
    repoUrl: parsed.repoUrl,
    repoId: parsed.repoId,
    branch,
    isGitRepo: true,
  };
}

// Cache git info by cwd to avoid repeated filesystem lookups
// Store both the info and the git directory path for branch refresh
interface CachedGitInfo {
  info: GitInfo;
  gitDir: string | null;
  lastChecked: number;
}

const gitInfoCache = new Map<string, CachedGitInfo>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

/**
 * Get GitHub repo info with caching.
 * Repo URL and ID are cached longer, but branch is refreshed more frequently.
 */
export async function getGitInfoCached(cwd: string): Promise<GitInfo> {
  const cached = gitInfoCache.get(cwd);
  const now = Date.now();

  // If we have cached info and it's recent, just refresh the branch
  if (cached && now - cached.lastChecked < CACHE_TTL_MS) {
    // Quick branch refresh
    if (cached.gitDir) {
      const branch = await getCurrentBranchFromDir(cached.gitDir);
      if (branch !== cached.info.branch) {
        cached.info = { ...cached.info, branch };
      }
    }
    return cached.info;
  }

  // Full refresh
  const gitDir = await findGitDir(cwd);
  const info = await getGitInfo(cwd);

  gitInfoCache.set(cwd, {
    info,
    gitDir,
    lastChecked: now,
  });

  return info;
}

/**
 * Get just the current branch for a cwd.
 * Fast operation that doesn't require full git info lookup.
 */
export async function getCurrentBranch(cwd: string): Promise<string | null> {
  const cached = gitInfoCache.get(cwd);
  if (cached?.gitDir) {
    return getCurrentBranchFromDir(cached.gitDir);
  }

  const gitDir = await findGitDir(cwd);
  if (!gitDir) return null;

  return getCurrentBranchFromDir(gitDir);
}

/**
 * Read the current branch from a known .git directory
 */
async function getCurrentBranchFromDir(gitDir: string): Promise<string | null> {
  try {
    const headPath = join(gitDir, "HEAD");
    const headContent = await readFile(headPath, "utf-8");
    const trimmed = headContent.trim();

    // HEAD usually contains "ref: refs/heads/branch-name"
    const match = trimmed.match(/^ref: refs\/heads\/(.+)$/);
    if (match) {
      return match[1];
    }

    // Detached HEAD - return null or the short SHA
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear git cache for a specific cwd (e.g., after branch change)
 */
export function clearGitCache(cwd: string): void {
  gitInfoCache.delete(cwd);
}
