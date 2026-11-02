import { useCallback, useState } from 'react';
import { ArrowDownAZ, Combine, GripVertical, Loader2, Trash2 } from 'lucide-react';
import { useTool, useInitialFiles } from '../hooks/useTool';
import { usePdfDocuments, type DocEntry } from '../hooks/usePdfDocuments';
import { useOperation } from '../hooks/useOperation';
import { ToolShell } from '../components/ToolShell';
import { Dropzone } from '../components/Dropzone';
import { SortableList } from '../components/Sortable';
import { PageThumbnail } from '../components/PageThumbnail';
import { OperationStatus } from '../components/OperationStatus';
import { ResultPanel } from '../components/ResultPanel';
import { Alert, Button, ErrorList, IconButton, Panel } from '../components/ui';
import { runPdfOperation } from '../services/workerClient';
import { readBytes, uid, validateFiles } from '../utils/files';
import type { AppError } from '../utils/errors';
import { cn } from '../utils/cn';
import { useI18n } from '../i18n';
import type { OutputFile } from '../types';

export default function MergeTool() {
  const tool = useTool();
  const { t, formatBytes, formatError } = useI18n();
  const [entries, setEntries] = useState<DocEntry[]>([]);
  const [warnings, setWarnings] = useState<AppError[]>([]);
  const docs = usePdfDocuments(entries);
  const op = useOperation<OutputFile[]>();

  const addFiles = useCallback((files: File[]) => {
    setEntries((current) => {
      const used = current.reduce((s, e) => s + e.file.size, 0);
      const { accepted, errors } = validateFiles(files, 'pdf', used, current.length);
      setWarnings(errors);
      return [...current, ...accepted.map((file) => ({ id: uid('pdf'), file }))];
    });
  }, []);

  useInitialFiles(addFiles);

  const reset = () => {
    setEntries([]);
    setWarnings([]);
    op.reset();
  };

  const remove = (id: string) => setEntries((e) => e.filter((x) => x.id !== id));
  const sortByName = () => setEntries((e) => [...e].sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true })));

  const broken = entries.filter((e) => docs[e.id]?.error);
  const totalPages = entries.reduce((s, e) => s + (docs[e.id]?.numPages ?? 0), 0);
  const stillLoading = entries.some((e) => docs[e.id]?.loading !== false);

  const run = () =>
    op.run(async (report) => {
      report(0, t.merge.reading);
      const sources = await Promise.all(entries.map((e) => readBytes(e.file)));
      report(0.05, t.merge.merging);
      const bytes = await runPdfOperation('merge', [sources], (f) => report(0.05 + f * 0.95));
      return [{ name: t.merge.outputName, bytes, mime: 'application/pdf' }];
    });

  return (
    <ToolShell tool={tool} onReset={entries.length ? reset : undefined}>
      {op.state.status === 'done' && op.state.result ? (
        <ResultPanel files={op.state.result} title={t.merge.done(entries.length, totalPages)} onReset={reset} onBack={op.reset} />
      ) : (
        <>
          {entries.length === 0 ? (
            <Dropzone accept="pdf" multiple onFiles={addFiles} title={t.merge.dropTitle} />
          ) : (
            <Panel
              title={t.merge.summary(entries.length, totalPages)}
              aside={
                <Button size="sm" variant="ghost" icon={<ArrowDownAZ className="size-4" aria-hidden />} onClick={sortByName}>
                  {t.merge.sortByName}
                </Button>
              }
            >
              <p className="mb-3 text-sm text-muted">{t.merge.hint}</p>
              <SortableList
                items={entries}
                onChange={setEntries}
                layout="list"
                className="space-y-2"
                renderItem={(entry, index, handle) => {
                  const st = docs[entry.id];
                  return (
                    <div
                      className={cn(
                        'flex items-center gap-3 rounded-xl border bg-paper p-2 pr-3',
                        st?.error ? 'border-danger/40' : 'border-line',
                        handle.isDragging && 'border-brand-500',
                      )}
                      data-testid="merge-item"
                    >
                      <button
                        type="button"
                        className="cursor-grab touch-none rounded-lg p-1.5 text-muted hover:bg-mist active:cursor-grabbing"
                        aria-label={t.merge.move(entry.file.name)}
                        {...handle.attributes}
                        {...handle.listeners}
                      >
                        <GripVertical className="size-4" />
                      </button>
                      <span className="w-6 text-center text-sm font-bold text-muted tabular-nums">{index + 1}</span>
                      <div className="w-14 shrink-0 rounded-lg bg-mist p-1">
                        {st?.doc ? (
                          <PageThumbnail doc={st.doc} pageIndex={0} width={56} />
                        ) : (
                          <div className="flex aspect-square items-center justify-center">
                            {st?.loading && <Loader2 className="size-4 animate-spin text-muted" />}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{entry.file.name}</p>
                        <p className={cn('text-xs', st?.error ? 'text-danger' : 'text-muted')}>
                          {st?.error ? formatError(st.error) : t.file.summary(formatBytes(entry.file.size), st?.numPages ?? 0)}
                        </p>
                      </div>
                      <IconButton label={t.merge.removeFile(entry.file.name)} onClick={() => remove(entry.id)}>
                        <Trash2 className="size-4" />
                      </IconButton>
                    </div>
                  );
                }}
              />
              <Dropzone accept="pdf" multiple compact onFiles={addFiles} className="mt-3" />
            </Panel>
          )}

          <ErrorList errors={warnings} onClose={() => setWarnings([])} />
          {broken.length > 0 && <Alert tone="error">{t.merge.removeBroken}</Alert>}
          {entries.length === 1 && <Alert tone="info">{t.merge.addOne}</Alert>}
          <OperationStatus state={op.state} onDismiss={op.reset} />

          {entries.length > 0 && (
            <div className="flex justify-end">
              <Button
                size="lg"
                icon={<Combine className="size-5" aria-hidden />}
                disabled={entries.length < 2 || broken.length > 0 || stillLoading}
                loading={op.state.status === 'working'}
                onClick={run}
              >
                {t.merge.button(entries.length)}
              </Button>
            </div>
          )}
        </>
      )}
    </ToolShell>
  );
}
