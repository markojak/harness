/**
 * GitHub PR tracking and CI status polling
 */
import fastq from "fastq";
import type { PRInfo } from "./schema.js";
type ExecFn = (cmd: string, opts: {
    cwd: string;
}) => Promise<{
    stdout: string;
    stderr: string;
}>;
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
type PRUpdateCallback = (sessionId: string, pr: PRInfo | null) => void;
/**
 * Set the callback for PR updates
 */
export declare function setOnPRUpdate(callback: PRUpdateCallback): void;
/**
 * Queue a PR check for a session
 */
export declare function queuePRCheck(cwd: string, branch: string, sessionId: string): void;
/**
 * Stop all polling (cleanup)
 */
export declare function stopAllPolling(): void;
/**
 * Get cached PR info for a session (for initial publish)
 */
export declare function getCachedPR(cwd: string, branch: string): PRInfo | null;
/**
 * Clear PR cache and stop CI polling when branch changes.
 * This ensures we don't show stale PR info from the old branch.
 */
export declare function clearPRForSession(sessionId: string, oldBranch: string | null, cwd: string): void;
export declare const __test__: {
    setExecAsync(fn: ExecFn): void;
    resetExecAsync(): void;
    clearCache(): void;
    getQueue(): fastq.queueAsPromised<QueueTask, any>;
};
export {};
