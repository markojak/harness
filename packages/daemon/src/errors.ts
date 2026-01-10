/**
 * Error registry for StatusIndicator
 * Tracks warnings/errors that persist until resolved
 */

export interface AppError {
  id: string;
  type: "warning" | "error";
  message: string;
  action?: string;      // Command to fix it (e.g., "brew install ripgrep")
  actionLabel?: string; // Label for copy button
  timestamp: number;
}

// In-memory error store
const errors = new Map<string, AppError>();

// Event listeners for real-time updates
type ErrorListener = (errors: AppError[]) => void;
const listeners = new Set<ErrorListener>();

function notifyListeners() {
  listeners.forEach((fn) => fn(getErrors()));
}

export function onErrorsChange(listener: ErrorListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Add or update an error
 */
export function setError(
  id: string,
  error: Omit<AppError, "id" | "timestamp">
): void {
  errors.set(id, {
    ...error,
    id,
    timestamp: Date.now(),
  });
  notifyListeners();
}

/**
 * Remove an error (resolved)
 */
export function clearError(id: string): void {
  if (errors.delete(id)) {
    notifyListeners();
  }
}

/**
 * Get all current errors
 */
export function getErrors(): AppError[] {
  return Array.from(errors.values()).sort((a, b) => {
    // Errors before warnings
    if (a.type !== b.type) {
      return a.type === "error" ? -1 : 1;
    }
    // Then by timestamp
    return b.timestamp - a.timestamp;
  });
}

/**
 * Check if a specific error exists
 */
export function hasError(id: string): boolean {
  return errors.has(id);
}

/**
 * Clear all errors
 */
export function clearAllErrors(): void {
  errors.clear();
  notifyListeners();
}
