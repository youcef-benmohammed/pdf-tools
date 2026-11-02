import type { OperationState } from '../hooks/useOperation';
import { Alert, ProgressBar } from './ui';
import { useI18n } from '../i18n';

/** Progress bar while working, translated error on failure. */
export function OperationStatus<T>({ state, onDismiss }: { state: OperationState<T>; onDismiss?: () => void }) {
  const { formatError } = useI18n();
  if (state.status === 'working') {
    return (
      <div className="rounded-2xl border border-line bg-paper p-5" aria-live="polite">
        <ProgressBar value={state.progress} label={state.label} />
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <Alert tone="error" onClose={onDismiss}>
        {formatError(state.error)}
      </Alert>
    );
  }
  return null;
}
