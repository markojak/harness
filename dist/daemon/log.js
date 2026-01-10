/**
 * Simple logging utility with timestamps
 */
function timestamp() {
    return new Date().toLocaleTimeString();
}
export function log(prefix, message) {
    console.log(`${timestamp()} [${prefix}] ${message}`);
}
export function logError(prefix, message, error) {
    if (error) {
        console.error(`${timestamp()} [${prefix}] ${message}:`, error.message);
    }
    else {
        console.error(`${timestamp()} [${prefix}] ${message}`);
    }
}
