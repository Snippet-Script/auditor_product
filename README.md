# React + Vite + TypeScript App

Google OAuth login plus two editors:

- Newsletter Builder (block-based, multi-page, templates, assets, rich text)
- Canvas POC (Canva‑like freeform A4 artboard with drag, resize, snapping, templates, PNG export)

## Project Structure (after refactor)

```
src/
	auth/                Auth context + barrel
	components/
		canvas/            CanvasPOC editor + module CSS + index barrel
		newsletter/        NewsletterBuilder + module CSS + index barrel
	routes/              Route-level pages (Home)
	App.tsx              Routing + providers
	main.tsx             Entry
	style.css            Global styles
```

Barrel files allow shorter imports:

```ts
import { CanvasPOC } from './components/canvas'
import { NewsletterBuilder } from './components/newsletter'
```

## Environment

Copy `.env.example` to `.env` and set `VITE_GOOGLE_CLIENT_ID` (Google OAuth Web client ID).

## Run (PowerShell)

```powershell
Copy-Item .env.example .env
notepad .env
npm install
npm run dev
```

## Key Features

Newsletter Builder:
- Block types: heading, paragraph, image, divider
- Multi-page management (add/rename/duplicate/delete)
- Templates (simple / feature / promo)
- Rich text editing (bold, italic, underline, lists, H2/P)
- Theme controls (font family, colors, heading size)
- Asset uploads (local images Base64) and selection
- Simulated AI generation with credit system (localStorage persisted)
- Live preview render

Canvas POC:
- A4 artboard (794x1123) with zoom controls
- Elements: text, rectangle, image
- Drag, resize (corner), snapping to artboard center & other element edges/centers
- Inline floating toolbar for text styling/alignment/font family
- Layer ordering (forward/back), duplication, delete, keyboard shortcuts (Del, Ctrl/Cmd+B/I/U, Ctrl/Cmd+D duplicate)
- Templates (Basic, Columns, Promo) populate canvas quickly
- Local asset uploads and image insertion
- Export current page to PNG (manual canvas render) & JSON of elements
- Multi-page support with rename/add/delete

## Persistence

LocalStorage keys:
- `newsletter-draft-v1:*` (content, assets, theme)
- `newsletter-pages-v1` (newsletter pages)
- `newsletter-credits-v1` (credit balance)
- `canvas-poc-pages` (canvas pages & elements)
- `canvas-poc-assets` (canvas image assets)

## Future Ideas

- Undo/redo history for both editors
- Multi-select + group operations on canvas
- Export newsletter to responsive HTML email template
- Shared asset library service / backend persistence
- Replace deprecated `document.execCommand` with a custom RTE model

## Notes

Legacy root component files were removed; CSS modules now colocated with each component for cohesion.

