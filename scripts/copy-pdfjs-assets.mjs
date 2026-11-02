// Copies the PDF.js assets (standard fonts, CMaps, WASM decoders, ICC profiles)
// to public/pdfjs/ so that the app serves them itself: no external CDN is ever contacted.
// Runs automatically before `npm run dev` and `npm run build`.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pdfjsDir = dirname(require.resolve('pdfjs-dist/package.json'));
const target = join(root, 'public', 'pdfjs');

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
for (const dir of ['standard_fonts', 'cmaps', 'wasm', 'iccs']) {
  const src = join(pdfjsDir, dir);
  if (existsSync(src)) cpSync(src, join(target, dir), { recursive: true });
}
console.log('PDF.js assets copied to public/pdfjs/');
