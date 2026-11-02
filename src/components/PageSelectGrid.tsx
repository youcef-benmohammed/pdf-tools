import { useEffect, useState, type ReactNode } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Check } from 'lucide-react';
import { PageThumbnail } from './PageThumbnail';
import { formatPageList, parsePageList } from '../utils/pageRanges';
import { cn } from '../utils/cn';
import { inputClass } from './ui';
import { useI18n } from '../i18n';

interface Props {
  doc: PDFDocumentProxy;
  numPages: number;
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
  /** Displayed rotation per page */
  rotations?: Record<number, number>;
  /** Style of selected pages */
  tone?: 'keep' | 'remove';
  /** Extra content under each thumbnail */
  renderExtra?: (index: number) => ReactNode;
}

/** Grid of selectable pages (click, Shift+click for a range, or typed "1-3, 5"). */
export function PageSelectGrid({ doc, numPages, selected, onChange, rotations, tone = 'keep', renderExtra }: Props) {
  const { t, formatError } = useI18n();
  const [text, setText] = useState('');
  const [textError, setTextError] = useState<unknown>(null);
  const [anchor, setAnchor] = useState<number | null>(null);

  // Keep the text field in sync with the selection
  useEffect(() => {
    setText(formatPageList([...selected]));
    setTextError(null);
  }, [selected]);

  const toggle = (i: number, shift: boolean) => {
    const next = new Set(selected);
    if (shift && anchor !== null) {
      const [a, b] = anchor < i ? [anchor, i] : [i, anchor];
      for (let k = a; k <= b; k++) next.add(k);
    } else if (next.has(i)) next.delete(i);
    else next.add(i);
    setAnchor(i);
    onChange(next);
  };

  const applyText = () => {
    if (!text.trim()) {
      onChange(new Set());
      return;
    }
    try {
      onChange(new Set(parsePageList(text, numPages)));
    } catch (e) {
      setTextError(e);
    }
  };

  const range = Array.from({ length: numPages }, (_, i) => i);
  const all = () => onChange(new Set(range));
  const none = () => onChange(new Set());
  const invert = () => onChange(new Set(range.filter((i) => !selected.has(i))));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <label htmlFor="page-input" className="sr-only">
            {t.pages.inputLabel}
          </label>
          <input
            id="page-input"
            className={cn(inputClass, textError != null && 'border-danger')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={applyText}
            onKeyDown={(e) => e.key === 'Enter' && applyText()}
            placeholder={t.pages.placeholder}
            aria-describedby="page-input-hint"
            data-testid="page-input"
          />
          <p id="page-input-hint" className={cn('mt-1 text-xs', textError != null ? 'text-danger' : 'text-muted')}>
            {textError != null ? formatError(textError) : t.pages.hint}
          </p>
        </div>
        <div className="flex gap-1 text-sm">
          {[
            [t.pages.all, all],
            [t.pages.none, none],
            [t.pages.invert, invert],
          ].map(([label, fn]) => (
            <button
              key={label as string}
              type="button"
              onClick={fn as () => void}
              className="rounded-lg px-2.5 py-2 font-semibold text-brand-600 hover:bg-brand-50"
            >
              {label as string}
            </button>
          ))}
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {range.map((i) => {
          const isSel = selected.has(i);
          return (
            <li key={i}>
              <div
                className={cn(
                  'relative rounded-xl border-2 bg-mist p-2 transition-colors',
                  isSel ? (tone === 'remove' ? 'border-danger bg-danger/5' : 'border-brand-600 bg-brand-50') : 'border-transparent',
                )}
              >
                <button
                  type="button"
                  aria-pressed={isSel}
                  aria-label={t.pages.page(i + 1)}
                  onClick={(e) => toggle(i, e.shiftKey)}
                  className="block w-full"
                  data-testid={`page-${i + 1}`}
                >
                  <PageThumbnail doc={doc} pageIndex={i} rotation={rotations?.[i] ?? 0} className={cn(isSel && tone === 'remove' && 'opacity-40')} />
                </button>
                <span
                  className={cn(
                    'pointer-events-none absolute left-3 top-3 flex size-5 items-center justify-center rounded-md border-2',
                    !isSel ? 'border-line bg-paper' : tone === 'remove' ? 'border-danger bg-danger text-white' : 'border-brand-600 bg-brand-600 text-white',
                  )}
                  aria-hidden
                >
                  {isSel && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted">{t.pages.page(i + 1)}</span>
                  {renderExtra?.(i)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
