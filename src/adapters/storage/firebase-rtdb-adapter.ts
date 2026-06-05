/**
 * Firebase RTDB storage adapters — implement MissionStoragePort + ChatStoragePort.
 *
 * Data layout:
 *   mission_hq/missions/{uid}/{missionId}  →  Mission (minus missionId key)
 *   mission_hq/chats/{uid}/{missionId}/{pushKey}  →  ChatMessage (minus msgId key)
 *
 * To swap storage: create a parallel file (e.g. supabase-adapter.ts) that
 * implements both ports, then update src/adapters/index.ts.
 */

import {
  ref, set, update, push, get,
  onValue, query as dbQuery,
  orderByChild, limitToLast,
} from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import type { MissionStoragePort, ChatStoragePort } from '@/ports/storage-port';
import type { Mission, ChatMessage } from '@/types';

const MISSIONS_ROOT = 'mission_hq/missions';
const CHATS_ROOT    = 'mission_hq/chats';

export const firebaseMissionAdapter: MissionStoragePort = {
  subscribeMission(uid, missionId, onChange) {
    const dbRef = ref(rtdb, `${MISSIONS_ROOT}/${uid}/${missionId}`);
    return onValue(dbRef, (snap) => {
      onChange(snap.exists() ? ({ missionId, ...snap.val() } as Mission) : null);
    });
  },

  subscribeAllMissions(uid, onChange) {
    const dbRef = ref(rtdb, `${MISSIONS_ROOT}/${uid}`);
    return onValue(dbRef, (snap) => {
      if (!snap.exists()) return onChange([]);
      const missions = Object.entries(
        snap.val() as Record<string, Omit<Mission, 'missionId'>>
      )
        .map(([id, data]) => ({ missionId: id, ...data } as Mission))
        .sort((a, b) => b.createdAt - a.createdAt);
      onChange(missions);
    });
  },

  async createMission(uid, missionId, data) {
    await set(ref(rtdb, `${MISSIONS_ROOT}/${uid}/${missionId}`), data);
  },

  async updateMission(uid, missionId, patch) {
    await update(ref(rtdb, `${MISSIONS_ROOT}/${uid}/${missionId}`), patch);
  },
};

export const firebaseChatAdapter: ChatStoragePort = {
  subscribeMessages(uid, missionId, onChange) {
    const dbRef = ref(rtdb, `${CHATS_ROOT}/${uid}/${missionId}`);
    return onValue(dbRef, (snap) => {
      if (!snap.exists()) return onChange([]);
      const msgs = Object.entries(
        snap.val() as Record<string, Omit<ChatMessage, 'msgId'>>
      )
        .map(([id, data]) => ({ msgId: id, ...data } as ChatMessage))
        .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
      onChange(msgs);
    });
  },

  async addMessage(uid, missionId, msg) {
    const dbRef = ref(rtdb, `${CHATS_ROOT}/${uid}/${missionId}`);
    const newRef = push(dbRef);
    await set(newRef, msg);
    return newRef.key ?? '';
  },

  async getRecentMessages(uid, missionId, limit) {
    const q = dbQuery(
      ref(rtdb, `${CHATS_ROOT}/${uid}/${missionId}`),
      orderByChild('timestamp'),
      limitToLast(limit)
    );
    const snap = await get(q);
    if (!snap.exists()) return [];
    return Object.values(
      snap.val() as Record<string, Omit<ChatMessage, 'msgId'>>
    )
      .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
      .map((m) => ({ role: m.role, content: m.content }));
  },
};
