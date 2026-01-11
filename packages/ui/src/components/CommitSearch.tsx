/**
 * CommitSearch - Find which Claude session created a commit
 * 
 * Flow:
 * 1. User types commit hash
 * 2. Live lookup finds which repo contains it
 * 3. On enter, fetch full commit details + matching sessions
 * 4. Show results with file matches
 */

import { useState, useEffect, useCallback } from "react";
import { Flex, Text, Box, ScrollArea } from "@radix-ui/themes";
import { ProviderBadge, type Provider } from "./ProviderIcon";

const SPINNER_FRAMES = ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"];

function useSpinner() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return SPINNER_FRAMES[frame];
}

interface CommitInfo {
  hash: string;
  repo: string;
  repoPath: string;
  message: string;
  author: string;
  date: string;
  files: string[];
}

interface SessionMatch {
  sessionId: string;
  projectName: string;
  score: number;
  matchedFiles: string[];
  filepath: string;
  provider?: "claude" | "codex" | "opencode";
}

interface CommitResult {
  commit: CommitInfo | null;
  sessions: SessionMatch[];
  error?: string;
}

interface CommitSearchProps {
  onSessionClick: (sessionId: string) => void;
}

export function CommitSearch({ onSessionClick }: CommitSearchProps) {
  const [hash, setHash] = useState("");
  const [repoHint, setRepoHint] = useState<string | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const spinner = useSpinner();

  // Live repo lookup as user types
  useEffect(() => {
    if (hash.length < 4) {
      setRepoHint(null);
      return;
    }

    // Debounce the lookup
    const timeout = setTimeout(async () => {
      setLookingUp(true);
      try {
        const res = await fetch(`/commit-repo/${hash}`);
        if (res.ok) {
          const data = await res.json();
          setRepoHint(data.repo);
        }
      } catch {
        setRepoHint(null);
      }
      setLookingUp(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [hash]);

  // Full commit search
  const searchCommit = useCallback(async () => {
    if (hash.length < 7) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`/commit/${hash}`);
      if (res.ok) {
        setResult(await res.json());
      } else {
        setResult({ commit: null, sessions: [], error: "Failed to search" });
      }
    } catch (err) {
      setResult({ commit: null, sessions: [], error: String(err) });
    }

    setLoading(false);
  }, [hash]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      searchCommit();
    }
  };

  const formatDate = (isoDate: string) => {
    try {
      return new Date(isoDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return isoDate;
    }
  };

  return (
    <Flex direction="column" gap="3">
      {/* Search input with repo hint - full width */}
      <Box style={{ position: "relative", width: "100%" }}>
        <input
          type="text"
          placeholder="Enter commit hash (e.g., abc123f)..."
          value={hash}
          onChange={(e) => setHash(e.target.value.toLowerCase())}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{
            width: "100%",
            padding: "8px 12px",
            paddingRight: repoHint ? "120px" : "12px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "3px",
            color: "var(--text-primary)",
            fontSize: "13px",
            fontFamily: "inherit",
            outline: "none",
          }}
        />
        {(repoHint || lookingUp) && (
          <Flex
            align="center"
            gap="1"
            style={{
              position: "absolute",
              right: "10px",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            {lookingUp ? (
              <Text size="1" style={{ color: "var(--text-tertiary)" }}>
                ⣾
              </Text>
            ) : repoHint ? (
              <>
                <Text size="1" style={{ color: "var(--text-tertiary)" }}>
                  📁
                </Text>
                <Text size="1" style={{ color: "var(--accent-cyan)" }}>
                  {repoHint}
                </Text>
              </>
            ) : null}
          </Flex>
        )}
      </Box>

      {/* Loading */}
      {loading && (
        <Flex align="center" justify="center" py="6">
          <Text size="2" style={{ color: "var(--text-tertiary)" }}>
            <Text style={{ color: "var(--accent-cyan)" }}>{spinner}</Text> Searching for sessions...
          </Text>
        </Flex>
      )}

      {/* Results */}
      {result && !loading && (
        <Box>
          {/* Error */}
          {result.error && (
            <Box p="3" style={{ background: "var(--bg-surface)", borderRadius: "3px" }}>
              <Text size="2" style={{ color: "var(--accent-red)" }}>
                {result.error}
              </Text>
            </Box>
          )}

          {/* Commit info */}
          {result.commit && (
            <Box
              p="3"
              mb="3"
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "3px",
              }}
            >
              <Flex direction="column" gap="2">
                <Flex align="center" gap="2">
                  <Text
                    size="1"
                    style={{
                      color: "var(--accent-cyan)",
                      fontFamily: "monospace",
                    }}
                  >
                    {result.commit.hash.slice(0, 8)}
                  </Text>
                  <Text size="1" style={{ color: "var(--text-tertiary)" }}>
                    in
                  </Text>
                  <Text size="1" style={{ color: "var(--accent-purple)" }}>
                    {result.commit.repo}
                  </Text>
                </Flex>
                <Text size="2" style={{ color: "var(--text-primary)" }}>
                  {result.commit.message}
                </Text>
                <Flex align="center" gap="2">
                  <Text size="1" style={{ color: "var(--text-tertiary)" }}>
                    {result.commit.author} · {formatDate(result.commit.date)}
                  </Text>
                </Flex>
                <Flex wrap="wrap" gap="1" mt="1">
                  {result.commit.files.slice(0, 10).map((file) => (
                    <Text
                      key={file}
                      size="1"
                      style={{
                        color: "var(--text-secondary)",
                        background: "var(--bg-elevated)",
                        padding: "2px 6px",
                        borderRadius: "2px",
                      }}
                    >
                      {file.split("/").pop()}
                    </Text>
                  ))}
                  {result.commit.files.length > 10 && (
                    <Text size="1" style={{ color: "var(--text-tertiary)" }}>
                      +{result.commit.files.length - 10} more
                    </Text>
                  )}
                </Flex>
              </Flex>
            </Box>
          )}

          {/* Matching sessions */}
          {result.sessions.length > 0 ? (
            <Flex direction="column" gap="2">
              <Text size="1" style={{ color: "var(--text-tertiary)" }}>
                {result.sessions.length} session
                {result.sessions.length !== 1 ? "s" : ""} may have created this
                commit
              </Text>
              <ScrollArea style={{ maxHeight: "220px" }}>
                <Flex direction="column" gap="1">
                  {result.sessions.map((session) => (
                    <Box
                      key={session.sessionId}
                      p="2"
                      style={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "3px",
                        cursor: "pointer",
                      }}
                      onClick={() => onSessionClick(session.sessionId)}
                    >
                      <Flex direction="column" gap="1">
                        <Flex align="center" justify="between">
                          <Flex align="center" gap="2">
                            <ProviderBadge provider={(session.provider || "claude") as Provider} />
                            <Text
                              size="1"
                              style={{
                                color: "var(--accent-cyan)",
                                fontFamily: "monospace",
                              }}
                            >
                              {session.sessionId.slice(0, 8)}
                            </Text>
                            <Text
                              size="1"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {session.projectName}
                            </Text>
                          </Flex>
                          <Text
                            size="1"
                            style={{
                              color:
                                session.score > 0.5
                                  ? "var(--accent-green)"
                                  : session.score > 0.2
                                  ? "var(--accent-yellow)"
                                  : "var(--text-tertiary)",
                            }}
                          >
                            {Math.round(session.score * 100)}% match
                          </Text>
                        </Flex>
                        <Flex wrap="wrap" gap="1">
                          {session.matchedFiles.slice(0, 5).map((file) => (
                            <Text
                              key={file}
                              size="1"
                              style={{
                                color: "var(--accent-green)",
                                fontSize: "10px",
                              }}
                            >
                              ✓ {file.split("/").pop()}
                            </Text>
                          ))}
                        </Flex>
                      </Flex>
                    </Box>
                  ))}
                </Flex>
              </ScrollArea>
            </Flex>
          ) : result.commit ? (
            <Box p="3" style={{ background: "var(--bg-surface)", borderRadius: "3px" }}>
              <Text size="2" style={{ color: "var(--text-tertiary)" }}>
                No matching Claude sessions found for this commit.
              </Text>
              <Text size="1" style={{ color: "var(--text-muted)", marginTop: "4px" }}>
                This commit may have been made manually or by a different tool.
              </Text>
            </Box>
          ) : null}
        </Box>
      )}

      {/* Help text */}
      {!result && !loading && (
        <Text size="1" style={{ color: "var(--text-tertiary)" }}>
          Enter a git commit hash to find which Claude session created it.
          Press Enter to search.
        </Text>
      )}
    </Flex>
  );
}
