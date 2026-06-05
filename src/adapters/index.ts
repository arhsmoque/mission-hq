/**
 * Adapter wiring — the ONLY file to edit when swapping a provider.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  To swap AI provider:  import a different adapter, assign aiAdapter  │
 * │  To swap storage:      import a different adapter, assign the ports  │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * View current wiring:              node scripts/adapter.mjs status
 * Generate a new adapter stub:      node scripts/adapter.mjs new-ai-stub --name=<provider>
 *
 * Every hook/lib in the app imports from HERE, never from concrete adapters.
 * That single indirection is what makes provider swaps a one-file change.
 */

import { openrouterAdapter }                              from './ai/openrouter-adapter';
import { firebaseMissionAdapter, firebaseChatAdapter }    from './storage/firebase-rtdb-adapter';

// ── Active adapters ────────────────────────────────────────────────────────
export const aiAdapter      = openrouterAdapter;        // AIPort
export const missionStorage = firebaseMissionAdapter;   // MissionStoragePort
export const chatStorage    = firebaseChatAdapter;      // ChatStoragePort
