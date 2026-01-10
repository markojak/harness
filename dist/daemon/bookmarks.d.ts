/**
 * Bookmarks storage using SQLite
 */
export interface Bookmark {
    id: string;
    sessionId: string;
    projectId: string | null;
    projectName: string | null;
    title: string;
    notes: string;
    tags: string[];
    originalPrompt: string | null;
    createdAt: string;
    updatedAt: string;
}
/**
 * Add a bookmark
 */
export declare function addBookmark(data: {
    sessionId: string;
    projectId?: string;
    projectName?: string;
    title: string;
    notes?: string;
    tags?: string[];
    originalPrompt?: string;
}): Bookmark;
/**
 * Update a bookmark
 */
export declare function updateBookmark(id: string, data: {
    title?: string;
    notes?: string;
    tags?: string[];
}): Bookmark | null;
/**
 * Remove a bookmark
 */
export declare function removeBookmark(id: string): boolean;
/**
 * Remove bookmark by session ID
 */
export declare function removeBookmarkBySession(sessionId: string): boolean;
/**
 * Get a bookmark by ID
 */
export declare function getBookmark(id: string): Bookmark | null;
/**
 * Get bookmark by session ID
 */
export declare function getBookmarkBySession(sessionId: string): Bookmark | null;
/**
 * Check if a session is bookmarked
 */
export declare function isBookmarked(sessionId: string): boolean;
/**
 * List all bookmarks
 */
export declare function listBookmarks(): Bookmark[];
/**
 * List bookmarks for a project
 */
export declare function listBookmarksByProject(projectId: string): Bookmark[];
/**
 * Search bookmarks
 */
export declare function searchBookmarks(query: string): Bookmark[];
/**
 * Get bookmark count
 */
export declare function getBookmarkCount(): number;
