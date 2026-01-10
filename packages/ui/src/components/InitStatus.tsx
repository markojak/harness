/**
 * Initialization status indicator with spinner
 */

import { useState, useEffect } from "react";
import { Flex, Text } from "@radix-ui/themes";

const SPINNER_FRAMES = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];

interface InitStatusProps {
  indexLoading: boolean;
  sessionCount: number;
  projectCount: number; // Reserved for future use
}

export function InitStatus({ indexLoading, sessionCount, projectCount: _projectCount }: InitStatusProps) {
  const [frame, setFrame] = useState(0);
  const [phase, setPhase] = useState<"init" | "indexing" | "ready">("init");

  useEffect(() => {
    if (indexLoading) {
      setPhase("indexing");
    } else if (sessionCount > 0) {
      setPhase("ready");
    }
  }, [indexLoading, sessionCount]);

  useEffect(() => {
    if (phase === "ready") return;
    
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(interval);
  }, [phase]);

  if (phase === "ready") {
    return null; // Hide when ready
  }

  return (
    <Flex align="center" gap="2">
      <Text size="1" style={{ color: "var(--accent-cyan)" }}>
        {SPINNER_FRAMES[frame]}
      </Text>
      <Text size="1" style={{ color: "var(--text-tertiary)" }}>
        {phase === "init" && "Initializing..."}
        {phase === "indexing" && `Indexing sessions...`}
      </Text>
    </Flex>
  );
}
