import { useState } from 'react';
import { Droplets } from 'lucide-react';
import { useTool } from '../hooks/useTool';
import { useSinglePdf } from '../hooks/useSinglePdf';
import { useOperation } from '../hooks/useOperation';
import { ToolShell } from '../components/ToolShell';
import { SinglePdfInput } from '../components/SinglePdfInput';
import { PagePreview } from '../components/PagePreview';
import { OperationStatus } from '../components/OperationStatus';
import { ResultPanel } from '../components/ResultPanel';
import { Button, Field, Panel, Segmented, inputClass } from '../components/ui';
import { runPdfOperation } from '../services/workerClient';
import { readBytes, suffixedName } from '../utils/files';
import { useI18n } from '../i18n';
import type { OutputFile, WatermarkOptions } from '../types';

type AngleKey = '0' | '45' | '-45';

export default function WatermarkTool() {
  const tool = useTool();
  const { t } = useI18n();
  const pdf = useSinglePdf();
  const op = useOperation<OutputFile[]>();
  const [opts, setOpts] = useState<WatermarkOptions>(() => ({
    text: t.watermark.defaultText,
    fontSize: 60,
    opacity: 0.2,
    color: '#c2362b',
    angle: 45,
    layout: 'center',
  }));
  const set = <K extends keyof WatermarkOptions>(k: K, v: WatermarkOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));

  const reset = () => {
    pdf.clear();
    op.reset();
  };

  const run = () =>
    op.run(async (report) => {
      const bytes = await runPdfOperation('watermark', [await readBytes(pdf.file!), opts], report);
      return [{ name: suffixedName(pdf.file!.name, t.watermark.suffix), bytes, mime: 'application/pdf' }];
    });

  return (
    <ToolShell tool={tool} onReset={pdf.file ? reset : undefined}>
      <SinglePdfInput pdf={pdf} />
      {op.state.status === 'done' && op.state.result ? (
        <ResultPanel files={op.state.result} title={t.watermark.done} onReset={reset} onBack={op.reset} />
      ) : (
        pdf.doc && (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <Panel title={t.watermark.preview} className="order-2 lg:order-1">
                <div className="rounded-xl bg-mist p-4">
                  <PagePreview doc={pdf.doc} pageIndex={0} maxHeight={640}>
                    {(geo) => <WatermarkOverlay opts={opts} scale={geo.scale} />}
                  </PagePreview>
                </div>
              </Panel>
              <Panel title={t.watermark.settings} className="order-1 lg:order-2">
                <div className="space-y-5">
                  <Field label={t.watermark.text} htmlFor="wm-text">
                    <input
                      id="wm-text"
                      className={inputClass}
                      value={opts.text}
                      maxLength={80}
                      onChange={(e) => set('text', e.target.value)}
                      data-testid="watermark-text"
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {t.watermark.presets.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => set('text', p)}
                          className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-muted hover:border-brand-500 hover:text-brand-600"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label={t.watermark.layout}>
                    <Segmented
                      label={t.watermark.layout}
                      value={opts.layout}
                      onChange={(v) => set('layout', v)}
                      options={[
                        { value: 'center', label: t.watermark.center },
                        { value: 'tile', label: t.watermark.tile },
                      ]}
                    />
                  </Field>
                  <Field label={t.watermark.angle}>
                    <Segmented<AngleKey>
                      label={t.watermark.angle}
                      value={String(opts.angle) as AngleKey}
                      onChange={(v) => set('angle', Number(v))}
                      options={[
                        { value: '45', label: t.watermark.diagUp },
                        { value: '0', label: t.watermark.horizontal },
                        { value: '-45', label: t.watermark.diagDown },
                      ]}
                    />
                  </Field>
                  <Field label={t.watermark.size(opts.fontSize)} htmlFor="wm-size">
                    <input
                      id="wm-size"
                      type="range"
                      min={12}
                      max={160}
                      value={opts.fontSize}
                      onChange={(e) => set('fontSize', Number(e.target.value))}
                      className="w-full accent-brand-600"
                    />
                  </Field>
                  <Field label={t.watermark.opacity(Math.round(opts.opacity * 100))} htmlFor="wm-opacity">
                    <input
                      id="wm-opacity"
                      type="range"
                      min={5}
                      max={100}
                      value={Math.round(opts.opacity * 100)}
                      onChange={(e) => set('opacity', Number(e.target.value) / 100)}
                      className="w-full accent-brand-600"
                    />
                  </Field>
                  <Field label={t.watermark.color} htmlFor="wm-color">
                    <div className="flex items-center gap-3">
                      <input
                        id="wm-color"
                        type="color"
                        value={opts.color}
                        onChange={(e) => set('color', e.target.value)}
                        className="h-10 w-14 cursor-pointer rounded-lg border border-line bg-paper p-1"
                      />
                      <span className="text-sm text-muted tabular-nums">{opts.color.toUpperCase()}</span>
                    </div>
                  </Field>
                </div>
              </Panel>
            </div>
            <OperationStatus state={op.state} onDismiss={op.reset} />
            <div className="flex justify-end">
              <Button size="lg" icon={<Droplets className="size-5" aria-hidden />} disabled={!opts.text.trim()} loading={op.state.status === 'working'} onClick={run}>
                {t.watermark.button}
              </Button>
            </div>
          </>
        )
      )}
    </ToolShell>
  );
}

/** Approximate CSS preview of the watermark; the final rendering is computed by pdf-lib. */
function WatermarkOverlay({ opts, scale }: { opts: WatermarkOptions; scale: number }) {
  const style = {
    fontSize: opts.fontSize * scale,
    color: opts.color,
    opacity: opts.opacity,
    fontFamily: 'Helvetica, Arial, sans-serif',
    fontWeight: 700,
    whiteSpace: 'pre' as const,
    lineHeight: 1,
  };
  if (opts.layout === 'center') {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <span style={{ ...style, transform: `rotate(${-opts.angle}deg)` }}>{opts.text}</span>
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -inset-1/2 flex flex-wrap content-center items-center justify-center"
        style={{ transform: `rotate(${-opts.angle}deg)`, gap: `${opts.fontSize * scale * 2}px` }}
      >
        {Array.from({ length: 60 }, (_, i) => (
          <span key={i} style={style}>
            {opts.text}
          </span>
        ))}
      </div>
    </div>
  );
}
