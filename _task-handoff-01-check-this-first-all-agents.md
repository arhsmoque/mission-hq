# Mission HQ — Feature Sprint Handoff
**Date:** 2026-06-05  
**Repo:** `C:\00_ARH\_arhsmoque-github-repo-clones\mission-hq`  
**Live URL:** `https://mission-hq.arh-homelab.workers.dev`  
**Build status:** ✅ Clean (`npm run build` passes, 0 errors)  
**Deploy pipeline:** GitHub Actions → `cloudflare/wrangler-action@v3` (wrangler v4 pinned) → Cloudflare Workers on every push to `master`

---

## What Was Done This Session

### Deployment (complete ✅)
- Diagnosed why `mission-hq.pages.dev` was unreachable — the Cloudflare Pages project never existed
- Chose **Cloudflare Workers + Assets** over Pages (better long-term platform)
- First deploy via `wrangler deploy` → live at `mission-hq.arh-homelab.workers.dev`
- Set up **GitHub Actions auto-deploy** (`.github/workflows/deploy.yml`): every push to master builds and deploys in ~52s
- Resolved two bad CF API tokens; valid token stored in vault as `"arh-homelab Cloudflare API Token (Workers edit)"`
- Added `.node-version → 20` (Vite 8 requires Node ≥ 20.19)

### Vault fix (complete ✅)
- Fixed missing comma in `C:\00_ARH\vault\keys\arhg3-vault.json` (was invalid JSON)
- Added `"arh-homelab Cloudflare API Token (Workers edit)": "cfut_458ZaoPGeGQFNNWMQoDvy8oOKFtDbMFr4aw7kVH8a8f503ec"`

---

## Planned Features (NOT YET STARTED — next session picks up here)

User requested these in order of dependency:

### 1. Free-model fallback in OpenRouter adapter
**File:** `src/adapters/ai/openrouter-adapter.ts`  
**What:** When a paid model returns HTTP 402 (no credits) / 429 (rate limit) / 5xx, automatically retry with the free fallback model instead of crashing.  
**Free fallback constant to add to `src/lib/models.ts`:**
```ts
export const FREE_FALLBACK_MODEL_ID = 'deepseek/deepseek-chat-v3-0324:free';
// Already the DEFAULT_MODEL_ID — use same for fallback. If that also fails, throw.
```
**Error codes to catch in adapter:**
- `402` → insufficient credits → fallback + log
- `429` → rate limit → fallback + log  
- `5xx` → service error → single retry, then throw

### 2. Graceful error handling (UI layer)
**What:** Instead of unhandled promise rejections, surface a friendly toast/banner when AI calls fail. Children see "My brain is taking a break, try again!" — not a stack trace.  
**Where to add:** `src/features/mission/ModuleChat.tsx` (catch `sendMessage.error`) and `src/routes/NewMission.tsx` (catch analysis errors).

### 3. Central event logger → Firebase RTDB
**New file:** `src/lib/logger.ts`  
**Schema — write to `mission_hq/logs/{uid}/{pushKey}`:**
```ts
interface LogEvent {
  event: 'ai_call' | 'error' | 'fallback';
  uid: string;
  profileId: string | null;
  model: string;
  usedFallback: boolean;
  fallbackReason?: string;   // '402' | '429' | '5xx'
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  error?: string;
  timestamp: object; // serverTimestamp()
}
```
**RTDB rules** — need to add `logs` path to `database.rules.json`:
```json
"logs": {
  "$uid": {
    ".read": "auth != null && auth.uid == $uid",
    ".write": "auth != null && auth.uid == $uid"
  }
}
```
**Token usage** — OpenRouter returns `usage.prompt_tokens` + `usage.completion_tokens` in the response body. Parse and log these.

### 4. Admin tab (PIN: 240514) — move AI Brain here
**What:** Add a 4th tab `admin` to `src/routes/Toolbelt.tsx`. PIN-gate it. Move ModelPicker out of the public `model` tab and into admin only.  
**New file:** `src/features/toolbelt/AdminPanel.tsx`  
**PIN state:** Add to rootStore (in-memory only, resets on refresh — do NOT persist to localStorage):
```ts
adminUnlocked: boolean
unlockAdmin: () => void
lockAdmin: () => void
```
**PIN UI:** 6 dot display + numpad (0-9 + backspace). On correct PIN → show admin content. On wrong → shake + clear.  
**Admin panel sections:**
- AI Brain (ModelPicker, now dynamic — see #5)
- Stats (see #6)
- Recent logs viewer (last 20 entries from Firebase `logs/{uid}`)

**Toolbelt tab change:**  
- Remove `model` tab from the 3-tab bar kids see
- Replace with `admin` tab (shows PIN gate)
- Tabs after change: `gadgets | assistant | admin`

**Persist selectedModel to localStorage** (so admin's choice survives refresh):
```ts
// In rootStore, change:
selectedModel: localStorage.getItem('mission_room_model') ?? DEFAULT_MODEL_ID,
setSelectedModel: (model) => {
  localStorage.setItem('mission_room_model', model);
  set({ selectedModel: model });
},
```

### 5. Dynamic OpenRouter model list (replace hardcoded `AVAILABLE_MODELS`)
**New file:** `src/lib/useOpenRouterModels.ts`
```ts
// Fetch from https://openrouter.ai/api/v1/models (no auth needed for GET)
// React Query, staleTime: 5min
// Sort: free models first, then alphabetical by name
// Mark free: model.pricing.prompt === '0' && model.pricing.completion === '0'
```
**AdminPanel ModelPicker** should use this hook instead of the static `AVAILABLE_MODELS`.  
Keep `AVAILABLE_MODELS` in `src/lib/models.ts` as a fallback if the fetch fails (or just show an error state).

### 6. Stats / observability in Admin panel
**What:** Aggregate the Firebase logs for display in the admin panel.  
**New hook:** `src/lib/useAdminStats.ts` — reads `mission_hq/logs/{uid}` (last 100 entries), computes:
- Total AI calls
- Fallback count + % 
- Model breakdown (calls per model)
- Estimated total tokens used
- Last error message + time

**Display:** Simple grid of stat cards in AdminPanel, plus a scrollable list of the last 20 log entries (event, model, tokens, latency, timestamp).

---

## Key File Map (for next session context)

| File | Purpose |
|---|---|
| `src/adapters/ai/openrouter-adapter.ts` | OpenRouter API calls — ADD fallback + logging here |
| `src/adapters/index.ts` | Wires adapters — no change needed |
| `src/lib/models.ts` | Static model list — ADD `FREE_FALLBACK_MODEL_ID` |
| `src/lib/ai.ts` | Shim — no change needed |
| `src/features/toolbelt/ModelPicker.tsx` | Current static model picker — will be replaced by dynamic one in AdminPanel |
| `src/routes/Toolbelt.tsx` | Tab controller — ADD admin tab, REMOVE model tab |
| `src/stores/rootStore.ts` | Global state — ADD adminUnlocked slice, persist selectedModel |
| `src/routes/ParentDashboard.tsx` | Currently a stub — leave alone (not the admin panel) |
| `database.rules.json` | RTDB rules — ADD logs path |

## OpenRouter API Notes

- Models endpoint: `GET https://openrouter.ai/api/v1/models` (public, no auth required)
- Response shape: `{ data: Array<{ id, name, description, context_length, pricing: { prompt, completion } }> }`
- Free model marker: `pricing.prompt === "0"` AND `pricing.completion === "0"`
- Usage in response: `data.usage.prompt_tokens` + `data.usage.completion_tokens`
- Error codes: 402 = no credits, 429 = rate limit, 503 = model down

## Implementation Order (avoid breaking build at each step)

1. Add `FREE_FALLBACK_MODEL_ID` to `models.ts` ← zero risk
2. Add logger.ts + update RTDB rules ← zero risk (no existing callers)
3. Update openrouter-adapter.ts (fallback + logging) ← isolated, test manually
4. Add `useOpenRouterModels.ts` ← zero risk (new file)
5. Add AdminPanel.tsx + PinGate ← new component, no existing deps
6. Update rootStore.ts (add slices, persist model) ← careful, test that existing state still works
7. Update Toolbelt.tsx (swap tabs) ← last, touches UI kids use
8. Add graceful error UI to ModuleChat + NewMission ← polish pass
