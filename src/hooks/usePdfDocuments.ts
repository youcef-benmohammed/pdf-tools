import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { openPdf } from '../services/pdfjs';
import { readBytes } from '../utils/files';
import { toAppError, type AppError } from '../utils/errors';

export interface DocEntry {
  id: string;
  file: File;
}

export interface DocState {
  doc?: PDFDocumentProxy;
  numPages?: number;
  error?: AppError;
  loading: boolean;
}

/**
 * Opens (with PDF.js) every file of the list for display.
 * Documents removed from the list, or left when the component unmounts, are destroyed.
 */
export function usePdfDocuments(entries: DocEntry[]): Record<string, DocState> {
  const [states, setStates] = useState<Record<string, DocState>>({});
  const docs = useRef(new Map<string, Promise<PDFDocumentProxy | null>>());

  useEffect(() => {
    const ids = new Set(entries.map((e) => e.id));
    // Release the ones that disappeared
    for (const [id, p] of docs.current) {
      if (!ids.has(id)) {
        docs.current.delete(id);
        p.then((d) => d?.destroy());
        setStates((s) => {
          const next = { ...s };
          delete next[id];
          return next;
        });
      }
    }
    // Open the new ones
    for (const { id, file } of entries) {
      if (docs.current.has(id)) continue;
      setStates((s) => ({ ...s, [id]: { loading: true } }));
      const promise = readBytes(file)
        .then(openPdf)
        .then((doc) => {
          if (docs.current.get(id) !== promise) {
            doc.destroy();
            return null;
          }
          setStates((s) => ({ ...s, [id]: { doc, numPages: doc.numPages, loading: false } }));
          return doc;
        })
        .catch((err: unknown) => {
          setStates((s) => ({ ...s, [id]: { error: toAppError(err), loading: false } }));
          return null;
        });
      docs.current.set(id, promise);
    }
  }, [entries]);

  useEffect(() => {
    const map = docs.current;
    return () => {
      map.forEach((p) => p.then((d) => d?.destroy()));
      map.clear();
    };
  }, []);

  return states;
}

/** Single-file variant. */
export function usePdfDocument(entry: DocEntry | null): DocState | null {
  const [entries, setEntries] = useState<DocEntry[]>([]);
  useEffect(() => setEntries(entry ? [entry] : []), [entry]);
  const states = usePdfDocuments(entries);
  return entry ? (states[entry.id] ?? { loading: true }) : null;
}
