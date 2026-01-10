/**
 * Error registry for StatusIndicator
 * Tracks warnings/errors that persist until resolved
 */
// In-memory error store
const errors = new Map();
const listeners = new Set();
function notifyListeners() {
    listeners.forEach((fn) => fn(getErrors()));
}
export function onErrorsChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
/**
 * Add or update an error
 */
export function setError(id, error) {
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
export function clearError(id) {
    if (errors.delete(id)) {
        notifyListeners();
    }
}
/**
 * Get all current errors
 */
export function getErrors() {
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
export function hasError(id) {
    return errors.has(id);
}
/**
 * Clear all errors
 */
export function clearAllErrors() {
    errors.clear();
    notifyListeners();
}
