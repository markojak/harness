/**
 * XState state machine for session status detection.
 *
 * This replaces the ad-hoc if-statements with a proper state machine
 * that makes transitions explicit and testable.
 */
import { setup, createActor } from "xstate";
/**
 * State machine for session status.
 *
 * States:
 * - working: Claude is actively processing
 * - waiting_for_approval: Tool use needs user approval
 * - waiting_for_input: Claude finished, waiting for user
 *
 * Note: "idle" status is determined by the UI based on elapsed time since lastActivityAt
 */
export const statusMachine = setup({
    types: {
        context: {},
        events: {},
    },
}).createMachine({
    id: "sessionStatus",
    initial: "waiting_for_input",
    // Use a factory function to ensure each actor gets a fresh context
    context: () => ({
        lastActivityAt: "",
        messageCount: 0,
        hasPendingToolUse: false,
        pendingToolIds: [],
    }),
    states: {
        working: {
            on: {
                USER_PROMPT: {
                    // Another user prompt while working (e.g., turn ended without system event)
                    actions: ({ context, event }) => {
                        context.lastActivityAt = event.timestamp;
                        context.messageCount += 1;
                        context.hasPendingToolUse = false;
                        context.pendingToolIds = [];
                    },
                },
                ASSISTANT_STREAMING: {
                    actions: ({ context, event }) => {
                        context.lastActivityAt = event.timestamp;
                    },
                },
                ASSISTANT_TOOL_USE: {
                    // Immediately transition to waiting_for_approval - tools that need approval
                    // will wait for user action, auto-approved tools are already filtered out
                    target: "waiting_for_approval",
                    actions: ({ context, event }) => {
                        context.lastActivityAt = event.timestamp;
                        context.messageCount += 1;
                        context.hasPendingToolUse = true;
                        context.pendingToolIds = event.toolUseIds;
                    },
                },
                TOOL_RESULT: {
                    // Tool completed - clear pending state, stay working
                    actions: ({ context, event }) => {
                        context.lastActivityAt = event.timestamp;
                        context.messageCount += 1;
                        const remaining = context.pendingToolIds.filter((id) => !event.toolUseIds.includes(id));
                        context.pendingToolIds = remaining;
                        context.hasPendingToolUse = remaining.length > 0;
                    },
                },
                TURN_END: {
                    target: "waiting_for_input",
                    actions: ({ context, event }) => {
                        context.lastActivityAt = event.timestamp;
                        context.hasPendingToolUse = false;
                        context.pendingToolIds = [];
                    },
                },
                STALE_TIMEOUT: {
                    target: "waiting_for_input",
                    actions: ({ context }) => {
                        context.hasPendingToolUse = false;
                    },
                },
            },
        },
        waiting_for_approval: {
            on: {
                TOOL_RESULT: {
                    target: "working",
                    actions: ({ context, event }) => {
                        context.lastActivityAt = event.timestamp;
                        context.messageCount += 1;
                        // Remove approved tools from pending
                        const remaining = context.pendingToolIds.filter((id) => !event.toolUseIds.includes(id));
                        context.pendingToolIds = remaining;
                        context.hasPendingToolUse = remaining.length > 0;
                    },
                },
                USER_PROMPT: {
                    // User started new turn - clears pending approval
                    target: "working",
                    actions: ({ context, event }) => {
                        context.lastActivityAt = event.timestamp;
                        context.messageCount += 1;
                        context.hasPendingToolUse = false;
                        context.pendingToolIds = [];
                    },
                },
                TURN_END: {
                    // Turn ended without approval (e.g., session closed)
                    target: "waiting_for_input",
                    actions: ({ context, event }) => {
                        context.lastActivityAt = event.timestamp;
                        context.hasPendingToolUse = false;
                        context.pendingToolIds = [];
                    },
                },
                STALE_TIMEOUT: {
                    // Approval pending too long - likely already resolved
                    target: "waiting_for_input",
                    actions: ({ context }) => {
                        context.hasPendingToolUse = false;
                        context.pendingToolIds = [];
                    },
                },
            },
        },
        waiting_for_input: {
            on: {
                USER_PROMPT: {
                    target: "working",
                    actions: ({ context, event }) => {
                        context.lastActivityAt = event.timestamp;
                        context.messageCount += 1;
                    },
                },
                // Handle assistant events for partial logs (e.g., resumed sessions)
                ASSISTANT_STREAMING: {
                    actions: ({ context, event }) => {
                        context.lastActivityAt = event.timestamp;
                    },
                },
                TURN_END: {
                    actions: ({ context, event }) => {
                        context.lastActivityAt = event.timestamp;
                    },
                },
            },
        },
    },
});
/**
 * Convert a log entry to a status event.
 */
export function logEntryToEvent(entry) {
    if (entry.type === "user") {
        const userEntry = entry;
        const content = userEntry.message.content;
        if (typeof content === "string") {
            // Human prompt (string form)
            return { type: "USER_PROMPT", timestamp: userEntry.timestamp };
        }
        else if (Array.isArray(content)) {
            // Check for tool results first
            const toolUseIds = content
                .filter((b) => b.type === "tool_result")
                .map((b) => b.tool_use_id);
            if (toolUseIds.length > 0) {
                return { type: "TOOL_RESULT", timestamp: userEntry.timestamp, toolUseIds };
            }
            // Check for text blocks (user prompt in array form with images, etc.)
            const hasTextBlock = content.some((b) => b.type === "text");
            if (hasTextBlock) {
                return { type: "USER_PROMPT", timestamp: userEntry.timestamp };
            }
        }
    }
    if (entry.type === "assistant") {
        const assistantEntry = entry;
        // Filter out tools that are typically auto-approved and don't need user approval
        // These tools run automatically without user intervention
        const autoApprovedTools = new Set([
            "Task", // Subagents
            "Read", // File reading
            "Glob", // File pattern matching
            "Grep", // Content search
            "TodoWrite", // Todo list management
            "TaskOutput", // Getting task output
            // Note: WebFetch, WebSearch, NotebookEdit, AskUserQuestion can require approval
            // depending on user configuration, so they're not auto-approved
        ]);
        const toolUseBlocks = assistantEntry.message.content.filter((b) => b.type === "tool_use" && !autoApprovedTools.has(b.name));
        if (toolUseBlocks.length > 0) {
            const toolUseIds = toolUseBlocks.map((b) => b.type === "tool_use" ? b.id : "");
            return { type: "ASSISTANT_TOOL_USE", timestamp: assistantEntry.timestamp, toolUseIds };
        }
        // Streaming assistant message (no tool_use, or only Task tools)
        return { type: "ASSISTANT_STREAMING", timestamp: assistantEntry.timestamp };
    }
    if (entry.type === "system") {
        const systemEntry = entry;
        if (systemEntry.subtype === "turn_duration" || systemEntry.subtype === "stop_hook_summary") {
            return { type: "TURN_END", timestamp: systemEntry.timestamp };
        }
    }
    return null;
}
/**
 * Derive status by running all log entries through the state machine.
 */
export function deriveStatusFromMachine(entries) {
    // Create a fresh actor and start it
    const actor = createActor(statusMachine);
    actor.start();
    // Process each entry
    for (const entry of entries) {
        const event = logEntryToEvent(entry);
        if (event) {
            actor.send(event);
        }
    }
    // Get current state
    const snapshot = actor.getSnapshot();
    let context = snapshot.context;
    let stateValue = snapshot.value;
    // Check for stale sessions (working state with no activity for a while)
    const now = Date.now();
    const lastActivityTime = context.lastActivityAt ? new Date(context.lastActivityAt).getTime() : 0;
    const timeSinceActivity = now - lastActivityTime;
    const STALE_TIMEOUT_MS = 15 * 1000; // 15 seconds - detect stale sessions quickly
    // Apply stale timeout for stale working or waiting_for_approval states
    // (idle status is handled by the UI based on elapsed time)
    if (timeSinceActivity > STALE_TIMEOUT_MS) {
        if (stateValue === "working" && !context.hasPendingToolUse) {
            // Stale working without tool use - probably turn ended without marker
            actor.send({ type: "STALE_TIMEOUT" });
        }
        else if (stateValue === "waiting_for_approval") {
            // Stale waiting for approval - tool probably already ran
            actor.send({ type: "STALE_TIMEOUT" });
        }
    }
    // Get final state
    const finalSnapshot = actor.getSnapshot();
    actor.stop();
    return {
        status: finalSnapshot.value,
        context: finalSnapshot.context,
    };
}
/**
 * Map machine status to the existing StatusResult format for compatibility.
 * Note: "idle" status is determined by the UI based on elapsed time.
 */
export function machineStatusToResult(machineStatus, context) {
    // Map the 3 machine states to 2 UI states (idle is handled by UI)
    const status = machineStatus === "working" ? "working" : "waiting";
    return {
        status,
        lastRole: "assistant", // Could track this in context if needed
        hasPendingToolUse: context.hasPendingToolUse,
        lastActivityAt: context.lastActivityAt,
        messageCount: context.messageCount,
    };
}
