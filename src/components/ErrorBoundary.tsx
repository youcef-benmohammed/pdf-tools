import { Component, type ContextType, type ReactNode } from 'react';
import { I18nContext } from '../i18n';
import en from '../i18n/en';

interface State {
  error: Error | null;
}

/** Safety net: shows an understandable error instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  static contextType = I18nContext;
  declare context: ContextType<typeof I18nContext>;
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    const t = this.context?.t ?? en;
    // A lazy chunk that fails to load usually means a new deploy or a network issue.
    const chunkFailed = /dynamically imported module|Failed to fetch|Importing a module script failed/i.test(this.state.error.message);
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="text-2xl font-extrabold">{t.errorBoundary.title}</h1>
        <p className="mt-3 text-muted">{chunkFailed ? t.errorBoundary.chunk : t.errorBoundary.generic}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700"
        >
          {t.errorBoundary.reload}
        </button>
      </div>
    );
  }
}
