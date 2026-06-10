/**
 * Resource content extraction orchestrator.
 *
 * Given a ResourceEntry (AnyFlip or FlipHTML5), this module:
 *   1. Probes the page count via binary search (no auth required — pages are public CDN)
 *   2. Fetches page images in batches via the Cloudflare Worker CORS proxy
 *   3. Sends each batch to Gemini Vision for text extraction
 *   4. Generates a structured TOC from the full extracted text
 *   5. Writes everything to Firebase under the resource entry
 *
 * All subsequent Gemini calls (lesson generation, chat context) use the stored
 * text — the source URL is never fetched again.
 */

import { resourceDirectory } from '@/adapters';
import { aiAdapter } from '@/adapters';
import { writePageNodes } from '@/adapters/storage/firebase-resources-adapter';
import type { ResourceEntry } from '@/types';
import { detectSource } from './sourceDetector';

const BATCH_SIZE    = 8;   // pages per Gemini call — balance cost vs latency
const MAX_PAGES     = 300; // safety cap for binary search
const EXTRACT_MODEL = 'gemini-2.5-flash';

const EXTRACT_PROMPT =
  `Extract ALL text from these primary school textbook or worksheet pages exactly as shown.
Content may include English, Malay (Bahasa Malaysia), Chinese (简体字 or 繁體字).
Rules:
- Preserve headings, numbered questions, math expressions, and table structure
- Format output as clean Markdown
- Separate each page with exactly this line: --- PAGE {n} ---  (replace {n} with the page number)
- Output extracted text only — no commentary, no preamble`;

const TOC_PROMPT = (title: string) =>
  `You are analysing extracted text from a Malaysian primary school textbook titled "${title}".
The text contains page markers in the format: --- PAGE n ---

Generate a table of contents as a JSON array. Each entry:
{ "title": string, "level": 1|2|3, "pageStart": number }

Rules:
- level 1 = chapter or unit, level 2 = topic, level 3 = subtopic
- Only include actual headings found in the text, not every page
- Maximum 40 entries
- pageStart = the PAGE number where the section begins

Return ONLY valid JSON array. No markdown fences, no explanation.`;

// ── Public API ─────────────────────────────────────────────────────────────

export interface ExtractionProgress {
  phase: 'probing' | 'extracting' | 'generating_toc' | 'saving';
  pagesFound?: number;
  pagesProcessed?: number;
}

/** Probe a resource's page count without extracting. Returns 0 if unreachable. */
export async function probeResource(resource: ResourceEntry): Promise<number> {
  const source = detectSource(resource.url);
  if (!source.pageImageTemplate) return 0;
  return probePageCount(source.pageImageTemplate);
}

export async function extractResource(
  resource: ResourceEntry,
  onProgress?: (p: ExtractionProgress) => void,
  maxPages?: number,
): Promise<void> {
  const source = detectSource(resource.url);

  if (!source.pageImageTemplate) {
    throw new Error(`"${resource.sourceType}" source type does not support automatic extraction. Open the book manually and use PDF upload instead.`);
  }

  await resourceDirectory.updateResource(resource.resourceId, {
    status: 'extracting',
    errorMessage: undefined,
  });

  try {
    // Phase 1: Probe page count
    onProgress?.({ phase: 'probing' });
    const pageCount = await probePageCount(source.pageImageTemplate);
    if (pageCount === 0) throw new Error('No pages found — the book may be private, or AnyFlip changed their URL structure. Open the book in browser and check the image URL in DevTools → Network tab.');

    const effectiveCount = maxPages ? Math.min(pageCount, maxPages) : pageCount;

    await resourceDirectory.updateResource(resource.resourceId, { pageCount });
    onProgress?.({ phase: 'extracting', pagesFound: effectiveCount, pagesProcessed: 0 });

    // Phase 2: Extract pages in batches
    const allText: string[] = [];
    for (let start = 1; start <= effectiveCount; start += BATCH_SIZE) {
      const end      = Math.min(start + BATCH_SIZE - 1, effectiveCount);
      const pageNums = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      const batchText = await extractBatch(source.pageImageTemplate, pageNums);
      if (batchText) allText.push(batchText);
      onProgress?.({ phase: 'extracting', pagesFound: effectiveCount, pagesProcessed: end });
    }

    const fullText = allText.join('\n\n');
    if (!fullText.trim()) throw new Error('Extraction returned no text. The book may use images that cannot be read, or the page URL pattern is incorrect.');

    // Phase 3: Generate TOC
    onProgress?.({ phase: 'generating_toc', pagesFound: pageCount, pagesProcessed: pageCount });
    const toc = await generateToc(fullText, resource.label);

    // Phase 4: Save everything (fullText blob + per-page nodes in parallel)
    onProgress?.({ phase: 'saving', pagesFound: pageCount, pagesProcessed: pageCount });
    await Promise.all([
      resourceDirectory.updateResource(resource.resourceId, {
        status:      'ready',
        extractedAt: Date.now(),
        pageCount,
        extractedContent: { fullText, toc },
      } as Partial<ResourceEntry>),
      writePageNodes(resource.resourceId, fullText),
    ]);

  } catch (err) {
    await resourceDirectory.updateResource(resource.resourceId, {
      status:       'error',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ── Internals ──────────────────────────────────────────────────────────────

async function probePageCount(template: string): Promise<number> {
  // Binary search: pages 1..MAX_PAGES, find the last valid page
  let lo = 1, hi = MAX_PAGES, last = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (await pageExists(template, mid)) {
      last = mid;
      lo   = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return last;
}

async function pageExists(template: string, n: number): Promise<boolean> {
  const imageUrl = template.replace('{n}', String(n));
  try {
    const res = await fetch(`/api/resource/proxy-image?url=${encodeURIComponent(imageUrl)}`);
    if (!res.ok) return false;
    const data = await res.json() as { found?: boolean };
    return data.found === true;
  } catch {
    return false;
  }
}

async function extractBatch(template: string, pageNums: number[]): Promise<string> {
  // Fetch all page images in parallel via the CORS proxy
  const fetched = await Promise.all(
    pageNums.map(async (n) => {
      const imageUrl = template.replace('{n}', String(n));
      try {
        const res  = await fetch(`/api/resource/proxy-image?url=${encodeURIComponent(imageUrl)}`);
        if (!res.ok) return null;
        const data = await res.json() as { found?: boolean; base64?: string; mimeType?: string };
        if (!data.found || !data.base64) return null;
        return { base64: data.base64, mimeType: data.mimeType ?? 'image/jpeg', pageNum: n };
      } catch {
        return null;
      }
    })
  );

  const pages = fetched.filter(Boolean) as Array<{ base64: string; mimeType: string; pageNum: number }>;
  if (pages.length === 0) return '';

  // Build the prompt with actual page numbers embedded
  const prompt = EXTRACT_PROMPT + `\n\nPage numbers for this batch: ${pages.map((p) => p.pageNum).join(', ')}`;

  const res = await fetch('/api/ai/extract-pages', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      pages: pages.map(({ base64, mimeType }) => ({ base64, mimeType })),
      model: EXTRACT_MODEL,
      prompt,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Page extraction failed: ${err}`);
  }

  const data = await res.json() as { text?: string; error?: string };
  if (data.error) throw new Error(data.error);
  return data.text ?? '';
}

async function generateToc(
  fullText: string,
  bookTitle: string,
): Promise<Array<{ title: string; level: number; pageStart: number }>> {
  // Send only the first 8000 chars — headings appear early, cuts token cost
  const sample = fullText.slice(0, 8000);

  try {
    const raw = await aiAdapter.chat(
      [
        { role: 'system', content: TOC_PROMPT(bookTitle) },
        { role: 'user',   content: sample },
      ],
      EXTRACT_MODEL,
      0.1,
    );

    const cleaned = raw.trim().replace(/^```(?:json)?|```$/gm, '').trim();
    const parsed  = JSON.parse(cleaned) as Array<{ title: string; level: number; pageStart: number }>;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
