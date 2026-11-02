import { createContext, useContext, useEffect, useRef } from 'react';
import type { ToolDefinition } from '../types';
import { takePendingFiles } from '../services/fileHandoff';

export const ToolContext = createContext<ToolDefinition | null>(null);

export function useTool(): ToolDefinition {
  const tool = useContext(ToolContext);
  if (!tool) throw new Error('useTool must be used inside a tool.');
  return tool;
}

/** Picks up, once, the files dropped on the home page. */
export function useInitialFiles(onFiles: (files: File[]) => void) {
  const done = useRef(false);
  const cb = useRef(onFiles);
  cb.current = onFiles;
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const files = takePendingFiles();
    if (files.length) cb.current(files);
  }, []);
}
