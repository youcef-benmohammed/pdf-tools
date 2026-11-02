import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PDFDocumentProxy, PageViewport } from 'pdfjs-dist';
import { Loader2 } from 'lucide-react';
import { renderPage } from '../services/pdfjs';
import { useI18n } from '../i18n';

export interface PreviewGeometry {
  /** Displayed size in CSS pixels */
  width: number;
  height: number;
  /** CSS pixels per PDF point */
  scale: number;
  /** PDF.js viewport at scale 1 (page rotation included) */
  viewport: PageViewport;
}

interface Props {
  doc: PDFDocumentProxy;
  pageIndex: number;
  maxWidth?: number;
  maxHeight?: number;
  /** Overlay layer positioned over the page */
  children?: (geo: PreviewGeometry) => ReactNode;
}

/** Large page preview with a positioned overlay layer. */
export function PagePreview({ doc, pageIndex, maxWidth = 720, maxHeight = 900, children }: Props) {
  const { t } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [geo, setGeo] = useState<PreviewGeometry | null>(null);
  const [available, setAvailable] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAvailable(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await doc.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(Math.min(available, maxWidth) / viewport.width, maxHeight / viewport.height);
        const width = viewport.width * scale;
        if (cancelled || !canvasRef.current) return;
        await renderPage(page, { targetWidth: width, canvas: canvasRef.current });
        if (cancelled) return;
        setGeo({ width, height: viewport.height * scale, scale, viewport });
        setError(false);
        page.cleanup();
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, pageIndex, available, maxWidth, maxHeight]);

  return (
    <div ref={wrapRef} className="flex w-full justify-center">
      <div className="relative" style={geo ? { width: geo.width, height: geo.height } : { minHeight: 240, width: '100%' }}>
        <canvas
          ref={canvasRef}
          className="block bg-white shadow-[0_2px_10px_rgba(22,24,43,0.15)]"
          style={geo ? { width: geo.width, height: geo.height } : { visibility: 'hidden', maxWidth: '100%' }}
          aria-label={t.pages.previewOf(pageIndex + 1)}
        />
        {!geo && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-muted">
            <Loader2 className="size-6 animate-spin" aria-hidden />
          </div>
        )}
        {error && <p className="absolute inset-0 flex items-center justify-center text-sm text-danger">{t.pages.previewUnavailable}</p>}
        {geo && children?.(geo)}
      </div>
    </div>
  );
}
