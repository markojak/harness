/**
 * GitHub PR tracking and CI status polling
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import fastq from "fastq";
import type { queueAsPromised } from "fastq";
import type { PRInfo, CIStatus } from "./schema.js";
import { log, logError } from "./log.js";

const defaultExecAsync = promisify(exec);

// Allow injection of exec function for testing
type ExecFn = (cmd: string, opts: { cwd: string }) => Promise<{ stdout: string; stderr: string }>;
let execAsync: ExecFn = defaultExecAsync;

// Types for queue tasks
interface PRCheckTask {
  type: "check_pr";
  cwd: string;
  branch: string;
  sessionId: string;
}

interface CICheckTask {
  type: "check_ci";
  cwd: string;
  prNumber: number;
  sessionId: string;
}

type QueueTask = PRCheckTask | CICheckTask;

// Callbacks for when PR/CI info is updated
type PRUpdateCallback = (sessionId: string, pr: PRInfo | null) => void;

// Cache PR info to avoid redundant API calls
const prCache = new Map<string, { pr: PRInfo | null; lastChecked: number }>();
const PR_CACHE_TTL = 60_000; // 1 minute

// Track which sessions need CI polling
const activeCIPolling = new Map<string, NodeJS.Timeout>();

// Polling intervals
const CI_POLL_INTERVAL_ACTIVE = 30_000; // 30 seconds while CI is running
const CI_POLL_INTERVAL_IDLE = 5 * 60_000; // 5 minutes after CI completes

let onPRUpdate: PRUpdateCallback | null = null;

/**
 * Set the callback for PR updates
 */
export function setOnPRUpdate(callback: PRUpdateCallback): void {
  onPRUpdate = callback;
}

/**
 * Process queue tasks
 */
async function processTask(task: QueueTask): Promise<void> {
  if (task.type === "check_pr") {
    await checkPRForBranch(task.cwd, task.branch, task.sessionId);
  } else if (task.type === "check_ci") {
    await checkCIStatus(task.cwd, task.prNumber, task.sessionId);
  }
}

// Create the queue with concurrency of 2
const queue: queueAsPromised<QueueTask> = fastq.promise(processTask, 2);

/**
 * Check if a branch has an associated PR
 */
async function checkPRForBranch(cwd: string, branch: string, sessionId: string): Promise<void> {
  const cacheKey = `${cwd}:${branch}`;

  // Check cache
  const cached = prCache.get(cacheKey);
  if (cached && Date.now() - cached.lastChecked < PR_CACHE_TTL) {
    if (cached.pr && onPRUpdate) {
      onPRUpdate(sessionId, cached.pr);
    }
    return;
  }

  try {
    // Use gh CLI to find PR for this branch
    const { stdout } = await execAsync(
      `gh pr list --head "${branch}" --json number,url,title,headRefName --limit 1`,
      { cwd }
    );

    const prs = JSON.parse(stdout);
    if (prs.length === 0) {
      log("PR", `No PR found for branch: ${branch}`);
      prCache.set(cacheKey, { pr: null, lastChecked: Date.now() });
      if (onPRUpdate) {
        onPRUpdate(sessionId, null);
      }
      return;
    }

    const pr = prs[0];
    log("PR", `Found PR #${pr.number} for branch: ${branch}`);

    // Get CI status for this PR
    const ciInfo = await getCIStatus(cwd, pr.number);

    const prInfo: PRInfo = {
      number: pr.number,
      url: pr.url,
      title: pr.title,
      ciStatus: ciInfo.overallStatus,
      ciChecks: ciInfo.checks,
      lastChecked: new Date().toISOString(),
    };

    prCache.set(cacheKey, { pr: prInfo, lastChecked: Date.now() });

    if (onPRUpdate) {
      onPRUpdate(sessionId, prInfo);
    }

    // Start CI polling if CI is not complete
    if (ciInfo.overallStatus === "pending" || ciInfo.overallStatus === "running") {
      startCIPolling(cwd, pr.number, sessionId);
    }
  } catch (error) {
    // gh CLI not available or not in a git repo
    logError("PR", `Failed to check PR for ${branch}`, error as Error);
    prCache.set(cacheKey, { pr: null, lastChecked: Date.now() });
  }
}

/**
 * Get CI status for a PR
 */
async function getCIStatus(cwd: string, prNumber: number): Promise<{
  overallStatus: CIStatus;
  checks: PRInfo["ciChecks"];
}> {
  try {
    const { stdout } = await execAsync(
      `gh pr checks ${prNumber} --json name,state,link`,
      { cwd }
    );

    const checks = JSON.parse(stdout);

    const mappedChecks: PRInfo["ciChecks"] = checks.map((check: { name: string; state: string; link?: string }) => ({
      name: check.name,
      status: mapGHState(check.state),
      url: check.link || null,
    }));

    // Determine overall status
    let overallStatus: CIStatus = "success";
    for (const check of mappedChecks) {
      if (check.status === "failure" || check.status === "cancelled") {
        overallStatus = "failure";
        break;
      }
      if (check.status === "running") {
        overallStatus = "running";
      } else if (check.status === "pending" && overallStatus !== "running") {
        overallStatus = "pending";
      }
    }

    if (mappedChecks.length === 0) {
      overallStatus = "unknown";
    }

    log("PR", `CI status for PR #${prNumber}: ${overallStatus} (${mappedChecks.length} checks)`);
    return { overallStatus, checks: mappedChecks };
  } catch (error) {
    logError("PR", `Failed to get CI status for PR #${prNumber}`, error as Error);
    return { overallStatus: "unknown", checks: [] };
  }
}

/**
 * Map GitHub state to our CIStatus
 */
function mapGHState(state: string): CIStatus {
  switch (state.toUpperCase()) {
    case "SUCCESS":
    case "COMPLETED":
    case "NEUTRAL":
    case "SKIPPED":
      return "success";
    case "FAILURE":
    case "ERROR":
    case "TIMED_OUT":
    case "ACTION_REQUIRED":
      return "failure";
    case "CANCELLED":
      return "cancelled";
    case "IN_PROGRESS":
    case "QUEUED":
    case "REQUESTED":
    case "WAITING":
      return "running";
    case "PENDING":
      return "pending";
    default:
      return "unknown";
  }
}

/**
 * Check CI status for a PR and update
 */
async function checkCIStatus(cwd: string, prNumber: number, sessionId: string): Promise<void> {
  try {
    const ciInfo = await getCIStatus(cwd, prNumber);

    // Get existing PR info from cache to update
    const cacheKey = Array.from(prCache.entries()).find(([_, v]) => v.pr?.number === prNumber)?.[0];
    if (!cacheKey) return;

    const cached = prCache.get(cacheKey);
    if (!cached?.pr) return;

    const updatedPR: PRInfo = {
      ...cached.pr,
      ciStatus: ciInfo.overallStatus,
      ciChecks: ciInfo.checks,
      lastChecked: new Date().toISOString(),
    };

    prCache.set(cacheKey, { pr: updatedPR, lastChecked: Date.now() });

    if (onPRUpdate) {
      onPRUpdate(sessionId, updatedPR);
    }

    // Adjust polling interval based on status
    if (ciInfo.overallStatus === "success" || ciInfo.overallStatus === "failure" || ciInfo.overallStatus === "cancelled") {
      // CI complete - switch to idle polling
      stopCIPolling(sessionId);
      startIdleCIPolling(cwd, prNumber, sessionId);
    }
  } catch (error) {
    logError("PR", `Failed to check CI for PR #${prNumber}`, error as Error);
  }
}

/**
 * Start active CI polling for a PR
 */
function startCIPolling(cwd: string, prNumber: number, sessionId: string): void {
  // Don't start if already polling
  if (activeCIPolling.has(sessionId)) return;

  const interval = setInterval(() => {
    queue.push({ type: "check_ci", cwd, prNumber, sessionId });
  }, CI_POLL_INTERVAL_ACTIVE);

  activeCIPolling.set(sessionId, interval);
}

/**
 * Start idle CI polling (less frequent, for detecting new CI runs)
 */
function startIdleCIPolling(cwd: string, prNumber: number, sessionId: string): void {
  stopCIPolling(sessionId);

  const interval = setInterval(() => {
    queue.push({ type: "check_ci", cwd, prNumber, sessionId });
  }, CI_POLL_INTERVAL_IDLE);

  activeCIPolling.set(sessionId, interval);
}

/**
 * Stop CI polling for a session
 */
function stopCIPolling(sessionId: string): void {
  const interval = activeCIPolling.get(sessionId);
  if (interval) {
    clearInterval(interval);
    activeCIPolling.delete(sessionId);
  }
}

/**
 * Queue a PR check for a session
 */
export function queuePRCheck(cwd: string, branch: string, sessionId: string): void {
  if (!branch) return;
  log("PR", `Queueing PR check for branch: ${branch}`);
  queue.push({ type: "check_pr", cwd, branch, sessionId });
}

/**
 * Stop all polling (cleanup)
 */
export function stopAllPolling(): void {
  for (const [sessionId] of activeCIPolling) {
    stopCIPolling(sessionId);
  }
}

/**
 * Get cached PR info for a session (for initial publish)
 */
export function getCachedPR(cwd: string, branch: string): PRInfo | null {
  const cacheKey = `${cwd}:${branch}`;
  return prCache.get(cacheKey)?.pr ?? null;
}

/**
 * Clear PR cache and stop CI polling when branch changes.
 * This ensures we don't show stale PR info from the old branch.
 */
export function clearPRForSession(sessionId: string, oldBranch: string | null, cwd: string): void {
  // Stop CI polling for this session
  stopCIPolling(sessionId);

  // Clear cache for the old branch if we know it
  if (oldBranch) {
    const cacheKey = `${cwd}:${oldBranch}`;
    prCache.delete(cacheKey);
    log("PR", `Cleared cache for old branch: ${oldBranch}`);
  }
}

// Test helpers
export const __test__ = {
  setExecAsync(fn: ExecFn) {
    execAsync = fn;
  },
  resetExecAsync() {
    execAsync = defaultExecAsync;
  },
  clearCache() {
    prCache.clear();
  },
  getQueue() {
    return queue;
  },
};
