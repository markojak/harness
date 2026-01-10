import { type CostSummary } from "./cost-tracker.js";
interface ProviderConfig {
    enabled: boolean;
    path: string;
}
interface HarnessConfig {
    providers: {
        claude: ProviderConfig;
        codex: ProviderConfig;
        opencode: ProviderConfig;
    };
    port: number;
    host: string;
    resumeFlags: string;
}
export declare function getConfig(): HarnessConfig;
export declare function saveConfig(config: Partial<HarnessConfig>): void;
export declare function getProviderPath(provider: "claude" | "codex" | "opencode"): string;
export declare function isProviderEnabled(provider: "claude" | "codex" | "opencode"): boolean;
export declare function updateTodayCost(summary: CostSummary): void;
export declare function getTodayCost(): {
    cost: string;
    tokens: string;
    raw: CostSummary;
};
export declare function startStatsServer(port?: number): void;
export {};
