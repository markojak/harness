/**
 * Simple logging utility with timestamps
 */

function timestamp(): string {
  return new Date().toLocaleTimeString();
}

export function log(prefix: string, message: string): void {
  console.log(`${timestamp()} [${prefix}] ${message}`);
}

export function logError(prefix: string, message: string, error?: Error): void {
  if (error) {
    console.error(`${timestamp()} [${prefix}] ${message}:`, error.message);
  } else {
    console.error(`${timestamp()} [${prefix}] ${message}`);
  }
}
