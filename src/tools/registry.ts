import { lazy } from 'react';
import { Combine, Droplets, FileMinus2, FileOutput, Images, LayoutGrid, PenLine, RotateCw, Scissors, Shrink } from 'lucide-react';
import type { ToolCategory, ToolDefinition } from '../types';
import { DICTIONARIES } from '../i18n';
import type { Dict } from '../i18n/en';

export const CATEGORY_COLORS: Record<ToolCategory, string> = {
  organize: 'var(--color-cat-organize)',
  sign: 'var(--color-cat-sign)',
  convert: 'var(--color-cat-convert)',
  optimize: 'var(--color-cat-optimize)',
};

export const CATEGORY_ORDER: ToolCategory[] = ['organize', 'sign', 'convert', 'optimize'];

/** Every tool is loaded on demand (lazy loading). Titles and descriptions live in the dictionaries. */
export const TOOLS: ToolDefinition[] = [
  { id: 'fusionner', category: 'organize', icon: Combine, accept: 'pdf', multiple: true, component: lazy(() => import('./MergeTool')) },
  { id: 'diviser', category: 'organize', icon: Scissors, accept: 'pdf', multiple: false, component: lazy(() => import('./SplitTool')) },
  { id: 'extraire', category: 'organize', icon: FileOutput, accept: 'pdf', multiple: false, component: lazy(() => import('./ExtractTool')) },
  { id: 'supprimer', category: 'organize', icon: FileMinus2, accept: 'pdf', multiple: false, component: lazy(() => import('./DeleteTool')) },
  { id: 'organiser', category: 'organize', icon: LayoutGrid, accept: 'pdf', multiple: true, component: lazy(() => import('./OrganizeTool')) },
  { id: 'pivoter', category: 'organize', icon: RotateCw, accept: 'pdf', multiple: false, component: lazy(() => import('./RotateTool')) },
  { id: 'signer', category: 'sign', icon: PenLine, accept: 'pdf', multiple: false, component: lazy(() => import('./SignTool')) },
  { id: 'images-en-pdf', category: 'convert', icon: Images, accept: 'image', multiple: true, component: lazy(() => import('./ImagesToPdfTool')) },
  { id: 'compresser', category: 'optimize', icon: Shrink, accept: 'pdf', multiple: false, component: lazy(() => import('./CompressTool')) },
  { id: 'filigrane', category: 'optimize', icon: Droplets, accept: 'pdf', multiple: false, component: lazy(() => import('./WatermarkTool')) },
];

export function getTool(id: string | undefined): ToolDefinition | undefined {
  return TOOLS.find((t) => t.id === id);
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function haystack(tool: ToolDefinition, dict: Dict): string {
  const text = dict.tools[tool.id];
  return [text.title, text.description, dict.categories[tool.category], ...text.keywords].join(' ');
}

/** Searches titles, descriptions and keywords in every language, so "merge" and "fusionner" both work. */
export function searchTools(query: string, tools = TOOLS): ToolDefinition[] {
  const q = normalize(query.trim());
  if (!q) return tools;
  const words = q.split(/\s+/);
  return tools.filter((t) => {
    const hay = normalize(Object.values(DICTIONARIES).map((d) => haystack(t, d)).join(' '));
    return words.every((w) => hay.includes(w));
  });
}
