/**
 * OpenRouter AI adapter — implements AIPort via openrouter.ai
 *
 * All models available on OpenRouter (DeepSeek, Claude, GPT, Gemini, Llama, …)
 * are accessible through this single adapter. Model selection happens at
 * call-site via the `model` argument, not here.
 *
 * To swap to a different provider: create a new file in this directory,
 * then update src/adapters/index.ts.
 */

import type { AIPort, AIChatMessage, OcrResult } from '@/ports/ai-port';
import { APP_CONFIG } from '@/config';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Free-tier vision model — excellent at multilingual worksheet OCR.
const OCR_MODEL = 'google/gemini-2.0-flash-exp:free';

const OR_HEADERS = {
  'Content-Type':       'application/json',
  Authorization:        `Bearer ${APP_CONFIG.openrouter.key}`,
  'HTTP-Referer':       APP_CONFIG.openrouter.referer,
  'X-OpenRouter-Title': APP_CONFIG.openrouter.title,
} as const;

export const openrouterAdapter: AIPort = {
  async chat(
    messages: AIChatMessage[],
    model: string,
    temperature = 0.7
  ): Promise<string> {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: OR_HEADERS,
      body: JSON.stringify({ model, messages, temperature }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter ${res.status}: ${err}`);
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? '';
  },

  async ocrImage(imageBase64: string, mimeType: string): Promise<OcrResult> {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: OR_HEADERS,
      body: JSON.stringify({
        model: OCR_MODEL,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${imageBase64}` },
              },
              {
                type: 'text',
                text: 'Extract ALL text from this worksheet image exactly as written. The content may include English, Malay (Bahasa Malaysia), and/or Chinese (简体字/繁體字). Preserve structure, line breaks, numbering, and math expressions. Output the extracted text only — no commentary, no markdown formatting.',
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter OCR ${res.status}: ${err}`);
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content ?? '';
    return { text: text.trim(), confidence: 95, engine: 'vision_llm' };
  },
};
