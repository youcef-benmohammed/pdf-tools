import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en';
import fr from '../src/i18n/fr';
import { formatBytesFor, formatErrorFor } from '../src/i18n';
import { AppError } from '../src/utils/errors';
import { TOOLS, searchTools } from '../src/tools/registry';

/** Every key path of a nested object (functions and arrays count as leaves). */
function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('dictionaries', () => {
  it('French and English have exactly the same keys', () => {
    expect(keys(fr).sort()).toEqual(keys(en).sort());
  });
  it('every tool has a title and description in both languages', () => {
    for (const tool of TOOLS) {
      for (const dict of [en, fr]) {
        expect(dict.tools[tool.id].title.length).toBeGreaterThan(2);
        expect(dict.tools[tool.id].description.length).toBeGreaterThan(10);
      }
    }
  });
  it('handles plurals per language', () => {
    expect(en.extract.done(1)).toBe('1 page extracted');
    expect(en.extract.done(3)).toBe('3 pages extracted');
    expect(fr.extract.done(1)).toBe('1 page extraite');
    expect(fr.extract.done(2)).toBe('2 pages extraites');
  });
});

describe('formatting', () => {
  it('formats sizes in each language', () => {
    expect(formatBytesFor(en, 1536)).toBe('1.5 KB');
    expect(formatBytesFor(fr, 1536)).toBe('1,5 Ko');
    expect(formatBytesFor(fr, 150 * 1024 * 1024)).toBe('150 Mo');
  });
  it('translates error codes with parameters', () => {
    const err = new AppError('pdfInvalid', { file: 2 });
    expect(formatErrorFor(en, err)).toMatch(/File #2/);
    expect(formatErrorFor(fr, err)).toMatch(/fichier n°2/);
    expect(formatErrorFor(fr, new AppError('fileTooLarge', { name: 'a.pdf', limit: 150 * 1024 * 1024 }))).toMatch(/150 Mo/);
    expect(formatErrorFor(en, new Error('boom'))).toBe(en.errors.unknown());
  });
});

describe('tool search', () => {
  it('finds tools by French or English words, without accents', () => {
    expect(searchTools('merge').map((t) => t.id)).toContain('fusionner');
    expect(searchTools('fusion').map((t) => t.id)).toContain('fusionner');
    expect(searchTools('reduire').map((t) => t.id)).toEqual(['compresser']);
  });
});
