/**
 * Project section - handles both active (Kanban) and dormant (session list) views
 */

import { useState } from "react";
import { Box, Flex, Text } from "@radix-ui/themes";
import { KanbanColumn } from "./KanbanColumn";
import { SessionCard } from "./SessionCard";
import type { IndexedProject, IndexedSession } from "../hooks/useIndex";
import type { Session, SessionStatus } from "../data/schema";

interface ProjectSectionProps {
  project: IndexedProject;
  sessions: IndexedSession[];
  liveSessions: Session[]; // Real-time sessions from watcher
  onSessionClick?: (session: IndexedSession) => void;
}

const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get effective status - sessions inactive for 1 hour are considered idle
 */
function getEffectiveStatus(session: Session): SessionStatus {
  const elapsed = Date.now() - new Date(session.lastActivityAt).getTime();
  if (elapsed > IDLE_TIMEOUT_MS) {
    return "idle";
  }
  return session.status;
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

  if (weeks > 0) return `${weeks}w ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

/**
 * Convert IndexedSession to Session format for SessionCard
 */
function toSessionCardFormat(indexed: IndexedSession): Session {
  return {
    sessionId: indexed.sessionId,
    provider: indexed.provider || "claude",
    cwd: indexed.cwd,
    gitBranch: indexed.gitBranch || null,
    originalPrompt: indexed.originalPrompt,
    goal: indexed.goal ?? "",
    lastActivityAt: indexed.lastActivityAt,
    status: indexed.isActive ? "working" : "idle",
    messageCount: indexed.messageCount,
    hasPendingToolUse: false,
    pendingTool: null,
    summary: indexed.goal ?? "",
    recentOutput: [],
    gitRepoId: indexed.gitRepoId ?? null,
    gitRepoUrl: indexed.gitRepoUrl ?? null,
    pr: null,
  };
}

export function ProjectSection({ project, sessions, liveSessions, onSessionClick }: ProjectSectionProps) {
  const [expanded, setExpanded] = useState(project.isActive || sessions.length <= 5);
  
  const isActive = project.isActive || liveSessions.length > 0;
  
  // For active projects, use live sessions for Kanban
  // For dormant, show indexed sessions as cards
  
  if (isActive && liveSessions.length > 0) {
    // Active project - show Kanban (apply effective status with 1hr idle timeout)
    const working = liveSessions.filter(s => getEffectiveStatus(s) === "working");
    const needsApproval = liveSessions.filter(s => getEffectiveStatus(s) === "waiting" && s.hasPendingToolUse);
    const waiting = liveSessions.filter(s => getEffectiveStatus(s) === "waiting" && !s.hasPendingToolUse);
    const idle = liveSessions.filter(s => getEffectiveStatus(s) === "idle");

    return (
      <Box mb="4" pb="4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        {/* Header */}
        <Flex align="center" gap="2" mb="3">
          <Text
            size="1"
            style={{ color: "var(--accent-green)", cursor: "pointer" }}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "▾" : "▸"}
          </Text>
          {project.gitRepoUrl ? (
            <a
              href={project.gitRepoUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--accent-cyan)",
                textDecoration: "none",
                fontSize: "13px",
                fontWeight: 500,
              }}
            >
              {project.projectName}
            </a>
          ) : (
            <Text size="2" weight="medium" style={{ color: "var(--text-primary)" }}>
              {project.projectName}
            </Text>
          )}
          <Flex align="center" gap="1">
            <Text size="1" style={{ color: "var(--status-working)" }}>●</Text>
            <Text size="1" style={{ color: "var(--text-secondary)" }}>
              {liveSessions.length} active
            </Text>
          </Flex>
        </Flex>

        {/* Kanban */}
        {expanded && (
          <Flex gap="2" style={{ minHeight: 160 }}>
            <KanbanColumn 
              title="Working" 
              status="working" 
              sessions={working} 
              color="green"
              onSessionClick={(s) => {
                // Find matching indexed session and call handler
                const indexed = sessions.find(is => is.sessionId === s.sessionId);
                if (indexed && onSessionClick) onSessionClick(indexed);
              }}
            />
            <KanbanColumn 
              title="Approval" 
              status="needs-approval" 
              sessions={needsApproval} 
              color="orange"
              onSessionClick={(s) => {
                const indexed = sessions.find(is => is.sessionId === s.sessionId);
                if (indexed && onSessionClick) onSessionClick(indexed);
              }}
            />
            <KanbanColumn 
              title="Waiting" 
              status="waiting" 
              sessions={waiting} 
              color="yellow"
              onSessionClick={(s) => {
                const indexed = sessions.find(is => is.sessionId === s.sessionId);
                if (indexed && onSessionClick) onSessionClick(indexed);
              }}
            />
            <KanbanColumn 
              title="Idle" 
              status="idle" 
              sessions={idle} 
              color="gray"
              onSessionClick={(s) => {
                const indexed = sessions.find(is => is.sessionId === s.sessionId);
                if (indexed && onSessionClick) onSessionClick(indexed);
              }}
            />
          </Flex>
        )}
      </Box>
    );
  }

  // Dormant project - show session cards
  const displaySessions = expanded ? sessions : sessions.slice(0, 3);

  return (
    <Box mb="4" pb="4" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      {/* Header */}
      <Flex
        align="center"
        gap="2"
        mb={expanded ? "3" : "0"}
        style={{ cursor: "pointer" }}
        onClick={() => setExpanded(!expanded)}
      >
        <Text size="1" style={{ color: "var(--text-tertiary)" }}>
          {expanded ? "▾" : "▸"}
        </Text>
        {project.gitRepoUrl ? (
          <a
            href={project.gitRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              color: "var(--accent-cyan)",
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            {project.projectName}
          </a>
        ) : (
          <Text size="2" weight="medium" style={{ color: "var(--text-primary)" }}>
            {project.projectName}
          </Text>
        )}
        <Text size="1" style={{ color: "var(--text-tertiary)" }}>
          {project.sessionCount} session{project.sessionCount !== 1 ? "s" : ""}
        </Text>
        <Text size="1" style={{ color: "var(--text-tertiary)" }}>
          · {formatTimeAgo(project.lastActivityAt)}
        </Text>
      </Flex>

      {/* Session cards */}
      {expanded && (
        <Flex direction="column" gap="2" mt="2">
          {displaySessions.map((session) => (
            <Box
              key={session.sessionId}
              onClick={() => onSessionClick?.(session)}
              style={{ cursor: onSessionClick ? "pointer" : "default" }}
            >
              <SessionCard
                session={toSessionCardFormat(session)}
                disableHover={false}
              />
            </Box>
          ))}
          {sessions.length > displaySessions.length && (
            <Text
              size="1"
              style={{
                color: "var(--text-tertiary)",
                cursor: "pointer",
                padding: "8px",
                textAlign: "center",
              }}
              onClick={() => setExpanded(true)}
            >
              +{sessions.length - displaySessions.length} more sessions
            </Text>
          )}
        </Flex>
      )}
    </Box>
  );
}
