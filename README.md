# Mission HQ

Turn homework into missions! An AI-powered learning tool for kids.

## Features

- 📸 **Upload & OCR** — Scan worksheets with Tesseract.js
- 🧠 **AI Module Generator** — Breaks homework into manageable steps
- 💬 **Chat Sidekick** — Socratic AI help per step
- 🀄 **Chinese Language Lab** — Pinyin, Malay & English translation
- 🧰 **My Toolbelt** — Gadgets, assistant config, AI model picker
- 🏆 **Gamification** — Badges, unlockable gadgets, progress tracking

## Tech Stack

- React 18 + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- Firebase (Auth, Firestore, Storage) — Spark plan
- OpenRouter — multi-model AI gateway
- TanStack Query + Zustand

## Local Development

```bash
npm install
npm run dev
```

Create `.env.local`:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_OPENROUTER_KEY=...
```

## Deploy to Cloudflare Pages (Recommended)

### Option A: Cloudflare Dashboard (like beelal coffee)

1. Push code to GitHub repo `mission-hq`
2. Cloudflare Dashboard → Pages → Create Project
3. Connect to Git → select `mission-hq`
4. Build settings:
   - **Framework preset:** None
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
5. Save and Deploy

URL: `mission-hq.pages.dev`

### Option B: Wrangler CLI

```bash
npm run build
npx wrangler login
npx wrangler pages deploy dist --project-name mission-hq
```

## SPA Routing

`_redirects` in `public/` handles client-side routing:
```
/* /index.html 200
```

## Firebase Setup

1. Enable **Authentication** → Anonymous sign-in
2. Enable **Firestore Database** → Start in production mode
3. Enable **Storage** → Default rules
4. Deploy rules: `firebase deploy --only firestore:rules,storage`

## Cost

- Firebase Spark plan: FREE (Auth, Firestore 1GB, Storage 1GB)
- OpenRouter: ~$6.50/month at 500 missions
