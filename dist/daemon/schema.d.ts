import { z } from "zod";
export declare const ProviderSchema: z.ZodEnum<{
    antigravity: "antigravity";
    claude: "claude";
    codex: "codex";
    opencode: "opencode";
}>;
export type Provider = z.infer<typeof ProviderSchema>;
export declare const SessionStatusSchema: z.ZodEnum<{
    idle: "idle";
    working: "working";
    waiting: "waiting";
}>;
export type SessionStatus = z.infer<typeof SessionStatusSchema>;
export declare const PendingToolSchema: z.ZodObject<{
    tool: z.ZodString;
    target: z.ZodString;
}, z.core.$strip>;
export type PendingTool = z.infer<typeof PendingToolSchema>;
export declare const RecentOutputSchema: z.ZodObject<{
    role: z.ZodEnum<{
        user: "user";
        assistant: "assistant";
        tool: "tool";
    }>;
    content: z.ZodString;
}, z.core.$strip>;
export type RecentOutput = z.infer<typeof RecentOutputSchema>;
export declare const CIStatusSchema: z.ZodEnum<{
    unknown: "unknown";
    pending: "pending";
    running: "running";
    success: "success";
    failure: "failure";
    cancelled: "cancelled";
}>;
export type CIStatus = z.infer<typeof CIStatusSchema>;
export declare const PRInfoSchema: z.ZodObject<{
    number: z.ZodNumber;
    url: z.ZodString;
    title: z.ZodString;
    ciStatus: z.ZodEnum<{
        unknown: "unknown";
        pending: "pending";
        running: "running";
        success: "success";
        failure: "failure";
        cancelled: "cancelled";
    }>;
    ciChecks: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        status: z.ZodEnum<{
            unknown: "unknown";
            pending: "pending";
            running: "running";
            success: "success";
            failure: "failure";
            cancelled: "cancelled";
        }>;
        url: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>;
    lastChecked: z.ZodString;
}, z.core.$strip>;
export type PRInfo = z.infer<typeof PRInfoSchema>;
export declare const SessionSchema: z.ZodObject<{
    sessionId: z.ZodString;
    provider: z.ZodDefault<z.ZodEnum<{
        antigravity: "antigravity";
        claude: "claude";
        codex: "codex";
        opencode: "opencode";
    }>>;
    cwd: z.ZodString;
    gitBranch: z.ZodNullable<z.ZodString>;
    gitRepoUrl: z.ZodNullable<z.ZodString>;
    gitRepoId: z.ZodNullable<z.ZodString>;
    originalPrompt: z.ZodString;
    status: z.ZodEnum<{
        idle: "idle";
        working: "working";
        waiting: "waiting";
    }>;
    lastActivityAt: z.ZodString;
    messageCount: z.ZodNumber;
    hasPendingToolUse: z.ZodBoolean;
    pendingTool: z.ZodNullable<z.ZodObject<{
        tool: z.ZodString;
        target: z.ZodString;
    }, z.core.$strip>>;
    goal: z.ZodString;
    summary: z.ZodString;
    recentOutput: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<{
            user: "user";
            assistant: "assistant";
            tool: "tool";
        }>;
        content: z.ZodString;
    }, z.core.$strip>>;
    pr: z.ZodNullable<z.ZodObject<{
        number: z.ZodNumber;
        url: z.ZodString;
        title: z.ZodString;
        ciStatus: z.ZodEnum<{
            unknown: "unknown";
            pending: "pending";
            running: "running";
            success: "success";
            failure: "failure";
            cancelled: "cancelled";
        }>;
        ciChecks: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            status: z.ZodEnum<{
                unknown: "unknown";
                pending: "pending";
                running: "running";
                success: "success";
                failure: "failure";
                cancelled: "cancelled";
            }>;
            url: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>;
        lastChecked: z.ZodString;
    }, z.core.$strip>>;
    modelProvider: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    modelId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type Session = z.infer<typeof SessionSchema>;
export declare const sessionsStateSchema: import("@durable-streams/state").StateSchema<{
    sessions: {
        schema: z.ZodObject<{
            sessionId: z.ZodString;
            provider: z.ZodDefault<z.ZodEnum<{
                antigravity: "antigravity";
                claude: "claude";
                codex: "codex";
                opencode: "opencode";
            }>>;
            cwd: z.ZodString;
            gitBranch: z.ZodNullable<z.ZodString>;
            gitRepoUrl: z.ZodNullable<z.ZodString>;
            gitRepoId: z.ZodNullable<z.ZodString>;
            originalPrompt: z.ZodString;
            status: z.ZodEnum<{
                idle: "idle";
                working: "working";
                waiting: "waiting";
            }>;
            lastActivityAt: z.ZodString;
            messageCount: z.ZodNumber;
            hasPendingToolUse: z.ZodBoolean;
            pendingTool: z.ZodNullable<z.ZodObject<{
                tool: z.ZodString;
                target: z.ZodString;
            }, z.core.$strip>>;
            goal: z.ZodString;
            summary: z.ZodString;
            recentOutput: z.ZodArray<z.ZodObject<{
                role: z.ZodEnum<{
                    user: "user";
                    assistant: "assistant";
                    tool: "tool";
                }>;
                content: z.ZodString;
            }, z.core.$strip>>;
            pr: z.ZodNullable<z.ZodObject<{
                number: z.ZodNumber;
                url: z.ZodString;
                title: z.ZodString;
                ciStatus: z.ZodEnum<{
                    unknown: "unknown";
                    pending: "pending";
                    running: "running";
                    success: "success";
                    failure: "failure";
                    cancelled: "cancelled";
                }>;
                ciChecks: z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    status: z.ZodEnum<{
                        unknown: "unknown";
                        pending: "pending";
                        running: "running";
                        success: "success";
                        failure: "failure";
                        cancelled: "cancelled";
                    }>;
                    url: z.ZodNullable<z.ZodString>;
                }, z.core.$strip>>;
                lastChecked: z.ZodString;
            }, z.core.$strip>>;
            modelProvider: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            modelId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, z.core.$strip>;
        type: string;
        primaryKey: string;
    };
}>;
