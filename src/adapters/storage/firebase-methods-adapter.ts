/**
 * Firebase RTDB adapter for the teaching method registry.
 *
 * Methods are global (no uid prefix) — any authenticated user can read,
 * writes are restricted to the admin path in database.rules.json.
 *
 * Data path: mission_hq/teachingMethods/{methodId}
 */

import { ref, get, set, update, onValue } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import type { MethodRegistryPort } from '@/ports/lesson-port';
import type { TeachingMethod } from '@/types';

const METHODS_ROOT = 'mission_hq/teachingMethods';

export const firebaseMethodsAdapter: MethodRegistryPort = {
  async getAllMethods() {
    const snap = await get(ref(rtdb, METHODS_ROOT));
    if (!snap.exists()) return [];
    return Object.entries(snap.val() as Record<string, Omit<TeachingMethod, 'methodId'>>)
      .map(([id, data]) => ({ methodId: id, ...data } as TeachingMethod))
      .filter((m) => m.isActive)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async getMethod(methodId) {
    const snap = await get(ref(rtdb, `${METHODS_ROOT}/${methodId}`));
    if (!snap.exists()) return null;
    return { methodId, ...snap.val() } as TeachingMethod;
  },

  async createMethod(method) {
    await set(ref(rtdb, `${METHODS_ROOT}/${method.methodId}`), {
      ...method,
      createdAt: Date.now(),
    });
  },

  async updateMethod(methodId, patch) {
    await update(ref(rtdb, `${METHODS_ROOT}/${methodId}`), patch);
  },

  subscribeActiveMethods(onChange) {
    const dbRef = ref(rtdb, METHODS_ROOT);
    return onValue(dbRef, (snap) => {
      if (!snap.exists()) return onChange([]);
      const methods = Object.entries(snap.val() as Record<string, Omit<TeachingMethod, 'methodId'>>)
        .map(([id, data]) => ({ methodId: id, ...data } as TeachingMethod))
        .filter((m) => m.isActive)
        .sort((a, b) => a.name.localeCompare(b.name));
      onChange(methods);
    });
  },
};
