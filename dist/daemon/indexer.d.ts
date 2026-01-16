/**
 * Full session indexer - scans ALL sessions, not just recent
 */
export type Provider = "claude" | "codex" | "opencode" | "antigravity";
export interface IndexedSession {
    sessionId: string;
    provider: Provider;
    filepath: string;
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
    isActive: boolean;
    isAgent: boolean;
    parentSessionId?: string | null;
    modelProvider?: string | null;
    modelId?: string | null;
}
export interface IndexedProject {
    projectId: string;
    projectName: string;
    gitRepoId: string | null;
    gitRepoUrl: string | null;
    lastActivityAt: string;
    sessionCount: number;
    activeSessionCount: number;
    isActive: boolean;
}
/**
 * Scan all sessions and build index
 */
export declare function indexAllSessions(): Promise<{
    sessions: IndexedSession[];
    projects: IndexedProject[];
}>;
/**
 * Get sessions for a specific project
 */
export declare function getProjectSessions(sessions: IndexedSession[], projectId: string): IndexedSession[];
