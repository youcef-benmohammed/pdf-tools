import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDownAZ, FileImage, Trash2 } from 'lucide-react';
import { useTool, useInitialFiles } from '../hooks/useTool';
import { useOperation } from '../hooks/useOperation';
import { ToolShell } from '../components/ToolShell';
import { Dropzone } from '../components/Dropzone';
import { SortableList } from '../components/Sortable';
import { OperationStatus } from '../components/OperationStatus';
import { ResultPanel } from '../components/ResultPanel';
import { Button, ErrorList, Field, IconButton, Panel, Segmented } from '../components/ui';
import { runPdfOperation } from '../services/workerClient';
import { checkImage, prepareImage } from '../utils/images';
import { baseName, uid, validateFiles } from '../utils/files';
import { toAppError, type AppError } from '../utils/errors';
import { cn } from '../utils/cn';
import { useI18n } from '../i18n';
import type { ImagePageInput, ImagesToPdfOptions, OrientationMode, OutputFile, PageSizeMode } from '../types';

interface ImageItem {
  id: string;
  file: File;
  /** Object URL for the preview, revoked when the item goes away */
  url: string;
}

const MARGINS = { none: 0, small: 18, large: 40 } as const;
type MarginKey = keyof typeof MARGINS;

export default function ImagesToPdfTool() {
  const tool = useTool();
  const { t, formatBytes } = useI18n();
  const [items, setItems] = useState<ImageItem[]>([]);
  const [warnings, setWarnings] = useState<AppError[]>([]);
  const [pageSize, setPageSize] = useState<PageSizeMode>('a4');
  const [orientation, setOrientation] = useState<OrientationMode>('auto');
  const [margin, setMargin] = useState<MarginKey>('small');
  const op = useOperation<OutputFile[]>();
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const addFiles = useCallback(async (files: File[]) => {
    const current = itemsRef.current;
    const used = current.reduce((s, e) => s + e.file.size, 0);
    const { accepted, errors } = validateFiles(files, 'image', used, current.length);
    const ok: ImageItem[] = [];
    for (const file of accepted) {
      try {
        await checkImage(file);
        ok.push({ id: uid('img'), file, url: URL.createObjectURL(file) });
      } catch (e) {
        errors.push(toAppError(e));
      }
    }
    setWarnings(errors);
    setItems((cur) => [...cur, ...ok]);
  }, []);

  useInitialFiles(addFiles);

  // Release the previews when the tool closes
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  const remove = (id: string) =>
    setItems((cur) => {
      const it = cur.find((i) => i.id === id);
      if (it) URL.revokeObjectURL(it.url);
      return cur.filter((i) => i.id !== id);
    });

  const reset = () => {
    items.forEach((i) => URL.revokeObjectURL(i.url));
    setItems([]);
    setWarnings([]);
    op.reset();
  };

  const run = () =>
    op.run(async (report) => {
      const images: ImagePageInput[] = [];
      for (let i = 0; i < items.length; i++) {
        images.push(await prepareImage(items[i].file));
        report(((i + 1) / items.length) * 0.4, t.images.preparing);
      }
      const options: ImagesToPdfOptions = { pageSize, orientation, margin: MARGINS[margin] };
      const bytes = await runPdfOperation('images', [images, options], (f) => report(0.4 + f * 0.6, t.images.building));
      const name = items.length === 1 ? `${baseName(items[0].file.name)}.pdf` : t.images.outputName;
      return [{ name, bytes, mime: 'application/pdf' }];
    });

  return (
    <ToolShell tool={tool} onReset={items.length ? reset : undefined}>
      {op.state.status === 'done' && op.state.result ? (
        <ResultPanel files={op.state.result} title={t.images.done(items.length)} onReset={reset} onBack={op.reset} />
      ) : (
        <>
          {items.length === 0 ? (
            <Dropzone accept="image" multiple onFiles={addFiles} title={t.images.dropTitle} />
          ) : (
            <>
              <Panel
                title={t.images.count(items.length)}
                aside={
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<ArrowDownAZ className="size-4" aria-hidden />}
                    onClick={() => setItems((c) => [...c].sort((a, b) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true })))}
                  >
                    {t.merge.sortByName}
                  </Button>
                }
              >
                <p className="mb-3 text-sm text-muted">{t.images.hint}</p>
                <SortableList
                  items={items}
                  onChange={setItems}
                  layout="grid"
                  className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                  renderItem={(item, i, handle) => (
                    <div className={cn('rounded-xl border-2 bg-mist p-2', handle.isDragging ? 'border-brand-500' : 'border-transparent')} data-testid="image-item">
                      <div
                        className="checker flex aspect-square cursor-grab touch-none items-center justify-center overflow-hidden rounded-lg active:cursor-grabbing"
                        {...handle.attributes}
                        {...handle.listeners}
                        aria-label={t.images.item(i + 1, item.file.name)}
                      >
                        <img src={item.url} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
                      </div>
                      <div className="mt-1.5 flex items-center gap-1">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold">
                            {i + 1}. {item.file.name}
                          </span>
                          <span className="block text-xs text-muted">{formatBytes(item.file.size)}</span>
                        </span>
                        <IconButton label={t.merge.removeFile(item.file.name)} className="size-7 hover:text-danger" onClick={() => remove(item.id)}>
                          <Trash2 className="size-3.5" />
                        </IconButton>
                      </div>
                    </div>
                  )}
                />
                <Dropzone accept="image" multiple compact onFiles={addFiles} className="mt-3" />
              </Panel>

              <Panel title={t.images.layout}>
                <div className="grid gap-5 md:grid-cols-3">
                  <Field label={t.images.pageSize}>
                    <Segmented<PageSizeMode>
                      label={t.images.pageSize}
                      value={pageSize}
                      onChange={setPageSize}
                      options={[
                        { value: 'a4', label: t.images.a4 },
                        { value: 'letter', label: t.images.letter },
                        { value: 'fit', label: t.images.fit },
                      ]}
                    />
                  </Field>
                  {pageSize !== 'fit' && (
                    <Field label={t.images.orientation}>
                      <Segmented<OrientationMode>
                        label={t.images.orientation}
                        value={orientation}
                        onChange={setOrientation}
                        options={[
                          { value: 'auto', label: t.images.auto },
                          { value: 'portrait', label: t.images.portrait },
                          { value: 'landscape', label: t.images.landscape },
                        ]}
                      />
                    </Field>
                  )}
                  <Field label={t.images.margins}>
                    <Segmented<MarginKey>
                      label={t.images.margins}
                      value={margin}
                      onChange={setMargin}
                      options={[
                        { value: 'none', label: t.images.marginNone },
                        { value: 'small', label: t.images.marginSmall },
                        { value: 'large', label: t.images.marginLarge },
                      ]}
                    />
                  </Field>
                </div>
              </Panel>
            </>
          )}

          <ErrorList errors={warnings} onClose={() => setWarnings([])} />
          <OperationStatus state={op.state} onDismiss={op.reset} />
          {items.length > 0 && (
            <div className="flex justify-end">
              <Button size="lg" icon={<FileImage className="size-5" aria-hidden />} loading={op.state.status === 'working'} onClick={run}>
                {t.images.button}
              </Button>
            </div>
          )}
        </>
      )}
    </ToolShell>
  );
}
