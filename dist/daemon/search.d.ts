/**
 * Full-text search using SQLite FTS5
 */
export interface SearchResult {
    sessionId: string;
    projectId: string;
    projectName: string;
    gitRepoId: string | null;
    gitRepoUrl: string | null;
    cwd: string;
    gitBranch: string | null;
    originalPrompt: string;
    goal: string | null;
    startedAt: string;
    lastActivityAt: string;
    messageCount: number;
    snippet: string;
    rank: number;
    provider?: string;
    modelProvider?: string | null;
    modelId?: string | null;
    isAgent?: boolean;
    parentSessionId?: string | null;
}
/**
 * Index a session for search
 */
export declare function indexSession(session: {
    sessionId: string;
    projectId: string;
    projectName: string;
    gitRepoId?: string | null;
    gitRepoUrl?: string | null;
    cwd: string;
    gitBranch?: string | null;
    originalPrompt: string;
    goal?: string | null;
    startedAt: string;
    lastActivityAt: string;
    messageCount: number;
    content?: string;
    provider?: string;
    modelProvider?: string | null;
    modelId?: string | null;
    isAgent?: boolean;
    parentSessionId?: string | null;
}): void;
/**
 * Search sessions using FTS5
 */
export declare function searchSessions(query: string, limit?: number): SearchResult[];
/**
 * Get search index stats
 */
export declare function getSearchStats(): {
    indexed: number;
    lastIndexed: string | null;
};
/**
 * Bulk index sessions
 */
export declare function bulkIndexSessions(sessions: Array<{
    sessionId: string;
    projectId: string;
    projectName: string;
    gitRepoId?: string | null;
    gitRepoUrl?: string | null;
    cwd: string;
    gitBranch?: string | null;
    originalPrompt: string;
    goal?: string | null;
    startedAt: string;
    lastActivityAt: string;
    messageCount: number;
    content?: string;
    provider?: string;
    modelProvider?: string | null;
    modelId?: string | null;
    isAgent?: boolean;
    parentSessionId?: string | null;
}>): number;
/**
 * Clear search index
 */
export declare function clearSearchIndex(): void;
/**
 * Get all unique cwds from indexed sessions
 */
export declare function getAllSessionCwds(): string[];
