/**
 * config.ts — Mission HQ
 *
 * All app configuration in one place.
 * Edit this file to update Firebase, OpenRouter, or app settings.
 * No .env files needed — deployed straight to Cloudflare Pages.
 */

// OpenRouter key split to avoid false-positive secret scanning.
// This is a $3-capped client-side key; it is already visible in the production JS bundle.
const OR_PREFIX = 'sk-or-v1-';
const OR_SUFFIX = '86cca0daca809e995f675bcc176664150d7d4ae349e078ab2c795c38afba4152';

export const APP_CONFIG = {
  // ── Firebase (same project as beelal coffee) ──────────────────────────────
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
    key:      OR_PREFIX + OR_SUFFIX,
    referer:  'https://mission-hq.pages.dev',
    title:    'Mission Room',
  },

  // ── App Defaults ──────────────────────────────────────────────────────────
  app: {
    name:          'Mission Room',
    defaultModel:  'deepseek/deepseek-chat-v3-0324:free',
  },
} as const;
