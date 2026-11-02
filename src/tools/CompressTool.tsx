import { useState } from 'react';
import { Shrink } from 'lucide-react';
import { useTool } from '../hooks/useTool';
import { useSinglePdf } from '../hooks/useSinglePdf';
import { useOperation } from '../hooks/useOperation';
import { ToolShell } from '../components/ToolShell';
import { SinglePdfInput } from '../components/SinglePdfInput';
import { OperationStatus } from '../components/OperationStatus';
import { ResultPanel } from '../components/ResultPanel';
import { Alert, Button, Panel } from '../components/ui';
import { runPdfOperation } from '../services/workerClient';
import { LEVELS, rasterizePdf, type CompressionLevel } from '../services/compress';
import { readBytes, suffixedName } from '../utils/files';
import { cn } from '../utils/cn';
import { useI18n } from '../i18n';
import type { OutputFile } from '../types';

type Mode = 'lossless' | CompressionLevel;
const RASTER_LEVELS: CompressionLevel[] = ['light', 'medium', 'strong'];

export default function CompressTool() {
  const tool = useTool();
  const { t, formatBytes } = useI18n();
  const pdf = useSinglePdf();
  const op = useOperation<OutputFile[]>();
  const [mode, setMode] = useState<Mode>('medium');

  const options: { value: Mode; label: string; hint: string }[] = [
    { value: 'lossless', label: t.compress.lossless, hint: t.compress.losslessHint },
    ...RASTER_LEVELS.map((l) => ({
      value: l as Mode,
      label: t.compress.dpi(t.compress.levels[l].label, LEVELS[l].dpi),
      hint: `${t.compress.levels[l].hint}. ${t.compress.rasterNote}`,
    })),
  ];

  const reset = () => {
    pdf.clear();
    op.reset();
  };

  const run = () =>
    op.run(async (report) => {
      const name = suffixedName(pdf.file!.name, t.compress.suffix);
      if (mode === 'lossless') {
        const bytes = await runPdfOperation('optimize', [await readBytes(pdf.file!)], report);
        return [{ name, bytes, mime: 'application/pdf' }];
      }
      // Rendering needs a canvas, so it runs on the main thread; assembling runs in the worker.
      const pages = await rasterizePdf(await readBytes(pdf.file!), mode, (f) => report(f * 0.8, t.compress.rendering));
      const bytes = await runPdfOperation('raster', [pages], (f) => report(0.8 + f * 0.2, t.compress.assembling));
      return [{ name, bytes, mime: 'application/pdf' }];
    });

  const before = pdf.file?.size ?? 0;
  const after = op.state.result?.[0]?.bytes.byteLength ?? 0;
  const saved = before ? 1 - after / before : 0;

  return (
    <ToolShell tool={tool} onReset={pdf.file ? reset : undefined}>
      <SinglePdfInput pdf={pdf} />
      {op.state.status === 'done' && op.state.result ? (
        <ResultPanel
          files={op.state.result}
          title={saved > 0.01 ? t.compress.reduced(Math.round(saved * 100)) : t.compress.finished}
          details={
            <div className="space-y-3">
              <p data-testid="compress-sizes">
                {formatBytes(before)} → <strong>{formatBytes(after)}</strong>
              </p>
              {saved <= 0.01 && <Alert tone="info">{t.compress.alreadyOptimal}</Alert>}
            </div>
          }
          onReset={reset}
          onBack={op.reset}
        />
      ) : (
        pdf.doc && (
          <>
            <Panel title={t.compress.level}>
              <div role="radiogroup" aria-label={t.compress.level} className="grid gap-2 sm:grid-cols-2">
                {options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={mode === o.value}
                    onClick={() => setMode(o.value)}
                    className={cn(
                      'rounded-xl border-2 p-4 text-left transition-colors',
                      mode === o.value ? 'border-brand-600 bg-brand-50' : 'border-line hover:border-brand-200',
                    )}
                  >
                    <span className="block font-bold">{o.label}</span>
                    <span className="mt-1 block text-sm text-muted">{o.hint}</span>
                  </button>
                ))}
              </div>
            </Panel>
            <OperationStatus state={op.state} onDismiss={op.reset} />
            <div className="flex justify-end">
              <Button size="lg" icon={<Shrink className="size-5" aria-hidden />} loading={op.state.status === 'working'} onClick={run}>
                {t.compress.button}
              </Button>
            </div>
          </>
        )
      )}
    </ToolShell>
  );
}
