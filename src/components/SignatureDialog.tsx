import { useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import { Eraser, ImageUp, PenLine, Undo2, X } from 'lucide-react';
import { Button, ErrorList, Segmented } from './ui';
import { canvasToBytes } from '../utils/images';
import { LIMITS, imageKind } from '../utils/files';
import { AppError, toAppError } from '../utils/errors';
import { cn } from '../utils/cn';
import { useI18n } from '../i18n';

export interface SignatureImage {
  bytes: Uint8Array;
  kind: 'png' | 'jpg';
  /** width / height */
  aspect: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (sig: SignatureImage) => void;
}

const INKS = ['#16182b', '#1d3fa8'] as const;

/** Crops a canvas to its non-transparent pixels (with a small margin). */
function trimCanvas(src: HTMLCanvasElement): HTMLCanvasElement | null {
  const ctx = src.getContext('2d')!;
  const { width, height } = src;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = 6;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const out = document.createElement('canvas');
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext('2d')!.drawImage(src, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/** Makes the light background of an image transparent (scanned or photographed signature). */
function removeLightBackground(canvas: HTMLCanvasElement, threshold = 225) {
  const ctx = canvas.getContext('2d')!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (lum >= threshold) d[i + 3] = 0;
    else if (lum > threshold - 40) d[i + 3] = Math.round(d[i + 3] * ((threshold - lum) / 40));
  }
  ctx.putImageData(img, 0, 0);
}

export function SignatureDialog({ open, onClose, onCreate }: Props) {
  const { t } = useI18n();
  const d = t.sign.dialog;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [tab, setTab] = useState<'draw' | 'upload'>('draw');
  const [ink, setInk] = useState<string>(INKS[0]);
  const [empty, setEmpty] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [upload, setUpload] = useState<{ file: File; url: string } | null>(null);
  const [transparent, setTransparent] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  // Set up the signature pad, sized for the device pixel ratio.
  useEffect(() => {
    if (!open || tab !== 'draw' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const pad = new SignaturePad(canvas, { penColor: ink, minWidth: 0.8, maxWidth: 2.6, throttle: 8 });
    padRef.current = pad;
    const resize = () => {
      const data = pad.toData();
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d')!.scale(ratio, ratio);
      pad.clear();
      pad.fromData(data);
    };
    resize();
    const onEnd = () => setEmpty(pad.isEmpty());
    pad.addEventListener('endStroke', onEnd);
    window.addEventListener('resize', resize);
    return () => {
      pad.removeEventListener('endStroke', onEnd);
      window.removeEventListener('resize', resize);
      pad.off();
      padRef.current = null;
    };
    // The ink color is applied by the next effect without recreating the pad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  useEffect(() => {
    if (padRef.current) padRef.current.penColor = ink;
  }, [ink]);

  useEffect(
    () => () => {
      if (upload) URL.revokeObjectURL(upload.url);
    },
    [upload],
  );

  const close = () => {
    setError(null);
    setUpload(null);
    setEmpty(true);
    onClose();
  };

  const clear = () => {
    padRef.current?.clear();
    setEmpty(true);
  };

  const undo = () => {
    const pad = padRef.current;
    if (!pad) return;
    const data = pad.toData();
    data.pop();
    pad.fromData(data);
    setEmpty(pad.isEmpty());
  };

  const pickFile = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!imageKind(file)) return setError(new AppError('sigNotImage'));
    if (file.size > LIMITS.imageBytes) return setError(new AppError('sigTooLarge', { limit: LIMITS.imageBytes }));
    setUpload({ file, url: URL.createObjectURL(file) });
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      let canvas: HTMLCanvasElement | null;
      if (tab === 'draw') {
        if (!canvasRef.current || padRef.current?.isEmpty()) throw new AppError('sigDrawFirst');
        canvas = trimCanvas(canvasRef.current);
      } else {
        if (!upload) throw new AppError('sigChooseImage');
        let bmp: ImageBitmap;
        try {
          bmp = await createImageBitmap(upload.file, { imageOrientation: 'from-image' });
        } catch {
          throw new AppError('imageInvalid', { name: upload.file.name });
        }
        // Cap the resolution to keep the PDF light.
        const max = 1600;
        const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas');
        c.width = Math.round(bmp.width * s);
        c.height = Math.round(bmp.height * s);
        c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
        bmp.close();
        if (transparent) removeLightBackground(c);
        canvas = transparent ? trimCanvas(c) : c;
      }
      if (!canvas) throw new AppError('sigEmpty');
      const bytes = await canvasToBytes(canvas, 'image/png');
      onCreate({ bytes, kind: 'png', aspect: canvas.width / canvas.height });
      close();
    } catch (e) {
      setError(toAppError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      className="m-auto w-[min(640px,calc(100vw-2rem))] rounded-2xl border border-line bg-paper p-0 text-ink backdrop:bg-ink/40"
      aria-labelledby="sig-title"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id="sig-title" className="text-lg font-bold">
          {d.title}
        </h2>
        <button type="button" onClick={close} aria-label={t.ui.close} className="text-muted hover:text-ink">
          <X className="size-5" />
        </button>
      </div>
      <div className="space-y-4 p-5">
        <Segmented
          label={d.method}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setError(null);
          }}
          options={[
            { value: 'draw', label: d.draw },
            { value: 'upload', label: d.upload },
          ]}
        />

        {tab === 'draw' ? (
          <>
            <div className="relative">
              <canvas
                ref={canvasRef}
                className="block h-52 w-full touch-none rounded-xl border-2 border-dashed border-line bg-white"
                aria-label={d.canvas}
                data-testid="signature-canvas"
              />
              <span className="pointer-events-none absolute bottom-10 left-6 right-6 border-b border-[#c8cad6]" aria-hidden />
              {empty && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[#8a8fa6]">{d.signHere}</span>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2" role="radiogroup" aria-label={d.ink}>
                {INKS.map((value, i) => {
                  const label = i === 0 ? d.black : d.blue;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={ink === value}
                      aria-label={label}
                      title={label}
                      onClick={() => setInk(value)}
                      className={cn('size-7 rounded-full border-2', ink === value ? 'border-brand-600 ring-2 ring-brand-100' : 'border-paper')}
                      style={{ backgroundColor: value }}
                    />
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" icon={<Undo2 className="size-4" aria-hidden />} onClick={undo} disabled={empty}>
                  {d.undo}
                </Button>
                <Button size="sm" variant="ghost" icon={<Eraser className="size-4" aria-hidden />} onClick={clear} disabled={empty}>
                  {d.clear}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-mist px-4 py-8 text-center hover:border-brand-500">
              {upload ? (
                <img src={upload.url} alt={d.uploadedAlt} className="checker max-h-36 max-w-full rounded object-contain" />
              ) : (
                <>
                  <ImageUp className="size-6 text-brand-600" aria-hidden />
                  <span className="text-sm font-semibold">{d.pick}</span>
                </>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={(e) => pickFile(e.target.files?.[0])}
                data-testid="signature-upload"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} className="size-4 accent-brand-600" />
              {d.transparent}
            </label>
          </div>
        )}
        <ErrorList errors={error ? [error] : []} />
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-5 py-4">
        <Button variant="secondary" onClick={close}>
          {d.cancel}
        </Button>
        <Button
          icon={<PenLine className="size-4" aria-hidden />}
          onClick={save}
          loading={busy}
          disabled={tab === 'draw' ? empty : !upload}
          data-testid="signature-save"
        >
          {d.use}
        </Button>
      </div>
    </dialog>
  );
}
