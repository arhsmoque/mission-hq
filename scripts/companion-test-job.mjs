#!/usr/bin/env node
/**
 * Diagnostic test for the Local Gemini Companion.
 *
 * Queues a small test job under mission_hq/aiJobs/{uid}/{jobId},
 * waits for the companion to process it, then prints the result.
 *
 * Usage:
 *   npm run companion:test-job
 *
 * Requires the companion to be running (admin or client mode).
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase, ref, push, set, onValue } from 'firebase/database';
import process from 'node:process';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY ?? process.env.FIREBASE_API_KEY ?? 'AIzaSyB8j-jHo2N341ieW4AVCdPL3ipn4Ss8sYQ',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN ?? process.env.FIREBASE_AUTH_DOMAIN ?? 'ash-2026-photobook.firebaseapp.com',
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL ?? process.env.FIREBASE_DATABASE_URL ?? 'https://ash-2026-photobook-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID ?? 'ash-2026-photobook',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET ?? process.env.FIREBASE_STORAGE_BUCKET ?? 'ash-2026-photobook.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? process.env.FIREBASE_MESSAGING_SENDER_ID ?? '328228907150',
  appId: process.env.VITE_FIREBASE_APP_ID ?? process.env.FIREBASE_APP_ID ?? '1:328228907150:web:fb4d2780b40bb8403ec1df',
};

const TIMEOUT_MS = Number(process.env.MHQ_TEST_TIMEOUT ?? 120_000);
const JOBS_ROOT = 'mission_hq/aiJobs';

const app = initializeApp(firebaseConfig, 'mission-hq-test-job');
const auth = getAuth(app);
const db = getDatabase(app);

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function main() {
  log('Signing into Firebase anonymously...');
  const cred = await signInAnonymously(auth);
  const uid = cred.user.uid;
  log(`Authenticated as ${uid}`);

  const testInput = {
    kind: 'general',
    messages: [
      { role: 'user', content: 'Say exactly: "Mission HQ companion is online."' },
    ],
    model: 'default',
    temperature: 0.1,
    metadata: { test: true, source: 'companion-test-job' },
  };

  const jobRef = push(ref(db, `${JOBS_ROOT}/${uid}`));
  const jobId = jobRef.key;
  const now = Date.now();

  log(`Queuing test job ${jobId}...`);
  await set(jobRef, {
    status: 'pending',
    input: testInput,
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  });

  log(`Waiting up to ${Math.round(TIMEOUT_MS / 1000)}s for companion to process...`);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Test job timed out after ${Math.round(TIMEOUT_MS / 1000)}s. Is the companion running?`));
    }, TIMEOUT_MS);

    const unsubscribe = onValue(jobRef, (snap) => {
      if (!snap.exists()) return;
      const job = snap.val();

      if (job.status === 'done') {
        clearTimeout(timeout);
        unsubscribe();
        resolve(job.result);
      }

      if (job.status === 'error') {
        clearTimeout(timeout);
        unsubscribe();
        reject(new Error(job.error ?? 'Companion reported error without message'));
      }
    });
  });
}

main()
  .then((result) => {
    log('Test job completed successfully');
    console.log('\n--- Result ---');
    console.log(result.text ?? '(no text)');
    if (result.stderr) {
      console.log('\n--- Stderr ---');
      console.log(result.stderr);
    }
    process.exit(0);
  })
  .catch((err) => {
    log(`Test job failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
