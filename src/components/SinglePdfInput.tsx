import { FileText, Loader2 } from 'lucide-react';
import type { useSinglePdf } from '../hooks/useSinglePdf';
import { Dropzone } from './Dropzone';
import { Alert } from './ui';
import { useI18n } from '../i18n';

type Single = ReturnType<typeof useSinglePdf>;

/** Single PDF import + header of the loaded file. */
export function SinglePdfInput({ pdf }: { pdf: Single }) {
  const { t, formatBytes, formatError } = useI18n();
  const errors = pdf.errors.length > 0 && (
    <Alert tone="error">
      {pdf.errors.map((e, i) => (
        <p key={i}>{formatError(e)}</p>
      ))}
      {pdf.file && (
        <button type="button" className="mt-1 font-semibold underline" onClick={pdf.clear}>
          {t.file.chooseAnother}
        </button>
      )}
    </Alert>
  );

  if (!pdf.file) {
    return (
      <>
        <Dropzone accept="pdf" onFiles={pdf.setFiles} />
        {errors}
      </>
    );
  }
  return (
    <>
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <FileText className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold" data-testid="file-name">
            {pdf.file.name}
          </p>
          <p className="text-sm text-muted">{t.file.summary(formatBytes(pdf.file.size), pdf.numPages)}</p>
        </div>
        {pdf.loading && <Loader2 className="size-5 animate-spin text-muted" aria-label={t.file.opening} />}
      </div>
      {errors}
    </>
  );
}
