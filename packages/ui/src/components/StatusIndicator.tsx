/**
 * StatusIndicator - Shows dependency errors and running jobs
 * 
 * Two independent cycling slots:
 * - Errors (5s cycle, slow, persists until resolved)
 * - Jobs (3s cycle, fast)
 * 
 * Both can be visible simultaneously, cycling independently.
 * Hover pauses cycle and shows copy button.
 * Click copies the action command.
 */

import { useState, useEffect } from "react";
import { Flex, Text } from "@radix-ui/themes";

interface DepStatus {
  ok: boolean;
  version?: string;
  install?: string;
}

interface DepsStatus {
  ripgrep: DepStatus;
  git: DepStatus;
  sqlite: DepStatus;
}

interface Job {
  id: string;
  name: string;
  status: "queued" | "running" | "done" | "error";
  progress?: { current: number; total: number };
  error?: string;
}

interface AppError {
  id: string;
  type: "warning" | "error";
  message: string;
  action?: string;
  actionLabel?: string;
}

interface StatusResponse {
  deps: DepsStatus;
  jobs: Job[];
  errors: AppError[];
  ready: boolean;
  hasRunningJobs: boolean;
  hasErrors: boolean;
}

const SPINNER_FRAMES = ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"];
const ERROR_CYCLE_MS = 5000;
const JOB_CYCLE_MS = 3000;

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

function useCycler<T>(items: T[], intervalMs: number, paused: boolean): T | null {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (paused || items.length <= 1) return;

    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [items.length, intervalMs, paused]);

  // Reset index if items change
  useEffect(() => {
    if (index >= items.length) {
      setIndex(0);
    }
  }, [items.length, index]);

  if (items.length === 0) return null;
  return items[index % items.length] || null;
}

function CopyButton({ text, onCopy }: { text: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Text
      size="1"
      style={{
        color: copied ? "var(--accent-green)" : "var(--text-tertiary)",
        cursor: "pointer",
        marginLeft: "6px",
        opacity: 0.8,
      }}
      onClick={handleCopy}
    >
      {copied ? "✓" : "⎘"}
    </Text>
  );
}

function ErrorSlot({
  error,
  paused,
  onHover,
}: {
  error: AppError;
  paused: boolean;
  onHover: (hovering: boolean) => void;
}) {
  return (
    <Flex
      align="center"
      gap="1"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      style={{ cursor: error.action ? "pointer" : "default" }}
    >
      <Text
        size="1"
        style={{
          color:
            error.type === "error"
              ? "var(--accent-red)"
              : "var(--accent-orange)",
        }}
      >
        ⚠
      </Text>
      <Text size="1" style={{ color: "var(--text-secondary)" }}>
        {error.message}
      </Text>
      {paused && error.action && <CopyButton text={error.action} />}
    </Flex>
  );
}

function JobSlot({
  job,
  spinner,
  onHover,
}: {
  job: Job;
  spinner: string;
  onHover: (hovering: boolean) => void;
}) {
  const progress = job.progress
    ? `${job.progress.current}/${job.progress.total}`
    : "";

  return (
    <Flex
      align="center"
      gap="1"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <Text size="1" style={{ color: "var(--accent-cyan)" }}>
        {spinner}
      </Text>
      <Text size="1" style={{ color: "var(--text-secondary)" }}>
        {job.name}
        {progress && (
          <Text style={{ color: "var(--text-tertiary)", marginLeft: "4px" }}>
            {progress}
          </Text>
        )}
      </Text>
    </Flex>
  );
}

export function StatusIndicator() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [errorHovered, setErrorHovered] = useState(false);
  const [jobHovered, setJobHovered] = useState(false);
  const spinner = useSpinner();

  // Fetch status periodically
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/status");
        if (res.ok) {
          setStatus(await res.json());
        }
      } catch {
        // Daemon not running, that's ok
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const errors = status?.errors || [];
  const jobs = (status?.jobs || []).filter((j) => j.status === "running");

  const currentError = useCycler(errors, ERROR_CYCLE_MS, errorHovered);
  const currentJob = useCycler(jobs, JOB_CYCLE_MS, jobHovered);

  // Nothing to show
  if (!currentError && !currentJob) {
    return null;
  }

  return (
    <Flex align="center" gap="3" ml="3">
      {currentError && (
        <ErrorSlot
          error={currentError}
          paused={errorHovered}
          onHover={setErrorHovered}
        />
      )}
      {currentJob && (
        <JobSlot
          job={currentJob}
          spinner={spinner}
          onHover={setJobHovered}
        />
      )}
    </Flex>
  );
}
