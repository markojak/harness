/**
 * Ripgrep wrapper for fast content search across session logs
 * Falls back to Node.js if ripgrep is not available
 */
export interface SearchMatch {
    file: string;
    line: number;
    content: string;
}
/**
 * Search session logs - uses ripgrep if available, falls back to Node.js
 */
export declare function searchLogs(pattern: string, options?: {
    maxResults?: number;
    filesOnly?: boolean;
}): Promise<SearchMatch[]>;
/**
 * Find sessions that touched a specific file path
 */
export declare function findSessionsByFilePath(filePath: string): Promise<string[]>;
/**
 * Find sessions that touched ANY of the given file paths (batch search)
 * Returns map of filePath -> sessionIds
 */
export declare function findSessionsByFilePaths(filePaths: string[]): Promise<Map<string, string[]>>;
