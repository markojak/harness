/**
 * Provider type definitions for multi-agent support
 */
export const PROVIDER_CONFIGS = {
    claude: {
        name: "claude",
        displayName: "Claude",
        baseDir: "~/.claude/projects",
        color: "#D4A574",
        icon: "anthropic",
    },
    codex: {
        name: "codex",
        displayName: "Codex",
        baseDir: "~/.codex/sessions",
        color: "#10A37F",
        icon: "openai",
    },
    opencode: {
        name: "opencode",
        displayName: "OpenCode",
        baseDir: "~/.local/share/opencode/storage",
        color: "#4285F4",
        icon: "code-brackets",
    },
};
