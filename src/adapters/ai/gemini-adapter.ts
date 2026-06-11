/**
 * Gemini adapter — implements AIPort via the /api/ai Cloudflare Worker proxy.
 *
 * The Worker holds the Gemini API key as a Cloudflare secret;
 * no credentials are ever bundled into the client.
 *
 * Local dev: run `wrangler dev --port 8787` alongside `npm run dev`
 * (Vite proxies /api/* to localhost:8787 — see vite.config.ts).
 *
 * Separate local-companion mode is implemented through Firebase aiJobs and the
 * desktop Gemini CLI worker, not through this API proxy adapter.
 */

import type { AIPort, AIChatMessage, OcrResult } from '@/ports/ai-port';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';

const AI_BASE = '/api/ai';

export const geminiAdapter: AIPort = {
  async chat(
    messages: AIChatMessage[],
    model: string,
    temperature = 0.7
  ): Promise<string> {
    const res = await fetchWithTimeout(`${AI_BASE}/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ messages, model, temperature }),
    }, 25000);

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini worker ${res.status}: ${err}`);
    }

    const data = await res.json() as { text?: string; error?: string };
    if (data.error) throw new Error(`Gemini: ${data.error}`);
    return data.text ?? '';
  },

  async ocrImage(imageBase64: string, mimeType: string): Promise<OcrResult> {
    const res = await fetchWithTimeout(`${AI_BASE}/ocr`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ imageBase64, mimeType }),
    }, 45000);

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini OCR worker ${res.status}: ${err}`);
    }

    const data = await res.json() as {
      text?:       string;
      confidence?: number;
      error?:      string;
    };
    if (data.error) throw new Error(`Gemini OCR: ${data.error}`);
    return {
      text:       data.text ?? '',
      confidence: data.confidence ?? 95,
      engine:     'vision_llm',
    };
  },
};
