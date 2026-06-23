import type { AIPort, AIChatMessage, OcrResult } from '@/ports/ai-port';
import { useRootStore } from '@/stores/rootStore';
import { waitForLocalCompanionResult } from '@/lib/localCompanionQueue';

export const agyAdapter: AIPort = {
  async chat(
    messages: AIChatMessage[],
    model: string,
    temperature = 0.7
  ): Promise<string> {
    const uid = useRootStore.getState().user?.uid;
    if (!uid) throw new Error('User not authenticated for local companion execution.');

    const result = await waitForLocalCompanionResult(uid, {
      kind: 'general',
      messages,
      model,
      temperature,
      metadata: {
        sessionId: useRootStore.getState().profileId || 'session',
        client: 'CikguWebapp',
      },
    }, 60000); // 60s timeout for CLI execution

    return result.text;
  },

  async ocrImage(_imageBase64: string, _mimeType: string): Promise<OcrResult> {
    // Local agy CLI does not parse vision images in queue mode.
    // Throw error to trigger routing to fallback provider.
    throw new Error('Local agy companion does not support vision OCR processing directly.');
  },
};
