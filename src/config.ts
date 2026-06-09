/**
 * config.ts — Mission Room
 *
 * All app configuration in one place.
 * No .env files needed — config is baked into the Cloudflare Pages build.
 *
 * AI models and default model: see src/lib/models.ts
 * Adapter wiring (swap providers): see src/adapters/index.ts
 * AI credentials: stored as Cloudflare Worker secrets (never in source)
 */

export const APP_CONFIG = {
  // ── Firebase ──────────────────────────────────────────────────────────────
  firebase: {
    apiKey:            'AIzaSyB8j-jHo2N341ieW4AVCdPL3ipn4Ss8sYQ',
    authDomain:        'ash-2026-photobook.firebaseapp.com',
    databaseURL:       'https://ash-2026-photobook-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId:         'ash-2026-photobook',
    storageBucket:     'ash-2026-photobook.firebasestorage.app',
    messagingSenderId: '328228907150',
    appId:             '1:328228907150:web:fb4d2780b40bb8403ec1df',
  },

  // ── App ───────────────────────────────────────────────────────────────────
  app: {
    name: 'Mission Room',
  },

  // ── Admin ─────────────────────────────────────────────────────────────────
  admin: {
    pin: '240514',
  },
} as const;
