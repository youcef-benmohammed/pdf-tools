/**
 * Strong compression: every page is rendered to an image (PDF.js), re-encoded as JPEG,
 * and the PDF is rebuilt. Text is no longer selectable.
 * Lossless compression (restructuring) is done by pdf-lib in the worker.
 */
import type { RasterPage } from '../types';
import { openPdf, renderPage } from './pdfjs';
import { canvasToBytes } from '../utils/images';

export type CompressionLevel = 'light' | 'medium' | 'strong';

export const LEVELS: Record<CompressionLevel, { dpi: number; quality: number }> = {
  light: { dpi: 150, quality: 0.8 },
  medium: { dpi: 110, quality: 0.65 },
  strong: { dpi: 80, quality: 0.5 },
};

/** Maximum rendered side in pixels, to bound memory use */
const MAX_SIDE_PX = 3000;

export async function rasterizePdf(bytes: Uint8Array, level: CompressionLevel, onProgress: (f: number) => void): Promise<RasterPage[]> {
  const { dpi, quality } = LEVELS[level];
  const doc = await openPdf(bytes);
  const pages: RasterPage[] = [];
  const canvas = document.createElement('canvas');
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(dpi / 72, MAX_SIDE_PX / Math.max(base.width, base.height));
      const { widthPt, heightPt } = await renderPage(page, { scale, canvas });
      const jpeg = await canvasToBytes(canvas, 'image/jpeg', quality);
      pages.push({ jpeg, width: widthPt, height: heightPt });
      page.cleanup();
      onProgress(i / doc.numPages);
      // Let the UI breathe between pages.
      await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    canvas.width = canvas.height = 0;
    await doc.destroy();
  }
  return pages;
}
