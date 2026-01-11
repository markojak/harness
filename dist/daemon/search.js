/**
 * Full-text search using SQLite FTS5
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
// Create FTS5 virtual table for full-text search
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts USING fts5(
    sessionId,
    projectId,
    projectName,
    originalPrompt,
    goal,
    content,
    tokenize='porter unicode61'
  );
  
  CREATE TABLE IF NOT EXISTS sessions_index (
    sessionId TEXT PRIMARY KEY,
    projectId TEXT,
    projectName TEXT,
    gitRepoId TEXT,
    gitRepoUrl TEXT,
    cwd TEXT,
    gitBranch TEXT,
    originalPrompt TEXT,
    goal TEXT,
    startedAt TEXT,
    lastActivityAt TEXT,
    messageCount INTEGER,
    indexed_at TEXT,
    provider TEXT,
    modelProvider TEXT,
    modelId TEXT
  );
`);
// Migration: add columns if they don't exist (for existing databases)
try {
    db.exec(`ALTER TABLE sessions_index ADD COLUMN provider TEXT`);
}
catch { }
try {
    db.exec(`ALTER TABLE sessions_index ADD COLUMN modelProvider TEXT`);
}
catch { }
try {
    db.exec(`ALTER TABLE sessions_index ADD COLUMN modelId TEXT`);
}
catch { }
try {
    db.exec(`ALTER TABLE sessions_index ADD COLUMN isAgent INTEGER DEFAULT 0`);
}
catch { }
try {
    db.exec(`ALTER TABLE sessions_index ADD COLUMN parentSessionId TEXT`);
}
catch { }
/**
 * Index a session for search
 */
export function indexSession(session) {
    const now = new Date().toISOString();
    // Upsert into sessions_index
    const upsert = db.prepare(`
    INSERT OR REPLACE INTO sessions_index 
    (sessionId, projectId, projectName, gitRepoId, gitRepoUrl, cwd, gitBranch, originalPrompt, goal, startedAt, lastActivityAt, messageCount, indexed_at, provider, modelProvider, modelId, isAgent, parentSessionId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    upsert.run(session.sessionId, session.projectId, session.projectName, session.gitRepoId || null, session.gitRepoUrl || null, session.cwd, session.gitBranch || null, session.originalPrompt, session.goal || null, session.startedAt, session.lastActivityAt, session.messageCount, now, session.provider || "claude", session.modelProvider || null, session.modelId || null, session.isAgent ? 1 : 0, session.parentSessionId || null);
    // Delete old FTS entry if exists
    db.prepare("DELETE FROM sessions_fts WHERE sessionId = ?").run(session.sessionId);
    // Insert into FTS
    const content = [
        session.originalPrompt,
        session.goal || "",
        session.content || "",
        session.projectName,
        session.gitBranch || "",
    ].join(" ");
    const insertFts = db.prepare(`
    INSERT INTO sessions_fts (sessionId, projectId, projectName, originalPrompt, goal, content)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
    insertFts.run(session.sessionId, session.projectId, session.projectName, session.originalPrompt, session.goal || "", content);
}
/**
 * Search sessions using FTS5
 */
export function searchSessions(query, limit = 50) {
    if (!query.trim())
        return [];
    // Escape special FTS5 characters and add prefix matching
    const sanitized = query
        .replace(/['"]/g, "")
        .split(/\s+/)
        .filter(Boolean)
        .map(term => `"${term}"*`)
        .join(" ");
    if (!sanitized)
        return [];
    const stmt = db.prepare(`
    SELECT 
      s.sessionId,
      s.projectId,
      s.projectName,
      s.gitRepoId,
      s.gitRepoUrl,
      s.cwd,
      s.gitBranch,
      s.originalPrompt,
      s.goal,
      s.startedAt,
      s.lastActivityAt,
      s.messageCount,
      s.provider,
      s.modelProvider,
      s.modelId,
      snippet(sessions_fts, 3, '**', '**', '...', 32) as snippet,
      rank
    FROM sessions_fts
    JOIN sessions_index s ON sessions_fts.sessionId = s.sessionId
    WHERE sessions_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `);
    try {
        const rows = stmt.all(sanitized, limit);
        return rows.map(row => ({
            ...row,
            rank: -row.rank, // FTS5 rank is negative, invert for display
        }));
    }
    catch (error) {
        console.error("Search error:", error);
        return [];
    }
}
/**
 * Get search index stats
 */
export function getSearchStats() {
    const countStmt = db.prepare("SELECT COUNT(*) as count FROM sessions_index");
    const lastStmt = db.prepare("SELECT MAX(indexed_at) as last FROM sessions_index");
    const count = countStmt.get().count;
    const last = lastStmt.get().last;
    return { indexed: count, lastIndexed: last };
}
/**
 * Bulk index sessions
 */
export function bulkIndexSessions(sessions) {
    let indexed = 0;
    const transaction = db.transaction(() => {
        for (const session of sessions) {
            try {
                indexSession(session);
                indexed++;
            }
            catch (error) {
                console.error(`Failed to index ${session.sessionId}:`, error);
            }
        }
    });
    transaction();
    return indexed;
}
/**
 * Clear search index
 */
export function clearSearchIndex() {
    db.exec("DELETE FROM sessions_fts");
    db.exec("DELETE FROM sessions_index");
}
/**
 * Get all unique cwds from indexed sessions
 */
export function getAllSessionCwds() {
    const stmt = db.prepare("SELECT DISTINCT cwd FROM sessions_index WHERE cwd IS NOT NULL AND cwd != ''");
    const rows = stmt.all();
    return rows.map(r => r.cwd);
}
