# Mission HQ

Turn homework into missions! An AI-powered learning tool for kids.

## Files

| File | Purpose |
|---|---|
| `src/config.ts` | **Edit this first** — all Firebase, OpenRouter, and app settings |
| `src/lib/firebase.ts` | Firebase init (reads from `config.ts`) |
| `src/lib/ai.ts` | OpenRouter client (reads from `config.ts`) |
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

## Architecture

- **Vite + React + TypeScript** — client-side SPA
- **Firebase Realtime Database** — stores missions, chat, progress (same project as beelal coffee)
- **Firebase Anonymous Auth** — no login required
- **Firebase Storage** — worksheet images
- **Cloudflare Pages** — serves the built app globally
- **OpenRouter** — multi-model AI gateway (DeepSeek, Claude, Gemini, etc.)

## Cost

- Firebase Spark plan: FREE (Auth, RTDB, Storage within limits)
- Cloudflare Pages: FREE
- OpenRouter: ~$6.50/month at 500 missions

## Local Mode

A localStorage-only variant exists in `src/lib/localDb.ts`. It replaces Firebase with browser storage — useful for offline testing or family devices without internet access to Firebase.

| Feature | Cloud (default) | Local mode |
|---|---|---|
| Auth | Firebase Anonymous | Auto-generated local uid |
| Database | Firebase Realtime DB | `localStorage` |
| Deploy | Cloudflare Pages | Any static host |
| AI | OpenRouter (client-side) | OpenRouter (client-side) |

To use local mode: swap `useMission.ts` and `useChat.ts` imports from `firebase/database` → `@/lib/localDb`. A `StorageAdapter` interface to make this switchable at runtime is a future ADR.
