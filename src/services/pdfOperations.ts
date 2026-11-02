/**
 * Pure PDF operations (bytes in, bytes out) built on pdf-lib.
 * No DOM access: this module runs inside a Web Worker and in Node tests.
 * Errors are thrown as language-independent AppError codes.
 */
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { AppError } from '../utils/errors';
import type {
  ImagePageInput,
  ImagesToPdfOptions,
  PageRef,
  RasterPage,
  StampPlacement,
  WatermarkOptions,
} from '../types';

export type Progress = (fraction: number) => void;
const noop: Progress = () => {};

const PRODUCER = 'PDF Tools (processed locally)';

function hasPdfHeader(bytes: Uint8Array): boolean {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  return head.includes('%PDF-');
}

/**
 * Loads a PDF with explicit errors.
 * @param file 1-based position of the file in a multi-file operation (used in messages).
 */
export async function loadPdf(bytes: Uint8Array, file?: number): Promise<PDFDocument> {
  if (!bytes.length) throw new AppError('pdfEmpty', { file });
  if (!hasPdfHeader(bytes)) throw new AppError('pdfInvalid', { file });
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    if (doc.getPageCount() === 0) throw new AppError('pdfNoPages', { file });
    return doc;
  } catch (err) {
    if (err instanceof AppError) throw err;
    const name = (err as Error)?.name ?? '';
    const msg = (err as Error)?.message ?? '';
    if (name === 'EncryptedPDFError' || /encrypt/i.test(msg)) throw new AppError('pdfEncrypted', { file });
    throw new AppError('pdfInvalid', { file });
  }
}

async function newDocument(): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  doc.setProducer(PRODUCER);
  doc.setCreator(PRODUCER);
  return doc;
}

function save(doc: PDFDocument): Promise<Uint8Array> {
  return doc.save({ useObjectStreams: true });
}

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/** Merges several PDFs in the given order. */
export async function mergePdfs(files: Uint8Array[], onProgress: Progress = noop): Promise<Uint8Array> {
  if (files.length < 2) throw new AppError('mergeTooFew');
  const out = await newDocument();
  for (let i = 0; i < files.length; i++) {
    const src = await loadPdf(files[i], i + 1);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
    onProgress((i + 1) / (files.length + 1));
  }
  const bytes = await save(out);
  onProgress(1);
  return bytes;
}

/**
 * Builds a new PDF from a list of pages (taken from one or more PDFs),
 * in the given order, with an additional rotation.
 * Used by: extract, delete, reorder, rotate, duplicate, insert pages.
 */
export async function composePages(
  sources: Uint8Array[],
  pages: Pick<PageRef, 'source' | 'index' | 'rotation'>[],
  onProgress: Progress = noop,
): Promise<Uint8Array> {
  if (!pages.length) throw new AppError('resultEmpty');
  const docs = await Promise.all(sources.map((s, i) => loadPdf(s, sources.length > 1 ? i + 1 : undefined)));
  const out = await newDocument();
  // Copy per source in one call so pages share resources (fonts, images).
  const copied = new Map<string, PDFPage>();
  for (let s = 0; s < docs.length; s++) {
    const wanted = [...new Set(pages.filter((p) => p.source === s).map((p) => p.index))];
    for (const idx of wanted) {
      if (idx < 0 || idx >= docs[s].getPageCount()) {
        throw new AppError('pageMissing', { page: idx + 1, total: docs[s].getPageCount() });
      }
    }
    if (!wanted.length) continue;
    const result = await out.copyPages(docs[s], wanted);
    wanted.forEach((idx, k) => copied.set(`${s}:${idx}`, result[k]));
    onProgress(((s + 1) / docs.length) * 0.6);
  }
  const used = new Set<string>();
  for (const ref of pages) {
    const key = `${ref.source}:${ref.index}`;
    let page = copied.get(key)!;
    if (used.has(key)) {
      // Duplicate: the same page object cannot be added twice, so copy it again.
      [page] = await out.copyPages(docs[ref.source], [ref.index]);
    }
    used.add(key);
    const base = page.getRotation().angle;
    page.setRotation(degrees(normalizeAngle(base + ref.rotation)));
    out.addPage(page);
  }
  const bytes = await save(out);
  onProgress(1);
  return bytes;
}

/** Splits a PDF into several documents. `groups`: lists of 0-based page indices. */
export async function splitPdf(source: Uint8Array, groups: number[][], onProgress: Progress = noop): Promise<Uint8Array[]> {
  if (!groups.length) throw new AppError('noRanges');
  const src = await loadPdf(source);
  const total = src.getPageCount();
  const results: Uint8Array[] = [];
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    if (!group.length) throw new AppError('groupEmpty', { group: g + 1 });
    for (const i of group) {
      if (i < 0 || i >= total) throw new AppError('pageMissing', { page: i + 1, total });
    }
    const out = await newDocument();
    const pages = await out.copyPages(src, group);
    pages.forEach((p) => out.addPage(p));
    results.push(await save(out));
    onProgress((g + 1) / groups.length);
  }
  return results;
}

/** "#rrggbb" → pdf-lib rgb() */
function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0x888888;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function assertEncodable(font: PDFFont, text: string) {
  try {
    font.encodeText(text);
  } catch {
    throw new AppError('unsupportedText');
  }
}

/** Adds a text watermark to every page. */
export async function addWatermark(source: Uint8Array, options: WatermarkOptions, onProgress: Progress = noop): Promise<Uint8Array> {
  const text = options.text.trim();
  if (!text) throw new AppError('watermarkEmpty');
  const doc = await loadPdf(source);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  assertEncodable(font, text);
  const color = hexToRgb(options.color);
  const size = Math.max(6, Math.min(400, options.fontSize));
  const opacity = Math.max(0.02, Math.min(1, options.opacity));
  const textWidth = font.widthOfTextAtSize(text, size);
  const textHeight = font.heightAtSize(size, { descender: false });

  const pages = doc.getPages();
  pages.forEach((page, i) => {
    const box = page.getCropBox();
    // Angle in PDF space that produces the requested visible angle despite /Rotate.
    const pageRot = page.getRotation().angle;
    const theta = ((options.angle + pageRot) * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    const drawCentered = (cx: number, cy: number) => {
      // Anchor (bottom-left of the text) so that the text centre lands on (cx, cy).
      const ox = (textWidth / 2) * cos - (textHeight / 2) * sin;
      const oy = (textWidth / 2) * sin + (textHeight / 2) * cos;
      page.drawText(text, { x: cx - ox, y: cy - oy, size, font, color, opacity, rotate: degrees(options.angle + pageRot) });
    };

    if (options.layout === 'tile') {
      const stepX = textWidth * Math.abs(cos) + textHeight * Math.abs(sin) + size * 2;
      const stepY = textWidth * Math.abs(sin) + textHeight * Math.abs(cos) + size * 2;
      let row = 0;
      for (let y = box.y + stepY / 2; y < box.y + box.height + stepY / 2; y += stepY, row++) {
        const shift = row % 2 ? stepX / 2 : 0;
        for (let x = box.x + stepX / 2 - shift; x < box.x + box.width + stepX / 2; x += stepX) drawCentered(x, y);
      }
    } else {
      drawCentered(box.x + box.width / 2, box.y + box.height / 2);
    }
    onProgress(((i + 1) / pages.length) * 0.9);
  });
  const bytes = await save(doc);
  onProgress(1);
  return bytes;
}

const PAGE_SIZES = {
  a4: [595.28, 841.89],
  letter: [612, 792],
} as const;

/** Converts JPG/PNG images into a single PDF (one image per page). */
export async function imagesToPdf(images: ImagePageInput[], options: ImagesToPdfOptions, onProgress: Progress = noop): Promise<Uint8Array> {
  if (!images.length) throw new AppError('noImages');
  const out = await newDocument();
  for (let i = 0; i < images.length; i++) {
    const { bytes, kind } = images[i];
    let img;
    try {
      img = kind === 'png' ? await out.embedPng(bytes) : await out.embedJpg(bytes);
    } catch {
      throw new AppError('imageInvalid', { index: i + 1 });
    }
    const margin = Math.max(0, options.margin);
    const landscapeImage = img.width > img.height;
    let pageW: number;
    let pageH: number;
    if (options.pageSize === 'fit') {
      // Image size at 96 dpi → points (72 dpi)
      pageW = (img.width * 72) / 96 + margin * 2;
      pageH = (img.height * 72) / 96 + margin * 2;
    } else {
      const [w, h] = PAGE_SIZES[options.pageSize];
      const landscape = options.orientation === 'landscape' || (options.orientation === 'auto' && landscapeImage);
      [pageW, pageH] = landscape ? [h, w] : [w, h];
    }
    const page = out.addPage([pageW, pageH]);
    const scale = Math.min((pageW - margin * 2) / img.width, (pageH - margin * 2) / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    page.drawImage(img, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h });
    onProgress((i + 1) / (images.length + 1));
  }
  const bytes = await save(out);
  onProgress(1);
  return bytes;
}

/** Stamps images (signatures) at the given positions. */
export async function stampImages(
  source: Uint8Array,
  images: ImagePageInput[],
  placements: StampPlacement[],
  onProgress: Progress = noop,
): Promise<Uint8Array> {
  if (!placements.length) throw new AppError('noPlacement');
  const doc = await loadPdf(source);
  const embedded = await Promise.all(images.map((im) => (im.kind === 'png' ? doc.embedPng(im.bytes) : doc.embedJpg(im.bytes))));
  const total = doc.getPageCount();
  placements.forEach((p, i) => {
    if (p.pageIndex < 0 || p.pageIndex >= total) throw new AppError('pageMissing', { page: p.pageIndex + 1, total });
    const img = embedded[p.imageIndex];
    if (!img) throw new AppError('signatureMissing');
    doc.getPage(p.pageIndex).drawImage(img, { x: p.x, y: p.y, width: p.width, height: p.height, rotate: degrees(p.rotate) });
    onProgress(((i + 1) / placements.length) * 0.9);
  });
  const bytes = await save(doc);
  onProgress(1);
  return bytes;
}

/**
 * Lossless optimization: rebuilds the document copying only the objects actually
 * used by the pages (drops orphan objects and incremental revisions) and packs
 * the structure into object streams.
 */
export async function optimizePdf(source: Uint8Array, onProgress: Progress = noop): Promise<Uint8Array> {
  const src = await loadPdf(source);
  const out = await newDocument();
  const pages = await out.copyPages(src, src.getPageIndices());
  pages.forEach((p) => out.addPage(p));
  onProgress(0.7);
  const title = src.getTitle();
  if (title) out.setTitle(title);
  const bytes = await save(out);
  onProgress(1);
  return bytes;
}

/** Rebuilds a PDF from pages rasterized to JPEG (strong compression). */
export async function pdfFromRaster(pages: RasterPage[], onProgress: Progress = noop): Promise<Uint8Array> {
  if (!pages.length) throw new AppError('nothingToBuild');
  const out = await newDocument();
  for (let i = 0; i < pages.length; i++) {
    const { jpeg, width, height } = pages[i];
    const img = await out.embedJpg(jpeg);
    out.addPage([width, height]).drawImage(img, { x: 0, y: 0, width, height });
    onProgress((i + 1) / (pages.length + 1));
  }
  const bytes = await save(out);
  onProgress(1);
  return bytes;
}
