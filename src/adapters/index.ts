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

import { geminiAdapter }                                                    from './ai/gemini-adapter';
import { openrouterAdapter }                                                from './ai/openrouter-adapter';
import { firebaseMissionAdapter, firebaseChatAdapter }                     from './storage/firebase-rtdb-adapter';
import { firebaseMethodsAdapter }                                           from './storage/firebase-methods-adapter';
import { firebaseLessonsAdapter }                                           from './storage/firebase-lessons-adapter';
import { firebaseAnalyticsAdapter }                                         from './analytics/firebase-analytics-adapter';
import { firebaseResourcesAdapter }                                         from './storage/firebase-resources-adapter';
import { firebaseCampaignsAdapter, firebaseSessionContentAdapter }         from './storage/firebase-campaigns-adapter';
import { useRootStore }                                                     from '@/stores/rootStore';
import { subscribeLocalCompanions, isCompanionFresh }                      from '@/lib/localCompanionStatus';
import type { AIPort, AIChatMessage, OcrResult }                            from '@/ports/ai-port';

export { getPageSlice, splitExtractedPages } from './storage/firebase-resources-adapter';

// ── Companion online state — updated by a persistent RTDB subscription ─────
let _companionOnline = false;
subscribeLocalCompanions((companions) => {
  _companionOnline = companions.some(isCompanionFresh);
});

function getActiveAiAdapter(): AIPort {
  const { aiProvider } = useRootStore.getState();
  return aiProvider === 'openrouter' ? openrouterAdapter : geminiAdapter;
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
    if (_companionOnline) {
      try {
        return await geminiAdapter.chat(messages, model, temperature);
      } catch {
        // companion online but Gemini Worker failed — fall through to configured provider
      }
    }
    return getActiveAiAdapter().chat(messages, model, temperature);
  },
  async ocrImage(imageBase64: string, mimeType: string): Promise<OcrResult> {
    try {
      return await geminiAdapter.ocrImage(imageBase64, mimeType);
    } catch {
      return openrouterAdapter.ocrImage(imageBase64, mimeType);
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
