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
  } | null;
  onClose: () => void;
  resumeFlags: string;
}

interface SessionData {
  summaries: Array<{ summary: string; timestamp: string }>;
  files: Array<{ path: string; action: "created" | "modified" | "deleted" }>;
  events: Array<{
    type: "user" | "assistant" | "tool";
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

function SummaryAccordion({ summary, timestamp, index }: { summary: string; timestamp: string; index: number }) {
  const [expanded, setExpanded] = useState(index === 0); // First one expanded by default
  const preview = summary.slice(0, 150) + (summary.length > 150 ? "..." : "");

  return (
    <Box
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "3px",
        overflow: "hidden",
      }}
    >
      <Flex
        justify="between"
        align="center"
        p="3"
        style={{ cursor: "pointer" }}
        onClick={() => setExpanded(!expanded)}
      >
        <Flex align="center" gap="2">
          <Text size="1" style={{ color: "var(--text-tertiary)" }}>
            {expanded ? "▾" : "▸"}
          </Text>
          <Text size="1" style={{ color: "var(--text-tertiary)" }}>
            {formatTime(timestamp)}
          </Text>
          {!expanded && (
            <Text size="1" style={{ color: "var(--text-secondary)" }}>
              {preview}
            </Text>
          )}
        </Flex>
        <CopyButton text={summary} />
      </Flex>
      {expanded && (
        <Box px="3" pb="3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <Text size="2" style={{ color: "var(--text-primary)", whiteSpace: "pre-wrap" }}>
            {summary}
          </Text>
        </Box>
      )}
    </Box>
  );
}

function SummaryTab({ summaries, loading }: { summaries: SessionData["summaries"]; loading: boolean }) {
  if (loading) {
    return (
      <Flex align="center" justify="center" py="9">
        <Spinner /> <Text size="1" style={{ marginLeft: "8px", color: "var(--text-tertiary)" }}>Loading summaries...</Text>
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
        {summaries.map((s, i) => (
          <SummaryAccordion key={i} summary={s.summary} timestamp={s.timestamp} index={i} />
        ))}
      </Flex>
    </ScrollArea>
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
                py="1"
                px="2"
                style={{
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <Flex gap="2" align="start">
                  <Text size="1" style={{ color: "var(--text-tertiary)", minWidth: "40px" }}>
                    {formatTime(event.timestamp)}
                  </Text>
                  <Text
                    size="1"
                    style={{
                      color: event.type === "user"
                        ? "var(--accent-cyan)"
                        : event.type === "tool"
                        ? "var(--accent-purple)"
                        : "var(--text-secondary)",
                      minWidth: "50px",
                    }}
                  >
                    {event.type === "tool" ? event.toolName : event.type}
                  </Text>
                  <Text
                    size="1"
                    style={{
                      color: "var(--text-primary)",
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {event.target || event.content.slice(0, 100)}
                  </Text>
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
  const [activeTab, setActiveTab] = useState<"summary" | "transcript" | "files">("summary");
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
    fetch(`http://127.0.0.1:4451/session/${session.sessionId}`)
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

  const resumeCommand = `claude --resume ${session.sessionId}${resumeFlags ? ` ${resumeFlags}` : ""}`;

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
      
      {/* Panel */}
      <Box
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "450px",
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
          gap="2"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <Flex justify="between" align="center">
            <Text size="2" weight="medium" style={{ color: "var(--text-primary)" }}>
              {session.goal || session.originalPrompt?.slice(0, 40) || "Session"}
            </Text>
            <Text
              size="1"
              style={{ color: "var(--text-tertiary)", cursor: "pointer" }}
              onClick={onClose}
            >
              ✕
            </Text>
          </Flex>
          
          <Flex align="center" gap="2">
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
          {(["summary", "transcript", "files"] as const).map((tab) => (
            <Box
              key={tab}
              px="2"
              py="1"
              style={{
                color: activeTab === tab ? "var(--text-primary)" : "var(--text-tertiary)",
                background: activeTab === tab ? "var(--bg-elevated)" : "transparent",
                borderRadius: "2px",
                cursor: "pointer",
                textTransform: "capitalize",
                fontSize: "12px",
              }}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </Box>
          ))}
        </Flex>

        {/* Tab content - full height, each tab handles its own scrolling */}
        <Box style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {activeTab === "summary" && (
            <SummaryTab summaries={sessionData.summaries} loading={loading} />
          )}
          {activeTab === "transcript" && (
            <TranscriptTab
              events={sessionData.events}
              loading={loading}
              searchQuery={transcriptSearch}
              setSearchQuery={setTranscriptSearch}
            />
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
