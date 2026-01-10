export interface GitInfo {
    repoUrl: string | null;
    repoId: string | null;
    branch: string | null;
    isGitRepo: boolean;
}
/**
 * Get GitHub repo info for a directory.
 */
export declare function getGitInfo(cwd: string): Promise<GitInfo>;
/**
 * Get GitHub repo info with caching.
 * Repo URL and ID are cached longer, but branch is refreshed more frequently.
 */
export declare function getGitInfoCached(cwd: string): Promise<GitInfo>;
/**
 * Get just the current branch for a cwd.
 * Fast operation that doesn't require full git info lookup.
 */
export declare function getCurrentBranch(cwd: string): Promise<string | null>;
/**
 * Clear git cache for a specific cwd (e.g., after branch change)
 */
export declare function clearGitCache(cwd: string): void;
