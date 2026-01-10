import { Box, Flex, Text } from "@radix-ui/themes";
import { KanbanColumn } from "./KanbanColumn";
import type { Session, SessionStatus } from "../data/schema";

const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

function getEffectiveStatus(session: Session): SessionStatus {
  const elapsed = Date.now() - new Date(session.lastActivityAt).getTime();
  if (elapsed > IDLE_TIMEOUT_MS) {
    return "idle";
  }
  return session.status;
}

interface RepoSectionProps {
  repoId: string;
  repoUrl: string | null;
  sessions: Session[];
  activityScore: number;
}

export function RepoSection({ repoId, repoUrl, sessions, activityScore }: RepoSectionProps) {
  const working = sessions.filter((s) => getEffectiveStatus(s) === "working");
  const needsApproval = sessions.filter(
    (s) => getEffectiveStatus(s) === "waiting" && s.hasPendingToolUse
  );
  const waiting = sessions.filter(
    (s) => getEffectiveStatus(s) === "waiting" && !s.hasPendingToolUse
  );
  const idle = sessions.filter((s) => getEffectiveStatus(s) === "idle");

  const isHot = activityScore > 50;

  return (
    <Box
      mb="4"
      pb="4"
      style={{ borderBottom: "1px solid var(--border-subtle)" }}
    >
      {/* Repo Header */}
      <Flex align="center" gap="2" mb="3">
        <Text size="1" style={{ color: "var(--text-tertiary)" }}>▸</Text>
        {repoId === "Other" ? (
          <Text size="2" weight="medium" style={{ color: "var(--text-secondary)" }}>
            other
          </Text>
        ) : repoUrl ? (
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--accent-cyan)",
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            {repoId}
          </a>
        ) : (
          <Text size="2" weight="medium" style={{ color: "var(--text-primary)" }}>
            {repoId}
          </Text>
        )}
        {isHot && (
          <Text size="1" style={{ color: "var(--accent-orange)" }}>
            ●
          </Text>
        )}
        <Text size="1" style={{ color: "var(--text-tertiary)" }}>
          {sessions.length} session{sessions.length !== 1 ? "s" : ""}
        </Text>
      </Flex>

      {/* Kanban Columns */}
      <Flex gap="2" style={{ minHeight: 180 }}>
        <KanbanColumn
          title="Working"
          status="working"
          sessions={working}
          color="green"
        />
        <KanbanColumn
          title="Approval"
          status="needs-approval"
          sessions={needsApproval}
          color="orange"
        />
        <KanbanColumn
          title="Waiting"
          status="waiting"
          sessions={waiting}
          color="yellow"
        />
        <KanbanColumn
          title="Idle"
          status="idle"
          sessions={idle}
          color="gray"
        />
      </Flex>
    </Box>
  );
}
