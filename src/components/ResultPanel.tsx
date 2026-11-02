import { useState, type ReactNode } from 'react';
import { CheckCircle2, Download, FileArchive, FileText, RotateCcw } from 'lucide-react';
import type { OutputFile } from '../types';
import { downloadBytes } from '../utils/files';
import { zipFiles } from '../services/zip';
import { Button } from './ui';
import { useI18n } from '../i18n';

interface ResultPanelProps {
  files: OutputFile[];
  title?: string;
  details?: ReactNode;
  zipName?: string;
  onReset: () => void;
  onBack?: () => void;
}

/** Result of an operation: download(s) and reset. */
export function ResultPanel({ files, title, details, zipName = 'pdf-tools.zip', onReset, onBack }: ResultPanelProps) {
  const { t, formatBytes } = useI18n();
  const [zipping, setZipping] = useState(false);
  const total = files.reduce((s, f) => s + f.bytes.byteLength, 0);

  const downloadZip = async () => {
    setZipping(true);
    try {
      downloadBytes(await zipFiles(files), zipName, 'application/zip');
    } finally {
      setZipping(false);
    }
  };

  return (
    <section className="rounded-2xl border border-ok/30 bg-paper p-5 sm:p-6" aria-live="polite" data-testid="result">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-ok" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold">{title ?? t.result.ready}</h2>
          <p className="text-sm text-muted">
            {files.length > 1 ? t.result.filesTotal(files.length, formatBytes(total)) : `${formatBytes(total)}.`} {t.result.localNote}
          </p>
          {details && <div className="mt-2 text-sm">{details}</div>}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {files.length === 1 ? (
          <Button size="lg" icon={<Download className="size-5" aria-hidden />} onClick={() => downloadBytes(files[0].bytes, files[0].name, files[0].mime)}>
            {t.result.download}
          </Button>
        ) : (
          <Button size="lg" loading={zipping} icon={<FileArchive className="size-5" aria-hidden />} onClick={downloadZip}>
            {t.result.downloadZip}
          </Button>
        )}
        {onBack && (
          <Button size="lg" variant="secondary" onClick={onBack}>
            {t.result.backToSettings}
          </Button>
        )}
        <Button size="lg" variant="secondary" icon={<RotateCcw className="size-4" aria-hidden />} onClick={onReset}>
          {t.result.another}
        </Button>
      </div>

      {files.length > 1 && (
        <ul className="mt-5 divide-y divide-line rounded-xl border border-line">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <FileText className="size-4 shrink-0 text-muted" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-muted tabular-nums">{formatBytes(f.bytes.byteLength)}</span>
              <button
                type="button"
                onClick={() => downloadBytes(f.bytes, f.name, f.mime)}
                className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline"
                aria-label={t.result.downloadOne(f.name)}
              >
                <Download className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
