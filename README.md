# Mission HQ

Turn homework into missions! An AI-powered learning tool for kids.

## Files

| File | Purpose |
|---|---|
| `src/config.ts` | **Edit this first** — Firebase and app settings |
| `src/lib/firebase.ts` | Firebase init (reads from `config.ts`) |
| `src/lib/ai.ts` | Backward-compatible AI shim that delegates to `@/adapters` |
| `src/worker.ts` | Cloudflare Worker proxy for Gemini API key mode |
| `scripts/local-gemini-companion.mjs` | Desktop companion that watches Firebase jobs and runs Gemini CLI locally |
| `scripts/gemini-prompts/*.md` | Prompt templates for local companion job kinds |
| `docs/local-gemini-companion.md` | Setup guide for Local CLI mode |
| `wrangler.jsonc` | Cloudflare Pages deployment config |
| `public/_redirects` | SPA catch-all for client-side routing |

## Quick Start

### 1. Local Dev

```bash
npm install
npm run dev
```

No `.env` file needed — config is in `src/config.ts`.

### 2. Deploy to Cloudflare Pages

**Option A — Cloudflare Dashboard (recommended):**
1. Push all files to GitHub (`arhsmoque/mission-hq`)
2. Cloudflare Dashboard → Pages → Create Project → Connect Git → select `mission-hq`
3. Build settings:
   - **Framework preset:** None
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Save and Deploy — every push to `master` auto-deploys in ~1 minute

**Option B — Wrangler CLI:**
```bash
npm run build
npx wrangler pages deploy dist --project-name mission-hq
```

### 3. Firebase Setup (one time)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → `ash-2026-photobook`
2. Enable **Authentication** → Anonymous sign-in
3. Enable **Realtime Database** → Start in test mode
4. Enable **Storage** → Default rules
5. Deploy rules: `firebase deploy --only database,storage`

### 4. Local Gemini CLI Companion

Mission HQ can queue AI jobs to Firebase and let your home desktop run them through Gemini CLI:

```bash
npm install -g @google/gemini-cli
gemini
npm run companion:gemini
```

Then use:

```text
Toolbelt → Admin → Chat → Local CLI
```

Full setup notes: `docs/local-gemini-companion.md`.

## Architecture

- **Vite + React + TypeScript** — client-side SPA
- **Firebase Realtime Database** — stores missions, chat, progress, and local companion AI jobs
- **Firebase Anonymous Auth** — no login required
- **Firebase Storage** — worksheet images
- **Cloudflare Pages** — serves the built app globally
- **Gemini API Worker mode** — Cloudflare Worker keeps the API key server-side
- **Local Gemini CLI companion mode** — desktop worker uses local Gemini CLI Google sign-in

## Cost

- Firebase Spark plan: FREE (Auth, RTDB, Storage within limits)
- Cloudflare Pages: FREE
- Gemini API Worker mode: governed by Gemini API quota/billing
- Local Gemini CLI companion mode: governed by the signed-in Gemini CLI account/session limits

## Storage

All data is stored in Firebase Realtime Database under the authenticated user's UID. Anonymous auth is used by default — parents can promote their anonymous session to a permanent email account via the Admin panel (Settings → Save Account). This preserves all existing data under the same UID.
