import { Link, Outlet } from 'react-router-dom';
import { Moon, ShieldCheck, Sun } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../i18n';
import { Logo } from './Logo';

export function Layout() {
  const { theme, toggle } = useTheme();
  const { t, toggle: toggleLang } = useI18n();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5" aria-label={t.app.homeLabel}>
            <Logo className="size-8" />
            <span className="text-lg font-extrabold tracking-tight">PDF Tools</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <span className="mr-2 hidden items-center gap-1.5 text-sm font-semibold text-ok sm:inline-flex">
              <ShieldCheck className="size-4" aria-hidden /> {t.app.privacy}
            </span>
            <button
              type="button"
              onClick={toggleLang}
              className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-2 text-sm font-bold text-muted hover:bg-mist hover:text-ink"
              aria-label={t.app.switchLanguage}
              title={t.app.switchLanguage}
              data-testid="lang-toggle"
            >
              {t.app.otherLanguageCode}
            </button>
            <button
              type="button"
              onClick={toggle}
              className="inline-flex size-9 items-center justify-center rounded-xl text-muted hover:bg-mist hover:text-ink"
              aria-label={theme === 'dark' ? t.app.toLight : t.app.toDark}
              title={theme === 'dark' ? t.app.lightShort : t.app.darkShort}
            >
              {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-line bg-paper">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>{t.app.footerPrivacy}</p>
          <p>{t.app.footerAbout}</p>
        </div>
      </footer>
    </div>
  );
}
