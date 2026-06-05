/**
 * Firebase Cloud Functions — NOT DEPLOYED / NOT ACTIVE
 *
 * These stubs were originally written targeting Firestore.
 * The Mission Room client uses Realtime Database (RTDB) — they are incompatible.
 *
 * Current architecture (client-direct, no Cloud Functions needed):
 *   AI calls   →  client → OpenRouter API       (src/adapters/ai/openrouter-adapter.ts)
 *   Data store →  client → Firebase RTDB        (src/adapters/storage/firebase-rtdb-adapter.ts)
 *
 * If you want to move AI calls server-side in the future (e.g. to hide the API key):
 *   1. Migrate these functions to use getDatabase() / RTDB instead of getFirestore()
 *   2. Store the OpenRouter key in Cloud Functions environment config (not in source)
 *   3. Create a new adapter in src/adapters/ai/ that calls the Cloud Function endpoint
 *   4. Update src/adapters/index.ts to use the new adapter
 *
 * Until then, this file is intentionally empty to prevent accidental deployment.
 */
export {};
