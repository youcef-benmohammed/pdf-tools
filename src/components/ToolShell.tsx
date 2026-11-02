import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw, ShieldCheck } from 'lucide-react';
import type { ToolDefinition } from '../types';
import { CATEGORY_COLORS } from '../tools/registry';
import { Button } from './ui';
import { useI18n } from '../i18n';

interface ToolShellProps {
  tool: ToolDefinition;
  children: ReactNode;
  /** Shows the "Start over" button when files are loaded */
  onReset?: () => void;
}

/** Common frame of every tool: header, privacy note, reset. */
export function ToolShell({ tool, children, onReset }: ToolShellProps) {
  const { t } = useI18n();
  const Icon = tool.icon;
  const text = t.tools[tool.id];
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-brand-600">
        <ArrowLeft className="size-4" aria-hidden /> {t.shell.allTools}
      </Link>
      <header className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: CATEGORY_COLORS[tool.category] }}>
            <Icon className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{text.title}</h1>
            <p className="mt-1 max-w-[60ch] text-muted">{text.description}</p>
          </div>
        </div>
        {onReset && (
          <Button variant="secondary" icon={<RotateCcw className="size-4" aria-hidden />} onClick={onReset}>
            {t.shell.restart}
          </Button>
        )}
      </header>
      <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-ok/10 px-3 py-1 text-xs font-semibold text-ok">
        <ShieldCheck className="size-3.5" aria-hidden /> {t.app.privacy}
      </p>
      <div className="mt-6 space-y-5">{children}</div>
    </div>
  );
}
