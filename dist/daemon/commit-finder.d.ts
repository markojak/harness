/**
 * Commit Finder - locate which Claude session created a given commit
 *
 * Flow:
 * 1. User enters commit hash
 * 2. Find which repo contains it (fast parallel git check)
 * 3. Get files changed in commit
 * 4. Search sessions that touched those files
 * 5. Score by content similarity
 */
export interface CommitInfo {
    hash: string;
    repo: string;
    repoPath: string;
    message: string;
    author: string;
    date: string;
    files: string[];
}
export interface SessionMatch {
    sessionId: string;
    projectName: string;
    score: number;
    matchedFiles: string[];
    filepath: string;
}
/**
 * Find which repo contains a commit (parallel check)
 */
export declare function findRepoForCommit(hash: string): Promise<string | null>;
/**
 * Get commit details
 */
export declare function getCommitInfo(hash: string, repoPath: string): Promise<CommitInfo | null>;
/**
 * Find sessions that might have created a commit
 */
export declare function findSessionsForCommit(commitInfo: CommitInfo): Promise<SessionMatch[]>;
/**
 * Main entry point: find sessions for a commit hash
 */
export declare function findCommit(hash: string): Promise<{
    commit: CommitInfo | null;
    sessions: SessionMatch[];
    error?: string;
}>;
