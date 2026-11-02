# PDF Tools

A lightweight web app to work with PDF files **entirely in the browser**: no backend, no upload, no sign-up. Built to be hosted for free on GitHub Pages.

> Your files stay on your device.

The interface is available in **English and French**, picked automatically from the browser language and switchable from the header.

*🇫🇷 Version française : l'application est disponible en français et en anglais. Tous les traitements sont faits dans votre navigateur, aucun fichier n'est envoyé. Instructions d'installation ci-dessous.*

## Features

| Tool | What it does |
|---|---|
| Merge PDF | Combines several PDFs; order set by drag and drop |
| Split PDF | By ranges (`1-3, 4-6, 7-`), every N pages, or one page per file. ZIP export |
| Extract pages | Select by click, Shift+click or typed list (`2, 4-6`) |
| Delete pages | Guard rail: at least one page is kept |
| Reorder pages | Drag and drop, rotate, duplicate, delete, **append pages from other PDFs** |
| Rotate pages | All or some pages, on top of the existing rotation |
| Sign PDF | Drawn signature (Signature Pad) or imported PNG/JPG (white background made transparent), movable and resizable, on one or several pages |
| Images to PDF | JPG/PNG, one image per page, A4 / Letter / image size, auto orientation, margins, EXIF orientation fix for phone photos |
| Compress PDF | *Lossless* (restructuring) or *lossy* in 3 levels (JPEG rasterization: text is no longer selectable, and the UI says so) |
| Add watermark | Centered or tiled text, angle, size, opacity, color, live preview |

Not included yet (no placeholder buttons in the UI): annotations, highlighting, freehand drawing, free text, PNG/JPG export, image extraction, page numbers, headers/footers, password protection. See the roadmap.

## Stack

React 19, TypeScript, Vite 7, Tailwind CSS 4, React Router (`HashRouter`), pdf-lib, PDF.js (`pdfjs-dist`), dnd-kit, signature_pad, fflate (ZIP), lucide-react. shadcn/ui turned out to be unnecessary: the few UI primitives live in `src/components/ui.tsx`.

Internationalization uses no library: typed dictionaries in `src/i18n/` (`en.ts` defines the shape, `fr.ts` must match it, enforced by TypeScript and by a unit test).

## Privacy and performance

- **No external request**: PDF.js, its standard fonts, CMaps and WASM decoders are served by the app itself (`scripts/copy-pdfjs-assets.mjs` copies them to `public/pdfjs/` before `dev` and `build`). The Manrope font is bundled.
- **Web Worker**: every pdf-lib operation runs in `src/services/pdf.worker.ts`. Bytes are *transferred* (not copied), and the worker is terminated after 30 s of inactivity or when leaving a tool.
- **Memory**: PDF.js documents are destroyed, `blob:` URLs revoked, state cleared by *Start over*. Nothing is written to disk; `localStorage` only holds the theme and language preferences.
- **On-demand loading**: each tool is a separate chunk; PDF.js (~400 KB) is never loaded on the home page; pdf-lib only exists in the worker.
- **Limits**: 150 MB per PDF, 40 MB per image, 400 MB and 50 files per operation (`src/utils/files.ts`). Thumbnails render lazily (IntersectionObserver, at most 3 renders at once).

## Run locally

Requirements: Node.js 20 or later (22 recommended).

```bash
git clone https://github.com/<your-username>/pdf-tools.git
cd pdf-tools
npm install
npm run dev          # http://localhost:5173
```

Other commands:

```bash
npm test             # unit tests (PDF operations, page ranges, i18n)
npm run typecheck    # TypeScript check
npm run build        # production build in dist/
npm run preview      # serve dist/ locally
```

To test the build exactly as GitHub Pages will serve it:

```bash
VITE_BASE_PATH=/pdf-tools/ npm run build
VITE_BASE_PATH=/pdf-tools/ npm run preview   # http://localhost:4173/pdf-tools/
```

## Deploy to GitHub Pages

### 1. Create the repository

```bash
cd pdf-tools
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

(or `gh repo create <repo-name> --public --source=. --push` with the GitHub CLI)

### 2. Enable GitHub Pages

In the repository: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

### 3. Automatic deployment

Every push to `main` runs `.github/workflows/deploy.yml`:

1. `npm ci`
2. `npm test`
3. `npm run build` with `VITE_BASE_PATH=/<repo-name>/` (derived automatically from the repository name)
4. publishes `dist/` to GitHub Pages.

The app is then live at `https://<your-username>.github.io/<repo-name>/`. Follow the run in the **Actions** tab; the workflow can also be started manually (*Run workflow*).

### Base URL

No repository name is hard-coded. `vite.config.ts` picks the base in this order:

1. `VITE_BASE_PATH` (environment variable or `.env.local`);
2. `GITHUB_REPOSITORY` (set by GitHub Actions) → `/<repo>/`, or `/` for a `<user>.github.io` repository;
3. `/` by default (local development).

For a **custom domain**, create a repository variable `BASE_PATH` = `/` (Settings → Secrets and variables → Actions → Variables) and add your `public/CNAME` file.

### Why HashRouter

GitHub Pages cannot serve `index.html` for unknown paths. With the hash (`/pdf-tools/#/fusionner`), the server only ever sees `/pdf-tools/`: refreshing a tool page and deep links work without a 404.

## Project structure

```
.github/workflows/deploy.yml   CI: tests, build, Pages deployment
public/                        favicon (+ generated pdfjs/, git-ignored)
scripts/copy-pdfjs-assets.mjs  copies the PDF.js assets
src/
  assets/       logo source
  components/   shared UI: Dropzone, ToolShell, ResultPanel, PageThumbnail,
                PagePreview, PageSelectGrid, Sortable, SignatureDialog…
  hooks/        usePdfDocuments, useSinglePdf, useOperation, useTheme…
  i18n/         en.ts, fr.ts, provider (detection, formatting, error messages)
  pages/        HomePage, ToolPage (lazy loading), NotFoundPage
  services/     pdfOperations.ts (pure pdf-lib), pdf.worker.ts, workerClient.ts,
                pdfjs.ts, compress.ts, zip.ts, fileHandoff.ts
  tools/        one component per tool + registry.ts (metadata, search)
  types/
  utils/        files, page ranges, images (EXIF), errors (AppError codes), cn
tests/          Vitest tests
```

### Errors and translations

Operations never throw user-facing text: they throw an `AppError` with a code and parameters (`new AppError('pageMissing', { page: 6, total: 2 })`). The UI turns it into a message in the current language through `formatError`. Adding a message means adding the code to `src/utils/errors.ts` and to both dictionaries.

### Adding a tool

1. Write the pure operation in `src/services/pdfOperations.ts` (+ a test in `tests/`).
2. Expose it in `src/services/pdf.worker.ts`.
3. Create `src/tools/MyTool.tsx` (build on `ToolShell`, `useSinglePdf`, `useOperation`, `ResultPanel`).
4. Register it in `src/tools/registry.ts` and add its texts under `tools` in `en.ts` and `fr.ts`: it shows up on the home page, in search and at `#/<id>`.

## Known limitations

- Encrypted PDFs (password or permissions) are rejected with an explicit message: pdf-lib cannot decrypt them.
- Watermark: standard Helvetica font, so Latin characters only (French accents included). Emoji, Chinese, Arabic… are rejected with a message.
- Lossless compression does not recompress images: the gain is small on an already optimized PDF (the UI says so).
- Existing form fields and digital signatures may be lost when a document is restructured (merge, extract…).

## Roadmap

- Annotations, highlighting, freehand drawing, free text
- Export pages to PNG/JPG, extract images
- Page numbers, headers and footers
- Password protection (needs an encryption library, e.g. a WASM build of qpdf)

## License

MIT
