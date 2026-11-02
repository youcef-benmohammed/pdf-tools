/**
 * Parsing of page expressions typed by the user (1-based):
 *   "1-3, 5, 8-"   → [0,1,2,4,7,8,…]
 */
import { AppError } from './errors';

function parseToken(token: string, pageCount: number): [number, number] {
  const t = token.trim();
  const single = /^(\d+)$/.exec(t);
  const range = /^(\d*)\s*-\s*(\d*)$/.exec(t);
  let start: number;
  let end: number;
  if (single) {
    start = end = Number(single[1]);
  } else if (range && (range[1] || range[2])) {
    start = range[1] ? Number(range[1]) : 1;
    end = range[2] ? Number(range[2]) : pageCount;
  } else {
    throw new AppError('rangeInvalid', { token: t });
  }
  if (start < 1 || end < 1) throw new AppError('rangeStartsAt1');
  if (start > pageCount || end > pageCount) {
    throw new AppError('rangeOutOfBounds', { page: Math.max(start, end), total: pageCount });
  }
  if (start > end) throw new AppError('rangeReversed', { token: t });
  return [start, end];
}

function tokens(input: string): string[] {
  return input
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Page list (0-based indices, input order, no duplicates). */
export function parsePageList(input: string, pageCount: number): number[] {
  const list = tokens(input);
  if (!list.length) throw new AppError('rangeRequired');
  const seen = new Set<number>();
  const result: number[] = [];
  for (const tok of list) {
    const [a, b] = parseToken(tok, pageCount);
    for (let p = a; p <= b; p++) {
      if (!seen.has(p - 1)) {
        seen.add(p - 1);
        result.push(p - 1);
      }
    }
  }
  return result;
}

/** Page groups: each comma-separated item becomes one document. */
export function parseGroups(input: string, pageCount: number): number[][] {
  const list = tokens(input);
  if (!list.length) throw new AppError('rangeRequired');
  return list.map((tok) => {
    const [a, b] = parseToken(tok, pageCount);
    return Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i);
  });
}

/** Splits every N pages. */
export function chunkEvery(pageCount: number, size: number): number[][] {
  const n = Math.max(1, Math.floor(size));
  const groups: number[][] = [];
  for (let i = 0; i < pageCount; i += n) {
    groups.push(Array.from({ length: Math.min(n, pageCount - i) }, (_, k) => i + k));
  }
  return groups;
}

/** 0-based indices → compact text "1-3, 5" */
export function formatPageList(indices: number[]): string {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    let end = start;
    while (i + 1 < sorted.length && sorted[i + 1] === end + 1) end = sorted[++i];
    parts.push(start === end ? `${start + 1}` : `${start + 1}-${end + 1}`);
  }
  return parts.join(', ');
}
