/**
 * Bookmarks storage using SQLite
 */

import Database from "better-sqlite3";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

const DATA_DIR = join(process.env.HOME || "", ".harness");
const DB_PATH = join(DATA_DIR, "harness.db");

// Ensure data directory exists
mkdirSync(DATA_DIR, { recursive: true });

// Initialize database
const db = new Database(DB_PATH);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    sessionId TEXT NOT NULL UNIQUE,
    projectId TEXT,
    projectName TEXT,
    title TEXT,
    notes TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    originalPrompt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  
  CREATE INDEX IF NOT EXISTS idx_bookmarks_sessionId ON bookmarks(sessionId);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_projectId ON bookmarks(projectId);
`);

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

interface BookmarkRow {
  id: string;
  sessionId: string;
  projectId: string | null;
  projectName: string | null;
  title: string;
  notes: string;
  tags: string;
  originalPrompt: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowToBookmark(row: BookmarkRow): Bookmark {
  return {
    ...row,
    tags: JSON.parse(row.tags || "[]"),
  };
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Add a bookmark
 */
export function addBookmark(data: {
  sessionId: string;
  projectId?: string;
  projectName?: string;
  title: string;
  notes?: string;
  tags?: string[];
  originalPrompt?: string;
}): Bookmark {
  const id = generateId();
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO bookmarks (id, sessionId, projectId, projectName, title, notes, tags, originalPrompt, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id,
    data.sessionId,
    data.projectId || null,
    data.projectName || null,
    data.title,
    data.notes || "",
    JSON.stringify(data.tags || []),
    data.originalPrompt || null,
    now,
    now
  );
  
  return {
    id,
    sessionId: data.sessionId,
    projectId: data.projectId || null,
    projectName: data.projectName || null,
    title: data.title,
    notes: data.notes || "",
    tags: data.tags || [],
    originalPrompt: data.originalPrompt || null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update a bookmark
 */
export function updateBookmark(id: string, data: {
  title?: string;
  notes?: string;
  tags?: string[];
}): Bookmark | null {
  const existing = getBookmark(id);
  if (!existing) return null;
  
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    UPDATE bookmarks 
    SET title = ?, notes = ?, tags = ?, updatedAt = ?
    WHERE id = ?
  `);
  
  stmt.run(
    data.title ?? existing.title,
    data.notes ?? existing.notes,
    JSON.stringify(data.tags ?? existing.tags),
    now,
    id
  );
  
  return getBookmark(id);
}

/**
 * Remove a bookmark
 */
export function removeBookmark(id: string): boolean {
  const stmt = db.prepare("DELETE FROM bookmarks WHERE id = ?");
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Remove bookmark by session ID
 */
export function removeBookmarkBySession(sessionId: string): boolean {
  const stmt = db.prepare("DELETE FROM bookmarks WHERE sessionId = ?");
  const result = stmt.run(sessionId);
  return result.changes > 0;
}

/**
 * Get a bookmark by ID
 */
export function getBookmark(id: string): Bookmark | null {
  const stmt = db.prepare("SELECT * FROM bookmarks WHERE id = ?");
  const row = stmt.get(id) as BookmarkRow | undefined;
  return row ? rowToBookmark(row) : null;
}

/**
 * Get bookmark by session ID
 */
export function getBookmarkBySession(sessionId: string): Bookmark | null {
  const stmt = db.prepare("SELECT * FROM bookmarks WHERE sessionId = ?");
  const row = stmt.get(sessionId) as BookmarkRow | undefined;
  return row ? rowToBookmark(row) : null;
}

/**
 * Check if a session is bookmarked
 */
export function isBookmarked(sessionId: string): boolean {
  const stmt = db.prepare("SELECT 1 FROM bookmarks WHERE sessionId = ?");
  return stmt.get(sessionId) !== undefined;
}

/**
 * List all bookmarks
 */
export function listBookmarks(): Bookmark[] {
  const stmt = db.prepare("SELECT * FROM bookmarks ORDER BY updatedAt DESC");
  const rows = stmt.all() as BookmarkRow[];
  return rows.map(rowToBookmark);
}

/**
 * List bookmarks for a project
 */
export function listBookmarksByProject(projectId: string): Bookmark[] {
  const stmt = db.prepare("SELECT * FROM bookmarks WHERE projectId = ? ORDER BY updatedAt DESC");
  const rows = stmt.all(projectId) as BookmarkRow[];
  return rows.map(rowToBookmark);
}

/**
 * Search bookmarks
 */
export function searchBookmarks(query: string): Bookmark[] {
  const stmt = db.prepare(`
    SELECT * FROM bookmarks 
    WHERE title LIKE ? OR notes LIKE ? OR originalPrompt LIKE ?
    ORDER BY updatedAt DESC
  `);
  const q = `%${query}%`;
  const rows = stmt.all(q, q, q) as BookmarkRow[];
  return rows.map(rowToBookmark);
}

/**
 * Get bookmark count
 */
export function getBookmarkCount(): number {
  const stmt = db.prepare("SELECT COUNT(*) as count FROM bookmarks");
  const row = stmt.get() as { count: number };
  return row.count;
}
