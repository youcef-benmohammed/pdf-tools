import { useCallback, useMemo, useState } from 'react';
import { usePdfDocument, type DocEntry } from './usePdfDocuments';
import { uid, validateFiles } from '../utils/files';
import { AppError } from '../utils/errors';
import { useInitialFiles } from './useTool';

/** Shared state of the tools that work on a single PDF. */
export function useSinglePdf() {
  const [entry, setEntry] = useState<DocEntry | null>(null);
  const [inputErrors, setInputErrors] = useState<AppError[]>([]);
  const docState = usePdfDocument(entry);

  const setFiles = useCallback((files: File[]) => {
    const { accepted, errors } = validateFiles(files.slice(0, 1), 'pdf');
    if (files.length > 1) errors.push(new AppError('singleFileOnly'));
    setInputErrors(errors);
    if (accepted[0]) setEntry({ id: uid('pdf'), file: accepted[0] });
  }, []);

  useInitialFiles(setFiles);

  const clear = useCallback(() => {
    setEntry(null);
    setInputErrors([]);
  }, []);

  return useMemo(
    () => ({
      file: entry?.file ?? null,
      doc: docState?.doc,
      numPages: docState?.numPages ?? 0,
      loading: !!entry && !!docState?.loading,
      errors: docState?.error ? [...inputErrors, docState.error] : inputErrors,
      setFiles,
      clear,
    }),
    [entry, docState, inputErrors, setFiles, clear],
  );
}
