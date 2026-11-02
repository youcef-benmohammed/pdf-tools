import { useId, useRef, useState, type DragEvent } from 'react';
import { FilePlus2, Upload } from 'lucide-react';
import type { AcceptKind } from '../types';
import { ACCEPT_ATTR, LIMITS } from '../utils/files';
import { cn } from '../utils/cn';
import { useI18n } from '../i18n';

interface DropzoneProps {
  accept: AcceptKind | 'any';
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  /** Compact variant (adding more files) */
  compact?: boolean;
  title?: string;
  className?: string;
}

export function Dropzone({ accept, multiple = false, onFiles, compact, title, className }: DropzoneProps) {
  const { t, formatBytes } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const id = useId();
  const acceptAttr = accept === 'any' ? `${ACCEPT_ATTR.pdf},${ACCEPT_ATTR.image}` : ACCEPT_ATTR[accept];
  const limit = accept === 'image' ? LIMITS.imageBytes : LIMITS.pdfBytes;

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };

  const open = () => inputRef.current?.click();

  const input = (
    <input
      id={id}
      ref={inputRef}
      type="file"
      className="sr-only"
      accept={acceptAttr}
      multiple={multiple}
      data-testid="file-input"
      onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = '';
        if (files.length) onFiles(files);
      }}
    />
  );

  const dragProps = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setOver(true);
    },
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
    },
    onDrop: handleDrop,
  };

  if (compact) {
    return (
      <div
        {...dragProps}
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-dashed px-4 py-3 text-sm transition-colors',
          over ? 'border-brand-500 bg-brand-50' : 'border-line',
          className,
        )}
      >
        {input}
        <FilePlus2 className="size-4 text-brand-600" aria-hidden />
        <span className="text-muted">{t.dropzone.compactLead}</span>
        <button type="button" onClick={open} className="font-semibold text-brand-600 hover:underline">
          {t.dropzone.compactBrowse}
        </button>
      </div>
    );
  }

  return (
    <div {...dragProps} className={cn('relative', className)}>
      {input}
      <button
        type="button"
        onClick={open}
        className={cn(
          'sheet group relative flex w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed bg-paper px-6 py-12 text-center transition-colors sm:py-16',
          over ? 'border-brand-500 bg-brand-50' : 'border-brand-200 hover:border-brand-500',
        )}
      >
        <span
          className={cn(
            'flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-white transition-transform',
            over ? '-translate-y-1' : 'group-hover:-translate-y-0.5',
          )}
        >
          <Upload className="size-6" aria-hidden />
        </span>
        <span className="space-y-1">
          <span className="block text-lg font-bold text-ink">
            {over ? t.dropzone.release : (title ?? (multiple ? t.dropzone.titleMany : t.dropzone.titleOne))}
          </span>
          <span className="block text-sm text-muted">
            {t.dropzone.or} <span className="font-semibold text-brand-600">{t.dropzone.browse}</span>
          </span>
        </span>
        <span className="text-xs text-muted">{t.dropzone.limit(t.dropzone.accept[accept], formatBytes(limit))}</span>
      </button>
      {/* Folded corner: the drop target reads as a sheet of paper */}
      <span className="sheet-fold pointer-events-none absolute right-0 top-0" aria-hidden />
    </div>
  );
}
