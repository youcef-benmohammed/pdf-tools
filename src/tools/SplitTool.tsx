import { useMemo, useState } from 'react';
import { Scissors } from 'lucide-react';
import { useTool } from '../hooks/useTool';
import { useSinglePdf } from '../hooks/useSinglePdf';
import { useOperation } from '../hooks/useOperation';
import { ToolShell } from '../components/ToolShell';
import { SinglePdfInput } from '../components/SinglePdfInput';
import { OperationStatus } from '../components/OperationStatus';
import { ResultPanel } from '../components/ResultPanel';
import { PageThumbnail } from '../components/PageThumbnail';
import { Alert, Button, Field, Panel, Segmented, inputClass } from '../components/ui';
import { runPdfOperation } from '../services/workerClient';
import { baseName, readBytes } from '../utils/files';
import { chunkEvery, formatPageList, parseGroups } from '../utils/pageRanges';
import { AppError } from '../utils/errors';
import { useI18n } from '../i18n';
import type { OutputFile } from '../types';

type Mode = 'each' | 'every' | 'ranges';

const MAX_PREVIEW_GROUPS = 60;

export default function SplitTool() {
  const tool = useTool();
  const { t, formatError } = useI18n();
  const pdf = useSinglePdf();
  const op = useOperation<OutputFile[]>();
  const [mode, setMode] = useState<Mode>('ranges');
  const [every, setEvery] = useState(2);
  const [ranges, setRanges] = useState('');

  const reset = () => {
    pdf.clear();
    op.reset();
    setRanges('');
  };

  /** Groups of pages that will become files, computed live from the settings. */
  const plan = useMemo((): { groups: number[][]; error?: unknown } => {
    if (!pdf.numPages) return { groups: [] };
    try {
      if (mode === 'each') return { groups: chunkEvery(pdf.numPages, 1) };
      if (mode === 'every') {
        if (!Number.isFinite(every) || every < 1) return { groups: [], error: new AppError('everyInvalid') };
        return { groups: chunkEvery(pdf.numPages, every) };
      }
      if (!ranges.trim()) return { groups: [] };
      return { groups: parseGroups(ranges, pdf.numPages) };
    } catch (e) {
      return { groups: [], error: e };
    }
  }, [mode, every, ranges, pdf.numPages]);

  const run = () =>
    op.run(async (report) => {
      const base = baseName(pdf.file!.name);
      const outputs = await runPdfOperation('split', [await readBytes(pdf.file!), plan.groups], report);
      return outputs.map((bytes, i) => {
        const g = plan.groups[i];
        const label = g.length === 1 ? `${t.split.pageName}-${g[0] + 1}` : `${t.split.pagesName}-${g[0] + 1}-${g[g.length - 1] + 1}`;
        return { name: `${base}-${label}.pdf`, bytes, mime: 'application/pdf' };
      });
    });

  const half = Math.max(1, Math.ceil(pdf.numPages / 2));

  return (
    <ToolShell tool={tool} onReset={pdf.file ? reset : undefined}>
      <SinglePdfInput pdf={pdf} />
      {op.state.status === 'done' && op.state.result ? (
        <ResultPanel
          files={op.state.result}
          title={t.split.done(op.state.result.length)}
          zipName={`${baseName(pdf.file?.name ?? 'document')}-${t.split.zipSuffix}.zip`}
          onReset={reset}
          onBack={op.reset}
        />
      ) : (
        pdf.doc && (
          <>
            <Panel title={t.split.method}>
              <div className="space-y-5">
                <Segmented<Mode>
                  label={t.split.methodLabel}
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: 'ranges', label: t.split.byRanges },
                    { value: 'every', label: t.split.everyN },
                    { value: 'each', label: t.split.eachPage },
                  ]}
                />
                {mode === 'ranges' && (
                  <Field label={t.split.rangesLabel} hint={t.split.rangesHint} htmlFor="ranges">
                    <input
                      id="ranges"
                      className={inputClass}
                      value={ranges}
                      onChange={(e) => setRanges(e.target.value)}
                      placeholder={t.split.rangesPlaceholder(`1-${half}`, `${Math.min(pdf.numPages, half + 1)}-${pdf.numPages}`)}
                      data-testid="ranges-input"
                    />
                  </Field>
                )}
                {mode === 'every' && (
                  <Field label={t.split.everyLabel} htmlFor="every">
                    <input
                      id="every"
                      type="number"
                      min={1}
                      max={pdf.numPages}
                      className={`${inputClass} max-w-32`}
                      value={every}
                      onChange={(e) => setEvery(Number(e.target.value))}
                    />
                  </Field>
                )}
                {plan.error != null && <Alert tone="error">{formatError(plan.error)}</Alert>}
              </div>
            </Panel>

            {plan.groups.length > 0 && (
              <Panel title={t.split.preview(plan.groups.length)}>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {plan.groups.slice(0, MAX_PREVIEW_GROUPS).map((g, i) => (
                    <li key={i} className="rounded-xl bg-mist p-2">
                      <PageThumbnail doc={pdf.doc!} pageIndex={g[0]} width={120} />
                      <p className="mt-1.5 text-xs font-semibold">{t.split.fileN(i + 1)}</p>
                      <p className="truncate text-xs text-muted">{t.split.pagesOf(g.length, formatPageList(g))}</p>
                    </li>
                  ))}
                </ul>
                {plan.groups.length > MAX_PREVIEW_GROUPS && (
                  <p className="mt-3 text-sm text-muted">{t.split.more(plan.groups.length - MAX_PREVIEW_GROUPS)}</p>
                )}
              </Panel>
            )}

            <OperationStatus state={op.state} onDismiss={op.reset} />
            <div className="flex justify-end">
              <Button
                size="lg"
                icon={<Scissors className="size-5" aria-hidden />}
                disabled={!plan.groups.length}
                loading={op.state.status === 'working'}
                onClick={run}
              >
                {t.split.button}
              </Button>
            </div>
          </>
        )
      )}
    </ToolShell>
  );
}
