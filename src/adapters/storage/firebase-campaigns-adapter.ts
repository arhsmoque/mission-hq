/**
 * Firebase RTDB adapter for campaigns and session content cache.
 *
 * Data paths:
 *   mission_hq/campaigns/{campaignId}              — Campaign objects
 *   mission_hq/session_content/{campaignId}/{idx}  — AI-generated review/questions cache
 */

import {
  ref, set, update, remove, get, push,
  onValue, query as dbQuery, orderByChild, equalTo,
} from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import type { CampaignStoragePort, SessionContentPort } from '@/ports/lesson-port';
import type { Campaign, CampaignSession, SessionContent } from '@/types';

const CAMPAIGNS_ROOT = 'mission_hq/campaigns';
const CONTENT_ROOT   = 'mission_hq/session_content';

// ── Campaign storage ───────────────────────────────────────────────────────

export const firebaseCampaignsAdapter: CampaignStoragePort = {
  async createCampaign(campaign) {
    await set(ref(rtdb, `${CAMPAIGNS_ROOT}/${campaign.campaignId}`), campaign);
  },

  async updateCampaign(campaignId, patch) {
    await update(ref(rtdb, `${CAMPAIGNS_ROOT}/${campaignId}`), patch);
  },

  async updateSession(campaignId, sessionIdx, patch) {
    // Sessions are stored as an array — update by index key
    const updates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      updates[`sessions/${sessionIdx}/${k}`] = v;
    }
    if (Object.keys(updates).length > 0) {
      await update(ref(rtdb, `${CAMPAIGNS_ROOT}/${campaignId}`), updates);
    }
    // Keep counters in sync
    const snap = await get(ref(rtdb, `${CAMPAIGNS_ROOT}/${campaignId}/sessions`));
    if (snap.exists()) {
      const sessions = Object.values(snap.val() as Record<string, CampaignSession>);
      const done = sessions.filter((s) => s.status === 'done').length;
      const allDone = done === sessions.length;
      await update(ref(rtdb, `${CAMPAIGNS_ROOT}/${campaignId}`), {
        sessionsDone: done,
        status: allDone ? 'completed' : 'active',
      });
    }
  },

  async deleteCampaign(campaignId) {
    await remove(ref(rtdb, `${CAMPAIGNS_ROOT}/${campaignId}`));
  },

  subscribeActiveCampaigns(profileId, onChange) {
    const q = dbQuery(
      ref(rtdb, CAMPAIGNS_ROOT),
      orderByChild('profileId'),
      equalTo(profileId),
    );
    return onValue(q, (snap) => {
      if (!snap.exists()) return onChange([]);
      const all = Object.values(snap.val() as Record<string, Campaign>);
      onChange(all.filter((c) => c.status === 'active').sort((a, b) => a.deadline - b.deadline));
    });
  },

  async getCampaignsByProfile(profileId) {
    const q = dbQuery(
      ref(rtdb, CAMPAIGNS_ROOT),
      orderByChild('profileId'),
      equalTo(profileId),
    );
    const snap = await get(q);
    if (!snap.exists()) return [];
    return Object.values(snap.val() as Record<string, Campaign>);
  },
};

// ── Session content cache ──────────────────────────────────────────────────

export const firebaseSessionContentAdapter: SessionContentPort = {
  async getSessionContent(campaignId, sessionIdx) {
    const snap = await get(ref(rtdb, `${CONTENT_ROOT}/${campaignId}/${sessionIdx}`));
    if (!snap.exists()) return null;
    return snap.val() as SessionContent;
  },

  async saveSessionContent(content) {
    await set(
      ref(rtdb, `${CONTENT_ROOT}/${content.campaignId}/${content.sessionIdx}`),
      content,
    );
  },
};

// ── Campaign ID generator ──────────────────────────────────────────────────

/** Generate a new campaign ID using Firebase push key format. */
export function newCampaignId(): string {
  return push(ref(rtdb, CAMPAIGNS_ROOT)).key ?? `c_${Date.now()}`;
}
