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
