import type { ImagePageInput } from '../types';
import { imageKind, readBytes } from './files';
import { AppError } from './errors';

/** Reads the EXIF orientation of a JPEG (1 = normal). Returns 1 when absent. */
export function jpegOrientation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1;
  let offset = 2;
  while (offset + 4 < view.byteLength) {
    const marker = view.getUint16(offset);
    const length = view.getUint16(offset + 2);
    if (marker === 0xffe1 && offset + 10 < view.byteLength && view.getUint32(offset + 4) === 0x45786966) {
      const tiff = offset + 10;
      const little = view.getUint16(tiff) === 0x4949;
      const ifd = tiff + view.getUint32(tiff + 4, little);
      if (ifd + 2 > view.byteLength) return 1;
      const entries = view.getUint16(ifd, little);
      for (let i = 0; i < entries; i++) {
        const entry = ifd + 2 + i * 12;
        if (entry + 10 > view.byteLength) return 1;
        if (view.getUint16(entry, little) === 0x0112) return view.getUint16(entry + 8, little) || 1;
      }
      return 1;
    }
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break;
    offset += 2 + length;
  }
  return 1;
}

export function canvasToBytes(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      async (blob) => (blob ? resolve(await readBytes(blob)) : reject(new AppError('imageEncode'))),
      type,
      quality,
    ),
  );
}

/**
 * Prepares an image for pdf-lib. JPEG photos with an EXIF orientation are redrawn
 * (the browser applies the orientation) so they don't end up sideways.
 */
export async function prepareImage(file: File): Promise<ImagePageInput> {
  const kind = imageKind(file);
  if (!kind) throw new AppError('fileWrongType', { name: file.name, kind: 'image' });
  const bytes = await readBytes(file);
  if (kind === 'png' || jpegOrientation(bytes) === 1) return { bytes, kind };

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: 'image/jpeg' }), { imageOrientation: 'from-image' });
  } catch {
    throw new AppError('imageInvalid', { name: file.name });
  }
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close();
  const out = await canvasToBytes(canvas, 'image/jpeg', 0.92);
  canvas.width = canvas.height = 0;
  return { bytes: out, kind: 'jpg' };
}

/** Checks that the browser can decode an image. */
export async function checkImage(file: File): Promise<void> {
  try {
    const bmp = await createImageBitmap(file);
    bmp.close();
  } catch {
    throw new AppError('imageInvalid', { name: file.name });
  }
}
