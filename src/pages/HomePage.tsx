import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Image as ImageIcon, Search, X } from 'lucide-react';
import { CATEGORY_COLORS, CATEGORY_ORDER, searchTools } from '../tools/registry';
import type { ToolCategory, ToolDefinition } from '../types';
import { Dropzone } from '../components/Dropzone';
import { Alert } from '../components/ui';
import { getPendingFiles, setPendingFiles, subscribePending } from '../services/fileHandoff';
import { imageKind, isPdf } from '../utils/files';
import { cn } from '../utils/cn';
import { useI18n } from '../i18n';

type Filter = 'all' | ToolCategory;

export function HomePage() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [dropError, setDropError] = useState<string | null>(null);
  const pending = useSyncExternalStore(subscribePending, getPendingFiles);
  const navigate = useNavigate();

  const pendingKind = useMemo(() => {
    if (!pending.length) return null;
    if (pending.every(isPdf)) return 'pdf' as const;
    if (pending.every((f) => imageKind(f))) return 'image' as const;
    return null;
  }, [pending]);

  // Once files are dropped, only show the tools that can take them.
  const visible = useMemo(() => {
    let list = searchTools(query);
    if (filter !== 'all') list = list.filter((tool) => tool.category === filter);
    if (pendingKind) list = list.filter((tool) => tool.accept === pendingKind && (tool.multiple || pending.length === 1));
    return list;
  }, [query, filter, pendingKind, pending.length]);

  const onDrop = (files: File[]) => {
    setDropError(null);
    const pdfs = files.filter(isPdf);
    const images = files.filter((f) => imageKind(f));
    if (!pdfs.length && !images.length) return setDropError(t.home.dropUnsupported);
    if (pdfs.length && images.length) return setDropError(t.home.dropMixed);
    if (images.length) {
      // Only one tool takes images: go straight to it.
      setPendingFiles(images);
      navigate('/images-en-pdf');
      return;
    }
    setPendingFiles(pdfs);
  };

  const groups = CATEGORY_ORDER.map((cat) => ({ cat, tools: visible.filter((tool) => tool.category === cat) })).filter((g) => g.tools.length);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <div>
          <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-balance sm:text-5xl lg:text-[3.4rem]">{t.home.title}</h1>
          <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-muted">{t.home.subtitle}</p>
          <ul className="mt-6 space-y-2 text-sm text-muted">
            {t.home.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          {pending.length ? (
            <PendingCard files={pending} onClear={() => setPendingFiles([])} hasTools={visible.length > 0} />
          ) : (
            <Dropzone accept="any" multiple onFiles={onDrop} title={t.home.dropTitle} />
          )}
          {dropError && (
            <Alert tone="error" onClose={() => setDropError(null)}>
              {dropError}
            </Alert>
          )}
        </div>
      </section>

      <section aria-labelledby="tools-heading" className="pb-16">
        <h2 id="tools-heading" className="sr-only">
          {t.home.toolsHeading}
        </h2>
        <div className="flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label={t.home.categoriesLabel} className="flex flex-wrap gap-1">
            <CategoryChip active={filter === 'all'} onClick={() => setFilter('all')}>
              {t.home.allTools}
            </CategoryChip>
            {CATEGORY_ORDER.map((c) => (
              <CategoryChip key={c} active={filter === c} onClick={() => setFilter(c)} color={CATEGORY_COLORS[c]}>
                {t.categories[c]}
              </CategoryChip>
            ))}
          </nav>
          <label className="relative block lg:w-60 lg:shrink-0">
            <span className="sr-only">{t.home.searchLabel}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.home.searchPlaceholder}
              className="h-10 w-full rounded-xl border border-line bg-paper pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </label>
        </div>

        {groups.length === 0 ? (
          <p className="py-12 text-center text-muted">
            {t.home.noResults(query)}{' '}
            <button
              type="button"
              className="font-semibold text-brand-600 hover:underline"
              onClick={() => {
                setQuery('');
                setFilter('all');
              }}
            >
              {t.home.showAll}
            </button>
          </p>
        ) : (
          <div className="mt-8 space-y-10">
            {groups.map(({ cat, tools }) => (
              <div key={cat}>
                <h3 className="mb-4 flex items-center gap-2.5 text-lg font-bold">
                  <span className="h-4 w-1 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] }} aria-hidden />
                  {t.categories[cat]}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tools.map((tool) => (
                    <ToolCard key={tool.id} tool={tool} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CategoryChip({ active, onClick, color, children }: { active: boolean; onClick: () => void; color?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors',
        active ? 'bg-ink text-paper' : 'text-muted hover:bg-paper hover:text-ink',
      )}
    >
      {color && <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />}
      {children}
    </button>
  );
}

function ToolCard({ tool }: { tool: ToolDefinition }) {
  const { t } = useI18n();
  const Icon = tool.icon;
  const color = CATEGORY_COLORS[tool.category];
  const text = t.tools[tool.id];
  return (
    <Link to={`/${tool.id}`} className="group flex gap-4 rounded-2xl border border-line bg-paper p-5 transition-colors hover:border-brand-500">
      <span
        className="flex size-11 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block font-bold text-ink group-hover:text-brand-600">{text.title}</span>
        <span className="mt-1 block text-sm leading-snug text-muted">{text.description}</span>
      </span>
    </Link>
  );
}

function PendingCard({ files, onClear, hasTools }: { files: File[]; onClear: () => void; hasTools: boolean }) {
  const { t, formatBytes } = useI18n();
  const total = files.reduce((s, f) => s + f.size, 0);
  const Icon = isPdf(files[0]) ? FileText : ImageIcon;
  return (
    <div className="rounded-2xl border-2 border-brand-500 bg-paper p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{files.length === 1 ? files[0].name : t.home.filesReady(files.length)}</p>
          <p className="text-sm text-muted">{t.home.stillOnDevice(formatBytes(total))}</p>
        </div>
        <button type="button" onClick={onClear} className="text-muted hover:text-ink" aria-label={t.home.clearFiles}>
          <X className="size-5" />
        </button>
      </div>
      <p className="mt-4 text-sm font-semibold text-brand-600">{hasTools ? t.home.chooseTool : t.home.noToolForFilter}</p>
    </div>
  );
}
