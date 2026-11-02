import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import en, { type Dict } from './en';
import fr from './fr';
import { toAppError, type ErrorParams } from '../utils/errors';

export type Lang = 'en' | 'fr';
export const DICTIONARIES: Record<Lang, Dict> = { en, fr };
const STORAGE_KEY = 'pdf-tools-lang';

/** Stored choice first, then the browser language; French browsers get French, everyone else English. */
export function detectLanguage(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'fr') return stored;
  } catch {
    /* storage unavailable */
  }
  const langs = typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : [];
  return langs.some((l) => l?.toLowerCase().startsWith('fr')) ? 'fr' : 'en';
}

export function formatBytesFor(dict: Dict, bytes: number): string {
  if (bytes < 1024) return `${bytes} ${dict.units[0]}`;
  let v = bytes / 1024;
  let u = 1;
  while (v >= 1024 && u < dict.units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toLocaleString(dict.locale, { maximumFractionDigits: v < 10 ? 1 : 0 })} ${dict.units[u]}`;
}

export function formatErrorFor(dict: Dict, error: unknown): string {
  const e = toAppError(error);
  const fn = dict.errors[e.code] as ((p: ErrorParams) => string) | undefined;
  // Size limits are passed in bytes and formatted in the current language.
  const params = { ...e.params };
  if (typeof params.limit === 'number') params.limit = formatBytesFor(dict, params.limit);
  return fn ? fn(params) : dict.errors.unknown();
}

interface I18nValue {
  lang: Lang;
  t: Dict;
  setLang: (lang: Lang) => void;
  toggle: () => void;
  formatBytes: (bytes: number) => string;
  formatError: (error: unknown) => string;
}

export const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(() => initial ?? detectLanguage());

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* preference simply not remembered */
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    const t = DICTIONARIES[lang];
    return {
      lang,
      t,
      setLang,
      toggle: () => setLang(lang === 'fr' ? 'en' : 'fr'),
      formatBytes: (b) => formatBytesFor(t, b),
      formatError: (e) => formatErrorFor(t, e),
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>.');
  return ctx;
}
