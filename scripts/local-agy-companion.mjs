#!/usr/bin/env node
/**
 * Local Antigravity (agy) Companion for Mission HQ.
 *
 * Watches Firebase RTDB jobs under mission_hq/aiJobs/{uid}/{jobId}, runs the
 * Antigravity CLI (agy) locally with closed stdin, and maintains conversation
 * state by mapping sessionIds to agy conversation IDs.
 *
 * Setup (client mode — default):
 *   npm install
 *   npm run companion:agy
 */

import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const COMPANION_ID = process.env.MHQ_COMPANION_ID ?? `desktop-agy-${process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? 'local'}`;
const JOBS_ROOT = process.env.MHQ_AI_JOBS_ROOT ?? 'mission_hq/aiJobs';
const COMPANIONS_ROOT = process.env.MHQ_COMPANIONS_ROOT ?? 'mission_hq/aiCompanions';
const MAX_PROMPT_CHARS = Number(process.env.MHQ_MAX_PROMPT_CHARS ?? 120_000);
const HEARTBEAT_MS = Number(process.env.MHQ_HEARTBEAT_MS ?? 15_000);

// Ensure common Unix utilities from Git Bash are in PATH on Windows for agy (e.g. grep)
if (process.platform === 'win32') {
  const home = homedir();
  const gitPaths = [
    'C:\\Program Files\\Git\\usr\\bin',
    path.join(home, 'AppData', 'Local', 'Programs', 'Git', 'usr', 'bin')
  ];
  for (const p of gitPaths) {
    if (existsSync(p)) {
      process.env.PATH = `${p};${process.env.PATH}`;
      break;
    }
  }
}

// Find agy executable
function findAgyPath() {
  if (process.env.AGY_BIN) return process.env.AGY_BIN;
  if (process.env.AGY_PATH) return process.env.AGY_PATH;
  const home = homedir();
  const candidates = process.platform === 'win32'
    ? [
        path.join(home, 'AppData', 'Local', 'Programs', 'agy', 'agy.exe'),
        path.join(home, 'AppData', 'Local', 'agy', 'bin', 'agy.exe'),
        path.join(home, 'AppData', 'Local', 'agy', 'agy.exe'),
        path.join(home, '.local', 'bin', 'agy.exe'),
        'C:\\Program Files\\agy\\agy.exe',
      ]
    : [
        path.join(home, '.local', 'bin', 'agy'),
        path.join(home, 'bin', 'agy'),
        '/usr/local/bin/agy',
        '/usr/bin/agy',
      ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return 'agy';
}

const AGY_BIN = findAgyPath();
const SESSIONS_FILE = path.join(
  homedir(),
  '.gemini',
  'antigravity-cli',
  'cache',
  'last_conversations.json'
);
const SESSIONS_CACHE_FILE = path.resolve(process.cwd(), 'mission_hq_sessions.json');

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY ?? process.env.FIREBASE_API_KEY ?? 'AIzaSyB8j-jHo2N341ieW4AVCdPL3ipn4Ss8sYQ',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN ?? process.env.FIREBASE_AUTH_DOMAIN ?? 'ash-2026-photobook.firebaseapp.com',
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL ?? process.env.FIREBASE_DATABASE_URL ?? 'https://ash-2026-photobook-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID ?? 'ash-2026-photobook',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET ?? process.env.FIREBASE_STORAGE_BUCKET ?? 'ash-2026-photobook.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? process.env.FIREBASE_MESSAGING_SENDER_ID ?? '328228907150',
  appId: process.env.VITE_FIREBASE_APP_ID ?? process.env.FIREBASE_APP_ID ?? '1:328228907150:web:fb4d2780b40bb8403ec1df',
};

/** @type {import('firebase/database').Database | import('firebase-admin/database').Database} */
let db;
/** @type {import('firebase/database').DatabaseReference | import('firebase-admin/database').DatabaseReference} */
let _statusRef;
let useAdmin = false;

// Lazy-load wrappers so we can use the same calls regardless of SDK.
let _ref, _get, _onChildAdded, _runTransaction, _update, _set, _onDisconnect;

async function initDatabase() {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (serviceAccountPath) {
    const { initializeApp, cert } = await import('firebase-admin/app');
    const { getDatabase } = await import('firebase-admin/database');

    const app = initializeApp({
      credential: cert(serviceAccountPath),
      databaseURL: firebaseConfig.databaseURL,
    });

    db = getDatabase(app);
    useAdmin = true;
    _ref          = (_db, path) => _db.ref(path);
    _get          = (refObj) => refObj.get();
    _onChildAdded = (refObj, cb) => { refObj.on('child_added', cb); return () => refObj.off('child_added', cb); };
    _runTransaction = (refObj, fn) => refObj.transaction(fn);
    _update       = (refObj, data) => refObj.update(data);
    _set          = (refObj, data) => refObj.set(data);
    _onDisconnect = (refObj) => refObj.onDisconnect();
    return;
  }

  const { initializeApp } = await import('firebase/app');
  const { getAuth, signInAnonymously, connectAuthEmulator } = await import('firebase/auth');
  const { getDatabase, ref, get, onChildAdded, runTransaction, update, set, onDisconnect, connectDatabaseEmulator } = await import('firebase/database');

  const app = initializeApp(firebaseConfig, 'mission-hq-local-agy-companion');
  const auth = getAuth(app);
  db = getDatabase(app);

  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  }

  if (process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
    const [host, port = '9000'] = process.env.FIREBASE_DATABASE_EMULATOR_HOST.split(':');
    connectDatabaseEmulator(db, host, Number(port));
  }

  await signInAnonymously(auth);
  log('Signed into Firebase anonymously', auth.currentUser?.uid ?? 'unknown');

  _ref = ref;
  _get = get;
  _onChildAdded = onChildAdded;
  _runTransaction = runTransaction;
  _update = update;
  _set = set;
  _onDisconnect = onDisconnect;
}

function dbRef(path) {
  return _ref(db, path);
}

const templateCache = new Map();
let activeJob = null;
let completedJobs = 0;
let failedJobs = 0;
let heartbeatTimer = null;

function log(message, extra = '') {
  const stamp = new Date().toISOString();
  console.log(`[${stamp}] ${message}${extra ? ` ${extra}` : ''}`);
}

function statusRef() {
  if (!_statusRef) _statusRef = dbRef(`${COMPANIONS_ROOT}/${COMPANION_ID}`);
  return _statusRef;
}

async function writeCompanionStatus(state, patch = {}) {
  const now = Date.now();
  await _update(statusRef(), {
    companionId: COMPANION_ID,
    state,
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    geminiBin: AGY_BIN,
    outputFormat: 'text',
    jobsRoot: JOBS_ROOT,
    activeJob,
    completedJobs,
    failedJobs,
    heartbeatAt: now,
    updatedAt: now,
    ...patch,
  });
}

async function startHeartbeat() {
  await _set(statusRef(), {
    companionId: COMPANION_ID,
    state: 'starting',
    pid: process.pid,
    nodeVersion: process.version,
    platform: process.platform,
    geminiBin: AGY_BIN,
    outputFormat: 'text',
    jobsRoot: JOBS_ROOT,
    activeJob: null,
    completedJobs: 0,
    failedJobs: 0,
    startedAt: Date.now(),
    heartbeatAt: Date.now(),
    updatedAt: Date.now(),
  });

  await _onDisconnect(statusRef()).update({
    state: 'offline',
    activeJob: null,
    offlineAt: Date.now(),
    updatedAt: Date.now(),
  });

  heartbeatTimer = setInterval(() => {
    void writeCompanionStatus(activeJob ? 'running' : 'idle').catch((err) => {
      log('Heartbeat update failed', err instanceof Error ? err.message : String(err));
    });
  }, HEARTBEAT_MS);
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
    throw new Error(`Prompt is ${prompt.length} chars; limit is ${MAX_PROMPT_CHARS}.`);
  }

  return prompt;
}

// Read mission_hq_sessions.json cache
async function readSessionsCache() {
  try {
    if (existsSync(SESSIONS_CACHE_FILE)) {
      return JSON.parse(await readFile(SESSIONS_CACHE_FILE, 'utf8'));
    }
  } catch (err) {
    log('Failed to read session cache', err.message);
  }
  return {};
}

// Write mission_hq_sessions.json cache
async function writeSessionsCache(cache) {
  try {
    await writeFile(SESSIONS_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    log('Failed to write session cache', err.message);
  }
}

// Normalize key paths and find the conversation ID
function getConversationIdFromLastConversations(lastConversationsJson, cwd) {
  try {
    const map = JSON.parse(lastConversationsJson);
    const target = path.resolve(cwd).toLowerCase();
    for (const [k, v] of Object.entries(map)) {
      if (path.resolve(k).toLowerCase() === target) {
        return v;
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

function runAgy(prompt, conversationId, model) {
  return new Promise((resolve, reject) => {
    const args = [];
    args.push('--dangerously-skip-permissions');
    args.push('--add-dir', process.cwd());
    if (conversationId) {
      args.push('--conversation', conversationId);
    }
    if (model) {
      args.push('--model', model);
    }
    args.push('--print-timeout', '180s');
    args.push('-p', prompt);

    log(`Running agy CLI: ${AGY_BIN} with conversationId=${conversationId ?? 'none'}`);

    const child = spawn(AGY_BIN, args, {
      cwd: process.cwd(),
      windowsHide: true,
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `agy exited with code ${code}`));
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
  const jobRef = dbRef(`${JOBS_ROOT}/${uid}/${jobId}`);
  const tx = await _runTransaction(jobRef, (current) => {
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

function getSessionKey(job) {
  const metadata = job.input?.metadata ?? {};
  const key = metadata.sessionId ?? metadata.missionId ?? metadata.chatSessionId;
  return key ? String(key) : null;
}

async function processJob(uid, jobId, job) {
  const claimed = await claimJob(uid, jobId, job);
  if (!claimed) return;

  activeJob = { uid, jobId, kind: claimed.input?.kind ?? 'unknown', startedAt: Date.now() };
  await writeCompanionStatus('running', { activeJob });
  log(`Running job ${uid}/${jobId}`, `kind=${claimed.input?.kind ?? 'unknown'}`);
  const jobRef = dbRef(`${JOBS_ROOT}/${uid}/${jobId}`);

  try {
    const sessionKey = getSessionKey(claimed);
    const cache = await readSessionsCache();
    let conversationId = sessionKey ? cache[sessionKey] : null;

    let promptToRun = '';
    if (conversationId && claimed.input?.messages?.length > 0) {
      // Session exists: pass only the last user message to agy
      const messages = claimed.input.messages;
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      promptToRun = lastUserMsg ? lastUserMsg.content : messages[messages.length - 1].content;
    } else {
      // Session does not exist yet: build the full prompt from template
      promptToRun = await buildPrompt(claimed.input ?? {});
    }

    const modelOverride = claimed.input?.model;
    const { stdout, stderr } = await runAgy(promptToRun, conversationId, modelOverride);
    const { text, json } = extractTextFromCliOutput(stdout);

    // Read last_conversations.json to see if a conversation ID was generated/updated
    let resolvedConvId = null;
    try {
      if (existsSync(SESSIONS_FILE)) {
        resolvedConvId = getConversationIdFromLastConversations(
          await readFile(SESSIONS_FILE, 'utf8'),
          process.cwd()
        );
      }
    } catch (err) {
      log('Could not resolve conversation ID from agy sessions file', err.message);
    }

    if (resolvedConvId && sessionKey) {
      cache[sessionKey] = resolvedConvId;
      await writeSessionsCache(cache);
      log(`Mapped sessionKey "${sessionKey}" to agy conversationId "${resolvedConvId}"`);
    }

    await _update(jobRef, {
      status: 'done',
      result: {
        text,
        json: json ?? null,
        rawOutput: stdout,
        stderr: stderr || null,
        sessionId: resolvedConvId || null,
      },
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });

    completedJobs += 1;
    log(`Completed job ${uid}/${jobId}`);
  } catch (err) {
    failedJobs += 1;
    await _update(jobRef, {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });
    log(`Failed job ${uid}/${jobId}`, err instanceof Error ? err.message : String(err));
  } finally {
    activeJob = null;
    await writeCompanionStatus('idle', { activeJob: null });
  }
}

async function scanExistingJobs() {
  const rootSnap = await _get(dbRef(JOBS_ROOT));
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
  const rootRef = dbRef(JOBS_ROOT);

  _onChildAdded(rootRef, (userSnap) => {
    const uid = userSnap.key;
    if (!uid) return;

    _onChildAdded(dbRef(`${JOBS_ROOT}/${uid}`), (jobSnap) => {
      const jobId = jobSnap.key;
      const job = jobSnap.val();
      if (!jobId || job?.status !== 'pending') return;
      void processJob(uid, jobId, job);
    });
  });
}

async function shutdown(signal) {
  log(`Received ${signal}; marking companion offline`);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  try {
    await writeCompanionStatus('offline', { activeJob: null, offlineAt: Date.now() });
  } finally {
    process.exit(0);
  }
}

async function main() {
  log('Starting Mission HQ local Antigravity (agy) companion', `id=${COMPANION_ID}`);
  log('agy CLI binary', AGY_BIN);
  log('Firebase RTDB root', JOBS_ROOT);

  process.on('SIGINT', () => { void shutdown('SIGINT'); });
  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });

  await initDatabase();
  log(useAdmin ? 'Running in ADMIN mode (bypasses Firebase Rules)' : 'Running in CLIENT mode (anonymous auth)');

  await startHeartbeat();
  await scanExistingJobs();
  watchJobs();
  await writeCompanionStatus('idle');
  log('Watching for pending jobs...');
}

main().catch(async (err) => {
  console.error(err);
  try {
    await writeCompanionStatus('error', { error: err instanceof Error ? err.message : String(err) });
  } catch {}
  process.exit(1);
});
