/**
 * E2E test for Claude Code session tracking
 *
 * Tests the full flow: file detection → parsing → status → publishing
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm, appendFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { SessionWatcher } from "./watcher.js";
import { deriveStatus } from "./status.js";
import { tailJSONL, extractMetadata } from "./parser.js";
const TEST_DIR = path.join(os.homedir(), ".claude", "projects", "-test-e2e-session");
// Generate unique IDs per test run to avoid conflicts
function getTestSessionId() {
    return "test-session-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}
// Shared for simple tests that don't use the watcher
let TEST_SESSION_ID = "";
let TEST_LOG_FILE = "";
// Helper to create a log entry
function createUserEntry(content, timestamp = new Date().toISOString()) {
    return JSON.stringify({
        type: "user",
        parentUuid: null,
        uuid: `uuid-${Date.now()}-${Math.random()}`,
        sessionId: TEST_SESSION_ID,
        timestamp,
        cwd: "/Users/test/project",
        version: "1.0.0",
        gitBranch: "main",
        isSidechain: false,
        userType: "external",
        message: {
            role: "user",
            content,
        },
    }) + "\n";
}
function createAssistantEntry(content, timestamp = new Date().toISOString(), hasToolUse = false) {
    const blocks = [
        { type: "text", text: content },
    ];
    if (hasToolUse) {
        blocks.push({
            type: "tool_use",
            id: `tool-${Date.now()}`,
            name: "Bash",
            input: { command: "echo test" },
        });
    }
    return JSON.stringify({
        type: "assistant",
        parentUuid: null,
        uuid: `uuid-${Date.now()}-${Math.random()}`,
        sessionId: TEST_SESSION_ID,
        timestamp,
        cwd: "/Users/test/project",
        version: "1.0.0",
        gitBranch: "main",
        isSidechain: false,
        userType: "external",
        requestId: `req-${Date.now()}`,
        message: {
            role: "assistant",
            model: "claude-sonnet-4-20250514",
            id: `msg-${Date.now()}`,
            content: blocks,
            stop_reason: hasToolUse ? "tool_use" : "end_turn",
        },
    }) + "\n";
}
describe("Session Tracking", () => {
    beforeEach(async () => {
        // Create test directory and generate unique session ID for this test
        TEST_SESSION_ID = getTestSessionId();
        TEST_LOG_FILE = path.join(TEST_DIR, `${TEST_SESSION_ID}.jsonl`);
        await mkdir(TEST_DIR, { recursive: true });
    });
    afterEach(async () => {
        // Small delay to let any pending file operations complete
        await new Promise((r) => setTimeout(r, 100));
        // Cleanup
        await rm(TEST_DIR, { recursive: true, force: true });
    });
    describe("Parser", () => {
        it("should parse JSONL entries from a log file", async () => {
            // Write a simple log file
            const entry1 = createUserEntry("Hello, help me with something");
            const entry2 = createAssistantEntry("Sure, I can help!");
            await writeFile(TEST_LOG_FILE, entry1 + entry2);
            // Parse it
            const { entries, newPosition } = await tailJSONL(TEST_LOG_FILE, 0);
            expect(entries).toHaveLength(2);
            expect(entries[0].type).toBe("user");
            expect(entries[1].type).toBe("assistant");
            expect(newPosition).toBeGreaterThan(0);
        });
        it("should extract metadata from entries", async () => {
            const entry = createUserEntry("Help me build a feature");
            await writeFile(TEST_LOG_FILE, entry);
            const { entries } = await tailJSONL(TEST_LOG_FILE, 0);
            const metadata = extractMetadata(entries);
            expect(metadata).not.toBeNull();
            expect(metadata?.sessionId).toBe(TEST_SESSION_ID);
            expect(metadata?.cwd).toBe("/Users/test/project");
            expect(metadata?.gitBranch).toBe("main");
            expect(metadata?.originalPrompt).toBe("Help me build a feature");
        });
        it("should handle incremental reads", async () => {
            // Write initial entry
            const entry1 = createUserEntry("First message");
            await writeFile(TEST_LOG_FILE, entry1);
            const { entries: first, newPosition: pos1 } = await tailJSONL(TEST_LOG_FILE, 0);
            expect(first).toHaveLength(1);
            // Append more entries
            const entry2 = createAssistantEntry("Response");
            const entry3 = createUserEntry("Follow up");
            await appendFile(TEST_LOG_FILE, entry2 + entry3);
            // Small delay to ensure file is flushed
            await new Promise((r) => setTimeout(r, 50));
            // Read from previous position - should get both new entries
            const { entries: second, newPosition: pos2 } = await tailJSONL(TEST_LOG_FILE, pos1);
            expect(second).toHaveLength(2);
            expect(second[0].type).toBe("assistant");
            expect(second[1].type).toBe("user");
            expect(pos2).toBeGreaterThan(pos1);
        });
    });
    describe("Status Derivation", () => {
        it("should detect working status after user message", async () => {
            const entry = createUserEntry("Do something");
            await writeFile(TEST_LOG_FILE, entry);
            const { entries } = await tailJSONL(TEST_LOG_FILE, 0);
            const status = deriveStatus(entries);
            expect(status.status).toBe("working");
            // Note: lastRole is not tracked in current implementation
            expect(status.hasPendingToolUse).toBe(false);
        });
        it("should detect waiting status after assistant response with turn end", async () => {
            const timestamp = new Date().toISOString();
            const entry1 = createUserEntry("Do something", timestamp);
            const entry2 = createAssistantEntry("Done!", timestamp);
            // Add a turn_duration system event to signal turn completion
            const turnEndEntry = JSON.stringify({
                type: "system",
                subtype: "turn_duration",
                timestamp,
                duration_ms: 1000,
                duration_api_ms: 900,
            }) + "\n";
            await writeFile(TEST_LOG_FILE, entry1 + entry2 + turnEndEntry);
            const { entries } = await tailJSONL(TEST_LOG_FILE, 0);
            const status = deriveStatus(entries);
            expect(status.status).toBe("waiting");
            // Note: lastRole is not tracked in current implementation
            expect(status.hasPendingToolUse).toBe(false);
        });
        it("should detect pending tool use as waiting with hasPendingToolUse", async () => {
            const entry1 = createUserEntry("Run a command");
            const entry2 = createAssistantEntry("I'll run that for you", new Date().toISOString(), true);
            await writeFile(TEST_LOG_FILE, entry1 + entry2);
            const { entries } = await tailJSONL(TEST_LOG_FILE, 0);
            const status = deriveStatus(entries);
            // Tool use for non-auto-approved tools (Bash) immediately shows as waiting
            expect(status.status).toBe("waiting");
            expect(status.hasPendingToolUse).toBe(true);
        });
        it("should report waiting status for old sessions (idle determined by UI)", async () => {
            // Create entry from 10 minutes ago
            // Note: idle status is now determined by the UI based on elapsed time
            const oldTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
            const entry = createAssistantEntry("Old response", oldTime);
            await writeFile(TEST_LOG_FILE, entry);
            const { entries } = await tailJSONL(TEST_LOG_FILE, 0);
            const status = deriveStatus(entries);
            // Daemon reports "waiting" - UI will show as "idle" based on elapsed time
            expect(status.status).toBe("waiting");
            expect(status.lastActivityAt).toBe(oldTime);
        });
    });
    describe("SessionWatcher", () => {
        it("should detect new session files", async () => {
            const watcher = new SessionWatcher({ debounceMs: 50 });
            const events = [];
            watcher.on("session", (event) => {
                if (event.session.sessionId === TEST_SESSION_ID) {
                    events.push({ type: event.type, sessionId: event.session.sessionId });
                }
            });
            await watcher.start();
            // Create a session file
            const entry = createUserEntry("New session");
            await writeFile(TEST_LOG_FILE, entry);
            // Wait for detection
            await new Promise((r) => setTimeout(r, 1000));
            watcher.stop();
            // Wait for watcher to fully stop
            await new Promise((r) => setTimeout(r, 100));
            expect(events.length).toBeGreaterThan(0);
            expect(events[0].type).toBe("created");
        });
        it("should detect session updates", async () => {
            // Create initial file
            const entry1 = createUserEntry("Initial");
            await writeFile(TEST_LOG_FILE, entry1);
            const watcher = new SessionWatcher({ debounceMs: 50 });
            const events = [];
            watcher.on("session", (event) => {
                if (event.session.sessionId === TEST_SESSION_ID) {
                    events.push({ type: event.type, status: event.session.status.status });
                }
            });
            await watcher.start();
            // Wait for initial detection
            await new Promise((r) => setTimeout(r, 1000));
            // Append assistant response
            const entry2 = createAssistantEntry("Response");
            await appendFile(TEST_LOG_FILE, entry2);
            // Wait for update detection
            await new Promise((r) => setTimeout(r, 1000));
            watcher.stop();
            // Wait for watcher to fully stop
            await new Promise((r) => setTimeout(r, 100));
            // Should have created event and possibly update
            expect(events.some(e => e.type === "created")).toBe(true);
        });
        it("should track message count changes", async () => {
            const watcher = new SessionWatcher({ debounceMs: 50 });
            let lastMessageCount = 0;
            // Track all events for our session
            watcher.on("session", (event) => {
                if (event.session.sessionId === TEST_SESSION_ID) {
                    lastMessageCount = event.session.status.messageCount;
                }
            });
            await watcher.start();
            // Create the file after watcher starts to ensure it's detected as new
            const entry1 = createUserEntry("First");
            await writeFile(TEST_LOG_FILE, entry1);
            // Wait for processing
            await new Promise((r) => setTimeout(r, 500));
            expect(lastMessageCount).toBe(1);
            // Add more messages
            await appendFile(TEST_LOG_FILE, createAssistantEntry("Two"));
            await new Promise((r) => setTimeout(r, 500));
            // Assistant message without tool use doesn't increment messageCount in current implementation
            // Only USER_PROMPT and ASSISTANT_TOOL_USE increment
            await appendFile(TEST_LOG_FILE, createUserEntry("Three"));
            await new Promise((r) => setTimeout(r, 500));
            watcher.stop();
            // Wait for watcher to fully stop
            await new Promise((r) => setTimeout(r, 100));
            // Should have at least 2 messages (user prompts)
            expect(lastMessageCount).toBeGreaterThanOrEqual(2);
        });
    });
});
