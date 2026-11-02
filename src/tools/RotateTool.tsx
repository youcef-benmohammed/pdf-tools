import { useEffect, useState } from 'react';
import { RotateCcw, RotateCw, Save } from 'lucide-react';
import { useTool } from '../hooks/useTool';
import { useSinglePdf } from '../hooks/useSinglePdf';
import { useOperation } from '../hooks/useOperation';
import { ToolShell } from '../components/ToolShell';
import { SinglePdfInput } from '../components/SinglePdfInput';
import { PageSelectGrid } from '../components/PageSelectGrid';
import { OperationStatus } from '../components/OperationStatus';
import { ResultPanel } from '../components/ResultPanel';
import { Button, IconButton, Panel } from '../components/ui';
import { runPdfOperation } from '../services/workerClient';
import { readBytes, suffixedName } from '../utils/files';
import { useI18n } from '../i18n';
import type { OutputFile } from '../types';

const norm = (deg: number) => ((deg % 360) + 360) % 360;

export default function RotateTool() {
  const tool = useTool();
  const { t } = useI18n();
  const pdf = useSinglePdf();
  const op = useOperation<OutputFile[]>();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rotations, setRotations] = useState<Record<number, number>>({});

  // Every page is selected by default when a file opens
  useEffect(() => {
    setSelected(new Set(Array.from({ length: pdf.numPages }, (_, i) => i)));
    setRotations({});
  }, [pdf.numPages, pdf.file]);

  const reset = () => {
    pdf.clear();
    op.reset();
    setRotations({});
  };

  const rotate = (indices: Iterable<number>, delta: number) =>
    setRotations((r) => {
      const next = { ...r };
      for (const i of indices) next[i] = norm((next[i] ?? 0) + delta);
      return next;
    });

  const changed = Object.values(rotations).some((v) => v !== 0);

  const run = () =>
    op.run(async (report) => {
      const pages = Array.from({ length: pdf.numPages }, (_, index) => ({ source: 0, index, rotation: rotations[index] ?? 0 }));
      const bytes = await runPdfOperation('compose', [[await readBytes(pdf.file!)], pages], report);
      return [{ name: suffixedName(pdf.file!.name, t.rotate.suffix), bytes, mime: 'application/pdf' }];
    });

  return (
    <ToolShell tool={tool} onReset={pdf.file ? reset : undefined}>
      <SinglePdfInput pdf={pdf} />
      {op.state.status === 'done' && op.state.result ? (
        <ResultPanel files={op.state.result} title={t.rotate.done} onReset={reset} onBack={op.reset} />
      ) : (
        pdf.doc && (
          <>
            <Panel
              title={t.rotate.panel}
              aside={
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted">{t.pages.selected(selected.size)}</span>
                  <Button size="sm" variant="secondary" disabled={!selected.size} icon={<RotateCcw className="size-4" aria-hidden />} onClick={() => rotate(selected, -90)}>
                    {t.rotate.left}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!selected.size}
                    icon={<RotateCw className="size-4" aria-hidden />}
                    onClick={() => rotate(selected, 90)}
                    data-testid="rotate-right"
                  >
                    {t.rotate.right}
                  </Button>
                </div>
              }
            >
              <PageSelectGrid
                doc={pdf.doc}
                numPages={pdf.numPages}
                selected={selected}
                onChange={setSelected}
                rotations={rotations}
                renderExtra={(i) => (
                  <span className="flex">
                    <IconButton label={t.rotate.pageLeft(i + 1)} className="size-7" onClick={() => rotate([i], -90)}>
                      <RotateCcw className="size-3.5" />
                    </IconButton>
                    <IconButton label={t.rotate.pageRight(i + 1)} className="size-7" onClick={() => rotate([i], 90)}>
                      <RotateCw className="size-3.5" />
                    </IconButton>
                  </span>
                )}
              />
            </Panel>
            <OperationStatus state={op.state} onDismiss={op.reset} />
            <div className="flex justify-end">
              <Button size="lg" icon={<Save className="size-5" aria-hidden />} disabled={!changed} loading={op.state.status === 'working'} onClick={run}>
                {t.rotate.apply}
              </Button>
            </div>
          </>
        )
      )}
    </ToolShell>
  );
}
