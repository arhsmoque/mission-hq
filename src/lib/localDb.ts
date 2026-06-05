/**
 * localDb.ts — localStorage adapter (mirrors Firebase RTDB for offline/local mode)
 *
 * Salvaged from mission-hq-local. Kept here as structural runway:
 * if Firebase is unavailable or a local mode is needed, swap imports in
 * useMission.ts and useChat.ts. A StorageAdapter interface is a future ADR.
 */
import type { Mission, ChatMessage, VocabEntry } from '@/types';

const DB_KEY = 'mission_hq_local_v1';

export interface LocalUser {
  uid: string;
  displayName: string;
  avatarUrl: string;
}

interface DbSchema {
  user: LocalUser | null;
  missions: Mission[];
  chats: Record<string, ChatMessage[]>; // key = missionId
  vocab: VocabEntry[];
}

function defaultDb(): DbSchema {
  return {
    user: null,
    missions: [],
    chats: {},
    vocab: [],
  };
}

function readDb(): DbSchema {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return defaultDb();
    return { ...defaultDb(), ...JSON.parse(raw) };
  } catch {
    return defaultDb();
  }
}

function writeDb(db: DbSchema) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

// ── User ────────────────────────────────────────────────────────────────────

export function getOrCreateUser(): LocalUser {
  const db = readDb();
  if (db.user) return db.user;

  const newUser: LocalUser = {
    uid: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    displayName: 'Agent',
    avatarUrl: '🤖',
  };
  db.user = newUser;
  writeDb(db);
  return newUser;
}

export function updateUser(updates: Partial<LocalUser>) {
  const db = readDb();
  if (db.user) {
    db.user = { ...db.user, ...updates };
    writeDb(db);
  }
}

export function getCurrentUser(): { uid: string } | null {
  const user = getOrCreateUser();
  return user ? { uid: user.uid } : null;
}

// ── Missions ────────────────────────────────────────────────────────────────

export function getMissions(): Mission[] {
  return readDb().missions;
}

export function getMission(missionId: string): Mission | null {
  return readDb().missions.find((m) => m.missionId === missionId) || null;
}

export function saveMission(mission: Mission) {
  const db = readDb();
  const idx = db.missions.findIndex((m) => m.missionId === mission.missionId);
  if (idx >= 0) {
    db.missions[idx] = mission;
  } else {
    db.missions.push(mission);
  }
  writeDb(db);
}

export function updateMission(missionId: string, updates: Partial<Mission>) {
  const db = readDb();
  const idx = db.missions.findIndex((m) => m.missionId === missionId);
  if (idx >= 0) {
    db.missions[idx] = { ...db.missions[idx], ...updates };
    writeDb(db);
  }
}

// ── Chats ───────────────────────────────────────────────────────────────────

export function getChatMessages(missionId: string): ChatMessage[] {
  return readDb().chats[missionId] || [];
}

export function addChatMessage(missionId: string, msg: Omit<ChatMessage, 'msgId'>) {
  const db = readDb();
  if (!db.chats[missionId]) db.chats[missionId] = [];
  const newMsg: ChatMessage = {
    ...msg,
    msgId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
  db.chats[missionId].push(newMsg);
  writeDb(db);
  return newMsg;
}

// ── Vocab ───────────────────────────────────────────────────────────────────

export function getVocab(): VocabEntry[] {
  return readDb().vocab;
}

export function saveVocab(entry: Omit<VocabEntry, 'vocabId'>): VocabEntry {
  const db = readDb();
  const newEntry: VocabEntry = {
    ...entry,
    vocabId: `vocab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };
  db.vocab.push(newEntry);
  writeDb(db);
  return newEntry;
}

export function deleteVocab(vocabId: string) {
  const db = readDb();
  db.vocab = db.vocab.filter((v) => v.vocabId !== vocabId);
  writeDb(db);
}
