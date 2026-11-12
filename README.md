# SuperNova frontend

The SuperNova pages (Workspace and AI usage), with no backend of their own. Every `/api/...` request of the page is forwarded to the SuperNova backend at `BACKEND_URL` by a Next.js rewrite in `next.config.mjs`, so the browser talks to one origin (no CORS) and downloads and client logos work as before. Long AI steps are allowed up to 10 minutes through the forwarding (`experimental.proxyTimeout`).

## Run
```bash
npm ci
npm run dev        # http://localhost:3000, forwards /api/* to http://localhost:3001
```
Set `BACKEND_URL` in `.env.local` (see `.env.example`) when the backend runs elsewhere. `npm run build && npm start` for production.

## Files
- `app/`: the pages and components (`page.tsx`, `fsd-step.tsx`, `form.tsx`, `insights.tsx`, `nav.tsx`, `usage-panels.tsx`, `usage/page.tsx`, `shared.ts`, `layout.tsx`, `globals.css`).
- `lib/wricef.ts`, `lib/validation.ts`, `lib/fsd.ts`: copies of the backend files of the same name (categories, the validation rules shown on the page, FS parsing and comparison). Keep them identical to the backend's; the backend enforces every rule itself.

## Settings
| Variable | Purpose |
|---|---|
| `BACKEND_URL` | Where the backend runs (default `http://localhost:3001`). Read when the server starts and at build time. |
| `NEXT_PUBLIC_SHOW_TECHNICAL_STEPS` | Optional. `1` shows the TS and technical steps (also `?technical=1` in the address). |
