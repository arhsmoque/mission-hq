/**
 * Cloudflare Worker — AI proxy for Mission Room
 *
 * Routes:
 *   POST /api/ai/chat  — text generation
 *   POST /api/ai/ocr   — vision / image text extraction
 *   *                  — serve SPA static assets
 *
 * Required Cloudflare secrets (set via `wrangler secret put <NAME>`):
 *   GEMINI_REFRESH_TOKEN   — from ~/.gemini/ after `gemini auth`
 *   GOOGLE_CLIENT_ID       — OAuth client used by the Gemini CLI
 *   GOOGLE_CLIENT_SECRET   — OAuth client secret
 *
 * The OAuth credentials are the same ones the Gemini CLI stores locally.
 * Extract them from ~/.gemini/ (Linux/Mac) or the platform-equivalent path.
 */

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  ASSETS: Fetcher;
  GEMINI_REFRESH_TOKEN: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}

// Vertex AI endpoint — accepts cloud-platform scope (same as Gemini CLI auth)
// gemini-3.x models require the global endpoint; 2.x models use us-central1.
const GCP_PROJECT        = 'ash-2026-photobook';
const GCP_LOCATION       = 'us-central1';
const GEMINI_BASE_REGIONAL = `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT}/locations/${GCP_LOCATION}/publishers/google/models`;
const GEMINI_BASE_GLOBAL   = `https://aiplatform.googleapis.com/v1/projects/${GCP_PROJECT}/locations/global/publishers/google/models`;
const TOKEN_URL            = 'https://oauth2.googleapis.com/token';
const OCR_MODEL            = 'gemini-2.5-flash';

function geminiBase(model: string): string {
  return model.startsWith('gemini-3') ? GEMINI_BASE_GLOBAL : GEMINI_BASE_REGIONAL;
}

// Access-token cache — lives for the lifetime of the isolate (minutes to hours).
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(env: Env): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  if (!env.GEMINI_REFRESH_TOKEN || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error(
      'Gemini OAuth secrets not configured. Run: ' +
      'wrangler secret put GEMINI_REFRESH_TOKEN / GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET'
    );
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GEMINI_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OAuth token refresh failed (${res.status}): ${body}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = {
    value:     data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return cachedToken.value;
}

// Convert OpenAI-style messages to Gemini contents + optional systemInstruction.
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
    messages:    Array<{ role: string; content: string }>;
    model:       string;
    temperature?: number;
  };

  const accessToken = await getAccessToken(env);
  const payload     = toGeminiPayload(messages, temperature);

  const res = await fetch(`${geminiBase(model)}/${model}:generateContent`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
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

  const accessToken = await getAccessToken(env);

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

  const res = await fetch(`${geminiBase(OCR_MODEL)}/${OCR_MODEL}:generateContent`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
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
