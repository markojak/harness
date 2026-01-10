import { z } from "zod";
import { createStateSchema } from "@durable-streams/state";

// Provider enum (Claude, Codex, OpenCode, etc.)
export const ProviderSchema = z.enum(["claude", "codex", "opencode"]);
export type Provider = z.infer<typeof ProviderSchema>;

// Session status enum
export const SessionStatusSchema = z.enum(["working", "waiting", "idle"]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

// Pending tool info
export const PendingToolSchema = z.object({
  tool: z.string(),
  target: z.string(),
});
export type PendingTool = z.infer<typeof PendingToolSchema>;

// Recent output entry for live view
export const RecentOutputSchema = z.object({
  role: z.enum(["user", "assistant", "tool"]),
  content: z.string(),
});
export type RecentOutput = z.infer<typeof RecentOutputSchema>;

// CI check status
export const CIStatusSchema = z.enum(["pending", "running", "success", "failure", "cancelled", "unknown"]);
export type CIStatus = z.infer<typeof CIStatusSchema>;

// PR info
export const PRInfoSchema = z.object({
  number: z.number(),
  url: z.string(),
  title: z.string(),
  ciStatus: CIStatusSchema,
  ciChecks: z.array(z.object({
    name: z.string(),
    status: CIStatusSchema,
    url: z.string().nullable(),
  })),
  lastChecked: z.string(),
});
export type PRInfo = z.infer<typeof PRInfoSchema>;

// Main session state schema
export const SessionSchema = z.object({
  sessionId: z.string(),
  provider: ProviderSchema.optional().default("claude"),
  cwd: z.string(),
  gitBranch: z.string().nullable(),
  gitRepoUrl: z.string().nullable(),
  gitRepoId: z.string().nullable(),
  originalPrompt: z.string(),
  status: SessionStatusSchema,
  lastActivityAt: z.string(), // ISO timestamp
  messageCount: z.number(),
  hasPendingToolUse: z.boolean(),
  pendingTool: PendingToolSchema.nullable(),
  goal: z.string(), // High-level goal of the session
  summary: z.string(), // Current activity summary
  recentOutput: z.array(RecentOutputSchema),
  pr: PRInfoSchema.nullable(), // Associated PR if branch has one
  // For OpenCode: track actual model used (can be Gemini, Claude, GPT, etc.)
  modelProvider: z.string().nullable().optional(), // e.g., "anthropic", "openai", "google"
  modelId: z.string().nullable().optional(), // e.g., "claude-3-5-sonnet", "gpt-4o", "gemini-2.0-flash"
});
export type Session = z.infer<typeof SessionSchema>;

// Create the state schema for durable streams
export const sessionsStateSchema = createStateSchema({
  sessions: {
    schema: SessionSchema,
    type: "session",
    primaryKey: "sessionId",
  },
});
