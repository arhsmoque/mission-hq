/**
 * Cloudflare Worker — AI proxy for Mission Room
 *
 * Routes:
 *   POST /api/ai/chat  — text generation
 *   POST /api/ai/ocr   — vision / image text extraction
 *   *                  — serve SPA static assets
 *
 * Required Cloudflare secret (set via `wrangler secret put GEMINI_API_KEY`):
 *   GEMINI_API_KEY — from https://aistudio.google.com/apikey (your Google account)
 */

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  ASSETS: Fetcher;
  GEMINI_API_KEY: string;
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const OCR_MODEL   = 'gemini-2.5-flash';

function toGeminiPayload(
  messages: Array<{ role: string; content: string }>,
  temperature: number
): Record<string, unknown> {
  const systemTexts: string[] = [];
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemTexts.push(msg.content);
    } else {
      contents.push({
        role:  msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  }

  const payload: Record<string, unknown> = {
    contents,
    generationConfig: { temperature },
  };

  if (systemTexts.length > 0) {
    payload.systemInstruction = { parts: [{ text: systemTexts.join('\n\n') }] };
  }

  return payload;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  const { messages, model, temperature = 0.7 } = await request.json() as {
    messages:     Array<{ role: string; content: string }>;
    model:        string;
    temperature?: number;
  };

  if (!env.GEMINI_API_KEY) {
    return json({ error: 'GEMINI_API_KEY secret not configured. Run: wrangler secret put GEMINI_API_KEY' }, 500);
  }

  const payload = toGeminiPayload(messages, temperature);

  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    return json({ error: await res.text() }, res.status);
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return json({ text });
}

async function handleOcr(request: Request, env: Env): Promise<Response> {
  const { imageBase64, mimeType } = await request.json() as {
    imageBase64: string;
    mimeType:    string;
  };

  if (!env.GEMINI_API_KEY) {
    return json({ error: 'GEMINI_API_KEY secret not configured. Run: wrangler secret put GEMINI_API_KEY' }, 500);
  }

  const payload = {
    contents: [{
      role:  'user',
      parts: [
        { inlineData: { mimeType, data: imageBase64 } },
        {
          text: 'Extract ALL text from this worksheet image exactly as written. ' +
                'The content may include English, Malay (Bahasa Malaysia), and/or Chinese (简体字/繁體字). ' +
                'Preserve structure, line breaks, numbering, and math expressions. ' +
                'Output the extracted text only — no commentary, no markdown formatting.',
        },
      ],
    }],
    generationConfig: { temperature: 0 },
  };

  const res = await fetch(`${GEMINI_BASE}/${OCR_MODEL}:generateContent`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    return json({ error: await res.text() }, res.status);
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return json({ text: text.trim(), confidence: 95, engine: 'vision_llm' });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === 'POST') {
      try {
        if (pathname === '/api/ai/chat') return await handleChat(request, env);
        if (pathname === '/api/ai/ocr')  return await handleOcr(request, env);
      } catch (err) {
        return json({ error: String(err) }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
