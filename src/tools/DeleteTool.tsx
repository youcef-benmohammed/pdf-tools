import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useTool } from '../hooks/useTool';
import { useSinglePdf } from '../hooks/useSinglePdf';
import { useOperation } from '../hooks/useOperation';
import { ToolShell } from '../components/ToolShell';
import { SinglePdfInput } from '../components/SinglePdfInput';
import { PageSelectGrid } from '../components/PageSelectGrid';
import { OperationStatus } from '../components/OperationStatus';
import { ResultPanel } from '../components/ResultPanel';
import { Alert, Button, Panel } from '../components/ui';
import { runPdfOperation } from '../services/workerClient';
import { readBytes, suffixedName } from '../utils/files';
import { useI18n } from '../i18n';
import type { OutputFile } from '../types';

export default function DeleteTool() {
  const tool = useTool();
  const { t } = useI18n();
  const pdf = useSinglePdf();
  const op = useOperation<OutputFile[]>();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const reset = () => {
    pdf.clear();
    op.reset();
    setSelected(new Set());
  };

  // A PDF cannot end up with zero pages.
  const allSelected = pdf.numPages > 0 && selected.size >= pdf.numPages;
  const remaining = pdf.numPages - selected.size;

  const run = () =>
    op.run(async (report) => {
      const pages = Array.from({ length: pdf.numPages }, (_, i) => i)
        .filter((i) => !selected.has(i))
        .map((index) => ({ source: 0, index, rotation: 0 }));
      const bytes = await runPdfOperation('compose', [[await readBytes(pdf.file!)], pages], report);
      return [{ name: suffixedName(pdf.file!.name, t.remove.suffix), bytes, mime: 'application/pdf' }];
    });

  return (
    <ToolShell tool={tool} onReset={pdf.file ? reset : undefined}>
      <SinglePdfInput pdf={pdf} />
      {op.state.status === 'done' && op.state.result ? (
        <ResultPanel files={op.state.result} title={t.remove.done(selected.size, remaining)} onReset={reset} onBack={op.reset} />
      ) : (
        pdf.doc && (
          <>
            <Panel title={t.remove.panel} aside={<span className="text-sm text-muted">{t.pages.selected(selected.size)}</span>}>
              <PageSelectGrid doc={pdf.doc} numPages={pdf.numPages} selected={selected} onChange={setSelected} tone="remove" />
            </Panel>
            {allSelected && <Alert tone="error">{t.remove.keepOne}</Alert>}
            <OperationStatus state={op.state} onDismiss={op.reset} />
            <div className="flex justify-end">
              <Button
                size="lg"
                icon={<Trash2 className="size-5" aria-hidden />}
                disabled={!selected.size || allSelected}
                loading={op.state.status === 'working'}
                onClick={run}
              >
                {t.remove.button(selected.size)}
              </Button>
            </div>
          </>
        )
      )}
    </ToolShell>
  );
}
