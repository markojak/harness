/**
 * Hook for fetching the full session index
 */

import { useState, useEffect, useCallback } from "react";

export interface IndexedSession {
  sessionId: string;
  provider?: "claude" | "codex" | "opencode";
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

export interface SessionIndex {
  sessions: IndexedSession[];
  projects: IndexedProject[];
}

export function useIndex() {
  const [index, setIndex] = useState<SessionIndex>({ sessions: [], projects: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("http://127.0.0.1:4451/index");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setIndex(data);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Refresh every 30 seconds
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { index, loading, error, refresh };
}

/**
 * Get sessions for a specific project
 */
export function getProjectSessions(
  sessions: IndexedSession[],
  projectId: string
): IndexedSession[] {
  return sessions
    .filter(s => s.projectId === projectId)
    .sort((a, b) => 
      new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
    );
}

/**
 * Filter sessions by search query
 */
export function filterSessions(
  sessions: IndexedSession[],
  query: string
): IndexedSession[] {
  if (!query.trim()) return sessions;
  
  const q = query.toLowerCase();
  return sessions.filter(s => 
    s.originalPrompt.toLowerCase().includes(q) ||
    s.goal?.toLowerCase().includes(q) ||
    s.projectName.toLowerCase().includes(q) ||
    s.sessionId.toLowerCase().includes(q) ||
    s.gitBranch?.toLowerCase().includes(q)
  );
}

/**
 * Filter projects by search query
 */
export function filterProjects(
  projects: IndexedProject[],
  sessions: IndexedSession[],
  query: string
): IndexedProject[] {
  if (!query.trim()) return projects;
  
  const q = query.toLowerCase();
  const matchingSessionProjectIds = new Set(
    filterSessions(sessions, query).map(s => s.projectId)
  );
  
  return projects.filter(p => 
    p.projectName.toLowerCase().includes(q) ||
    p.gitRepoId?.toLowerCase().includes(q) ||
    matchingSessionProjectIds.has(p.projectId)
  );
}
