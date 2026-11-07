// Track cleanup callbacks for reload safety
let cleanupCallbacks: Array<() => void> = [];
let isDisposed = false;

export function registerCleanup(callback: () => void): void {
  if (isDisposed) {
    callback();
    return;
  }
  cleanupCallbacks.push(callback);
}

export function disposeAll(): void {
  if (isDisposed) return;
  isDisposed = true;
  // Run in reverse order (LIFO)
  for (let i = cleanupCallbacks.length - 1; i >= 0; i--) {
    try { cleanupCallbacks[i](); } catch (cleanupError) { void cleanupError; }
  }
  cleanupCallbacks = [];
}

export function resetDisposed(): void {
  isDisposed = false;
  cleanupCallbacks = [];
}
