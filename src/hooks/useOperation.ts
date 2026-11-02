import { useCallback, useRef, useState } from 'react';

export type OperationStatus = 'idle' | 'working' | 'done' | 'error';

export interface OperationState<T> {
  status: OperationStatus;
  progress: number;
  label?: string;
  /** Raw error (usually an AppError), translated at render time */
  error?: unknown;
  result?: T;
}

/** Handles the state of an operation (progress, success, error) in a uniform way. */
export function useOperation<T>() {
  const [state, setState] = useState<OperationState<T>>({ status: 'idle', progress: 0 });
  const runId = useRef(0);

  const run = useCallback(async (task: (report: (fraction: number, label?: string) => void) => Promise<T>) => {
    const id = ++runId.current;
    setState({ status: 'working', progress: 0 });
    const report = (fraction: number, label?: string) => {
      if (runId.current !== id) return;
      setState((s) => ({ ...s, progress: Math.max(0, Math.min(1, fraction)), label: label ?? s.label }));
    };
    try {
      const result = await task(report);
      if (runId.current === id) setState({ status: 'done', progress: 1, result });
      return result;
    } catch (error) {
      if (runId.current === id) setState({ status: 'error', progress: 0, error });
      return undefined;
    }
  }, []);

  const reset = useCallback(() => {
    runId.current++;
    setState({ status: 'idle', progress: 0 });
  }, []);

  return { state, run, reset };
}
