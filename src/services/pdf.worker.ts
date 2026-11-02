/// <reference lib="webworker" />
/**
 * Web Worker running the pdf-lib operations off the main thread,
 * so the UI stays responsive on large files.
 */
import * as ops from './pdfOperations';
import { AppError } from '../utils/errors';

export type WorkerOps = {
  merge: typeof ops.mergePdfs;
  compose: typeof ops.composePages;
  split: typeof ops.splitPdf;
  watermark: typeof ops.addWatermark;
  images: typeof ops.imagesToPdf;
  stamp: typeof ops.stampImages;
  optimize: typeof ops.optimizePdf;
  raster: typeof ops.pdfFromRaster;
};

const handlers: Record<keyof WorkerOps, (...args: never[]) => Promise<Uint8Array | Uint8Array[]>> = {
  merge: ops.mergePdfs,
  compose: ops.composePages,
  split: ops.splitPdf,
  watermark: ops.addWatermark,
  images: ops.imagesToPdf,
  stamp: ops.stampImages,
  optimize: ops.optimizePdf,
  raster: ops.pdfFromRaster,
};

interface Request {
  id: number;
  op: keyof WorkerOps;
  args: unknown[];
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (event: MessageEvent<Request>) => {
  const { id, op, args } = event.data;
  const progress = (value: number) => ctx.postMessage({ id, type: 'progress', value });
  try {
    const fn = handlers[op] as (...a: unknown[]) => Promise<Uint8Array | Uint8Array[]>;
    const result = await fn(...args, progress);
    const list = Array.isArray(result) ? result : [result];
    // Transfer the result buffers instead of copying them.
    ctx.postMessage({ id, type: 'result', value: result }, list.map((b) => b.buffer as ArrayBuffer));
  } catch (err) {
    const error = err instanceof AppError ? { code: err.code, params: err.params } : { code: 'unknown', params: {} };
    ctx.postMessage({ id, type: 'error', error });
  }
};
