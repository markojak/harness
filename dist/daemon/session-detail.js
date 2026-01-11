/**
 * Session detail extraction - summaries, files, events from JSONL
 */
import { readFile } from "node:fs/promises";
export async function extractSessionDetail(filepath) {
    const summaries = [];
    const filesMap = new Map();
    const events = [];
    try {
        const content = await readFile(filepath, "utf-8");
        const lines = content.trim().split("\n").filter(Boolean);
        for (const line of lines) {
            try {
                const entry = JSON.parse(line);
                // Extract summaries
                if (entry.type === "summary" && entry.summary) {
                    summaries.push({
                        summary: entry.summary,
                        timestamp: entry.timestamp || "",
                    });
                }
                // Extract user messages
                if (entry.type === "user" && entry.message?.content) {
                    const content = typeof entry.message.content === "string"
                        ? entry.message.content
                        : JSON.stringify(entry.message.content);
                    events.push({
                        type: "user",
                        timestamp: entry.timestamp || "",
                        content: content.slice(0, 500),
                    });
                }
                // Extract assistant messages (brief)
                if (entry.type === "assistant" && entry.message?.content) {
                    const blocks = entry.message.content;
                    if (Array.isArray(blocks)) {
                        for (const block of blocks) {
                            // Extract thinking blocks
                            if (block.type === "thinking" && block.thinking) {
                                events.push({
                                    type: "thinking",
                                    timestamp: entry.timestamp || "",
                                    content: block.thinking,
                                });
                            }
                            if (block.type === "text" && block.text) {
                                events.push({
                                    type: "assistant",
                                    timestamp: entry.timestamp || "",
                                    content: block.text.slice(0, 200),
                                });
                                break; // Just first text block
                            }
                            if (block.type === "tool_use") {
                                const toolName = block.name || "tool";
                                let target = "";
                                // Extract target based on tool type
                                if (block.input) {
                                    if (block.input.file_path)
                                        target = block.input.file_path;
                                    else if (block.input.path)
                                        target = block.input.path;
                                    else if (block.input.command)
                                        target = block.input.command.slice(0, 50);
                                    else if (block.input.query)
                                        target = block.input.query.slice(0, 50);
                                }
                                events.push({
                                    type: "tool",
                                    timestamp: entry.timestamp || "",
                                    content: "",
                                    toolName,
                                    target,
                                });
                                // Track file modifications
                                const filePath = block.input?.file_path || block.input?.path;
                                if (["Write", "Edit", "MultiEdit"].includes(toolName) && filePath) {
                                    const path = filePath;
                                    const existing = filesMap.get(path);
                                    if (!existing) {
                                        filesMap.set(path, {
                                            path,
                                            action: toolName === "Write" ? "created" : "modified",
                                        });
                                    }
                                    else if (existing.action === "created" && toolName !== "Write") {
                                        // Keep as created if first was Write
                                    }
                                    else {
                                        existing.action = "modified";
                                    }
                                }
                            }
                        }
                    }
                }
            }
            catch {
                // Skip malformed lines
            }
        }
    }
    catch (error) {
        console.error(`Failed to extract session detail from ${filepath}:`, error);
    }
    // Sort summaries by timestamp (newest first)
    summaries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return {
        summaries,
        files: Array.from(filesMap.values()),
        events,
    };
}
