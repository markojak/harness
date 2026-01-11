/**
 * Project section - handles both active (Kanban) and dormant (session list) views
 */

import { useState, useMemo, useEffect } from "react";
import { Box, Flex, Text } from "@radix-ui/themes";
import { KanbanColumn } from "./KanbanColumn";
import { SessionCard } from "./SessionCard";
import type { IndexedProject, IndexedSession } from "../hooks/useIndex";
import type { Session, SessionStatus } from "../data/schema";

// Structure for grouping sessions with their sub-agents
interface SessionGroup {
  session: IndexedSession;
  agents: IndexedSession[];
}

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
    isAgent: indexed.isAgent,
    parentSessionId: indexed.parentSessionId,
  };
}

/**
 * Group sessions with their sub-agents
 */
function groupSessionsWithAgents(sessions: IndexedSession[]): SessionGroup[] {
  // Separate parent sessions and agent sessions
  const parentSessions = sessions.filter(s => !s.isAgent);
  const agentSessions = sessions.filter(s => s.isAgent === true);
  
  // Create a map of parent ID to agents
  const agentsByParent = new Map<string, IndexedSession[]>();
  for (const agent of agentSessions) {
    if (agent.parentSessionId) {
      const agents = agentsByParent.get(agent.parentSessionId) || [];
      agents.push(agent);
      agentsByParent.set(agent.parentSessionId, agents);
    }
  }
  
  // Build groups
  const groups: SessionGroup[] = parentSessions.map(session => ({
    session,
    agents: agentsByParent.get(session.sessionId) || [],
  }));
  
  // Add orphaned agents (no parent found in this project) as standalone
  const assignedAgentIds = new Set<string>();
  for (const agents of agentsByParent.values()) {
    for (const agent of agents) {
      assignedAgentIds.add(agent.sessionId);
    }
  }
  const orphanedAgents = agentSessions.filter(a => !assignedAgentIds.has(a.sessionId));
  for (const agent of orphanedAgents) {
    groups.push({ session: agent, agents: [] });
  }
  
  return groups;
}

/**
 * Session card with expandable sub-agents
 */
function SessionWithAgents({ 
  group, 
  onSessionClick 
}: { 
  group: SessionGroup; 
  onSessionClick?: (session: IndexedSession) => void;
}) {
  const [agentsExpanded, setAgentsExpanded] = useState(false);
  const hasAgents = group.agents.length > 0;
  
  return (
    <Box>
      {/* Main session card with agent toggle */}
      <Box style={{ position: "relative" }}>
        <Box
          onClick={() => onSessionClick?.(group.session)}
          style={{ cursor: onSessionClick ? "pointer" : "default" }}
        >
          <SessionCard
            session={toSessionCardFormat(group.session)}
            disableHover={true}
          />
        </Box>
        
        {/* Agent expand toggle */}
        {hasAgents && (
          <Box
            onClick={(e) => {
              e.stopPropagation();
              setAgentsExpanded(!agentsExpanded);
            }}
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              padding: "2px 6px",
              borderRadius: "4px",
              backgroundColor: "var(--bg-tertiary)",
              cursor: "pointer",
              fontSize: "10px",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle)",
              userSelect: "none",
            }}
            title={agentsExpanded ? "Hide sub-agents" : `Show ${group.agents.length} sub-agent${group.agents.length > 1 ? 's' : ''}`}
          >
            {agentsExpanded ? "−" : "+"} {group.agents.length}
          </Box>
        )}
      </Box>
      
      {/* Agent sessions (collapsed by default) */}
      {hasAgents && agentsExpanded && (
        <Flex direction="column" gap="1" ml="4" mt="1" style={{ borderLeft: "2px solid var(--accent-purple)" }}>
          {group.agents.map((agent) => (
            <Box
              key={agent.sessionId}
              onClick={() => onSessionClick?.(agent)}
              style={{ 
                cursor: onSessionClick ? "pointer" : "default",
                paddingLeft: "12px",
              }}
            >
              <SessionCard
                session={{
                  ...toSessionCardFormat(agent),
                }}
                disableHover={true}
              />
            </Box>
          ))}
        </Flex>
      )}
    </Box>
  );
}

export function ProjectSection({ project, sessions, liveSessions, onSessionClick }: ProjectSectionProps) {
  // Check if there are live sessions
  const hasActiveSessions = liveSessions.length > 0;
  const isActive = project.isActive || hasActiveSessions;
  
  // Start expanded if active or few sessions
  const [expanded, setExpanded] = useState(true);
  
  // When liveSessions change and we have active sessions, auto-expand
  useEffect(() => {
    if (hasActiveSessions) {
      setExpanded(true);
    }
  }, [hasActiveSessions]);
  
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
          <Flex gap="2" className="kanban-grid" style={{ minHeight: 160, overflowX: "auto" }}>
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
  // Group sessions with their sub-agents
  const sessionGroups = useMemo(() => groupSessionsWithAgents(sessions), [sessions]);
  const parentCount = sessionGroups.filter(g => !g.session.isAgent).length;
  const agentCount = sessions.filter(s => s.isAgent === true).length;
  const displayGroups = expanded ? sessionGroups : sessionGroups.slice(0, 3);

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
          {parentCount} session{parentCount !== 1 ? "s" : ""}
          {agentCount > 0 && (
            <span style={{ color: "var(--accent-purple)" }}> +{agentCount} sub</span>
          )}
        </Text>
        <Text size="1" style={{ color: "var(--text-tertiary)" }}>
          · {formatTimeAgo(project.lastActivityAt)}
        </Text>
      </Flex>

      {/* Session cards */}
      {expanded && (
        <Flex direction="column" gap="2" mt="2">
          {displayGroups.map((group) => (
            <SessionWithAgents
              key={group.session.sessionId}
              group={group}
              onSessionClick={onSessionClick}
            />
          ))}
          {sessionGroups.length > displayGroups.length && (
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
              +{sessionGroups.length - displayGroups.length} more sessions
            </Text>
          )}
        </Flex>
      )}
    </Box>
  );
}
