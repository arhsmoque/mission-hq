/**
 * Client-side 5-minute cache over the method registry Firebase adapter.
 *
 * selectBestMethod falls back to Bloom's Taxonomy when no analytics data exists.
 * Stage 5 will replace the fallback with analytics-driven selection.
 */

import { methodRegistry } from '@/adapters';
import type { TeachingMethod } from '@/types';

const CACHE_TTL_MS = 5 * 60 * 1000;

let _cache:    TeachingMethod[] = [];
let _cacheAt = 0;

export async function getCachedMethods(): Promise<TeachingMethod[]> {
  if (Date.now() - _cacheAt < CACHE_TTL_MS && _cache.length > 0) return _cache;
  _cache   = await methodRegistry.getAllMethods();
  _cacheAt = Date.now();
  return _cache;
}

export async function getCachedMethod(methodId: string): Promise<TeachingMethod | null> {
  const methods = await getCachedMethods();
  return methods.find((m) => m.methodId === methodId) ?? null;
}

export async function selectBestMethod(subject: string): Promise<string> {
  const methods = await getCachedMethods();
  const match   = methods.find(
    (m) => m.isActive && (m.applicableSubjects.includes(subject) || m.applicableSubjects.includes('mixed'))
  );
  return match?.methodId ?? 'blooms_taxonomy';
}
