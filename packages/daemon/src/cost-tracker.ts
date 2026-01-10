/**
 * Cost tracking based on token usage from session logs
 */

// Pricing per million tokens (as of Jan 2026, approximate)
const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  // Claude 4
  "claude-opus-4-5-20251101": { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  "claude-sonnet-4-5-20251101": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  // Claude 3.5
  "claude-3-5-sonnet-20241022": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-3-5-haiku-20241022": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  // Claude 3
  "claude-3-opus-20240229": { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  "claude-3-sonnet-20240229": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-3-haiku-20240307": { input: 0.25, output: 1.25, cacheRead: 0.025, cacheWrite: 0.3125 },
  // Haiku 4
  "claude-haiku-4-5-20251001": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  // Defaults
  "default": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
};

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

function getPricing(model: string) {
  // Try exact match first
  if (MODEL_PRICING[model]) {
    return MODEL_PRICING[model];
  }
  
  // Try partial match
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (model.includes(key.split("-").slice(0, 3).join("-"))) {
      return pricing;
    }
  }
  
  // Default to Sonnet pricing
  return MODEL_PRICING["default"];
}

export function calculateCost(usage: TokenUsage, model: string): number {
  const pricing = getPricing(model);
  
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  const cacheReadCost = (usage.cacheReadTokens / 1_000_000) * pricing.cacheRead;
  const cacheWriteCost = (usage.cacheWriteTokens / 1_000_000) * pricing.cacheWrite;
  
  return inputCost + outputCost + cacheReadCost + cacheWriteCost;
}

export function extractUsageFromEntry(entry: any): { usage: TokenUsage; model: string } | null {
  if (entry.type !== "assistant" || !entry.message?.usage) {
    return null;
  }
  
  const usage = entry.message.usage;
  const model = entry.message.model || "default";
  
  // Handle different usage formats
  const cacheCreation = usage.cache_creation || {};
  
  return {
    usage: {
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      cacheReadTokens: usage.cache_read_input_tokens || 0,
      cacheWriteTokens: (usage.cache_creation_input_tokens || 0) + 
                        (cacheCreation.ephemeral_5m_input_tokens || 0) +
                        (cacheCreation.ephemeral_1h_input_tokens || 0),
    },
    model,
  };
}

export function aggregateUsage(entries: any[]): CostSummary {
  let totalUsage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
  
  let totalCost = 0;
  
  for (const entry of entries) {
    const extracted = extractUsageFromEntry(entry);
    if (extracted) {
      totalUsage.inputTokens += extracted.usage.inputTokens;
      totalUsage.outputTokens += extracted.usage.outputTokens;
      totalUsage.cacheReadTokens += extracted.usage.cacheReadTokens;
      totalUsage.cacheWriteTokens += extracted.usage.cacheWriteTokens;
      totalCost += calculateCost(extracted.usage, extracted.model);
    }
  }
  
  return {
    totalTokens: totalUsage.inputTokens + totalUsage.outputTokens + 
                 totalUsage.cacheReadTokens + totalUsage.cacheWriteTokens,
    ...totalUsage,
    estimatedCost: totalCost,
  };
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${(cost * 100).toFixed(2)}¢`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Format token count for display
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}k`;
  }
  return tokens.toString();
}
