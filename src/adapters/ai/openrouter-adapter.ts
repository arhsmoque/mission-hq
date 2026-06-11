/**
 * OpenRouter adapter — implements AIPort via the /api/openrouter Cloudflare Worker proxy.
 *
 * Model resolution: OR model IDs contain '/' (e.g. 'google/gemini-2.5-flash').
 * When a plain Gemini model ID is passed from legacy call sites, this adapter
 * substitutes the user's stored openrouterModel so existing code paths work
 * without modification.
 *
 * Side effects (in-memory only, not persisted):
 *   - Successful calls update lastTokenUsage in rootStore
 *   - Failed calls append to errorLog in rootStore
 */

import type { AIPort, AIChatMessage, OcrResult } from '@/ports/ai-port';
import { useRootStore } from '@/stores/rootStore';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import type { ErrorEntry } from '@/stores/rootStore';

const OR_BASE = '/api/openrouter';

function resolveModel(model: string): string {
  if (model.includes('/')) return model;
  return useRootStore.getState().openrouterModel;
}

function wantsJsonObject(messages: AIChatMessage[]): boolean {
  return messages.some((m) =>
    /respond only with a json object|return only valid json|output schema/i.test(m.content)
  );
}

function logError(entry: Omit<ErrorEntry, 'id' | 'ts'>) {
  useRootStore.getState().pushError({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: new Date().toISOString(),
    ...entry,
  });
}

export const openrouterAdapter: AIPort = {
  async chat(messages: AIChatMessage[], model: string, temperature = 0.7): Promise<string> {
    const orModel = resolveModel(model);
    const t0      = Date.now();

    let res: Response;
    try {
      const uid = useRootStore.getState().user?.uid;
      res = await fetchWithTimeout(`${OR_BASE}/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages,
          model: orModel,
          temperature,
          user: uid,
          responseFormat: wantsJsonObject(messages) ? 'json_object' : undefined,
        }),
      }, 25000);
    } catch (err) {
      logError({ source: 'chat', model: orModel, message: `Network error: ${String(err)}`, latencyMs: Date.now() - t0 });
      throw err;
    }

    const latencyMs = Date.now() - t0;

    if (!res.ok) {
      const errText = await res.text();
      logError({ source: 'chat', model: orModel, message: errText, status: res.status, latencyMs });
      throw new Error(`OpenRouter chat ${res.status}: ${errText}`);
    }

    const data = await res.json() as {
      text?:   string;
      tokens?: { prompt: number; completion: number; total: number };
      error?:  string;
    };

    if (data.error) {
      logError({ source: 'chat', model: orModel, message: data.error, latencyMs });
      throw new Error(`OpenRouter: ${data.error}`);
    }

    if (data.tokens) useRootStore.getState().setLastTokenUsage(data.tokens);
    return data.text ?? '';
  },

  async ocrImage(imageBase64: string, mimeType: string): Promise<OcrResult> {
    const orModel = useRootStore.getState().openrouterModel;
    const t0      = Date.now();

    let res: Response;
    try {
      res = await fetchWithTimeout(`${OR_BASE}/ocr`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ imageBase64, mimeType, model: orModel }),
      }, 45000);
    } catch (err) {
      logError({ source: 'ocr', model: orModel, message: `Network error: ${String(err)}`, latencyMs: Date.now() - t0 });
      throw err;
    }

    const latencyMs = Date.now() - t0;

    if (!res.ok) {
      const errText = await res.text();
      logError({ source: 'ocr', model: orModel, message: errText, status: res.status, latencyMs });
      throw new Error(`OpenRouter OCR ${res.status}: ${errText}`);
    }

    const data = await res.json() as { text?: string; confidence?: number; error?: string };

    if (data.error) {
      logError({ source: 'ocr', model: orModel, message: data.error, latencyMs });
      throw new Error(`OpenRouter OCR: ${data.error}`);
    }

    return { text: data.text ?? '', confidence: data.confidence ?? 95, engine: 'vision_llm' };
  },
};
