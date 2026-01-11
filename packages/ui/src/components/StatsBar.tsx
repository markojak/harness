import { useEffect, useState } from "react";
import { Flex, Text, Box } from "@radix-ui/themes";
import type { Session } from "../data/schema";

interface StatsBarProps {
  sessions: Session[];
}

interface SystemStats {
  cpuUsage: number;
  memUsage: number;
  uptime: string;
  todayCost: string;
  todayTokens: string;
}

const IDLE_TIMEOUT_MS = 60 * 60 * 1000;

function getEffectiveStatus(session: Session): string {
  const elapsed = Date.now() - new Date(session.lastActivityAt).getTime();
  if (elapsed > IDLE_TIMEOUT_MS) return "idle";
  if (session.status === "working") return "working";
  if (session.status === "waiting" && session.hasPendingToolUse) return "approval";
  if (session.status === "waiting") return "waiting";
  return "idle";
}



function formatTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function MiniBar({ value, color }: { value: number; color: string }) {
  const filled = Math.round(value / 12.5); // 8 segments
  const empty = 8 - filled;
  
  return (
    <Text size="1" style={{ fontFamily: "monospace", letterSpacing: "-1px" }}>
      <span style={{ color }}>{`${"█".repeat(filled)}`}</span>
      <span style={{ color: "var(--text-tertiary)" }}>{`${"░".repeat(empty)}`}</span>
    </Text>
  );
}

export function StatsBar({ sessions }: StatsBarProps) {
  const [time, setTime] = useState(formatTime());
  const [systemStats, setSystemStats] = useState<SystemStats>({
    cpuUsage: 0,
    memUsage: 0,
    uptime: "0m",
    todayCost: "$0.00",
    todayTokens: "0",
  });

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(formatTime());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch system stats
  useEffect(() => {
    async function fetchStats() {
      try {
        // Get stats from daemon stats server (port 4451)
        const res = await fetch("/system-stats");
        if (res.ok) {
          const data = await res.json();
          setSystemStats(data);
        }
      } catch {
        // Silently fail - stats server might not be running
      }
    }
    
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  // Calculate session counts
  const counts = sessions.reduce(
    (acc, session) => {
      const status = getEffectiveStatus(session);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const working = counts.working || 0;
  const approval = counts.approval || 0;
  const waiting = counts.waiting || 0;

  // Cost from daemon
  const { todayCost, todayTokens } = systemStats;

  return (
    <Flex
      align="center"
      gap="4"
      className="stats-bar"
      style={{
        marginLeft: "auto",
        fontSize: "12px",
      }}
    >
      {/* Session counts - always visible */}
      <Flex align="center" gap="3">
        {working > 0 && (
          <Flex align="center" gap="1">
            <Text size="1" style={{ color: "var(--status-working)" }}>●</Text>
            <Text size="1" style={{ color: "var(--text-secondary)" }}>
              {working}<span className="stats-label"> working</span>
            </Text>
          </Flex>
        )}
        {approval > 0 && (
          <Flex align="center" gap="1">
            <Text size="1" style={{ color: "var(--status-approval)" }}>●</Text>
            <Text size="1" style={{ color: "var(--text-secondary)" }}>
              {approval}<span className="stats-label"> approval</span>
            </Text>
          </Flex>
        )}
        {waiting > 0 && (
          <Flex align="center" gap="1">
            <Text size="1" style={{ color: "var(--status-waiting)" }}>●</Text>
            <Text size="1" style={{ color: "var(--text-secondary)" }}>
              {waiting}<span className="stats-label"> waiting</span>
            </Text>
          </Flex>
        )}
        <Text size="1" style={{ color: "var(--text-tertiary)" }}>
          {sessions.length}<span className="stats-label"> total</span>
        </Text>
      </Flex>

      {/* Cost & Tokens - primary info */}
      <Flex align="center" gap="2" className="stats-cost">
        <Box className="stats-divider" style={{ width: "1px", height: "16px", background: "var(--border-subtle)" }} />
        <Text size="1" style={{ color: "var(--accent-green)" }}>
          {todayCost}
        </Text>
        <Text size="1" style={{ color: "var(--text-tertiary)" }}>·</Text>
        <Text size="1" style={{ color: "var(--accent-cyan)" }}>
          {todayTokens}
        </Text>
        <Text size="1" className="stats-label" style={{ color: "var(--text-tertiary)" }}>
          tokens
        </Text>
      </Flex>

      {/* System stats - secondary, hide on mobile */}
      <Flex align="center" gap="3" className="stats-secondary">
        <Box style={{ width: "1px", height: "16px", background: "var(--border-subtle)" }} />
        <Flex align="center" gap="1">
          <Text size="1" style={{ color: "var(--text-tertiary)" }}>cpu</Text>
          <MiniBar value={systemStats.cpuUsage} color="var(--accent-cyan)" />
        </Flex>
        <Flex align="center" gap="1">
          <Text size="1" style={{ color: "var(--text-tertiary)" }}>mem</Text>
          <MiniBar value={systemStats.memUsage} color="var(--accent-purple)" />
        </Flex>
      </Flex>

      {/* Time - hide on mobile */}
      <Flex align="center" gap="2" className="header-time">
        <Box style={{ width: "1px", height: "16px", background: "var(--border-subtle)" }} />
        <Text size="1" style={{ color: "var(--text-primary)" }}>
          {time}
        </Text>
        {systemStats.uptime && (
          <Text size="1" style={{ color: "var(--text-tertiary)" }}>
            up {systemStats.uptime}
          </Text>
        )}
      </Flex>
    </Flex>
  );
}
