export type LogEntry = UserEntry | AssistantEntry | SystemEntry | QueueOperationEntry | FileHistorySnapshotEntry;
export interface BaseMessageEntry {
    parentUuid: string | null;
    uuid: string;
    sessionId: string;
    timestamp: string;
    cwd: string;
    version: string;
    gitBranch: string;
    isSidechain: boolean;
    userType: string;
}
export interface UserEntry extends BaseMessageEntry {
    type: "user";
    message: {
        role: "user";
        content: string | UserContentBlock[];
    };
    toolUseResult?: string;
    thinkingMetadata?: {
        level: string;
        disabled: boolean;
        triggers: string[];
    };
    todos?: TodoItem[];
}
export type UserContentBlock = TextBlock | ToolResultBlock | ImageBlock;
export interface ImageBlock {
    type: "image";
    source: {
        type: "base64";
        media_type: string;
        data: string;
    };
}
export interface AssistantEntry extends BaseMessageEntry {
    type: "assistant";
    slug?: string;
    requestId: string;
    message: {
        role: "assistant";
        model: string;
        id: string;
        content: AssistantContentBlock[];
        stop_reason: string | null;
        usage?: {
            input_tokens: number;
            output_tokens: number;
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
        };
    };
}
export interface TextBlock {
    type: "text";
    text: string;
}
export interface ToolUseBlock {
    type: "tool_use";
    id: string;
    name: string;
    input: Record<string, unknown>;
}
export interface ThinkingBlock {
    type: "thinking";
    thinking: string;
    signature: string;
}
export interface ToolResultBlock {
    type: "tool_result";
    tool_use_id: string;
    content: string;
}
export type AssistantContentBlock = TextBlock | ToolUseBlock | ThinkingBlock;
export interface SystemEntry {
    type: "system";
    subtype: string;
    parentUuid: string;
    uuid: string;
    timestamp: string;
    sessionId: string;
    cwd: string;
    version: string;
    gitBranch: string;
    hookCount?: number;
    hookInfos?: unknown[];
    hookErrors?: unknown[];
    preventedContinuation?: boolean;
    stopReason?: string;
    hasOutput?: boolean;
    level?: string;
    toolUseID?: string;
}
export interface QueueOperationEntry {
    type: "queue-operation";
    operation: "enqueue" | "dequeue";
    timestamp: string;
    sessionId: string;
    content: string;
}
export interface FileHistorySnapshotEntry {
    type: "file-history-snapshot";
    messageId: string;
    snapshot: {
        messageId: string;
        trackedFileBackups: Record<string, unknown>;
        timestamp: string;
    };
    isSnapshotUpdate: boolean;
}
export interface TodoItem {
    content: string;
    status: "pending" | "in_progress" | "completed";
}
export interface SessionMetadata {
    sessionId: string;
    cwd: string;
    gitBranch: string | null;
    originalPrompt: string;
    startedAt: string;
}
export type SessionStatus = "working" | "waiting" | "idle";
export interface StatusResult {
    status: SessionStatus;
    lastRole: "user" | "assistant";
    hasPendingToolUse: boolean;
    lastActivityAt: string;
    messageCount: number;
}
export declare function isUserEntry(entry: LogEntry): entry is UserEntry;
export declare function isAssistantEntry(entry: LogEntry): entry is AssistantEntry;
export declare function isMessageEntry(entry: LogEntry): entry is UserEntry | AssistantEntry;
