import { useState, useRef, useEffect } from "react";
import { Box, Flex, Text, ScrollArea } from "@radix-ui/themes";
import { SessionCard } from "./SessionCard";
import type { Session, SessionStatus } from "../data/schema";

interface KanbanColumnProps {
  title: string;
  status: SessionStatus | "needs-approval";
  sessions: Session[];
  color: "green" | "orange" | "yellow" | "gray";
  onSessionClick?: (session: Session) => void;
}

const STATUS_COLORS = {
  green: "var(--status-working)",
  orange: "var(--status-approval)",
  yellow: "var(--status-waiting)",
  gray: "var(--status-idle)",
};

export function KanbanColumn({ title, sessions, color, onSessionClick }: KanbanColumnProps) {
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const viewport = scrollArea.querySelector("[data-radix-scroll-area-viewport]");
    if (!viewport) return;

    const handleScroll = () => {
      setIsScrolling(true);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);
    };

    viewport.addEventListener("scroll", handleScroll);
    return () => {
      viewport.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const statusColor = STATUS_COLORS[color];

  return (
    <Box
      className="kanban-column"
      style={{
        flex: 1,
        minWidth: 280,
        maxWidth: 420,
        backgroundColor: "var(--bg-surface)",
        borderRadius: "3px",
        border: "1px solid var(--border-subtle)",
      }}
      p="2"
    >
      <Flex direction="column" gap="2" style={{ height: "100%" }}>
        {/* Header */}
        <Flex
          justify="between"
          align="center"
          pb="2"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <Flex align="center" gap="2">
            <Box
              style={{
                width: "3px",
                height: "12px",
                backgroundColor: statusColor,
                borderRadius: "1px",
              }}
            />
            <Text size="2" weight="medium" style={{ color: "var(--text-primary)" }}>
              {title}
            </Text>
          </Flex>
          <Text
            size="1"
            weight="medium"
            style={{
              color: sessions.length > 0 ? statusColor : "var(--text-tertiary)",
              minWidth: "20px",
              textAlign: "right",
            }}
          >
            {sessions.length}
          </Text>
        </Flex>

        {/* Sessions */}
        <ScrollArea style={{ maxHeight: 380 }} ref={scrollAreaRef}>
          <Flex direction="column" gap="2" pr="1">
            {sessions.map((session) => (
              <SessionCard
                key={session.sessionId}
                session={session}
                disableHover={isScrolling}
                onClick={onSessionClick ? () => onSessionClick(session) : undefined}
              />
            ))}
            {sessions.length === 0 && (
              <Text
                size="1"
                align="center"
                style={{
                  padding: "24px 16px",
                  color: "var(--text-tertiary)",
                }}
              >
                —
              </Text>
            )}
          </Flex>
        </ScrollArea>
      </Flex>
    </Box>
  );
}
