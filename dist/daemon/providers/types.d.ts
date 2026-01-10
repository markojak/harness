/**
 * Provider type definitions for multi-agent support
 */
export type Provider = "claude" | "codex" | "opencode";
export interface ProviderSession {
    provider: Provider;
    sessionId: string;
    projectName: string;
    cwd: string;
    originalPrompt: string;
    goal?: string;
    gitBranch?: string;
    gitCommit?: string;
    model?: string;
    /** For OpenCode: the actual model provider (anthropic, openai, google, etc.) */
    modelProvider?: string;
    /** For OpenCode: the actual model ID used (e.g., claude-3-5-sonnet, gpt-4o, gemini-2.0-flash) */
    modelId?: string;
    status: SessionStatus;
    lastActivityAt: string;
    createdAt?: string;
    messageCount: number;
    filepath: string;
}
export interface SessionStatus {
    state: "working" | "waiting" | "approval" | "idle";
    lastActivityAt: string;
    isActive: boolean;
}
export interface SessionEvent {
    type: "user" | "assistant" | "tool";
    timestamp: string;
    content?: string;
    toolName?: string;
}
export interface ProviderConfig {
    name: string;
    displayName: string;
    baseDir: string;
    color: string;
    icon: string;
}
export declare const PROVIDER_CONFIGS: Record<Provider, ProviderConfig>;
