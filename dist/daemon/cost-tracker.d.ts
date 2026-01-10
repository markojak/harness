/**
 * Cost tracking based on token usage from session logs
 */
export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
}
export interface CostSummary {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    estimatedCost: number;
}
export declare function calculateCost(usage: TokenUsage, model: string): number;
export declare function extractUsageFromEntry(entry: any): {
    usage: TokenUsage;
    model: string;
} | null;
export declare function aggregateUsage(entries: any[]): CostSummary;
/**
 * Format cost for display
 */
export declare function formatCost(cost: number): string;
/**
 * Format token count for display
 */
export declare function formatTokens(tokens: number): string;
