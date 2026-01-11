import { createStreamDB, type StreamDB } from "@durable-streams/state";
import { sessionsStateSchema } from "./schema";

// Build stream URL dynamically based on current host
function getStreamUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/stream/sessions`;
  }
  // Fallback for SSR/testing
  return "http://127.0.0.1:4451/stream/sessions";
}

export type SessionsDB = StreamDB<typeof sessionsStateSchema>;

let dbInstance: SessionsDB | null = null;
let dbPromise: Promise<SessionsDB> | null = null;

/**
 * Get or create the sessions StreamDB instance.
 * Call this in a route loader to ensure db is ready before render.
 */
export async function getSessionsDb(): Promise<SessionsDB> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!dbPromise) {
    dbPromise = (async () => {
      const streamUrl = getStreamUrl();
      const db = await createStreamDB({
        streamOptions: {
          url: streamUrl,
          contentType: "application/json",
        },
        state: sessionsStateSchema,
      });

      // Preload existing data
      await db.preload();

      dbInstance = db;
      return db;
    })();
  }

  return dbPromise;
}

/**
 * Get the db instance synchronously.
 * Only call this after getSessionsDb() has resolved (e.g., after loader).
 * Throws if db is not initialized.
 */
export function getSessionsDbSync(): SessionsDB {
  if (!dbInstance) {
    throw new Error("SessionsDB not initialized. Call getSessionsDb() first in a loader.");
  }
  return dbInstance;
}

/**
 * Close the sessions DB connection.
 */
export async function closeSessionsDb(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
    dbPromise = null;
  }
}
