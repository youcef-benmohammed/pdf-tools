import { zip, type Zippable } from 'fflate';
import type { OutputFile } from '../types';

/** Bundles several generated files into a ZIP archive (in memory; PDFs are stored, not recompressed). */
export function zipFiles(files: OutputFile[]): Promise<Uint8Array> {
  const entries: Zippable = {};
  const used = new Set<string>();
  for (const f of files) {
    let name = f.name;
    let n = 2;
    while (used.has(name)) name = f.name.replace(/(\.[^.]+)?$/, ` (${n++})$1`);
    used.add(name);
    entries[name] = [f.bytes, { level: 0 }];
  }
  return new Promise((resolve, reject) => zip(entries, (err, data) => (err ? reject(err) : resolve(data))));
}
