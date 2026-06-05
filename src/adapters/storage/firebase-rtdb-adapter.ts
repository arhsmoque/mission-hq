/**
 * Firebase RTDB storage adapters — implement MissionStoragePort + ChatStoragePort.
 *
 * Data layout:
 *   mission_hq/missions/{profileId}/{missionId}  →  Mission (minus missionId key)
 *   mission_hq/chats/{missionId}/{pushKey}       →  ChatMessage (minus msgId key)
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
  subscribeMission(profileId, missionId, onChange) {
    const dbRef = ref(rtdb, `${MISSIONS_ROOT}/${profileId}/${missionId}`);
    return onValue(dbRef, (snap) => {
      onChange(snap.exists() ? ({ missionId, ...snap.val() } as Mission) : null);
    });
  },

  subscribeAllMissions(profileId, onChange) {
    const dbRef = ref(rtdb, `${MISSIONS_ROOT}/${profileId}`);
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

  async createMission(profileId, missionId, data) {
    await set(ref(rtdb, `${MISSIONS_ROOT}/${profileId}/${missionId}`), data);
  },

  async updateMission(profileId, missionId, patch) {
    await update(ref(rtdb, `${MISSIONS_ROOT}/${profileId}/${missionId}`), patch);
  },
};

export const firebaseChatAdapter: ChatStoragePort = {
  subscribeMessages(missionId, onChange) {
    const dbRef = ref(rtdb, `${CHATS_ROOT}/${missionId}`);
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

  async addMessage(missionId, msg) {
    const dbRef = ref(rtdb, `${CHATS_ROOT}/${missionId}`);
    const newRef = push(dbRef);
    await set(newRef, msg);
    return newRef.key ?? '';
  },

  async getRecentMessages(missionId, limit) {
    const q = dbQuery(
      ref(rtdb, `${CHATS_ROOT}/${missionId}`),
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
