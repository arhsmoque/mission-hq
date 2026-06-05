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
 *   missions  →  mission_hq/missions/{profileId}/{missionId}
 *   chat      →  mission_hq/chats/{missionId}
 */

import type { Mission, ChatMessage } from '@/types';

export interface MissionStoragePort {
  subscribeMission(
    profileId: string,
    missionId: string,
    onChange: (mission: Mission | null) => void
  ): () => void;

  subscribeAllMissions(
    profileId: string,
    onChange: (missions: Mission[]) => void
  ): () => void;

  createMission(
    profileId: string,
    missionId: string,
    data: Omit<Mission, 'missionId'>
  ): Promise<void>;

  updateMission(
    profileId: string,
    missionId: string,
    patch: Record<string, unknown>
  ): Promise<void>;
}

export interface ChatStoragePort {
  subscribeMessages(
    missionId: string,
    onChange: (messages: ChatMessage[]) => void
  ): () => void;

  addMessage(
    missionId: string,
    msg: Omit<ChatMessage, 'msgId'>
  ): Promise<string>;

  getRecentMessages(
    missionId: string,
    limit: number
  ): Promise<Array<{ role: string; content: string }>>;
}
