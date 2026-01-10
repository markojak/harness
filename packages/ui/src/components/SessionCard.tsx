import { Flex, Text, Box, HoverCard } from "@radix-ui/themes";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useBookmarksContext } from "../context/BookmarksContext";
import { ProviderBadge } from "./ProviderIcon";

// Customize oneDark for better contrast
const codeTheme = {
  ...oneDark,
  'comment': { ...oneDark['comment'], color: '#8b949e' },
  'prolog': { ...oneDark['prolog'], color: '#8b949e' },
  'doctype': { ...oneDark['doctype'], color: '#8b949e' },
  'cdata': { ...oneDark['cdata'], color: '#8b949e' },
};
import type { Session, CIStatus } from "../data/schema";

interface SessionCardProps {
  session: Session;
  disableHover?: boolean;
  onClick?: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  working: { label: "working", color: "var(--status-working)" },
  "needs-approval": { label: "approval", color: "var(--status-approval)" },
  waiting: { label: "waiting", color: "var(--status-waiting)" },
  idle: { label: "idle", color: "var(--status-idle)" },
};

const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

function getStatusKey(session: Session): string {
  // Check for time-based idle first
  const elapsed = Date.now() - new Date(session.lastActivityAt).getTime();
  if (elapsed > IDLE_TIMEOUT_MS) {
    return "idle";
  }
  
  if (session.status === "working") return "working";
  if (session.status === "waiting" && session.hasPendingToolUse) return "needs-approval";
  if (session.status === "waiting") return "waiting";
  return "idle";
}

function getCardClass(session: Session): string {
  const classes = ["session-card"];
  const statusKey = getStatusKey(session);
  if (statusKey === "working") classes.push("status-working");
  if (statusKey === "needs-approval") classes.push("status-needs-approval");
  return classes.join(" ");
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

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function formatTarget(target: string): string {
  if (target.includes("/")) {
    const parts = target.split("/");
    return parts[parts.length - 1];
  }
  if (target.length > 25) {
    return target.slice(0, 22) + "…";
  }
  return target;
}

function getRoleColor(role: "user" | "assistant" | "tool"): string {
  switch (role) {
    case "user": return "var(--accent-cyan)";
    case "assistant": return "var(--text-primary)";
    case "tool": return "var(--accent-purple)";
  }
}

function getCIStatusIcon(status: CIStatus): string {
  switch (status) {
    case "success": return "✓";
    case "failure": return "✗";
    case "running":
    case "pending": return "◎";
    case "cancelled": return "⊘";
    default: return "?";
  }
}

function getCIStatusColor(status: CIStatus): "green" | "red" | "yellow" | "gray" {
  switch (status) {
    case "success": return "green";
    case "failure": return "red";
    case "running":
    case "pending": return "yellow";
    default: return "gray";
  }
}

function shortenPath(cwd: string): string {
  // ~/workspace/foo/bar → foo/bar (keep last 2 segments)
  const path = cwd.replace(/^\/Users\/[^/]+/, "~");
  const parts = path.split("/");
  if (parts.length > 3) {
    return parts.slice(-2).join("/");
  }
  return path.replace("~/", "");
}

export function SessionCard({ session, disableHover, onClick }: SessionCardProps) {
  const { isBookmarked, toggleBookmark } = useBookmarksContext();
  const showPendingTool = session.hasPendingToolUse && session.pendingTool;
  const statusKey = getStatusKey(session);
  const status = STATUS_LABELS[statusKey];
  const shortPath = shortenPath(session.cwd);
  const bookmarked = isBookmarked(session.sessionId);

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleBookmark({
      sessionId: session.sessionId,
      projectId: session.gitRepoId || session.cwd,
      projectName: session.gitRepoId || session.cwd.split("/").pop(),
      originalPrompt: session.originalPrompt,
      goal: session.goal,
    });
  };

  return (
    <HoverCard.Root openDelay={600} open={disableHover ? false : undefined}>
      <HoverCard.Trigger>
        <Box 
          className={getCardClass(session)} 
          style={{ cursor: onClick ? "pointer" : "default" }}
          onClick={onClick}
        >
          {/* Top row: provider + status + path + time + bookmark */}
          <Flex justify="between" align="center" mb="2">
            <Flex align="center" gap="2">
              <ProviderBadge 
                provider={session.provider || "claude"} 
                waiting={statusKey === "waiting"}
                modelId={session.modelId}
                modelProvider={session.modelProvider}
              />
              <Text size="1" style={{ color: status.color, fontWeight: 500 }}>
                ● {status.label}
              </Text>
              <Text size="1" style={{ color: "var(--text-tertiary)" }}>
                {shortPath}
              </Text>
            </Flex>
            <Flex align="center" gap="2">
              <Text
                size="1"
                style={{
                  color: bookmarked ? "var(--accent-orange)" : "var(--text-tertiary)",
                  cursor: "pointer",
                  transition: "color 0.15s",
                }}
                onClick={handleBookmarkClick}
                title={bookmarked ? "Remove bookmark" : "Bookmark this session"}
              >
                {bookmarked ? "★" : "☆"}
              </Text>
              <Text size="1" style={{ color: "var(--text-tertiary)" }}>
                {formatTimeAgo(session.lastActivityAt)}
              </Text>
            </Flex>
          </Flex>

          {/* Goal/prompt - single line, truncated */}
          <Text
            size="2"
            weight="medium"
            style={{
              color: "var(--text-primary)",
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginBottom: "6px",
            }}
          >
            {session.goal || session.originalPrompt.slice(0, 60)}
          </Text>

          {/* Pending tool or summary */}
          {showPendingTool ? (
            <Flex align="center" gap="1" mb="2">
              <Text size="1" style={{ color: "var(--status-approval)" }}>
                → {session.pendingTool!.tool}:
              </Text>
              <Text size="1" style={{ color: "var(--text-secondary)" }}>
                {formatTarget(session.pendingTool!.target)}
              </Text>
            </Flex>
          ) : session.summary ? (
            <Text
              size="1"
              style={{
                color: "var(--text-secondary)",
                display: "block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginBottom: "6px",
              }}
            >
              {session.summary}
            </Text>
          ) : null}

          {/* Bottom row: branch/PR + msg count */}
          <Flex justify="between" align="center">
            <Flex align="center" gap="2">
              {session.pr ? (
                <a
                  href={session.pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ textDecoration: "none" }}
                >
                  <Text size="1" style={{ color: getCIStatusColor(session.pr.ciStatus) === "green" ? "var(--accent-green)" : getCIStatusColor(session.pr.ciStatus) === "red" ? "var(--accent-red)" : "var(--accent-orange)" }}>
                    {getCIStatusIcon(session.pr.ciStatus)} #{session.pr.number}
                  </Text>
                </a>
              ) : session.gitBranch ? (
                <Text size="1" style={{ color: "var(--accent-purple)" }}>
                  {session.gitBranch.length > 18
                    ? session.gitBranch.slice(0, 15) + "…"
                    : session.gitBranch}
                </Text>
              ) : null}
            </Flex>
            <Text size="1" style={{ color: "var(--text-tertiary)" }}>
              {session.messageCount} msgs
            </Text>
          </Flex>
        </Box>
      </HoverCard.Trigger>

      <HoverCard.Content
        size="2"
        side="right"
        sideOffset={8}
        collisionPadding={16}
        style={{
          width: 440,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100vh - 32px)",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-default)",
        }}
      >
        <Flex direction="column" gap="2" style={{ height: "100%" }}>
          {/* Header */}
          <Text size="2" weight="bold" style={{ color: "var(--text-primary)" }}>
            {session.goal || session.originalPrompt.slice(0, 60)}
          </Text>

          {/* Recent output */}
          <Box
            p="2"
            style={{
              backgroundColor: "var(--bg-surface)",
              borderRadius: "3px",
              border: "1px solid var(--border-subtle)",
              overflow: "auto",
              maxHeight: "300px",
              fontSize: "11px",
            }}
          >
            {session.recentOutput?.length > 0 ? (
              session.recentOutput.map((output, i) => (
                <Box key={i} style={{ color: getRoleColor(output.role) }} mb="2">
                  {output.role === "user" && (
                    <Text size="1" weight="medium" style={{ color: "var(--accent-cyan)" }}>
                      → 
                    </Text>
                  )}
                  <Markdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <Text as="p" size="1" mb="2">{children}</Text>,
                      code: ({ className, children }) => {
                        const match = /language-(\w+)/.exec(className || "");
                        const isBlock = Boolean(match);
                        return isBlock ? (
                          <SyntaxHighlighter
                            style={codeTheme}
                            language={match![1]}
                            PreTag="div"
                            customStyle={{
                              margin: "4px 0",
                              borderRadius: "2px",
                              fontSize: "10px",
                              padding: "8px",
                            }}
                          >
                            {String(children).replace(/\n$/, "")}
                          </SyntaxHighlighter>
                        ) : (
                          <code style={{
                            background: "var(--bg-hover)",
                            padding: "1px 4px",
                            borderRadius: "2px",
                            fontSize: "10px",
                          }}>
                            {children}
                          </code>
                        );
                      },
                      pre: ({ children }) => <Box mb="2">{children}</Box>,
                      ul: ({ children }) => <ul style={{ paddingLeft: "16px", margin: "4px 0" }}>{children}</ul>,
                      ol: ({ children }) => <ol style={{ paddingLeft: "16px", margin: "4px 0" }}>{children}</ol>,
                      li: ({ children }) => <li style={{ marginBottom: "2px", fontSize: "11px" }}>{children}</li>,
                      h1: ({ children }) => <Text size="2" weight="bold" mb="2">{children}</Text>,
                      h2: ({ children }) => <Text size="2" weight="bold" mb="2">{children}</Text>,
                      h3: ({ children }) => <Text size="1" weight="bold" mb="2">{children}</Text>,
                      blockquote: ({ children }) => (
                        <Box style={{ borderLeft: "2px solid var(--border-default)", paddingLeft: "8px", margin: "4px 0" }}>
                          {children}
                        </Box>
                      ),
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-cyan)" }}>
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {output.content}
                  </Markdown>
                </Box>
              ))
            ) : (
              <Text size="1" style={{ color: "var(--text-tertiary)" }}>
                No recent output
              </Text>
            )}
            {session.status === "working" && (
              <Text style={{ color: "var(--accent-green)" }}>█</Text>
            )}
          </Box>

          {/* PR Info */}
          {session.pr && (
            <Box>
              <a
                href={session.pr.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--accent-cyan)", fontSize: "11px" }}
              >
                PR #{session.pr.number}: {session.pr.title}
              </a>
              {session.pr.ciChecks.length > 0 && (
                <Flex gap="1" wrap="wrap" mt="1">
                  {session.pr.ciChecks.slice(0, 4).map((check) => (
                    <Text
                      key={check.name}
                      size="1"
                      style={{
                        color: getCIStatusColor(check.status) === "green" ? "var(--accent-green)" :
                               getCIStatusColor(check.status) === "red" ? "var(--accent-red)" :
                               "var(--accent-orange)",
                      }}
                    >
                      {getCIStatusIcon(check.status)} {check.name.slice(0, 15)}
                    </Text>
                  ))}
                </Flex>
              )}
            </Box>
          )}

          {/* Footer */}
          <Flex justify="between" pt="1" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <Text size="1" style={{ color: "var(--text-tertiary)" }}>
              {session.cwd.replace(/^\/Users\/\w+\//, "~/")}
            </Text>
            <Text size="1" style={{ color: "var(--text-tertiary)" }}>
              {session.sessionId.slice(0, 8)}
            </Text>
          </Flex>
        </Flex>
      </HoverCard.Content>
    </HoverCard.Root>
  );
}
