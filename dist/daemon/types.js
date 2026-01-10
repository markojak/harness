// Log entry types based on actual Claude Code session logs
// Type guards
export function isUserEntry(entry) {
    return entry.type === "user";
}
export function isAssistantEntry(entry) {
    return entry.type === "assistant";
}
export function isMessageEntry(entry) {
    return entry.type === "user" || entry.type === "assistant";
}
