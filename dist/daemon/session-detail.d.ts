/**
 * Session detail extraction - summaries, files, events from JSONL
 */
interface Summary {
    summary: string;
    timestamp: string;
}
interface FileChange {
    path: string;
    action: "created" | "modified" | "deleted";
}
interface Event {
    type: "user" | "assistant" | "tool" | "thinking";
    timestamp: string;
    content: string;
    toolName?: string;
    target?: string;
}
export interface SessionDetail {
    summaries: Summary[];
    files: FileChange[];
    events: Event[];
}
export declare function extractSessionDetail(filepath: string): Promise<SessionDetail>;
export {};
