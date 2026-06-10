#!/usr/bin/env node
/**
 * Seed script — adds KAFA teaching resources to Firebase RTDB.
 *
 * Usage:
 *   node scripts/seed-resources.mjs
 *
 * Signs in anonymously (same as the web app). Skips entries whose URL
 * already exists in the database so it's safe to run multiple times.
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase, ref, push, set, get } from 'firebase/database';

const firebaseConfig = {
  apiKey:            'AIzaSyB8j-jHo2N341ieW4AVCdPL3ipn4Ss8sYQ',
  authDomain:        'ash-2026-photobook.firebaseapp.com',
  databaseURL:       'https://ash-2026-photobook-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId:         'ash-2026-photobook',
  storageBucket:     'ash-2026-photobook.firebasestorage.app',
  messagingSenderId: '328228907150',
  appId:             '1:328228907150:web:fb4d2780b40bb8403ec1df',
};

const RESOURCES_ROOT = 'mission_hq/resources';

const SEED_RESOURCES = [
  {
    url:         'https://anyflip.com/xvurt/nkll/basic',
    label:       'KAFA Adab & Akhlak Islam Tahun 3',
    sourceType:  'anyflip',
    schoolType:  'kafa',
    subject:     'islamic',
    yearLevel:   3,
    description: 'Buku Teks KAFA Adab & Akhlak Islam Tahun 3 — Islamic etiquette and morality.',
    status:      'pending',
    addedBy:     'seed',
    addedAt:     Date.now(),
  },
  {
    url:         'https://anyflip.com/xvurt/plch/basic',
    label:       'KAFA Aqidah Tahun 3',
    sourceType:  'anyflip',
    schoolType:  'kafa',
    subject:     'islamic',
    yearLevel:   3,
    description: 'Buku Teks KAFA Aqidah Tahun 3 — Islamic theology and creed.',
    status:      'pending',
    addedBy:     'seed',
    addedAt:     Date.now(),
  },
  {
    url:         'https://anyflip.com/rprdm/vkkr/basic',
    label:       'KAFA Jawi & Khat Tahun 3',
    sourceType:  'anyflip',
    schoolType:  'kafa',
    subject:     'kafa',
    yearLevel:   3,
    description: 'Buku Teks KAFA Tahun 3 — Jawi script and calligraphy (Khat).',
    status:      'pending',
    addedBy:     'seed',
    addedAt:     Date.now(),
  },
];

const app = initializeApp(firebaseConfig, 'seed');
const auth = getAuth(app);
const db = getDatabase(app);

console.log('Signing in anonymously…');
await signInAnonymously(auth);
console.log('Signed in.\n');

const rootRef = ref(db, RESOURCES_ROOT);
const snap = await get(rootRef);
const existing = snap.exists() ? Object.values(snap.val()) : [];
const existingUrls = new Set(existing.map((r) => r.url));

let added = 0;
let skipped = 0;

for (const resource of SEED_RESOURCES) {
  if (existingUrls.has(resource.url)) {
    console.log(`  skip  ${resource.label} (already exists)`);
    skipped++;
    continue;
  }
  const newRef = push(rootRef);
  await set(newRef, { ...resource, resourceId: newRef.key });
  console.log(`  added ${resource.label}  →  ${newRef.key}`);
  added++;
}

console.log(`\nDone. Added: ${added}  Skipped: ${skipped}`);
process.exit(0);
