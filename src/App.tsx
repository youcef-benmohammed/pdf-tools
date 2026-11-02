import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { ToolPage } from './pages/ToolPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { I18nProvider } from './i18n';

/**
 * HashRouter: URLs look like /<repo>/#/fusionner.
 * GitHub Pages only serves index.html at the root; the hash guarantees that
 * refreshing a tool page works without a 404.
 */
export default function App() {
  return (
    <I18nProvider>
      <HashRouter>
        <ErrorBoundary>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path=":toolId" element={<ToolPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </ErrorBoundary>
      </HashRouter>
    </I18nProvider>
  );
}
