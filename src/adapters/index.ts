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

import { geminiAdapter }                                   from './ai/gemini-adapter';
import { openrouterAdapter }                               from './ai/openrouter-adapter';
import { firebaseMissionAdapter, firebaseChatAdapter }    from './storage/firebase-rtdb-adapter';
import { firebaseMethodsAdapter }                          from './storage/firebase-methods-adapter';
import { firebaseLessonsAdapter }                          from './storage/firebase-lessons-adapter';
import { firebaseAnalyticsAdapter }                        from './analytics/firebase-analytics-adapter';
import { firebaseResourcesAdapter }                        from './storage/firebase-resources-adapter';
import { useRootStore }                                    from '@/stores/rootStore';
import type { AIPort, AIChatMessage, OcrResult }           from '@/ports/ai-port';

function getActiveAiAdapter(): AIPort {
  const { aiProvider } = useRootStore.getState();
  return aiProvider === 'openrouter' ? openrouterAdapter : geminiAdapter;
}

// ── Active adapters ────────────────────────────────────────────────────────

/** Runtime-dispatching AI proxy — reads aiProvider from store on each call. */
export const aiAdapter: AIPort = {
  chat(messages: AIChatMessage[], model: string, temperature?: number): Promise<string> {
    return getActiveAiAdapter().chat(messages, model, temperature);
  },
  ocrImage(imageBase64: string, mimeType: string): Promise<OcrResult> {
    return getActiveAiAdapter().ocrImage(imageBase64, mimeType);
  },
};

export const missionStorage     = firebaseMissionAdapter;       // MissionStoragePort
export const chatStorage        = firebaseChatAdapter;          // ChatStoragePort
export const methodRegistry     = firebaseMethodsAdapter;       // MethodRegistryPort
export const lessonStorage      = firebaseLessonsAdapter;       // LessonStoragePort
export const analyticsAdapter   = firebaseAnalyticsAdapter;     // AnalyticsPort
export const resourceDirectory  = firebaseResourcesAdapter;     // ResourceDirectoryPort
