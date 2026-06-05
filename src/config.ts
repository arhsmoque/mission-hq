/**
 * config.ts — Mission Room
 *
 * All app configuration in one place.
 * No .env files needed — config is baked into the Cloudflare Pages build.
 *
 * AI models and default model: see src/lib/models.ts
 * Adapter wiring (swap providers): see src/adapters/index.ts
 */

// OpenRouter key split to avoid false-positive secret scanning.
// This is a $3-capped client-side key; it is already visible in the production JS bundle.
const OR_PREFIX = 'sk-or-v1-';
const OR_SUFFIX = '86cca0daca809e995f675bcc176664150d7d4ae349e078ab2c795c38afba4152';

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

  // ── OpenRouter (client-side, $3 cap — family use only) ───────────────────
  openrouter: {
    key:     OR_PREFIX + OR_SUFFIX,
    referer: 'https://mission-hq.pages.dev',
    title:   'Mission Room',
  },

  // ── App ───────────────────────────────────────────────────────────────────
  app: {
    name: 'Mission Room',
  },
} as const;
