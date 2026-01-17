/**
 * Antigravity (Google Gemini/DeepMind) session parser
 *
 * Parses Antigravity session data from:
 * - annotations/*.pbtxt - Session activity timestamps
 * - code_tracker/active/ - Project context and workspace info
 * - brain/<id>/ - Artifacts (task.md, implementation_plan.md, etc.)
 */
import { readFile, readdir, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { existsSync } from "node:fs";
const ANTIGRAVITY_DIR = join(process.env.HOME || "", ".gemini", "antigravity");
const ANNOTATIONS_DIR = join(ANTIGRAVITY_DIR, "annotations");
const CODE_TRACKER_DIR = join(ANTIGRAVITY_DIR, "code_tracker", "active");
const BRAIN_DIR = join(ANTIGRAVITY_DIR, "brain");
const CONVERSATIONS_DIR = join(ANTIGRAVITY_DIR, "conversations");
/**
 * Parse a .pbtxt annotation file to extract session activity time.
 * Format: last_user_view_time:{seconds:1768592085 nanos:23000000}
 */
export async function parseAnnotation(filepath) {
    try {
        const content = await readFile(filepath, "utf-8");
        const sessionId = basename(filepath, ".pbtxt");
        // Parse last_user_view_time:{seconds:XXXX nanos:XXXX}
        const match = content.match(/last_user_view_time:\s*\{\s*seconds:\s*(\d+)/);
        if (match) {
            const seconds = parseInt(match[1], 10);
            return {
                sessionId,
                lastUserViewTime: new Date(seconds * 1000),
            };
        }
        return {
            sessionId,
            lastUserViewTime: null,
        };
    }
    catch {
        return null;
    }
}
/**
 * Extract project name from code_tracker directory name.
 * Format: <project_name>_<hash>
 */
export function parseProjectDirName(dirname) {
    // Find the last underscore that separates name from hash
    const lastUnderscore = dirname.lastIndexOf("_");
    if (lastUnderscore === -1) {
        return null;
    }
    const name = dirname.substring(0, lastUnderscore);
    const hash = dirname.substring(lastUnderscore + 1);
    // Verify hash looks like a hash (40 hex chars for git)
    if (hash.length === 40 && /^[a-f0-9]+$/.test(hash)) {
        return { name, hash };
    }
    return { name: dirname, hash: "" };
}
/**
 * Get all active projects from code_tracker.
 */
export async function getActiveProjects() {
    const projects = new Map();
    if (!existsSync(CODE_TRACKER_DIR)) {
        return projects;
    }
    try {
        const dirs = await readdir(CODE_TRACKER_DIR);
        for (const dir of dirs) {
            const parsed = parseProjectDirName(dir);
            if (parsed) {
                const fullPath = join(CODE_TRACKER_DIR, dir);
                const stats = await stat(fullPath);
                projects.set(parsed.hash || dir, {
                    name: parsed.name,
                    path: fullPath,
                    lastModified: stats.mtime,
                });
            }
        }
    }
    catch {
        // Ignore errors
    }
    return projects;
}
/**
 * Get artifacts for a session from brain directory.
 */
export async function getSessionArtifacts(sessionId) {
    const brainPath = join(BRAIN_DIR, sessionId);
    if (!existsSync(brainPath)) {
        return [];
    }
    try {
        const files = await readdir(brainPath);
        return files.filter(f => f.endsWith(".md") ||
            f.endsWith(".png") ||
            f.endsWith(".webp"));
    }
    catch {
        return [];
    }
}
/**
 * Get session creation time from brain directory or conversation file.
 */
export async function getSessionCreatedAt(sessionId) {
    // Try brain directory first
    const brainPath = join(BRAIN_DIR, sessionId);
    if (existsSync(brainPath)) {
        try {
            const stats = await stat(brainPath);
            return stats.birthtime;
        }
        catch {
            // Fall through
        }
    }
    // Try conversation file
    const convPath = join(CONVERSATIONS_DIR, `${sessionId}.pb`);
    if (existsSync(convPath)) {
        try {
            const stats = await stat(convPath);
            return stats.birthtime;
        }
        catch {
            // Fall through
        }
    }
    return new Date();
}
/**
 * Get all Antigravity sessions.
 */
export async function getAllSessions() {
    const sessions = [];
    const sessionIds = new Set();
    // Collect session IDs from multiple sources
    // 1. From annotations
    if (existsSync(ANNOTATIONS_DIR)) {
        try {
            const files = await readdir(ANNOTATIONS_DIR);
            for (const file of files) {
                if (file.endsWith(".pbtxt")) {
                    sessionIds.add(basename(file, ".pbtxt"));
                }
            }
        }
        catch {
            // Ignore
        }
    }
    // 2. From brain directory
    if (existsSync(BRAIN_DIR)) {
        try {
            const dirs = await readdir(BRAIN_DIR);
            for (const dir of dirs) {
                // UUID format check
                if (/^[a-f0-9-]{36}$/.test(dir)) {
                    sessionIds.add(dir);
                }
            }
        }
        catch {
            // Ignore
        }
    }
    // 3. From conversations
    if (existsSync(CONVERSATIONS_DIR)) {
        try {
            const files = await readdir(CONVERSATIONS_DIR);
            for (const file of files) {
                if (file.endsWith(".pb")) {
                    sessionIds.add(basename(file, ".pb"));
                }
            }
        }
        catch {
            // Ignore
        }
    }
    // Get active projects for context
    const projects = await getActiveProjects();
    // Build session objects
    for (const sessionId of sessionIds) {
        // Parse annotation for activity time
        const annotationPath = join(ANNOTATIONS_DIR, `${sessionId}.pbtxt`);
        const annotation = existsSync(annotationPath)
            ? await parseAnnotation(annotationPath)
            : null;
        // Get artifacts
        const artifacts = await getSessionArtifacts(sessionId);
        // Get creation time
        const createdAt = await getSessionCreatedAt(sessionId);
        // Determine last activity
        let lastActivity = annotation?.lastUserViewTime || createdAt;
        // Check conversation file modification time
        const convPath = join(CONVERSATIONS_DIR, `${sessionId}.pb`);
        if (existsSync(convPath)) {
            try {
                const stats = await stat(convPath);
                if (stats.mtime > lastActivity) {
                    lastActivity = stats.mtime;
                }
            }
            catch {
                // Ignore
            }
        }
        // Determine status based on activity
        const now = new Date();
        const minutesSinceActivity = (now.getTime() - lastActivity.getTime()) / 60000;
        let status = "unknown";
        if (minutesSinceActivity < 5) {
            status = "active";
        }
        else if (minutesSinceActivity < 60) {
            status = "idle";
        }
        // Try to find project name (would need workspace mapping)
        // For now, use null - we'll enhance this later
        let projectName = null;
        let projectPath = null;
        // Check if any project was recently modified (heuristic)
        let minTimeDiff = 96 * 60 * 60 * 1000;
        for (const [, project] of projects) {
            const timeDiff = Math.abs(project.lastModified.getTime() - lastActivity.getTime());
            if (timeDiff < minTimeDiff) { // Within 24 hours (checked by init value)
                minTimeDiff = timeDiff;
                projectName = project.name;
                projectPath = project.path;
            }
        }
        sessions.push({
            sessionId,
            projectName,
            projectPath,
            lastActivity,
            createdAt,
            artifacts,
            status,
        });
    }
    // Sort by last activity (most recent first)
    sessions.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    return sessions;
}
/**
 * Get session count for stats.
 */
export async function getSessionCount() {
    const sessions = await getAllSessions();
    return sessions.length;
}
/**
 * Check if Antigravity is installed/available.
 */
export function isAntigravityAvailable() {
    return existsSync(ANTIGRAVITY_DIR);
}
export { ANTIGRAVITY_DIR, ANNOTATIONS_DIR, CODE_TRACKER_DIR, BRAIN_DIR, CONVERSATIONS_DIR };
