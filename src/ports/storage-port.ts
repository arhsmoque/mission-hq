/**
 * Storage ports — contracts for mission and chat persistence.
 *
 * To swap storage backend:
 *   1. Create src/adapters/storage/<backend>-adapter.ts implementing both ports
 *   2. Point `missionStorage` / `chatStorage` in src/adapters/index.ts to it
 *   3. Done — hooks never import Firebase directly
 *
 * Current implementation: Firebase Realtime Database (RTDB)
 * Data paths:
 *   missions  →  mission_hq/missions/{uid}/{missionId}
 *   chat      →  mission_hq/chats/{uid}/{missionId}
 */

import type { Mission, ChatMessage } from '@/types';

export interface MissionStoragePort {
  subscribeMission(
    uid: string,
    missionId: string,
    onChange: (mission: Mission | null) => void
  ): () => void;

  subscribeAllMissions(
    uid: string,
    onChange: (missions: Mission[]) => void
  ): () => void;

  createMission(
    uid: string,
    missionId: string,
    data: Omit<Mission, 'missionId'>
  ): Promise<void>;

  updateMission(
    uid: string,
    missionId: string,
    patch: Record<string, unknown>
  ): Promise<void>;
}

export interface ChatStoragePort {
  subscribeMessages(
    uid: string,
    missionId: string,
    onChange: (messages: ChatMessage[]) => void
  ): () => void;

  addMessage(
    uid: string,
    missionId: string,
    msg: Omit<ChatMessage, 'msgId'>
  ): Promise<string>;

  getRecentMessages(
    uid: string,
    missionId: string,
    limit: number
  ): Promise<Array<{ role: string; content: string }>>;
}
