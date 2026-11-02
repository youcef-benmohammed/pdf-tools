import { Suspense, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getTool } from '../tools/registry';
import { ToolContext } from '../hooks/useTool';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { terminateWorker } from '../services/workerClient';
import { NotFoundPage } from './NotFoundPage';
import { useI18n } from '../i18n';

export function ToolPage() {
  const { toolId } = useParams();
  const { t } = useI18n();
  const tool = getTool(toolId);
  const title = tool ? t.tools[tool.id].title : null;

  useEffect(() => {
    if (title) document.title = t.app.pageTitle(title);
    return () => {
      document.title = 'PDF Tools';
    };
  }, [title, t]);

  useEffect(() => {
    window.scrollTo(0, 0);
    // Release the worker (and its memory) when leaving the tool.
    return () => terminateWorker();
  }, [tool]);

  if (!tool) return <NotFoundPage />;
  const Component = tool.component;

  return (
    <ToolContext.Provider value={tool}>
      <ErrorBoundary key={tool.id}>
        <Suspense
          fallback={
            <div className="flex justify-center py-24 text-muted" role="status">
              <Loader2 className="size-6 animate-spin" aria-hidden />
              <span className="sr-only">{t.app.loadingTool}</span>
            </div>
          }
        >
          <Component key={tool.id} />
        </Suspense>
      </ErrorBoundary>
    </ToolContext.Provider>
  );
}
