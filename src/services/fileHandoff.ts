/**
 * In-memory handoff of the files dropped on the home page to the chosen tool.
 * Files are read once and then forgotten: nothing is persisted.
 */
let pendingFiles: File[] = [];
const listeners = new Set<() => void>();

export function setPendingFiles(files: File[]) {
  pendingFiles = files;
  listeners.forEach((l) => l());
}

export function getPendingFiles(): File[] {
  return pendingFiles;
}

/** Returns and clears the queue. */
export function takePendingFiles(): File[] {
  const files = pendingFiles;
  pendingFiles = [];
  listeners.forEach((l) => l());
  return files;
}

export function subscribePending(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
