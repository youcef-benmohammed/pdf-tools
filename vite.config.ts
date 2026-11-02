/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Base URL of the app.
 *
 * - Locally (`npm run dev`): "/".
 * - On GitHub Pages: "/<repository-name>/".
 *
 * Priority:
 *   1. VITE_BASE_PATH (e.g. "/pdf-tools/", or "/" for a custom domain)
 *   2. GITHUB_REPOSITORY (set automatically by GitHub Actions: "owner/repo")
 *   3. "/"
 *
 * No repository name is hard-coded.
 */
function resolveBase(env: Record<string, string>): string {
  const explicit = env.VITE_BASE_PATH ?? process.env.VITE_BASE_PATH;
  if (explicit) return normalize(explicit);

  const repository = process.env.GITHUB_REPOSITORY; // "owner/repo"
  if (repository) {
    const repo = repository.split('/')[1] ?? '';
    // A "<user>.github.io" repository is served at the domain root.
    if (repo.endsWith('.github.io')) return '/';
    return normalize(repo);
  }
  return '/';
}

function normalize(path: string): string {
  const trimmed = path.trim().replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: resolveBase(env),
    plugins: [react(), tailwindcss()],
    worker: { format: 'es' },
    build: {
      target: 'es2022',
      sourcemap: false,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            dnd: ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          },
        },
      },
    },
    optimizeDeps: { exclude: ['pdfjs-dist'] },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  };
});
