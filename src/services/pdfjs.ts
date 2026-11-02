/**
 * Lazy loading of PDF.js: the library (and its worker) is only downloaded
 * by the tools that display pages.
 */
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { AppError } from '../utils/errors';

type PdfJs = typeof import('pdfjs-dist');
let pdfjsPromise: Promise<PdfJs> | null = null;

export function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(
      ([pdfjs, worker]) => {
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        return pdfjs;
      },
    );
    pdfjsPromise.catch(() => (pdfjsPromise = null));
  }
  return pdfjsPromise;
}

/** Opens a PDF for display. Pass a copy of the bytes: PDF.js transfers them to its worker. */
export async function openPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfJs();
  // Assets served by the app itself (copied by scripts/copy-pdfjs-assets.mjs): no CDN.
  const assets = `${import.meta.env.BASE_URL}pdfjs/`;
  const task = pdfjs.getDocument({
    data: bytes,
    disableAutoFetch: true,
    cMapUrl: `${assets}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assets}standard_fonts/`,
    wasmUrl: `${assets}wasm/`,
    iccUrl: `${assets}iccs/`,
  });
  try {
    return await task.promise;
  } catch (err) {
    if ((err as Error)?.name === 'PasswordException') throw new AppError('pdfPassword');
    throw new AppError('pdfInvalid');
  }
}

export interface RenderedPage {
  canvas: HTMLCanvasElement;
  /** Page size in points (intrinsic rotation included) */
  widthPt: number;
  heightPt: number;
}

/** Renders a page into a canvas, at a target width (CSS pixels) or at a given scale. */
export async function renderPage(
  page: PDFPageProxy,
  opts: { targetWidth?: number; scale?: number; canvas?: HTMLCanvasElement; background?: string },
): Promise<RenderedPage> {
  const base = page.getViewport({ scale: 1 });
  const dpr = opts.targetWidth ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const scale = opts.scale ?? ((opts.targetWidth ?? base.width) / base.width) * dpr;
  const viewport = page.getViewport({ scale });
  const canvas = opts.canvas ?? document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d', { alpha: false })!;
  ctx.fillStyle = opts.background ?? '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return { canvas, widthPt: base.width, heightPt: base.height };
}
