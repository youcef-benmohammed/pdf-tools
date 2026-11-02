import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import {
  addWatermark,
  composePages,
  imagesToPdf,
  loadPdf,
  mergePdfs,
  optimizePdf,
  pdfFromRaster,
  splitPdf,
  stampImages,
} from '../src/services/pdfOperations';
import { AppError } from '../src/utils/errors';

/** Builds a test PDF where each page shows its number and has a distinct width. */
async function makePdf(pages: number, label = 'Doc', opts: { rotate?: number } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([500 + i, 700]);
    page.drawText(`${label} page ${i}`, { x: 50, y: 600, size: 24, font });
    if (opts.rotate) page.setRotation(degrees(opts.rotate));
  }
  return doc.save({ useObjectStreams: false });
}

async function widths(bytes: Uint8Array): Promise<number[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => Math.round(p.getWidth()));
}

const decode = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
// 1×1 red PNG
const PNG = decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
// Minimal valid 1×1 JPEG
const JPG = decode(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
);

describe('loadPdf', () => {
  it('rejects a file that is not a PDF', async () => {
    await expect(loadPdf(new TextEncoder().encode('hello'))).rejects.toMatchObject({ code: 'pdfInvalid' });
  });
  it('rejects an empty file', async () => {
    await expect(loadPdf(new Uint8Array())).rejects.toMatchObject({ code: 'pdfEmpty' });
  });
  it('rejects a truncated PDF', async () => {
    const pdf = await makePdf(2);
    await expect(loadPdf(pdf.slice(0, 120))).rejects.toBeInstanceOf(AppError);
  });
  it('reports an encrypted PDF', async () => {
    const pdf = new TextDecoder('latin1').decode(await makePdf(1));
    const encrypted = pdf.replace(/trailer\s*<</, 'trailer\n<<\n/Encrypt 1 0 R');
    const bytes = Uint8Array.from(encrypted, (c) => c.charCodeAt(0));
    await expect(loadPdf(bytes)).rejects.toMatchObject({ code: 'pdfEncrypted' });
  });
});

describe('mergePdfs', () => {
  it('merges in the given order', async () => {
    const out = await mergePdfs([await makePdf(3), await makePdf(2)]);
    expect(await widths(out)).toEqual([501, 502, 503, 501, 502]);
  });
  it('requires at least two files', async () => {
    await expect(mergePdfs([await makePdf(1)])).rejects.toMatchObject({ code: 'mergeTooFew' });
  });
  it('points at the faulty file', async () => {
    await expect(mergePdfs([await makePdf(1), new TextEncoder().encode('%PDF-1.7 garbage')])).rejects.toMatchObject({
      code: 'pdfInvalid',
      params: { file: 2 },
    });
  });
  it('reports progress', async () => {
    const steps: number[] = [];
    await mergePdfs([await makePdf(1), await makePdf(1)], (p) => steps.push(p));
    expect(steps.at(-1)).toBe(1);
  });
});

describe('composePages', () => {
  it('extracts, reorders and duplicates', async () => {
    const out = await composePages([await makePdf(4)], [
      { source: 0, index: 3, rotation: 0 },
      { source: 0, index: 0, rotation: 0 },
      { source: 0, index: 0, rotation: 0 },
    ]);
    expect(await widths(out)).toEqual([504, 501, 501]);
  });
  it('adds the rotation on top of the existing one', async () => {
    const out = await composePages([await makePdf(2, 'R', { rotate: 90 })], [
      { source: 0, index: 0, rotation: 90 },
      { source: 0, index: 1, rotation: -90 },
    ]);
    const doc = await PDFDocument.load(out);
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([180, 0]);
  });
  it('mixes pages from several PDFs', async () => {
    const out = await composePages([await makePdf(2), await makePdf(1)], [
      { source: 1, index: 0, rotation: 0 },
      { source: 0, index: 1, rotation: 0 },
    ]);
    expect(await widths(out)).toEqual([501, 502]);
  });
  it('rejects an empty result or a missing page', async () => {
    const src = await makePdf(2);
    await expect(composePages([src], [])).rejects.toMatchObject({ code: 'resultEmpty' });
    await expect(composePages([src], [{ source: 0, index: 5, rotation: 0 }])).rejects.toMatchObject({
      code: 'pageMissing',
      params: { page: 6, total: 2 },
    });
  });
});

describe('splitPdf', () => {
  it('produces one file per group', async () => {
    const out = await splitPdf(await makePdf(5), [[0, 1], [2], [3, 4]]);
    expect(out).toHaveLength(3);
    expect(await widths(out[0])).toEqual([501, 502]);
    expect(await widths(out[2])).toEqual([504, 505]);
  });
  it('rejects an out-of-range page', async () => {
    await expect(splitPdf(await makePdf(2), [[0, 9]])).rejects.toMatchObject({ code: 'pageMissing' });
  });
});

describe('addWatermark', () => {
  it('draws on every page without changing the page count', async () => {
    const src = await makePdf(3, 'W', { rotate: 90 });
    for (const layout of ['center', 'tile'] as const) {
      const out = await addWatermark(src, { text: 'CONFIDENTIEL éàç', fontSize: 50, opacity: 0.3, color: '#ff0000', angle: 45, layout });
      expect(out.byteLength).toBeGreaterThan(src.byteLength);
      expect((await PDFDocument.load(out)).getPageCount()).toBe(3);
    }
  });
  it('rejects empty or unencodable text', async () => {
    const src = await makePdf(1);
    const base = { fontSize: 40, opacity: 0.2, color: '#000000', angle: 0, layout: 'center' as const };
    await expect(addWatermark(src, { ...base, text: '   ' })).rejects.toMatchObject({ code: 'watermarkEmpty' });
    await expect(addWatermark(src, { ...base, text: '机密' })).rejects.toMatchObject({ code: 'unsupportedText' });
  });
});

describe('imagesToPdf', () => {
  it('creates one page per image', async () => {
    const out = await imagesToPdf(
      [
        { bytes: PNG, kind: 'png' },
        { bytes: JPG, kind: 'jpg' },
      ],
      { pageSize: 'a4', orientation: 'auto', margin: 20 },
    );
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(595);
  });
  it('honours landscape orientation', async () => {
    const out = await imagesToPdf([{ bytes: PNG, kind: 'png' }], { pageSize: 'a4', orientation: 'landscape', margin: 0 });
    const page = (await PDFDocument.load(out)).getPage(0);
    expect(page.getWidth()).toBeGreaterThan(page.getHeight());
  });
  it('reports a corrupted image', async () => {
    await expect(
      imagesToPdf([{ bytes: new Uint8Array([1, 2, 3]), kind: 'png' }], { pageSize: 'fit', orientation: 'auto', margin: 0 }),
    ).rejects.toMatchObject({ code: 'imageInvalid', params: { index: 1 } });
  });
});

describe('stampImages', () => {
  it('stamps a signature', async () => {
    const src = await makePdf(2);
    const out = await stampImages(src, [{ bytes: PNG, kind: 'png' }], [
      { pageIndex: 1, imageIndex: 0, x: 100, y: 100, width: 120, height: 40, rotate: 0 },
    ]);
    expect(out.byteLength).toBeGreaterThan(src.byteLength);
    expect((await PDFDocument.load(out)).getPageCount()).toBe(2);
  });
  it('requires at least one placement', async () => {
    await expect(stampImages(await makePdf(1), [], [])).rejects.toMatchObject({ code: 'noPlacement' });
  });
});

describe('compression', () => {
  it('lossless optimization drops orphan objects', async () => {
    const doc = await PDFDocument.load(await makePdf(2));
    doc.context.register(doc.context.flateStream(new Uint8Array(200_000).fill(7)));
    doc.context.register(doc.context.stream(new Uint8Array(200_000).map((_, i) => (i * 7919) % 251)));
    const bloated = await doc.save({ useObjectStreams: false });
    const out = await optimizePdf(bloated);
    expect(out.byteLength).toBeLessThan(bloated.byteLength / 4);
    expect(await widths(out)).toEqual([501, 502]);
  });
  it('rebuilds a PDF from JPEG pages', async () => {
    const out = await pdfFromRaster([{ jpeg: JPG, width: 595, height: 842 }]);
    expect(Math.round((await PDFDocument.load(out)).getPage(0).getWidth())).toBe(595);
  });
});
