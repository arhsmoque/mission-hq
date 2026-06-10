/**
 * Cloudflare Worker — AI proxy for Mission Room
 *
 * Routes:
 *   POST /api/ai/chat                      — Gemini text generation
 *   POST /api/ai/ocr                       — Gemini vision / image text extraction
 *   POST /api/ai/extract-pages             — Gemini batch vision: multiple page images → text
 *   POST /api/openrouter/chat              — OpenRouter text generation
 *   POST /api/openrouter/ocr               — OpenRouter vision / image text extraction
 *   GET  /api/openrouter/models            — OpenRouter model list (proxied)
 *   GET  /api/openrouter/balance           — OpenRouter credit balance
 *   GET  /api/resource/proxy-image?url=... — CORS-safe image proxy (AnyFlip, FlipHTML5)
 *   *                                      — serve SPA static assets
 *
 * Required Cloudflare secrets:
 *   GEMINI_API_KEY     — from https://aistudio.google.com/apikey
 *   OPENROUTER_API_KEY — from https://openrouter.ai/keys (sk-or-v1-...)
 */

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

export interface Env {
  ASSETS: Fetcher;
  GEMINI_API_KEY: string;
  OPENROUTER_API_KEY: string;
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
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const usage = data.usageMetadata;
  return json({
    text,
    tokens: usage ? {
      prompt:     usage.promptTokenCount     ?? 0,
      completion: usage.candidatesTokenCount ?? 0,
      total:      usage.totalTokenCount      ?? 0,
    } : undefined,
  });
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

// ── Image proxy (CORS bypass for AnyFlip / FlipHTML5) ─────────────────────

const PROXY_ALLOWED = ['online.anyflip.com', 'anyflip.com', 'online.fliphtml5.com', 'fliphtml5.com'];

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binary);
}

async function handleProxyImage(request: Request): Promise<Response> {
  const imageUrl = new URL(request.url).searchParams.get('url');
  if (!imageUrl) return json({ error: 'url param required' }, 400);

  let host: string;
  try { host = new URL(imageUrl).hostname.toLowerCase(); }
  catch { return json({ error: 'Invalid URL' }, 400); }

  if (!PROXY_ALLOWED.some((d) => host === d || host.endsWith('.' + d))) {
    return json({ error: 'Domain not allowed' }, 403);
  }

  // Derive a same-origin Referer from the image URL so CDN hotlink protection passes.
  // AnyFlip and FlipHTML5 reject requests without a matching Referer.
  let referer = '';
  try {
    const u = new URL(imageUrl);
    // Use the book root — e.g. https://online.anyflip.com/xvurt/nkll/
    const parts = u.pathname.replace(/^\/+|\/+$/g, '').split('/');
    const bookRoot = parts.length >= 2 ? `${u.origin}/${parts[0]}/${parts[1]}/` : u.origin + '/';
    referer = bookRoot;
  } catch { referer = ''; }

  const res = await fetch(imageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Referer':    referer,
      'Accept':     'image/webp,image/apng,image/*,*/*;q=0.8',
    },
  });

  if (!res.ok) return json({ found: false }, res.status);

  const mimeType = res.headers.get('content-type') ?? 'image/jpeg';
  const base64   = arrayBufferToBase64(await res.arrayBuffer());
  return json({ found: true, base64, mimeType });
}

// ── Batch page extraction (multiple images → text, one Gemini call) ────────

async function handleExtractPages(request: Request, env: Env): Promise<Response> {
  const { pages, model = 'gemini-2.5-flash', prompt } = await request.json() as {
    pages:  Array<{ base64: string; mimeType: string }>;
    model?: string;
    prompt: string;
  };

  if (!env.GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY not configured' }, 500);
  if (!pages?.length)      return json({ error: 'pages array required' }, 400);

  const parts = [
    ...pages.map((p) => ({ inlineData: { mimeType: p.mimeType, data: p.base64 } })),
    { text: prompt },
  ];

  const payload = {
    contents:         [{ role: 'user', parts }],
    generationConfig: { temperature: 0 },
  };

  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) return json({ error: await res.text() }, res.status);

  const data = await res.json() as {
    candidates?:    Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  };
  const text  = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const usage = data.usageMetadata;
  return json({
    text,
    tokens: usage ? {
      prompt:     usage.promptTokenCount     ?? 0,
      completion: usage.candidatesTokenCount ?? 0,
      total:      usage.totalTokenCount      ?? 0,
    } : undefined,
  });
}

// ── OpenRouter handlers ────────────────────────────────────────────────────

const OR_BASE = 'https://openrouter.ai/api/v1';
const OR_HEADERS_STATIC = {
  'HTTP-Referer': 'https://mission-hq.arh-homelab.workers.dev',
  'X-Title':      'Mission HQ',
};

async function handleOrChat(request: Request, env: Env): Promise<Response> {
  if (!env.OPENROUTER_API_KEY) {
    return json({ error: 'OPENROUTER_API_KEY secret not configured. Run: wrangler secret put OPENROUTER_API_KEY' }, 500);
  }

  const { messages, model, temperature = 0.7 } = await request.json() as {
    messages:     Array<{ role: string; content: string }>;
    model:        string;
    temperature?: number;
  };

  const orBody = {
    model,
    messages,
    temperature,
  };

  const res = await fetch(`${OR_BASE}/chat/completions`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      ...OR_HEADERS_STATIC,
    },
    body: JSON.stringify(orBody),
  });

  if (!res.ok) {
    return json({ error: await res.text() }, res.status);
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?:   { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    error?:   { message?: string };
  };

  if (data.error?.message) return json({ error: data.error.message }, 500);

  const text  = data.choices?.[0]?.message?.content ?? '';
  const usage = data.usage;
  return json({
    text,
    tokens: usage ? {
      prompt:     usage.prompt_tokens     ?? 0,
      completion: usage.completion_tokens ?? 0,
      total:      usage.total_tokens      ?? 0,
    } : undefined,
  });
}

const OCR_TEXT_PROMPT =
  'Extract ALL text from this image exactly as written. ' +
  'The content may include English, Malay (Bahasa Malaysia), and/or Chinese (简体字/繁體字). ' +
  'Preserve structure, line breaks, numbering, and math expressions. ' +
  'Output the extracted text only — no commentary, no markdown formatting.';

async function handleOrOcr(request: Request, env: Env): Promise<Response> {
  if (!env.OPENROUTER_API_KEY) {
    return json({ error: 'OPENROUTER_API_KEY secret not configured.' }, 500);
  }

  const { imageBase64, mimeType, model } = await request.json() as {
    imageBase64: string;
    mimeType:    string;
    model:       string;
  };

  const orBody = {
    model,
    messages: [{
      role:    'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        { type: 'text', text: OCR_TEXT_PROMPT },
      ],
    }],
    temperature: 0,
  };

  const res = await fetch(`${OR_BASE}/chat/completions`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      ...OR_HEADERS_STATIC,
    },
    body: JSON.stringify(orBody),
  });

  if (!res.ok) return json({ error: await res.text() }, res.status);

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    error?:   { message?: string };
  };

  if (data.error?.message) return json({ error: data.error.message }, 500);

  const text = data.choices?.[0]?.message?.content ?? '';
  return json({ text: text.trim(), confidence: 95, engine: 'vision_llm' });
}

async function handleOrModels(_request: Request, env: Env): Promise<Response> {
  if (!env.OPENROUTER_API_KEY) {
    return json({ error: 'OPENROUTER_API_KEY not configured.' }, 500);
  }

  const res = await fetch(`${OR_BASE}/models`, {
    headers: {
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      ...OR_HEADERS_STATIC,
    },
  });

  if (!res.ok) return json({ error: await res.text() }, res.status);
  const data = await res.json();
  return json(data);
}

async function handleOrBalance(_request: Request, env: Env): Promise<Response> {
  if (!env.OPENROUTER_API_KEY) {
    return json({ error: 'OPENROUTER_API_KEY not configured.' }, 500);
  }

  const res = await fetch(`${OR_BASE}/auth/key`, {
    headers: {
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      ...OR_HEADERS_STATIC,
    },
  });

  if (!res.ok) return json({ error: await res.text() }, res.status);
  const data = await res.json();
  return json(data);
}

// ── Router ─────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    try {
      if (request.method === 'POST') {
        if (pathname === '/api/ai/chat')              return await handleChat(request, env);
        if (pathname === '/api/ai/ocr')               return await handleOcr(request, env);
        if (pathname === '/api/ai/extract-pages')     return await handleExtractPages(request, env);
        if (pathname === '/api/openrouter/chat')      return await handleOrChat(request, env);
        if (pathname === '/api/openrouter/ocr')       return await handleOrOcr(request, env);
      }
      if (request.method === 'GET') {
        if (pathname === '/api/resource/proxy-image') return await handleProxyImage(request);
        if (pathname === '/api/openrouter/models')    return await handleOrModels(request, env);
        if (pathname === '/api/openrouter/balance')   return await handleOrBalance(request, env);
      }
    } catch (err) {
      return json({ error: String(err) }, 500);
    }

    return env.ASSETS.fetch(request);
  },
};
