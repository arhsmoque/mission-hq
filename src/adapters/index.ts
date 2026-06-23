/**
 * Adapter wiring — the ONLY file to edit when swapping a provider.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  To swap AI provider:  change `aiProvider` in rootStore at runtime   │
 * │  To add a new AI provider: create src/adapters/ai/<name>-adapter.ts  │
 * │                            and wire it in getActiveAiAdapter() below  │
 * │  To swap storage:      import a different adapter, assign the ports  │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Every hook/lib in the app imports from HERE, never from concrete adapters.
 * aiAdapter is a runtime proxy — dispatches to the provider selected in store.
 */

import { get, ref } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import { isCompanionFresh, type LocalCompanionStatus } from '@/lib/localCompanionStatus';
import { agyAdapter } from './ai/agy-adapter';
import { geminiAdapter }                                                    from './ai/gemini-adapter';
import { openrouterAdapter }                                                from './ai/openrouter-adapter';
import { firebaseMissionAdapter, firebaseChatAdapter }                     from './storage/firebase-rtdb-adapter';
import { firebaseMethodsAdapter }                                           from './storage/firebase-methods-adapter';
import { firebaseLessonsAdapter }                                           from './storage/firebase-lessons-adapter';
import { firebaseAnalyticsAdapter }                                         from './analytics/firebase-analytics-adapter';
import { firebaseResourcesAdapter }                                         from './storage/firebase-resources-adapter';
import { firebaseCampaignsAdapter, firebaseSessionContentAdapter }         from './storage/firebase-campaigns-adapter';
import type { AIPort, AIChatMessage, OcrResult }                            from '@/ports/ai-port';

export { getPageSlice, splitExtractedPages } from './storage/firebase-resources-adapter';

async function isAnyCompanionOnline(): Promise<boolean> {
  try {
    const snap = await get(ref(rtdb, 'mission_hq/aiCompanions'));
    if (!snap.exists()) return false;
    const val = snap.val() as Record<string, LocalCompanionStatus>;
    return Object.values(val).some((c) => isCompanionFresh(c));
  } catch (err) {
    console.error('[Companion Check] Failed to check companion status:', err);
    return false;
  }
}

// ── Active adapters ────────────────────────────────────────────────────────

/**
 * Runtime-dispatching AI proxy.
 * - chat: when a local companion is online, prefers geminiAdapter (direct, no quota cost).
 *         Falls back to openrouterAdapter on failure or when companion is offline.
 * - ocrImage: always tries geminiAdapter (vision Worker) first; local companion queue
 *             does not support image input, so openrouter is the only fallback.
 */
export const aiAdapter: AIPort = {
  async chat(messages: AIChatMessage[], model: string, temperature?: number): Promise<string> {
    const isOnline = await isAnyCompanionOnline();
    if (isOnline) {
      try {
        console.log('[aiAdapter] Routing chat via local agy companion...');
        return await agyAdapter.chat(messages, model, temperature);
      } catch (err) {
        console.warn('[aiAdapter] Local agy companion chat failed, falling back to openrouter:', err);
        return await openrouterAdapter.chat(messages, model, temperature);
      }
    }
    console.log('[aiAdapter] Local companion offline, routing chat directly to openrouter...');
    return await openrouterAdapter.chat(messages, model, temperature);
  },

  async ocrImage(imageBase64: string, mimeType: string): Promise<OcrResult> {
    try {
      console.log('[aiAdapter] Trying direct Gemini OCR via Worker...');
      return await geminiAdapter.ocrImage(imageBase64, mimeType);
    } catch (err) {
      console.warn('[aiAdapter] Direct Gemini OCR failed, falling back to openrouter OCR:', err);
      return await openrouterAdapter.ocrImage(imageBase64, mimeType);
    }
  },
};

export const missionStorage     = firebaseMissionAdapter;            // MissionStoragePort
export const chatStorage        = firebaseChatAdapter;               // ChatStoragePort
export const methodRegistry     = firebaseMethodsAdapter;            // MethodRegistryPort
export const lessonStorage      = firebaseLessonsAdapter;            // LessonStoragePort
export const analyticsAdapter   = firebaseAnalyticsAdapter;          // AnalyticsPort
export const resourceDirectory  = firebaseResourcesAdapter;          // ResourceDirectoryPort
export const campaignStorage    = firebaseCampaignsAdapter;          // CampaignStoragePort
export const sessionContent     = firebaseSessionContentAdapter;     // SessionContentPort
