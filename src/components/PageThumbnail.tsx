import { memo, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { renderPage } from '../services/pdfjs';
import { cn } from '../utils/cn';
import { useI18n } from '../i18n';

/** Global queue: limits the number of simultaneous renders. */
const MAX_CONCURRENT = 3;
let active = 0;
const queue: Array<() => void> = [];
function schedule<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      active++;
      task()
        .then(resolve, reject)
        .finally(() => {
          active--;
          queue.shift()?.();
        });
    };
    if (active < MAX_CONCURRENT) start();
    else queue.push(start);
  });
}

interface Props {
  doc: PDFDocumentProxy;
  /** 0-based index */
  pageIndex: number;
  /** Added rotation (degrees) */
  rotation?: number;
  /** Render width in CSS pixels */
  width?: number;
  className?: string;
}

/** Page thumbnail rendered lazily (only once it becomes visible). */
export const PageThumbnail = memo(function PageThumbnail({ doc, pageIndex, rotation = 0, width = 150, className }: Props) {
  const { t } = useI18n();
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    schedule(async () => {
      if (cancelled) return;
      const page = await doc.getPage(pageIndex + 1);
      if (cancelled || !canvasRef.current) return;
      await renderPage(page, { targetWidth: width, canvas: canvasRef.current });
      if (!cancelled) setRendered(true);
      page.cleanup();
    }).catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [visible, doc, pageIndex, width]);

  return (
    <div ref={boxRef} className={cn('relative flex aspect-square w-full items-center justify-center overflow-hidden', className)}>
      <canvas
        ref={canvasRef}
        aria-hidden
        className={cn(
          'max-h-full max-w-full bg-white shadow-[0_1px_3px_rgba(22,24,43,0.18)] transition-transform duration-200',
          !rendered && 'invisible',
        )}
        // The longest side fits in the square, so the rotated page fits too.
        style={{ transform: `rotate(${rotation}deg)` }}
      />
      {!rendered && !failed && <div className="absolute inset-[12%] animate-pulse rounded bg-line/60" />}
      {failed && <span className="absolute text-xs text-danger">{t.pages.previewUnavailable}</span>}
    </div>
  );
});
