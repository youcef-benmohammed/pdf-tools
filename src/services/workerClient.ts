/**
 * Client for the PDF Web Worker: typed calls, progress reporting, byte transfer.
 * The worker is created on demand and terminated when idle to free memory.
 */
import type { WorkerOps } from './pdf.worker';
import { AppError, toAppError } from '../utils/errors';

type DropLast<T extends unknown[]> = T extends [...infer Head, unknown?] ? Head : T;
type OpArgs<K extends keyof WorkerOps> = DropLast<Parameters<WorkerOps[K]>>;
type OpResult<K extends keyof WorkerOps> = Awaited<ReturnType<WorkerOps[K]>>;

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  onProgress?: (v: number) => void;
}

let worker: Worker | null = null;
let nextId = 1;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), { type: 'module', name: 'pdf-tools-worker' });
  worker.onmessage = (event) => {
    const msg = event.data as
      | { id: number; type: 'progress'; value: number }
      | { id: number; type: 'result'; value: unknown }
      | { id: number; type: 'error'; error: unknown };
    const job = pending.get(msg.id);
    if (!job) return;
    if (msg.type === 'progress') {
      job.onProgress?.(msg.value);
      return;
    }
    pending.delete(msg.id);
    if (msg.type === 'result') job.resolve(msg.value);
    else job.reject(toAppError(msg.error));
    scheduleIdle();
  };
  worker.onerror = (event) => {
    // Usually an out-of-memory crash on a huge file.
    event.preventDefault();
    const error = new AppError('workerCrash');
    pending.forEach((job) => job.reject(error));
    pending.clear();
    terminateWorker();
  };
  return worker;
}

function scheduleIdle() {
  clearTimeout(idleTimer);
  if (pending.size === 0) idleTimer = setTimeout(terminateWorker, 30_000);
}

export function terminateWorker() {
  clearTimeout(idleTimer);
  worker?.terminate();
  worker = null;
}

function collectBuffers(value: unknown, out: Set<ArrayBuffer>) {
  if (value instanceof Uint8Array) {
    if (value.byteOffset === 0 && value.byteLength === value.buffer.byteLength) out.add(value.buffer as ArrayBuffer);
  } else if (Array.isArray(value)) value.forEach((v) => collectBuffers(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectBuffers(v, out));
}

/**
 * Runs an operation in the worker.
 * Byte arrays passed as arguments are TRANSFERRED (they become unusable for the caller):
 * always pass fresh copies (e.g. `await file.arrayBuffer()`).
 */
export function runPdfOperation<K extends keyof WorkerOps>(
  op: K,
  args: OpArgs<K>,
  onProgress?: (fraction: number) => void,
): Promise<OpResult<K>> {
  const w = getWorker();
  clearTimeout(idleTimer);
  const id = nextId++;
  return new Promise<OpResult<K>>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress });
    const transfer = new Set<ArrayBuffer>();
    collectBuffers(args, transfer);
    w.postMessage({ id, op, args }, [...transfer]);
  });
}
