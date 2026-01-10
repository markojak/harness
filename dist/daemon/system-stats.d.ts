import { type CostSummary } from "./cost-tracker.js";
export declare function updateTodayCost(summary: CostSummary): void;
export declare function getTodayCost(): {
    cost: string;
    tokens: string;
    raw: CostSummary;
};
export declare function startStatsServer(port?: number): void;
