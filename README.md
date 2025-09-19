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
 - Preview button jumps to the Preview route; from there, proceed to Contacts

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

## Wireframe flow

- Home → "Open Wireframe Flow" guides through Template → Source → Content → Design → Preview → Contacts → Schedule → Analytics.
- From Template, you can open the Canvas editor directly.
- In Canvas, clicking a text element opens the toolbar and AI rewrite panel.
- Use the "Preview" button in Canvas to navigate to the Preview page; from Preview, click "Next: Contacts" to continue the flow.

## Firebase & Server Persistence (Added)

The app now supports cross-device persistence via Firebase Authentication + Firestore.

### Client Environment Variables (.env)

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...   # (optional, only if Analytics enabled)
VITE_GOOGLE_CLIENT_ID=...
```

### Server Environment Variables

Either provide a base64‐encoded service account JSON:

```
FIREBASE_SERVICE_ACCOUNT_B64=...
```

Or individual credential fields:

```
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\n"
```

### Quick Base64 Generation (PowerShell)
```powershell
$bytes = [IO.File]::ReadAllBytes('serviceAccount.json')
[Convert]::ToBase64String($bytes) | Set-Clipboard
```
Paste into `.env` as `FIREBASE_SERVICE_ACCOUNT_B64=`.

### Request Body Size Limit
Large canvas states (with base64 images) may exceed Express's default 100kb. The server supports:
```
BODY_LIMIT=4mb   # increase if needed (e.g., 6mb)
```
Logged on startup as `[config] JSON body limit set to <value>`.

### Local-Only Fallback Mode
If Firebase Admin credentials are missing, the UI shows "Local only" and will:
- Skip remote saves
- Store usage & state in localStorage only
- Still allow AI rewrites (if `ALLOW_UNAUTH_AI=true`)

Once credentials are added and server restarted, `/api/health` returns `adminReady: true` and persistence re-enables automatically.

### Endpoints

Auth header must include `Authorization: Bearer <firebase_id_token>`

| Method | Path              | Description |
|--------|-------------------|-------------|
| GET    | /api/user/state   | Fetch stored per-user application state |
| POST   | /api/user/state   | Upsert `{ state }` payload |
| POST   | /api/rewrite      | AI rewrite + token usage accounting |

### Firestore Collections

`userStates/{uid}`:
```
{ state: <any>, updatedAt: <epoch_ms> }
```

`usage/{uid}` (aggregate):
```
{
	totalInputTokens: number,
	totalOutputTokens: number,
	totalCost: number,
	lastAt: epoch_ms,
	model: string
}
```

### Token & Cost Estimation

Heuristic (~4 chars = 1 token) implemented in `server/tokenUtil.js` with adjustable pricing constants:
```
PRICE_INPUT_PER_1K
PRICE_OUTPUT_PER_1K
```
Response from `/api/rewrite` includes:
```
{
	text: string,
	usage: { inputTokens, outputTokens, inputCost, outputCost, totalCost }
}
```

Adjust pricing to match your chosen Gemini model costs.

### Admin Usage Access

Set a comma-separated list of admin emails in the server environment:
```
ADMIN_EMAILS=admin1@example.com,admin2@example.com
```
Admins can call `/api/usage/all` and view the Admin Usage page.

### Canvas Autosave & Admin States (New)

When authenticated, the Canvas editor automatically saves `{ pages, assets }` (debounced ~600ms) to `/api/user/state`.

Additional admin endpoint:

| Method | Path               | Description |
| ------ | ------------------ | ----------- |
| GET    | /api/admin/states  | List metadata (pages count, assets count, updatedAt) for all user states |

Admin UI pages (visible only to configured admin emails):

- `Admin Usage` – aggregated token & cost totals per user
- `Admin States` – per-user state summary (counts & last update)

The header Usage Badge refetches after each AI rewrite via a dispatched `usage-updated` browser event.

The Canvas shows a small status chip (Saving… / Saved / Save error / Synced) indicating remote persistence progress.

### Firebase Admin Setup

1. In Firebase Console: Settings > Service Accounts > Generate new private key.
2. Either:
	 - Base64 encode the JSON: `base64 serviceAccount.json` (PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes('serviceAccount.json'))`)
	 - Put value in `FIREBASE_SERVICE_ACCOUNT_B64`.
	 - Or copy fields into individual env vars as shown above.
3. NEVER commit the service account JSON or the raw private key.

Security Notes:
- Do not expose your Google OAuth client_secret in frontend code or README. Treat it as a secret.
- Restrict Firestore rules to authenticated users: basic example:
```
rules_version = '2';
service cloud.firestore {
	match /databases/{db}/documents {
		match /userStates/{userId} {
			allow read, write: if request.auth != null && request.auth.uid == userId;
		}
		match /usage/{userId} {
			allow read: if request.auth != null && request.auth.uid == userId;
			allow write: if request.auth != null && request.auth.uid == userId;
		}
	}
}
```
Update rules in Firebase Console > Firestore > Rules.

### Deploying Rules via Firebase CLI

If you prefer CLI deployment instead of editing in the console:

1. Install tools (one-time):
	```powershell
	npm install -g firebase-tools
	```
2. Login:
	```powershell
	firebase login
	```
3. Initialize (accept Firestore, use existing project, when asked about rules file you can point to `firestore.rules`):
	```powershell
	firebase init firestore
	```
	(If already initialized, skip this.)
4. Make sure `firestore.rules` matches the one in this repo.
5. Deploy:
	```powershell
	firebase deploy --only firestore:rules
	```

Verify deployment:
```powershell
firebase firestore:rules:test  # (optional advanced validation)
```

After deployment, hitting secured endpoints without a valid Firebase ID token should return 401/403.

### Development Bypass

If you want to exercise the AI rewrite endpoint before configuring Firebase Admin credentials, you can set:
```
ALLOW_UNAUTH_AI=true
```
in your `.env` (server side). This allows `/api/rewrite` to function without authentication and skips Firestore usage persistence. Do NOT enable this in production.

