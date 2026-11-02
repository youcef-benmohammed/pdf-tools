import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, RotateCcw, RotateCw, Save, Trash2, Undo2 } from 'lucide-react';
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
import { readBytes, suffixedName, uid, validateFiles } from '../utils/files';
import type { AppError } from '../utils/errors';
import { cn } from '../utils/cn';
import { useI18n } from '../i18n';
import type { OutputFile, PageRef } from '../types';

/** Colors that tell apart pages coming from different files */
const SOURCE_COLORS = ['#5b3fd9', '#0f7a8c', '#b4570e', '#2b6fd6', '#a3307a', '#3f7d20'];
const norm = (deg: number) => ((deg % 360) + 360) % 360;
const signature = (pages: PageRef[]) => JSON.stringify(pages.map(({ source, index, rotation }) => [source, index, rotation]));

export default function OrganizeTool() {
  const tool = useTool();
  const { t, formatError } = useI18n();
  const [entries, setEntries] = useState<DocEntry[]>([]);
  const [pages, setPages] = useState<PageRef[]>([]);
  const [initial, setInitial] = useState<PageRef[]>([]);
  const [warnings, setWarnings] = useState<AppError[]>([]);
  const expanded = useRef(new Set<string>());
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

  // Append the pages of each new document once it is open
  useEffect(() => {
    entries.forEach((entry, source) => {
      const st = docs[entry.id];
      if (!st?.numPages || expanded.current.has(entry.id)) return;
      expanded.current.add(entry.id);
      const added = Array.from({ length: st.numPages }, (_, index) => ({ id: uid('p'), source, index, rotation: 0 }));
      setPages((p) => [...p, ...added]);
      setInitial((p) => [...p, ...added]);
    });
  }, [entries, docs]);

  const reset = () => {
    setEntries([]);
    setPages([]);
    setInitial([]);
    setWarnings([]);
    expanded.current.clear();
    op.reset();
  };

  const update = (id: string, fn: (p: PageRef) => PageRef) => setPages((ps) => ps.map((p) => (p.id === id ? fn(p) : p)));
  const rotate = (id: string, d: number) => update(id, (p) => ({ ...p, rotation: norm(p.rotation + d) }));
  const rotateAll = (d: number) => setPages((ps) => ps.map((p) => ({ ...p, rotation: norm(p.rotation + d) })));
  const duplicate = (id: string) =>
    setPages((ps) => {
      const i = ps.findIndex((p) => p.id === id);
      return [...ps.slice(0, i + 1), { ...ps[i], id: uid('p') }, ...ps.slice(i + 1)];
    });
  const remove = (id: string) => setPages((ps) => ps.filter((p) => p.id !== id));

  const brokenEntries = entries.filter((e) => docs[e.id]?.error);
  const changed = signature(pages) !== signature(initial);
  const loading = entries.some((e) => docs[e.id]?.loading !== false);
  const multiSource = entries.length > 1;

  const run = () =>
    op.run(async (report) => {
      // Only send the files that still contribute pages.
      const used = [...new Set(pages.map((p) => p.source))].sort((a, b) => a - b);
      const remap = new Map(used.map((s, i) => [s, i]));
      const sources = await Promise.all(used.map((s) => readBytes(entries[s].file)));
      const list = pages.map((p) => ({ source: remap.get(p.source)!, index: p.index, rotation: p.rotation }));
      const bytes = await runPdfOperation('compose', [sources, list], report);
      return [{ name: suffixedName(entries[0].file.name, t.organize.suffix), bytes, mime: 'application/pdf' }];
    });

  return (
    <ToolShell tool={tool} onReset={entries.length ? reset : undefined}>
      {op.state.status === 'done' && op.state.result ? (
        <ResultPanel files={op.state.result} title={t.organize.done(pages.length)} onReset={reset} onBack={op.reset} />
      ) : entries.length === 0 ? (
        <>
          <Dropzone accept="pdf" multiple onFiles={addFiles} title={t.organize.dropTitle} />
          <ErrorList errors={warnings} onClose={() => setWarnings([])} />
        </>
      ) : (
        <>
          <Panel
            title={t.organize.count(pages.length)}
            aside={
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon={<RotateCcw className="size-4" aria-hidden />} onClick={() => rotateAll(-90)}>
                  {t.organize.allLeft}
                </Button>
                <Button size="sm" variant="secondary" icon={<RotateCw className="size-4" aria-hidden />} onClick={() => rotateAll(90)}>
                  {t.organize.allRight}
                </Button>
                <Button size="sm" variant="ghost" icon={<Undo2 className="size-4" aria-hidden />} disabled={!changed} onClick={() => setPages(initial)}>
                  {t.organize.undo}
                </Button>
              </div>
            }
          >
            <p className="mb-4 text-sm text-muted">{t.organize.hint}</p>
            {multiSource && (
              <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                {entries.map((e, i) => (
                  <li key={e.id} className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                    {e.file.name}
                  </li>
                ))}
              </ul>
            )}
            {pages.length === 0 && !loading && <p className="py-6 text-center text-sm text-muted">{t.organize.allRemoved}</p>}
            <SortableList
              items={pages}
              onChange={setPages}
              layout="grid"
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
              renderItem={(page, i, handle) => {
                const doc = docs[entries[page.source]?.id]?.doc;
                return (
                  <div
                    className={cn('rounded-xl border-2 bg-mist p-2 transition-colors', handle.isDragging ? 'border-brand-500 shadow-lg' : 'border-transparent')}
                    data-testid="organize-page"
                  >
                    <div className="cursor-grab touch-none active:cursor-grabbing" {...handle.attributes} {...handle.listeners} aria-label={t.organize.draggable(i + 1)}>
                      {doc && <PageThumbnail doc={doc} pageIndex={page.index} rotation={page.rotation} />}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                        {multiSource && (
                          <span className="size-2 rounded-full" style={{ backgroundColor: SOURCE_COLORS[page.source % SOURCE_COLORS.length] }} aria-hidden />
                        )}
                        {i + 1}
                      </span>
                      <span className="flex">
                        <IconButton label={t.organize.rotateLeft} className="size-7" onClick={() => rotate(page.id, -90)}>
                          <RotateCcw className="size-3.5" />
                        </IconButton>
                        <IconButton label={t.organize.rotateRight} className="size-7" onClick={() => rotate(page.id, 90)}>
                          <RotateCw className="size-3.5" />
                        </IconButton>
                        <IconButton label={t.organize.duplicate} className="size-7" onClick={() => duplicate(page.id)}>
                          <Copy className="size-3.5" />
                        </IconButton>
                        <IconButton label={t.organize.delete} className="size-7 hover:text-danger" onClick={() => remove(page.id)}>
                          <Trash2 className="size-3.5" />
                        </IconButton>
                      </span>
                    </div>
                  </div>
                );
              }}
            />
            <Dropzone accept="pdf" multiple compact onFiles={addFiles} className="mt-4" />
          </Panel>

          <ErrorList errors={warnings} onClose={() => setWarnings([])} />
          {brokenEntries.map((e) => (
            <Alert key={e.id} tone="error">
              {e.file.name} : {formatError(docs[e.id]?.error)}
            </Alert>
          ))}
          <OperationStatus state={op.state} onDismiss={op.reset} />
          <div className="flex justify-end">
            <Button
              size="lg"
              icon={<Save className="size-5" aria-hidden />}
              disabled={!pages.length || loading || (!changed && !multiSource)}
              loading={op.state.status === 'working'}
              onClick={run}
            >
              {t.organize.save}
            </Button>
          </div>
        </>
      )}
    </ToolShell>
  );
}
