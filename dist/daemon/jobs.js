/**
 * Job queue for tracking background tasks
 * Used by StatusIndicator to show what's running
 */
// In-memory job store
const jobs = new Map();
let jobCounter = 0;
const listeners = new Set();
function notifyListeners() {
    const activeJobs = getActiveJobs();
    listeners.forEach((fn) => fn(activeJobs));
}
export function onJobsChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
/**
 * Create a new job
 */
export function createJob(name) {
    const id = `job_${++jobCounter}_${Date.now()}`;
    jobs.set(id, {
        id,
        name,
        status: "queued",
    });
    notifyListeners();
    return id;
}
/**
 * Start a job
 */
export function startJob(id) {
    const job = jobs.get(id);
    if (job) {
        job.status = "running";
        job.startedAt = Date.now();
        notifyListeners();
    }
}
/**
 * Update job progress
 */
export function updateJobProgress(id, current, total) {
    const job = jobs.get(id);
    if (job) {
        job.progress = { current, total };
        notifyListeners();
    }
}
/**
 * Complete a job successfully
 */
export function completeJob(id) {
    const job = jobs.get(id);
    if (job) {
        job.status = "done";
        job.completedAt = Date.now();
        notifyListeners();
        // Clean up after 5 seconds
        setTimeout(() => {
            jobs.delete(id);
            notifyListeners();
        }, 5000);
    }
}
/**
 * Fail a job
 */
export function failJob(id, error) {
    const job = jobs.get(id);
    if (job) {
        job.status = "error";
        job.error = error;
        job.completedAt = Date.now();
        notifyListeners();
        // Keep errors longer (30 seconds) so user can see them
        setTimeout(() => {
            jobs.delete(id);
            notifyListeners();
        }, 30000);
    }
}
/**
 * Get all active jobs (running or queued)
 */
export function getActiveJobs() {
    return Array.from(jobs.values()).filter((j) => j.status === "running" || j.status === "queued");
}
/**
 * Get running jobs only
 */
export function getRunningJobs() {
    return Array.from(jobs.values()).filter((j) => j.status === "running");
}
/**
 * Get all jobs including completed
 */
export function getAllJobs() {
    return Array.from(jobs.values());
}
/**
 * Helper: Run a function as a tracked job
 */
export async function runAsJob(name, fn) {
    const id = createJob(name);
    startJob(id);
    try {
        const result = await fn((current, total) => {
            updateJobProgress(id, current, total);
        });
        completeJob(id);
        return result;
    }
    catch (error) {
        failJob(id, error.message || "Unknown error");
        throw error;
    }
}
