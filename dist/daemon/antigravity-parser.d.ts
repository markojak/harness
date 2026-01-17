/**
 * Antigravity (Google Gemini/DeepMind) session parser
 *
 * Parses Antigravity session data from:
 * - annotations/*.pbtxt - Session activity timestamps
 * - code_tracker/active/ - Project context and workspace info
 * - brain/<id>/ - Artifacts (task.md, implementation_plan.md, etc.)
 */
declare const ANTIGRAVITY_DIR: string;
declare const ANNOTATIONS_DIR: string;
declare const CODE_TRACKER_DIR: string;
declare const BRAIN_DIR: string;
declare const CONVERSATIONS_DIR: string;
export interface AntigravitySession {
    sessionId: string;
    projectName: string | null;
    projectPath: string | null;
    lastActivity: Date;
    createdAt: Date;
    artifacts: string[];
    status: "active" | "idle" | "unknown";
}
export interface AnnotationData {
    sessionId: string;
    lastUserViewTime: Date | null;
}
/**
 * Parse a .pbtxt annotation file to extract session activity time.
 * Format: last_user_view_time:{seconds:1768592085 nanos:23000000}
 */
export declare function parseAnnotation(filepath: string): Promise<AnnotationData | null>;
/**
 * Extract project name from code_tracker directory name.
 * Format: <project_name>_<hash>
 */
export declare function parseProjectDirName(dirname: string): {
    name: string;
    hash: string;
} | null;
/**
 * Get all active projects from code_tracker.
 */
export declare function getActiveProjects(): Promise<Map<string, {
    name: string;
    path: string;
    lastModified: Date;
}>>;
/**
 * Get artifacts for a session from brain directory.
 */
export declare function getSessionArtifacts(sessionId: string): Promise<string[]>;
/**
 * Get session creation time from brain directory or conversation file.
 */
export declare function getSessionCreatedAt(sessionId: string): Promise<Date>;
/**
 * Get all Antigravity sessions.
 */
export declare function getAllSessions(): Promise<AntigravitySession[]>;
/**
 * Get session count for stats.
 */
export declare function getSessionCount(): Promise<number>;
/**
 * Check if Antigravity is installed/available.
 */
export declare function isAntigravityAvailable(): boolean;
export { ANTIGRAVITY_DIR, ANNOTATIONS_DIR, CODE_TRACKER_DIR, BRAIN_DIR, CONVERSATIONS_DIR };
