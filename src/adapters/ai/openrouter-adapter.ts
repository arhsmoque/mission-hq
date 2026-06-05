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

import type { AIPort, AIChatMessage } from '@/ports/ai-port';
import { APP_CONFIG } from '@/config';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const openrouterAdapter: AIPort = {
  async chat(
    messages: AIChatMessage[],
    model: string,
    temperature = 0.7
  ): Promise<string> {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type':       'application/json',
        Authorization:        `Bearer ${APP_CONFIG.openrouter.key}`,
        'HTTP-Referer':       APP_CONFIG.openrouter.referer,
        'X-OpenRouter-Title': APP_CONFIG.openrouter.title,
      },
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
};
