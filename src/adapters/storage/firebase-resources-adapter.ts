/**
 * Firebase RTDB adapter for the resource directory.
 *
 * Resources are global (no uid prefix) — admin-managed, shared across all users.
 * Any authenticated user can read; writes are gated by the admin PIN in the UI.
 *
 * Data path: mission_hq/resources/{resourceId}
 */

import { ref, push, set, update, remove, get, onValue, query as dbQuery, orderByChild, equalTo } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import type { ResourceDirectoryPort } from '@/ports/lesson-port';
import type { ResourceEntry } from '@/types';

const RESOURCES_ROOT = 'mission_hq/resources';

// ── Per-page helpers ───────────────────────────────────────────────────────

/**
 * Fetch a contiguous slice of extracted pages from Firebase.
 * Reads only the requested page nodes — not the full fullText blob.
 * Returns a string with --- PAGE n --- separators, ready to send to the AI.
 */
export async function getPageSlice(
  resourceId: string,
  startPage: number,
  endPage: number,
): Promise<string> {
  // Try per-page nodes first (fast, efficient)
  const fetches = Array.from(
    { length: endPage - startPage + 1 },
    (_, i) => startPage + i,
  ).map(async (n) => {
    const snap = await get(ref(rtdb, `${RESOURCES_ROOT}/${resourceId}/extractedContent/pages/${n}`));
    return snap.exists() ? `--- PAGE ${n} ---\n${snap.val() as string}` : '';
  });
  const texts = await Promise.all(fetches);
  const result = texts.filter(Boolean).join('\n\n');
  if (result.trim()) return result;

  // Fallback: slice the fullText blob (older extractions without per-page nodes)
  const snap = await get(ref(rtdb, `${RESOURCES_ROOT}/${resourceId}/extractedContent/fullText`));
  if (!snap.exists()) return '';
  return sliceFullText(snap.val() as string, startPage, endPage);
}

function sliceFullText(fullText: string, startPage: number, endPage: number): string {
  const startRe = new RegExp(`---\\s*PAGE\\s+${startPage}\\s*---`);
  const endRe   = new RegExp(`---\\s*PAGE\\s+${endPage + 1}\\s*---`);
  const si = fullText.search(startRe);
  if (si === -1) return fullText.slice(0, 6000); // last resort: first chunk
  const sub = fullText.slice(si);
  const ei  = sub.search(endRe);
  return ei === -1 ? sub : sub.slice(0, ei);
}

/**
 * One-time migration: split an existing fullText blob into per-page nodes.
 * Safe to run multiple times — idempotent write.
 */
export async function splitExtractedPages(resourceId: string): Promise<void> {
  const snap = await get(ref(rtdb, `${RESOURCES_ROOT}/${resourceId}/extractedContent/fullText`));
  if (!snap.exists()) return;
  const fullText = snap.val() as string;
  const pageMap = parsePageMap(fullText);
  if (Object.keys(pageMap).length === 0) return;
  await update(ref(rtdb, `${RESOURCES_ROOT}/${resourceId}/extractedContent/pages`), pageMap);
}

/** Parse fullText with --- PAGE n --- markers into { n: text } map. */
export function parsePageMap(fullText: string): Record<string, string> {
  const map: Record<string, string> = {};
  const re = /---\s*PAGE\s+(\d+)\s*---/g;
  let match: RegExpExecArray | null;
  let lastN = 0;
  let lastIdx = 0;

  while ((match = re.exec(fullText)) !== null) {
    const n = parseInt(match[1], 10);
    if (lastN > 0) {
      map[String(lastN)] = fullText.slice(lastIdx, match.index).trim();
    }
    lastN  = n;
    lastIdx = match.index + match[0].length;
  }
  if (lastN > 0) {
    map[String(lastN)] = fullText.slice(lastIdx).trim();
  }
  return map;
}

/** Write per-page nodes for newly extracted text. */
export async function writePageNodes(resourceId: string, fullText: string): Promise<void> {
  const pageMap = parsePageMap(fullText);
  if (Object.keys(pageMap).length === 0) return;
  await update(ref(rtdb, `${RESOURCES_ROOT}/${resourceId}/extractedContent/pages`), pageMap);
}

export const firebaseResourcesAdapter: ResourceDirectoryPort = {
  async addResource(resource) {
    const dbRef = ref(rtdb, RESOURCES_ROOT);
    const newRef = push(dbRef);
    await set(newRef, { ...resource, resourceId: newRef.key });
    return newRef.key ?? '';
  },

  async updateResource(resourceId, patch) {
    await update(ref(rtdb, `${RESOURCES_ROOT}/${resourceId}`), patch);
  },

  async deleteResource(resourceId) {
    await remove(ref(rtdb, `${RESOURCES_ROOT}/${resourceId}`));
  },

  subscribeResources(onChange) {
    const dbRef = ref(rtdb, RESOURCES_ROOT);
    return onValue(dbRef, (snap) => {
      if (!snap.exists()) return onChange([]);
      const resources = Object.values(
        snap.val() as Record<string, ResourceEntry>
      ).sort((a, b) => a.yearLevel - b.yearLevel || a.subject.localeCompare(b.subject));
      onChange(resources);
    });
  },

  async getResourcesByYear(yearLevel) {
    const q = dbQuery(
      ref(rtdb, RESOURCES_ROOT),
      orderByChild('yearLevel'),
      equalTo(yearLevel)
    );
    const snap = await get(q);
    if (!snap.exists()) return [];
    return Object.values(snap.val() as Record<string, ResourceEntry>);
  },
};
