/**
 * Job queue for tracking background tasks
 * Used by StatusIndicator to show what's running
 */
export type JobStatus = "queued" | "running" | "done" | "error";
export interface Job {
    id: string;
    name: string;
    status: JobStatus;
    progress?: {
        current: number;
        total: number;
    };
    error?: string;
    startedAt?: number;
    completedAt?: number;
}
type JobListener = (jobs: Job[]) => void;
export declare function onJobsChange(listener: JobListener): () => void;
/**
 * Create a new job
 */
export declare function createJob(name: string): string;
/**
 * Start a job
 */
export declare function startJob(id: string): void;
/**
 * Update job progress
 */
export declare function updateJobProgress(id: string, current: number, total: number): void;
/**
 * Complete a job successfully
 */
export declare function completeJob(id: string): void;
/**
 * Fail a job
 */
export declare function failJob(id: string, error: string): void;
/**
 * Get all active jobs (running or queued)
 */
export declare function getActiveJobs(): Job[];
/**
 * Get running jobs only
 */
export declare function getRunningJobs(): Job[];
/**
 * Get all jobs including completed
 */
export declare function getAllJobs(): Job[];
/**
 * Helper: Run a function as a tracked job
 */
export declare function runAsJob<T>(name: string, fn: (updateProgress: (current: number, total: number) => void) => Promise<T>): Promise<T>;
export {};
