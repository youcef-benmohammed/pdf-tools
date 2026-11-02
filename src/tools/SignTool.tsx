import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { ChevronLeft, ChevronRight, PenLine, Plus, Save, Trash2 } from 'lucide-react';
import { useTool } from '../hooks/useTool';
import { useSinglePdf } from '../hooks/useSinglePdf';
import { useOperation } from '../hooks/useOperation';
import { ToolShell } from '../components/ToolShell';
import { SinglePdfInput } from '../components/SinglePdfInput';
import { PagePreview, type PreviewGeometry } from '../components/PagePreview';
import { PageThumbnail } from '../components/PageThumbnail';
import { SignatureDialog, type SignatureImage } from '../components/SignatureDialog';
import { OperationStatus } from '../components/OperationStatus';
import { ResultPanel } from '../components/ResultPanel';
import { Alert, Button, IconButton, Panel } from '../components/ui';
import { runPdfOperation } from '../services/workerClient';
import { readBytes, suffixedName, uid } from '../utils/files';
import { cn } from '../utils/cn';
import { useI18n } from '../i18n';
import type { OutputFile, StampPlacement } from '../types';

interface Signature extends SignatureImage {
  id: string;
  url: string;
}

/** Position as fractions of the displayed page (independent of zoom). */
interface Placement {
  id: string;
  sigId: string;
  page: number;
  x: number;
  y: number;
  /** width as a fraction of the page width */
  w: number;
}

const MIN_W = 0.04;

export default function SignTool() {
  const tool = useTool();
  const { t } = useI18n();
  const pdf = useSinglePdf();
  const op = useOperation<OutputFile[]>();
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [activeSig, setActiveSig] = useState<string | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const sigsRef = useRef(signatures);
  sigsRef.current = signatures;

  useEffect(() => () => sigsRef.current.forEach((s) => URL.revokeObjectURL(s.url)), []);
  useEffect(() => {
    setPage(0);
    setPlacements([]);
  }, [pdf.file]);

  const place = (sig: Signature | undefined = signatures.find((s) => s.id === activeSig)) => {
    if (!sig) return;
    const w = 0.28;
    const p: Placement = { id: uid('pl'), sigId: sig.id, page, x: 0.5 - w / 2, y: 0.7, w };
    setPlacements((ps) => [...ps, p]);
    setSelected(p.id);
  };

  const addSignature = (img: SignatureImage) => {
    const sig: Signature = { ...img, id: uid('sig'), url: URL.createObjectURL(new Blob([img.bytes as BlobPart], { type: 'image/png' })) };
    setSignatures((s) => [...s, sig]);
    setActiveSig(sig.id);
    place(sig);
  };

  const removeSignature = (id: string) => {
    setSignatures((s) => {
      const sig = s.find((x) => x.id === id);
      if (sig) URL.revokeObjectURL(sig.url);
      return s.filter((x) => x.id !== id);
    });
    setPlacements((ps) => ps.filter((p) => p.sigId !== id));
    if (activeSig === id) setActiveSig(null);
  };

  const reset = () => {
    signatures.forEach((s) => URL.revokeObjectURL(s.url));
    setSignatures([]);
    setPlacements([]);
    setActiveSig(null);
    pdf.clear();
    op.reset();
  };

  const run = () =>
    op.run(async (report) => {
      const doc = pdf.doc!;
      const used = [...new Set(placements.map((p) => p.sigId))];
      // Copies: the bytes are transferred to the worker.
      const images = used.map((id) => {
        const s = signatures.find((x) => x.id === id)!;
        return { bytes: s.bytes.slice(), kind: s.kind };
      });
      const stamps: StampPlacement[] = [];
      for (const pl of placements) {
        const sig = signatures.find((s) => s.id === pl.sigId)!;
        const pdfPage = await doc.getPage(pl.page + 1);
        const vp = pdfPage.getViewport({ scale: 1 });
        const w = pl.w * vp.width;
        const h = w / sig.aspect;
        const left = pl.x * vp.width;
        const bottom = pl.y * vp.height + h;
        // Bottom-left corner of the image (screen space) → PDF space; handles /Rotate and the CropBox.
        const [px, py] = vp.convertToPdfPoint(left, bottom);
        // The image is rotated by the page rotation so that it appears upright.
        stamps.push({ pageIndex: pl.page, imageIndex: used.indexOf(pl.sigId), x: px, y: py, width: w, height: h, rotate: pdfPage.rotate });
      }
      const bytes = await runPdfOperation('stamp', [await readBytes(pdf.file!), images, stamps], report);
      return [{ name: suffixedName(pdf.file!.name, t.sign.suffix), bytes, mime: 'application/pdf' }];
    });

  const onPage = placements.filter((p) => p.page === page);
  const pagesWithSig = new Set(placements.map((p) => p.page));

  return (
    <ToolShell tool={tool} onReset={pdf.file ? reset : undefined}>
      <SinglePdfInput pdf={pdf} />
      {op.state.status === 'done' && op.state.result ? (
        <ResultPanel files={op.state.result} title={t.sign.done} onReset={reset} onBack={op.reset} />
      ) : (
        pdf.doc && (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="space-y-5">
                <Panel title={t.sign.signatures}>
                  {signatures.length === 0 ? (
                    <p className="mb-3 text-sm text-muted">{t.sign.empty}</p>
                  ) : (
                    <ul className="mb-3 space-y-2">
                      {signatures.map((s) => (
                        <li key={s.id}>
                          <div className={cn('flex items-center gap-2 rounded-xl border-2 p-2', activeSig === s.id ? 'border-brand-600 bg-brand-50' : 'border-line')}>
                            <button
                              type="button"
                              onClick={() => setActiveSig(s.id)}
                              className="checker flex h-12 min-w-0 flex-1 items-center justify-center rounded-lg bg-white"
                              aria-label={t.sign.choose}
                              aria-pressed={activeSig === s.id}
                            >
                              <img src={s.url} alt={t.sign.alt} className="max-h-10 max-w-full object-contain" />
                            </button>
                            <IconButton label={t.sign.deleteSig} className="hover:text-danger" onClick={() => removeSignature(s.id)}>
                              <Trash2 className="size-4" />
                            </IconButton>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-col gap-2">
                    <Button variant="secondary" icon={<PenLine className="size-4" aria-hidden />} onClick={() => setDialog(true)} data-testid="new-signature">
                      {t.sign.newSig}
                    </Button>
                    <Button icon={<Plus className="size-4" aria-hidden />} disabled={!activeSig} onClick={() => place()}>
                      {t.sign.place(page + 1)}
                    </Button>
                  </div>
                </Panel>
                {pdf.numPages > 1 && (
                  <Panel title={t.sign.pages} className="hidden lg:block">
                    <ul className="grid max-h-[420px] grid-cols-3 gap-2 overflow-y-auto pr-1">
                      {Array.from({ length: pdf.numPages }, (_, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            onClick={() => setPage(i)}
                            aria-label={t.sign.showPage(i + 1)}
                            aria-current={page === i}
                            className={cn('relative w-full rounded-lg border-2 bg-mist p-1', page === i ? 'border-brand-600' : 'border-transparent')}
                          >
                            <PageThumbnail doc={pdf.doc!} pageIndex={i} width={70} />
                            <span className="text-[11px] font-semibold text-muted">{i + 1}</span>
                            {pagesWithSig.has(i) && <span className="absolute right-1 top-1 size-2 rounded-full bg-brand-600" aria-label={t.sign.signed} />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                )}
              </div>

              <Panel
                title={t.sign.pageOf(page + 1, pdf.numPages)}
                aside={
                  pdf.numPages > 1 && (
                    <div className="flex gap-1">
                      <IconButton label={t.sign.prev} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                        <ChevronLeft className="size-5" />
                      </IconButton>
                      <IconButton label={t.sign.next} disabled={page >= pdf.numPages - 1} onClick={() => setPage((p) => p + 1)}>
                        <ChevronRight className="size-5" />
                      </IconButton>
                    </div>
                  )
                }
              >
                <div className="rounded-xl bg-mist p-3 sm:p-4" onPointerDown={() => setSelected(null)}>
                  <PagePreview doc={pdf.doc} pageIndex={page} maxHeight={760}>
                    {(geo) =>
                      onPage.map((pl) => {
                        const sig = signatures.find((s) => s.id === pl.sigId);
                        if (!sig) return null;
                        return (
                          <PlacedSignature
                            key={pl.id}
                            placement={pl}
                            sig={sig}
                            geo={geo}
                            selected={selected === pl.id}
                            onSelect={() => setSelected(pl.id)}
                            onChange={(next) => setPlacements((ps) => ps.map((p) => (p.id === pl.id ? next : p)))}
                            onRemove={() => setPlacements((ps) => ps.filter((p) => p.id !== pl.id))}
                          />
                        );
                      })
                    }
                  </PagePreview>
                </div>
                <p className="mt-3 text-sm text-muted">{t.sign.help}</p>
              </Panel>
            </div>

            {placements.length === 0 && signatures.length > 0 && <Alert tone="info">{t.sign.placeFirst}</Alert>}
            <OperationStatus state={op.state} onDismiss={op.reset} />
            <div className="flex items-center justify-end gap-3">
              {placements.length > 0 && <span className="text-sm text-muted">{t.sign.summary(placements.length, pagesWithSig.size)}</span>}
              <Button
                size="lg"
                icon={<Save className="size-5" aria-hidden />}
                disabled={!placements.length}
                loading={op.state.status === 'working'}
                onClick={run}
                data-testid="sign-apply"
              >
                {t.sign.apply}
              </Button>
            </div>
          </>
        )
      )}
      <SignatureDialog open={dialog} onClose={() => setDialog(false)} onCreate={addSignature} />
    </ToolShell>
  );
}

function PlacedSignature({
  placement,
  sig,
  geo,
  selected,
  onSelect,
  onChange,
  onRemove,
}: {
  placement: Placement;
  sig: Signature;
  geo: PreviewGeometry;
  selected: boolean;
  onSelect: () => void;
  onChange: (p: Placement) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const drag = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; orig: Placement } | null>(null);
  const pageAspect = geo.width / geo.height;
  const hFrac = (placement.w / sig.aspect) * pageAspect;

  /** Keeps the signature inside the page and above a minimum size. */
  const clamp = (p: Placement): Placement => {
    const w = Math.min(Math.max(p.w, MIN_W), 1, sig.aspect / pageAspect);
    const h = (w / sig.aspect) * pageAspect;
    return { ...p, w, x: Math.min(Math.max(p.x, 0), 1 - w), y: Math.min(Math.max(p.y, 0), 1 - h) };
  };

  const start = (mode: 'move' | 'resize') => (e: RPointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { mode, startX: e.clientX, startY: e.clientY, orig: placement };
  };

  const move = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / geo.width;
    const dy = (e.clientY - d.startY) / geo.height;
    if (d.mode === 'move') onChange(clamp({ ...d.orig, x: d.orig.x + dx, y: d.orig.y + dy }));
    else onChange(clamp({ ...d.orig, w: d.orig.w + dx }));
  };

  const end = () => (drag.current = null);

  // Keyboard: arrows move, +/- resize, Delete removes
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      onChange(clamp({ ...placement, x: placement.x + moves[e.key][0], y: placement.y + moves[e.key][1] }));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onRemove();
    } else if (e.key === '+' || e.key === '-') {
      onChange(clamp({ ...placement, w: placement.w * (e.key === '+' ? 1.1 : 0.9) }));
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t.sign.placed}
      onKeyDown={onKey}
      onPointerDown={start('move')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className={cn('absolute cursor-move touch-none select-none outline-none', selected ? 'ring-2 ring-brand-600' : 'ring-1 ring-brand-500/40 hover:ring-brand-500')}
      style={{ left: placement.x * geo.width, top: placement.y * geo.height, width: placement.w * geo.width, height: hFrac * geo.height }}
      data-testid="placed-signature"
    >
      <img src={sig.url} alt="" draggable={false} className="pointer-events-none size-full" />
      {selected && (
        <>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRemove}
            aria-label={t.sign.removePlaced}
            className="absolute -right-3 -top-3 flex size-6 items-center justify-center rounded-full bg-danger text-white shadow"
          >
            <Trash2 className="size-3.5" />
          </button>
          <span
            onPointerDown={start('resize')}
            onPointerMove={move}
            onPointerUp={end}
            className="absolute -bottom-2 -right-2 size-4 cursor-nwse-resize rounded-sm border-2 border-white bg-brand-600 shadow"
            aria-hidden
          />
        </>
      )}
    </div>
  );
}
