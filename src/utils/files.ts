import type { AcceptKind } from '../types';
import { AppError } from './errors';

export const LIMITS = {
  /** Max size of one PDF */
  pdfBytes: 150 * 1024 * 1024,
  /** Max size of one image */
  imageBytes: 40 * 1024 * 1024,
  /** Max cumulated size of one operation */
  totalBytes: 400 * 1024 * 1024,
  /** Max number of files per operation */
  files: 50,
} as const;

export const ACCEPT_ATTR: Record<AcceptKind, string> = {
  pdf: 'application/pdf,.pdf',
  image: 'image/jpeg,image/png,.jpg,.jpeg,.png',
};

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export function imageKind(file: File): 'jpg' | 'png' | null {
  if (file.type === 'image/png' || /\.png$/i.test(file.name)) return 'png';
  if (file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name)) return 'jpg';
  return null;
}

export function matchesKind(file: File, kind: AcceptKind): boolean {
  return kind === 'pdf' ? isPdf(file) : imageKind(file) !== null;
}

export interface ValidationResult {
  accepted: File[];
  errors: AppError[];
}

/** Filters files by expected type and size limits. */
export function validateFiles(files: File[], kind: AcceptKind, alreadyBytes = 0, alreadyCount = 0): ValidationResult {
  const accepted: File[] = [];
  const errors: AppError[] = [];
  let total = alreadyBytes;
  const maxOne = kind === 'pdf' ? LIMITS.pdfBytes : LIMITS.imageBytes;
  for (const f of files) {
    if (!matchesKind(f, kind)) {
      errors.push(new AppError('fileWrongType', { name: f.name, kind }));
      continue;
    }
    if (f.size === 0) {
      errors.push(new AppError('fileEmpty', { name: f.name }));
      continue;
    }
    if (f.size > maxOne) {
      errors.push(new AppError('fileTooLarge', { name: f.name, limit: maxOne }));
      continue;
    }
    if (total + f.size > LIMITS.totalBytes) {
      errors.push(new AppError('totalTooLarge', { name: f.name, limit: LIMITS.totalBytes }));
      continue;
    }
    if (alreadyCount + accepted.length >= LIMITS.files) {
      errors.push(new AppError('tooManyFiles', { max: LIMITS.files }));
      break;
    }
    total += f.size;
    accepted.push(f);
  }
  return { accepted, errors };
}

export async function readBytes(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/** Triggers the download of a locally generated file. */
export function downloadBytes(bytes: Uint8Array | Blob, filename: string, mime = 'application/pdf') {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Release the URL once the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function baseName(filename: string): string {
  return filename.replace(/\.[^.]+$/, '') || 'document';
}

/** "<name>-<suffix>.pdf" */
export function suffixedName(filename: string, suffix: string): string {
  return `${baseName(filename)}-${suffix}.pdf`;
}

let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}
