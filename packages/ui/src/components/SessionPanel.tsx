/**
 * Session detail panel - slide-out sidecar with Summary, Transcript, Files tabs
 */

import { useState, useEffect } from "react";
import { Flex, Text, Box, ScrollArea } from "@radix-ui/themes";

interface SessionPanelProps {
  session: {
    sessionId: string;
    projectName: string;
    gitBranch: string | null;
    originalPrompt: string;
    goal: string | null;
    lastActivityAt: string;
    cwd: string;
    provider?: "claude" | "codex" | "opencode";
  } | null;
  onClose: () => void;
  resumeFlags: string;
}

interface SessionData {
  summaries: Array<{ summary: string; timestamp: string }>;
  files: Array<{ path: string; action: "created" | "modified" | "deleted" }>;
  events: Array<{
    type: "user" | "assistant" | "tool" | "thinking";
    timestamp: string;
    content: string;
    toolName?: string;
    target?: string;
  }>;
}

const SPINNER_FRAMES = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];

function Spinner() {
  const [frame, setFrame] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(interval);
  }, []);
  
  return <span style={{ color: "var(--accent-cyan)" }}>{SPINNER_FRAMES[frame]}</span>;
}

function formatTime(isoString: string): string {
  if (!isoString) return "—";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

function formatTimeAgo(isoString: string): string {
  if (!isoString) return "—";
  const now = Date.now();
  const then = new Date(isoString).getTime();
  if (isNaN(then)) return "—";
  const diff = now - then;
  if (diff < 0) return "—";
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Text
      size="1"
      style={{
        color: copied ? "var(--accent-green)" : "var(--text-tertiary)",
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={handleCopy}
    >
      {copied ? "✓" : label || "⎘"}
    </Text>
  );
}

function CompactionTab({ summaries, loading, provider }: { summaries: SessionData["summaries"]; loading: boolean; provider?: string }) {
  // Check if provider supports compactions (currently only Claude)
  const supportsCompaction = !provider || provider === "claude";
  
  if (!supportsCompaction) {
    return (
      <Flex align="center" justify="center" py="9">
        <Text size="1" style={{ color: "var(--text-tertiary)" }}>
          Compactions not available for {provider} sessions
        </Text>
      </Flex>
    );
  }

  if (loading) {
    return (
      <Flex align="center" justify="center" py="9">
        <Spinner /> <Text size="1" style={{ marginLeft: "8px", color: "var(--text-tertiary)" }}>Loading compactions...</Text>
      </Flex>
    );
  }

  if (summaries.length === 0) {
    return (
      <Flex align="center" justify="center" py="9">
        <Text size="1" style={{ color: "var(--text-tertiary)" }}>No compaction summaries yet</Text>
      </Flex>
    );
  }

  return (
    <ScrollArea style={{ height: "100%" }}>
      <Flex direction="column" gap="2" p="3">
        <Text size="1" style={{ color: "var(--text-tertiary)", marginBottom: "8px" }}>
          {summaries.length} context snapshot{summaries.length !== 1 ? "s" : ""} (compactions)
        </Text>
        {summaries.map((s, i) => (
          <Box
            key={i}
            p="2"
            style={{
              background: "var(--bg-base)",
              borderRadius: "3px",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <Text size="2" style={{ color: "var(--text-primary)", lineHeight: "1.5" }}>
              {s.summary}
            </Text>
            {s.timestamp && (
              <Text size="1" style={{ color: "var(--text-tertiary)", marginTop: "4px", display: "block" }}>
                {new Date(s.timestamp).toLocaleTimeString()}
              </Text>
            )}
          </Box>
        ))}
      </Flex>
    </ScrollArea>
  );
}

function ThinkingBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <Box
      onClick={() => setExpanded(!expanded)}
      style={{ cursor: "pointer" }}
    >
      <Flex gap="1" align="center">
        <Text size="2" style={{ color: "var(--accent-orange, #f97316)", fontSize: "14px" }}>
          {expanded ? "▾" : "▸"}
        </Text>
        <Text
          size="2"
          style={{
            color: "var(--text-primary)",
            flex: 1,
            overflow: expanded ? "visible" : "hidden",
            textOverflow: expanded ? "clip" : "ellipsis",
            whiteSpace: expanded ? "pre-wrap" : "nowrap",
            lineHeight: "1.5",
            fontSize: "14px",
          }}
        >
          {expanded ? content : content.slice(0, 80) + (content.length > 80 ? "..." : "")}
        </Text>
      </Flex>
    </Box>
  );
}

function TranscriptTab({ events, loading, searchQuery, setSearchQuery }: {
  events: SessionData["events"];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}) {
  const filtered = searchQuery
    ? events.filter(e => 
        e.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.toolName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.target?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : events;

  return (
    <Flex direction="column" style={{ height: "100%" }}>
      <Box p="2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <input
          type="text"
          placeholder="Search in transcript..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "6px 10px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "2px",
            color: "var(--text-primary)",
            fontSize: "12px",
            fontFamily: "inherit",
            outline: "none",
          }}
        />
      </Box>
      
      {loading ? (
        <Flex align="center" justify="center" py="9">
          <Spinner /> <Text size="1" style={{ marginLeft: "8px", color: "var(--text-tertiary)" }}>Loading transcript...</Text>
        </Flex>
      ) : (
        <ScrollArea style={{ flex: 1 }}>
          <Flex direction="column" p="2">
            {filtered.map((event, i) => (
              <Box
                key={i}
                py="2"
                px="2"
                style={{
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <Flex gap="2" align="start">
                  <Text size="2" style={{ color: "var(--text-tertiary)", minWidth: "45px", lineHeight: "1.5", fontSize: "14px" }}>
                    {formatTime(event.timestamp)}
                  </Text>
                  <Text
                    size="2"
                    style={{
                      color: event.type === "user"
                        ? "var(--accent-cyan)"
                        : event.type === "tool"
                        ? "var(--accent-purple)"
                        : event.type === "thinking"
                        ? "var(--accent-orange, #f97316)"
                        : "var(--text-secondary)",
                      minWidth: "55px",
                      lineHeight: "1.5",
                      fontSize: "14px",
                    }}
                  >
                    {event.type === "tool" ? event.toolName : event.type}
                  </Text>
                  {event.type === "thinking" ? (
                    <ThinkingBlock content={event.content} />
                  ) : (
                    <Text
                      size="2"
                      style={{
                        color: "var(--text-primary)",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        lineHeight: "1.5",
                        fontSize: "14px",
                      }}
                    >
                      {event.target || event.content.slice(0, 100)}
                    </Text>
                  )}
                </Flex>
              </Box>
            ))}
            {filtered.length === 0 && (
              <Text size="1" style={{ color: "var(--text-tertiary)", padding: "16px", textAlign: "center" }}>
                {searchQuery ? "No matches" : "No events"}
              </Text>
            )}
          </Flex>
        </ScrollArea>
      )}
    </Flex>
  );
}

function FilesTab({ files, loading }: { files: SessionData["files"]; loading: boolean }) {
  if (loading) {
    return (
      <Flex align="center" justify="center" py="9" style={{ flex: 1 }}>
        <Spinner /> <Text size="1" style={{ marginLeft: "8px", color: "var(--text-tertiary)" }}>Loading files...</Text>
      </Flex>
    );
  }

  if (files.length === 0) {
    return (
      <Flex align="center" justify="center" py="9" style={{ flex: 1 }}>
        <Text size="1" style={{ color: "var(--text-tertiary)" }}>No files modified</Text>
      </Flex>
    );
  }

  return (
    <ScrollArea style={{ flex: 1 }}>
      <Flex direction="column" p="3">
        <Text size="1" mb="2" style={{ color: "var(--text-tertiary)" }}>
          {files.length} file{files.length !== 1 ? "s" : ""} modified
        </Text>
        {files.map((file, i) => (
          <Flex
            key={i}
            align="center"
            gap="2"
            py="1"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}
          >
            <Text
              size="1"
              style={{
                color: file.action === "created"
                  ? "var(--accent-green)"
                  : file.action === "deleted"
                  ? "var(--accent-red)"
                  : "var(--accent-orange)",
                minWidth: "12px",
              }}
            >
              {file.action === "created" ? "+" : file.action === "deleted" ? "-" : "~"}
            </Text>
            <Text size="1" style={{ color: "var(--text-primary)", flex: 1 }}>
              {file.path}
            </Text>
            <Text size="1" style={{ color: "var(--text-tertiary)" }}>
              {file.action}
            </Text>
          </Flex>
        ))}
      </Flex>
    </ScrollArea>
  );
}

export function SessionPanel({ session, onClose, resumeFlags }: SessionPanelProps) {
  const [activeTab, setActiveTab] = useState<"transcript" | "compaction" | "files">("transcript");
  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<SessionData>({
    summaries: [],
    files: [],
    events: [],
  });
  const [transcriptSearch, setTranscriptSearch] = useState("");

  // Fetch session data
  useEffect(() => {
    if (!session) return;

    setLoading(true);
    fetch(`/session/${session.sessionId}`)
      .then(res => res.json())
      .then(data => {
        setSessionData(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [session?.sessionId]);

  if (!session) return null;

  // Provider-aware resume command
  const getResumeCommand = () => {
    const provider = session.provider || "claude";
    switch (provider) {
      case "codex":
        return `codex --resume ${session.sessionId}`;
      case "opencode":
        return `opencode resume ${session.sessionId}`;
      case "claude":
      default:
        return `claude --resume ${session.sessionId}${resumeFlags ? ` ${resumeFlags}` : ""}`;
    }
  };
  const resumeCommand = getResumeCommand();

  return (
    <>
      {/* Backdrop */}
      <Box
        onClick={onClose}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          zIndex: 100,
        }}
      />
      
      {/* Panel - 50% width on desktop, 90% on mobile */}
      <Box
        className="session-panel"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "50vw",
          minWidth: "400px",
          maxWidth: "90vw",
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border-default)",
          zIndex: 101,
          display: "flex",
          flexDirection: "column",
          animation: "slideIn 0.2s ease-out",
        }}
      >
        {/* Header */}
        <Flex
          direction="column"
          p="3"
          gap="4"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          {/* Close button */}
          <Flex justify="end">
            <Text
              size="1"
              style={{ color: "var(--text-tertiary)", cursor: "pointer" }}
              onClick={onClose}
            >
              ✕
            </Text>
          </Flex>
          
          {/* Title */}
          <Text 
            size="3" 
            weight="medium" 
            style={{ 
              color: "var(--text-primary)",
              lineHeight: "1.4",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
            title={session.goal || session.originalPrompt || "Session"}
          >
            {session.goal || session.originalPrompt?.slice(0, 150) || "Session"}
          </Text>
          
          {/* Project info */}
          <Flex align="center" gap="2" style={{ flexWrap: "wrap" }}>
            <Text size="1" style={{ color: "var(--accent-cyan)" }}>
              {session.projectName}
            </Text>
            {session.gitBranch && (
              <>
                <Text size="1" style={{ color: "var(--text-tertiary)" }}>·</Text>
                <Text size="1" style={{ color: "var(--accent-purple)" }}>
                  {session.gitBranch}
                </Text>
              </>
            )}
            <Text size="1" style={{ color: "var(--text-tertiary)" }}>·</Text>
            <Text size="1" style={{ color: "var(--text-tertiary)" }}>
              {formatTimeAgo(session.lastActivityAt)}
            </Text>
          </Flex>
          
          {/* Resume command */}
          <Flex
            className="resume-command"
            align="center"
            justify="between"
            p="2"
            style={{
              background: "var(--bg-base)",
              borderRadius: "3px",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <Text size="1" style={{ color: "var(--text-secondary)", fontFamily: "monospace" }}>
              {resumeCommand}
            </Text>
            <CopyButton text={resumeCommand} label="copy" />
          </Flex>
        </Flex>

        {/* Tabs */}
        <Flex
          gap="1"
          px="3"
          py="2"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          {([
            { id: "transcript", label: "Transcript" },
            { id: "compaction", label: "Compactions" },
            { id: "files", label: "Files" },
          ] as const).map(({ id, label }) => (
            <Box
              key={id}
              px="2"
              py="1"
              style={{
                color: activeTab === id ? "var(--text-primary)" : "var(--text-tertiary)",
                background: activeTab === id ? "var(--bg-elevated)" : "transparent",
                borderRadius: "2px",
                cursor: "pointer",
                fontSize: "12px",
              }}
              onClick={() => setActiveTab(id)}
            >
              {label}
            </Box>
          ))}
        </Flex>

        {/* Tab content - full height, each tab handles its own scrolling */}
        <Box style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {activeTab === "transcript" && (
            <TranscriptTab
              events={sessionData.events}
              loading={loading}
              searchQuery={transcriptSearch}
              setSearchQuery={setTranscriptSearch}
            />
          )}
          {activeTab === "compaction" && (
            <CompactionTab summaries={sessionData.summaries} loading={loading} provider={session.provider} />
          )}
          {activeTab === "files" && (
            <FilesTab files={sessionData.files} loading={loading} />
          )}
        </Box>
      </Box>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}
