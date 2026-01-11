/**
 * Search results component - terminal-dense list of matching sessions
 */

import React from "react";
import { Flex, Text, Box } from "@radix-ui/themes";
import { useBookmarksContext } from "../context/BookmarksContext";
import { ProviderBadge, type Provider } from "./ProviderIcon";

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
  provider?: Provider;
  modelProvider?: string | null;
  modelId?: string | null;
}

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  onSessionClick?: (sessionId: string) => void;
}

function formatTimeAgo(isoString: string): string {
  if (!isoString) return "—";
  
  const now = Date.now();
  const then = new Date(isoString).getTime();
  
  if (isNaN(then)) return "—";
  
  const diff = now - then;
  if (diff < 0) return "—";

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (weeks > 0) return `${weeks}w`;
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return "now";
}

function highlightSnippet(snippet: string): React.ReactElement {
  // Split by ** markers and alternate between normal and highlighted
  const parts = snippet.split(/\*\*/);
  return (
    <>
      {parts.map((part, i) => (
        i % 2 === 0 ? (
          <span key={i}>{part}</span>
        ) : (
          <span key={i} style={{ color: "var(--accent-orange)", fontWeight: 500 }}>{part}</span>
        )
      ))}
    </>
  );
}

function SearchResultRow({ result, onClick }: { result: SearchResult; onClick?: () => void }) {
  const { isBookmarked, toggleBookmark } = useBookmarksContext();
  const bookmarked = isBookmarked(result.sessionId);

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleBookmark({
      sessionId: result.sessionId,
      projectId: result.projectId,
      projectName: result.projectName,
      originalPrompt: result.originalPrompt,
      goal: result.goal || undefined,
    });
  };

  return (
    <Box
      py="3"
      px="3"
      onClick={onClick}
      style={{
        borderBottom: "1px solid var(--border-subtle)",
        cursor: onClick ? "pointer" : "default",
        transition: "background 0.1s",
      }}
      className="search-result-row"
    >
      <Flex direction="column" gap="2">
        {/* Top row: Provider, Project, Time */}
        <Flex align="center" gap="3">
          <ProviderBadge 
            provider={result.provider || "claude"} 
            modelId={result.modelId}
            modelProvider={result.modelProvider}
          />
          <Text
            size="1"
            style={{
              color: "var(--accent-cyan)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {result.gitRepoId || result.projectName}
          </Text>
          {result.gitBranch && (
            <>
              <Text size="1" style={{ color: "var(--text-tertiary)" }}>·</Text>
              <Text
                size="1"
                style={{
                  color: "var(--accent-purple)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {result.gitBranch}
              </Text>
            </>
          )}
          <Text
            size="1"
            style={{
              color: "var(--text-tertiary)",
              marginLeft: "auto",
              flexShrink: 0,
            }}
          >
            {formatTimeAgo(result.lastActivityAt)}
          </Text>
          <Text
            size="1"
            style={{
              color: bookmarked ? "var(--accent-orange)" : "var(--text-tertiary)",
              cursor: "pointer",
              flexShrink: 0,
            }}
            onClick={handleBookmarkClick}
          >
            {bookmarked ? "★" : "☆"}
          </Text>
        </Flex>

        {/* Bottom row: Snippet */}
        <Text
          size="2"
          style={{
            color: "var(--text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            lineHeight: "1.4",
          }}
        >
          {highlightSnippet(result.snippet || result.goal || result.originalPrompt)}
        </Text>
      </Flex>
    </Box>
  );
}

export function SearchResults({ results, query, onSessionClick }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <Flex direction="column" align="center" py="9">
        <Text size="2" style={{ color: "var(--text-secondary)" }}>
          No results for "{query}"
        </Text>
        <Text size="1" style={{ color: "var(--text-tertiary)" }}>
          Try different keywords
        </Text>
      </Flex>
    );
  }

  return (
    <Box
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "3px",
      }}
    >
      {/* Header */}
      <Flex
        align="center"
        justify="between"
        px="3"
        py="2"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <Text size="1" style={{ color: "var(--text-tertiary)" }}>
          {results.length} result{results.length !== 1 ? "s" : ""} for "{query}"
        </Text>
      </Flex>

      {/* Results */}
      <Box style={{ maxHeight: "60vh", overflowY: "auto" }}>
        {results.map((result) => (
          <SearchResultRow 
            key={result.sessionId} 
            result={result} 
            onClick={() => onSessionClick?.(result.sessionId)}
          />
        ))}
      </Box>

      <style>{`
        .search-result-row:hover {
          background: var(--bg-hover);
        }
      `}</style>
    </Box>
  );
}
