import { createFileRoute } from "@tanstack/react-router";
import { Flex, Text, Box } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { ProjectSection } from "../components/ProjectSection";
import { StatsBar } from "../components/StatsBar";
import { SearchResults } from "../components/SearchResults";
import { SessionPanel } from "../components/SessionPanel";
import { InitStatus } from "../components/InitStatus";
import { StatusIndicator } from "../components/StatusIndicator";
import { CommitSearch } from "../components/CommitSearch";
import { ProviderFilter, type ProviderFilterValue } from "../components/ProviderFilter";
import { useSessions } from "../hooks/useSessions";
import { useIndex, getProjectSessions } from "../hooks/useIndex";
import { useSearch } from "../hooks/useSearch";
import { useConfig } from "../hooks/useConfig";
import type { Session } from "../data/schema";
import type { IndexedSession } from "../hooks/useIndex";

type SearchMode = "search" | "commits";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const { sessions: liveSessions } = useSessions();
  const { index, loading: indexLoading } = useIndex();
  const { query, setQuery, results, loading: searchLoading, isSearching, clearSearch } = useSearch();
  const { config } = useConfig();

  const [selectedSession, setSelectedSession] = useState<IndexedSession | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>("search");
  const [providerFilter, setProviderFilter] = useState<ProviderFilterValue>("all");

  // Force re-render every minute to update relative times
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Close panel on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedSession) {
        setSelectedSession(null);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedSession]);

  // Group live sessions by project
  const liveSessionsByProject = new Map<string, Session[]>();
  for (const session of liveSessions) {
    const matchingProject = index.projects.find(p =>
      p.gitRepoId === session.gitRepoId ||
      p.projectId === session.cwd ||
      session.cwd.startsWith(p.projectId)
    );

    if (matchingProject) {
      if (!liveSessionsByProject.has(matchingProject.projectId)) {
        liveSessionsByProject.set(matchingProject.projectId, []);
      }
      liveSessionsByProject.get(matchingProject.projectId)!.push(session);
    }
  }

  // Sort projects: active first (by live session count), then by last activity
  const sortedProjects = [...index.projects].sort((a, b) => {
    const aLive = liveSessionsByProject.get(a.projectId)?.length || 0;
    const bLive = liveSessionsByProject.get(b.projectId)?.length || 0;

    if (aLive > 0 && bLive === 0) return -1;
    if (bLive > 0 && aLive === 0) return 1;

    return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
  });

  // Combine all sessions for stats
  const allSessions = liveSessions.length > 0 ? liveSessions :
    index.sessions.slice(0, 20).map(s => ({
      sessionId: s.sessionId,
      status: s.isActive ? "working" : "idle",
    } as Session));

  const loading = indexLoading;

  // Handle session click
  const handleSessionClick = (session: IndexedSession) => {
    setSelectedSession(session);
  };

  return (
    <Flex direction="column" gap="3">
      {/* Header */}
      <Flex
        align="center"
        justify="between"
        pb="2"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <Flex align="center" gap="3">
          <Flex align="center" gap="2">
            <Text size="3" weight="bold" style={{ color: "var(--accent-green)" }}>
              ▪ harness
            </Text>
            <Text size="2" style={{ color: "var(--text-tertiary)" }}>
              session tracker
            </Text>
          </Flex>
          <InitStatus
            indexLoading={indexLoading}
            sessionCount={index.sessions.length}
            projectCount={index.projects.length}
          />
          <StatusIndicator />
        </Flex>
        <StatsBar sessions={allSessions} />
      </Flex>

      {/* Search Section */}
      <Box>
        {/* Mode Toggle - above search bar */}
        <Flex align="center" gap="2" mb="2">
          <Box
            px="2"
            py="1"
            style={{
              background: searchMode === "search" ? "var(--bg-elevated)" : "transparent",
              color: searchMode === "search" ? "var(--text-primary)" : "var(--text-tertiary)",
              cursor: "pointer",
              fontSize: "12px",
              lineHeight: "1.4",
              borderRadius: "3px",
            }}
            onClick={() => {
              setSearchMode("search");
              clearSearch();
            }}
          >
            Search
          </Box>
          <Box
            px="2"
            py="1"
            style={{
              background: searchMode === "commits" ? "var(--bg-elevated)" : "transparent",
              color: searchMode === "commits" ? "var(--text-primary)" : "var(--text-tertiary)",
              cursor: "pointer",
              fontSize: "12px",
              lineHeight: "1.4",
              borderRadius: "3px",
            }}
            onClick={() => {
              setSearchMode("commits");
              clearSearch();
            }}
          >
            Commits
          </Box>
        </Flex>

        {/* Search Input with Provider Filter inside on left */}
        {searchMode === "search" && (
          <Flex
            align="center"
            style={{
              width: "100%",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "3px",
            }}
          >
            {/* Provider Filter inside on left */}
            <ProviderFilter value={providerFilter} onChange={setProviderFilter} />
            <Box style={{ position: "relative", flex: 1 }}>
              <form onSubmit={(e) => { e.preventDefault(); }} style={{ margin: 0 }}>
                <input
                  type="text"
                  placeholder={providerFilter === "all" ? "Search sessions..." : `Search ${providerFilter}...`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    paddingRight: query ? "32px" : "12px",
                    background: "transparent",
                    border: "none",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                />
              </form>
              {query && (
                <Text
                  size="1"
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-tertiary)",
                    cursor: "pointer",
                  }}
                  onClick={clearSearch}
                >
                  ✕
                </Text>
              )}
              {searchLoading && (
                <Text
                  size="1"
                  style={{
                    position: "absolute",
                    right: query ? "30px" : "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-tertiary)",
                  }}
                >
                  ...
                </Text>
              )}
            </Box>
          </Flex>
        )}
      </Box>

      {/* Commit Search (when in commits mode) */}
      {searchMode === "commits" && (
        <CommitSearch
          onSessionClick={(sessionId) => {
            const session = index.sessions.find(s => s.sessionId === sessionId);
            if (session) handleSessionClick(session);
          }}
        />
      )}

      {/* Search Results */}
      {isSearching && (
        <SearchResults
          results={results}
          query={query}
          onSessionClick={(sessionId) => {
            const session = index.sessions.find(s => s.sessionId === sessionId);
            if (session) handleSessionClick(session);
          }}
        />
      )}

      {/* Loading state */}
      {loading && !isSearching && (
        <Flex align="center" justify="center" py="9">
          <Text style={{ color: "var(--text-tertiary)" }}>Loading sessions...</Text>
        </Flex>
      )}

      {/* Empty state */}
      {!loading && !isSearching && sortedProjects.length === 0 && (
        <Flex direction="column" align="center" gap="3" py="9">
          <Text style={{ color: "var(--text-secondary)" }} size="2">
            No sessions found
          </Text>
          <Text style={{ color: "var(--text-tertiary)" }} size="1">
            Start a Claude Code session to see it here
          </Text>
        </Flex>
      )}

      {/* Projects (hidden when searching) */}
      {!loading && !isSearching && sortedProjects.length > 0 && (
        <Flex direction="column" style={{ maxWidth: "100%" }}>
          {sortedProjects.map((project) => (
            <ProjectSection
              key={project.projectId}
              project={project}
              sessions={getProjectSessions(index.sessions, project.projectId)}
              liveSessions={liveSessionsByProject.get(project.projectId) || []}
              onSessionClick={handleSessionClick}
            />
          ))}
        </Flex>
      )}

      {/* Summary */}
      {!loading && !isSearching && index.projects.length > 0 && (
        <Flex justify="center" py="4">
          <Text size="1" style={{ color: "var(--text-tertiary)" }}>
            {index.projects.length} projects · {index.sessions.length} sessions
          </Text>
        </Flex>
      )}

      {/* Session Panel */}
      {selectedSession && (
        <SessionPanel
          session={{
            sessionId: selectedSession.sessionId,
            projectName: selectedSession.projectName,
            gitBranch: selectedSession.gitBranch,
            originalPrompt: selectedSession.originalPrompt,
            goal: selectedSession.goal,
            lastActivityAt: selectedSession.lastActivityAt,
            cwd: selectedSession.cwd,
            provider: selectedSession.provider,
          }}
          onClose={() => setSelectedSession(null)}
          resumeFlags={config.resumeFlags}
        />
      )}
    </Flex>
  );
}
