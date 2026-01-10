/**
 * Error registry for StatusIndicator
 * Tracks warnings/errors that persist until resolved
 */
export interface AppError {
    id: string;
    type: "warning" | "error";
    message: string;
    action?: string;
    actionLabel?: string;
    timestamp: number;
}
type ErrorListener = (errors: AppError[]) => void;
export declare function onErrorsChange(listener: ErrorListener): () => void;
/**
 * Add or update an error
 */
export declare function setError(id: string, error: Omit<AppError, "id" | "timestamp">): void;
/**
 * Remove an error (resolved)
 */
export declare function clearError(id: string): void;
/**
 * Get all current errors
 */
export declare function getErrors(): AppError[];
/**
 * Check if a specific error exists
 */
export declare function hasError(id: string): boolean;
/**
 * Clear all errors
 */
export declare function clearAllErrors(): void;
export {};
