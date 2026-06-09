#!/usr/bin/env node
/**
 * Local Gemini Companion for Mission HQ.
 *
 * Watches Firebase RTDB jobs under mission_hq/aiJobs/{uid}/{jobId}, runs the
 * official Gemini CLI locally, then writes the result back to the same job.
 *
 * Setup:
 *   npm install
 *   npm install -g @google/gemini-cli
 *   gemini   # choose Sign in with Google once
 *   npm run companion:gemini
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  getDatabase,
  ref,
  get,
  onChildAdded,
  runTransaction,
  update,
} from 'firebase/database';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const COMPANION_ID = process.env.MHQ_COMPANION_ID ?? `desktop-${process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? 'local'}`;
const JOBS_ROOT = process.env.MHQ_AI_JOBS_ROOT ?? 'mission_hq/aiJobs';
const MAX_PROMPT_CHARS = Number(process.env.MHQ_MAX_PROMPT_CHARS ?? 120_000);
const GEMINI_BIN = process.env.GEMINI_BIN ?? 'gemini';
const DEFAULT_OUTPUT_FORMAT = process.env.GEMINI_OUTPUT_FORMAT ?? 'json';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY ?? process.env.FIREBASE_API_KEY ?? 'AIzaSyB8j-jHo2N341ieW4AVCdPL3ipn4Ss8sYQ',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN ?? process.env.FIREBASE_AUTH_DOMAIN ?? 'ash-2026-photobook.firebaseapp.com',
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL ?? process.env.FIREBASE_DATABASE_URL ?? 'https://ash-2026-photobook-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID ?? 'ash-2026-photobook',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET ?? process.env.FIREBASE_STORAGE_BUCKET ?? 'ash-2026-photobook.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? process.env.FIREBASE_MESSAGING_SENDER_ID ?? '328228907150',
  appId: process.env.VITE_FIREBASE_APP_ID ?? process.env.FIREBASE_APP_ID ?? '1:328228907150:web:fb4d2780b40bb8403ec1df',
};

const app = initializeApp(firebaseConfig, 'mission-hq-local-companion');
const auth = getAuth(app);
const db = getDatabase(app);

const templateCache = new Map();

function log(message, extra = '') {
  const stamp = new Date().toISOString();
  console.log(`[${stamp}] ${message}${extra ? ` ${extra}` : ''}`);
}

function roleLabel(role) {
  if (role === 'system') return 'SYSTEM';
  if (role === 'assistant') return 'ASSISTANT';
  return 'USER';
}

async function loadTemplate(kind) {
  const safeKind = String(kind || 'general').replace(/[^a-z0-9_-]/gi, '');
  if (templateCache.has(safeKind)) return templateCache.get(safeKind);

  const file = path.resolve(process.cwd(), 'scripts', 'gemini-prompts', `${safeKind}.md`);
  try {
    const text = await readFile(file, 'utf8');
    templateCache.set(safeKind, text);
    return text;
  } catch {
    const fallback = await readFile(path.resolve(process.cwd(), 'scripts', 'gemini-prompts', 'general.md'), 'utf8');
    templateCache.set(safeKind, fallback);
    return fallback;
  }
}

async function buildPrompt(input) {
  const template = await loadTemplate(input.kind);
  const messages = Array.isArray(input.messages) ? input.messages : [];
  const conversation = messages
    .map((m) => `### ${roleLabel(m.role)}\n${m.content ?? ''}`)
    .join('\n\n');

  const prompt = template
    .replaceAll('{{kind}}', input.kind ?? 'general')
    .replaceAll('{{model}}', input.model ?? 'default')
    .replaceAll('{{temperature}}', String(input.temperature ?? 0.7))
    .replaceAll('{{metadata}}', JSON.stringify(input.metadata ?? {}, null, 2))
    .replaceAll('{{conversation}}', conversation);

  if (prompt.length > MAX_PROMPT_CHARS) {
    throw new Error(`Prompt is ${prompt.length} chars; limit is ${MAX_PROMPT_CHARS}. Raise MHQ_MAX_PROMPT_CHARS if intentional.`);
  }

  return prompt;
}

function runGemini(prompt) {
  return new Promise((resolve, reject) => {
    const args = ['-p', prompt, '--output-format', DEFAULT_OUTPUT_FORMAT];
    const child = spawn(GEMINI_BIN, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `${GEMINI_BIN} exited with code ${code}`));
        return;
      }
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

function tryJson(text) {
  try { return JSON.parse(text); } catch { return undefined; }
}

function extractTextFromCliOutput(rawOutput) {
  const parsed = tryJson(rawOutput);
  if (!parsed || typeof parsed !== 'object') return { text: rawOutput, json: undefined };

  const direct = parsed.text ?? parsed.response ?? parsed.result ?? parsed.content ?? parsed.output;
  if (typeof direct === 'string') {
    const nested = tryJson(direct);
    return { text: direct, json: nested ?? parsed };
  }

  return { text: JSON.stringify(parsed, null, 2), json: parsed };
}

async function claimJob(uid, jobId, job) {
  const jobRef = ref(db, `${JOBS_ROOT}/${uid}/${jobId}`);
  const tx = await runTransaction(jobRef, (current) => {
    if (!current || current.status !== 'pending') return;
    return {
      ...current,
      status: 'running',
      companionId: COMPANION_ID,
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
  });

  return tx.committed ? { ...job, ...tx.snapshot.val() } : null;
}

async function processJob(uid, jobId, job) {
  const claimed = await claimJob(uid, jobId, job);
  if (!claimed) return;

  log(`Running job ${uid}/${jobId}`, `kind=${claimed.input?.kind ?? 'unknown'}`);
  const jobRef = ref(db, `${JOBS_ROOT}/${uid}/${jobId}`);

  try {
    const prompt = await buildPrompt(claimed.input ?? {});
    const { stdout, stderr } = await runGemini(prompt);
    const { text, json } = extractTextFromCliOutput(stdout);

    await update(jobRef, {
      status: 'done',
      result: {
        text,
        json: json ?? null,
        rawOutput: stdout,
        stderr: stderr || null,
      },
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });

    log(`Completed job ${uid}/${jobId}`);
  } catch (err) {
    await update(jobRef, {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });
    log(`Failed job ${uid}/${jobId}`, err instanceof Error ? err.message : String(err));
  }
}

async function scanExistingJobs() {
  const rootSnap = await get(ref(db, JOBS_ROOT));
  if (!rootSnap.exists()) return;

  const allUsers = rootSnap.val();
  for (const [uid, jobs] of Object.entries(allUsers)) {
    if (!jobs || typeof jobs !== 'object') continue;
    for (const [jobId, job] of Object.entries(jobs)) {
      if (job?.status === 'pending') {
        void processJob(uid, jobId, job);
      }
    }
  }
}

function watchJobs() {
  const rootRef = ref(db, JOBS_ROOT);

  onChildAdded(rootRef, (userSnap) => {
    const uid = userSnap.key;
    if (!uid) return;

    onChildAdded(ref(db, `${JOBS_ROOT}/${uid}`), (jobSnap) => {
      const jobId = jobSnap.key;
      const job = jobSnap.val();
      if (!jobId || job?.status !== 'pending') return;
      void processJob(uid, jobId, job);
    });
  });
}

async function main() {
  log('Starting Mission HQ local Gemini companion', `id=${COMPANION_ID}`);
  log('Gemini CLI binary', GEMINI_BIN);
  log('Firebase RTDB root', JOBS_ROOT);

  await signInAnonymously(auth);
  log('Signed into Firebase anonymously', auth.currentUser?.uid ?? 'unknown');

  await scanExistingJobs();
  watchJobs();
  log('Watching for pending jobs...');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
