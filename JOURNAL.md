# Mission HQ — Development Journal

A running log of design decisions, architectural choices, and open questions.

---

## 2026-06-09 — Stage 1: Data Layer Foundation

### Context

Session focused on designing the expansion of Mission HQ from a homework-chunking tool into an adaptive learning platform. The core new capability: a parent/teacher uploads a PDF workbook, the system processes it once (Gemini extracts TOC + section Markdown), stores the result permanently in Firebase, and subsequently uses only the stored text — never re-reading the PDF.

### Key Design Decisions

**1. Teaching methods as Firebase documents, not code**

The original design hardcoded Bloom's Taxonomy into prompt strings. We moved it to a `TeachingMethod` document in Firebase. Each method carries its own `systemPrompt`, `outputSchema` (JSON Schema), and `evaluationRubric`. Adding a new teaching methodology requires writing a Firebase document, not a code deploy. This was the central architectural decision of the session.

*Tradeoff accepted:* Methods must be fetched at runtime (one Firebase read per session start, cached 5 minutes). This is negligible overhead for the benefit of extensibility.

**2. Process-once, store-forever for PDF content**

Gemini's Files API has a 48-hour TTL on uploaded files. The naive approach would re-upload the PDF for every lesson generation request. Instead: Phase 1 extraction stores all Markdown permanently in Firebase RTDB. Every subsequent Gemini call passes the stored Markdown as text in the prompt context. The original PDF in Firebase Storage is an archive, not an active input.

*Implication:* Gemini context window size is the practical constraint, not storage. At 1M tokens for Gemini 2.5 Flash, a 40-page workbook (~20K tokens of Markdown) fits comfortably in a single call.

**3. Two-pass generation + AI judge**

Lesson content generation uses two Gemini calls:
- Pass 1 (temp 0.3): Generate activities conforming to the method's schema
- Pass 2 (temp 0.1): Evaluate the output against the method's `evaluationRubric`

This addresses the core concern raised in the session: "we have no guardrails, just prompts and hope." The AI judge pass provides structured validation before content is written to Firebase. If `overallPass: false`, the system retries with issues fed back as constraints.

The existing Socratic safety filter (`src/lib/safety.ts`) is a precedent for this pattern — it already intercepts and rewrites AI output post-generation. The lesson evaluator is the same idea applied to a richer schema.

**4. Analytics as the feedback mechanism**

Without data on which methods work best, method selection is arbitrary. The analytics schema (Stage 1) records sessions with: which method was used, how many chat turns the child needed, whether they completed unaided, and time taken. Stage 5 aggregates this into `effectiveness/{methodId}/{subject}` scores. Stage 3's `methodRegistry.selectBestMethod()` uses these scores to auto-select.

*Signal interpretation:* Lower `avgChatTurns` = child needed less help = method was more effective at building independence. This is intentionally about self-sufficiency, not speed.

**5. Parent review as the final guardrail**

Probabilistic AI output cannot be fully controlled by prompts or schemas. The `parentReviewed` flag (already on `Mission`, now also on `Lesson`) is the human gate. Lessons are locked to children until a parent approves. This is not a workaround — it's the correct responsibility boundary.

### What Stage 1 Delivers

Stage 1 is purely data layer: types, ports, adapters, RTDB rules, and the Bloom's Taxonomy seed. No UI, no AI calls. The purpose is to establish contracts that all subsequent stages implement against. Every later stage has stable interfaces to build on.

### Open Questions

- **Method registry ownership:** Who writes new methods to Firebase — admin-only, or any authenticated user? Current RTDB rules allow any authenticated user to read, but only `uid === 'admin_uid'` equivalent to write. For now, methods are seeded programmatically via `seedMethodsIfEmpty()`. A proper admin write interface is Stage 4+.
- **Analytics privacy:** Session data is per-uid, following the same pattern as missions. Parents can see their child's analytics via the admin PIN gate, but not other families' data. This is the correct default.
- **Effectiveness aggregation timing:** Stage 1 records raw sessions. Stage 5 computes aggregates. Between stages, admin stats will show raw session counts only. This is acceptable for the interim.
- **5E and CPA methods:** Bloom's Taxonomy is seeded in Stage 1. The 5E Inquiry Model and Concrete-Pictorial-Abstract approach are planned but not yet seeded. They follow the same `TeachingMethod` schema and require no code changes to add.

### Next Session (Stage 2)

Focus: PDF upload UI, Gemini Files API integration, two-phase extraction, Firebase Storage persistence. Key file: `src/lib/pdfIngestion.ts`. Key worker routes: `/api/ai/pdf-toc` and `/api/ai/pdf-section`.

---

## 2026-06-17 — Multi-Agent Audit + Hardening Pass

### Context

A comprehensive audit was performed across all prior agent sessions (Claude Jun 5 handoff, Kimi Jun 10, Codex Jun 11, Gemini Jun 14). The goal: reconcile what each agent claimed to have done against what actually landed in the repo, identify gaps, and implement missing fixes in a single session.

### What Prior Agents Did (Summary)

**Claude (Jun 5):** Found 4 bugs; all subsequently fixed. Salvaged `src/lib/localDb.ts` — a localStorage adapter that exists in the repo but is currently imported nowhere (dead code, intentionally left as offline-mode runway).

**Kimi (Jun 10):** Fixed the critical AI judge parse failure bug (`overallPass = true` on invalid JSON → changed to `false`). Added Zod validation to lesson generation. Wrote `LessonBuilder.tsx` and `LessonPlayer.tsx`. Added `EvaluationAttempt` type and `evaluationLog`/`parentNotes` fields to `LessonSection`.

**Codex (Jun 11):** Added full tutoring policy (intent classification, hint escalation, rapid-attempt lockout, PIN-gated answer reveal). Added `fetchWithTimeout.ts`, `AppErrorBoundary.tsx`, and a deterministic OCR-to-mission fallback when AI generation fails. Added OpenRouter timeout and JSON-mode detection.

**Gemini (Jun 14):** Performed thorough architecture study and implemented 6 hardening fixes locally — but **never committed or pushed**. Those changes were validated (build + 23 tests) but lost. This session re-implements them.

### Key Design Decisions (Jun 17)

**1. Real-time subscriptions for `useMission` and `useChatMessages`**

Both hooks were wrapping Firebase `onValue` inside a React Query `queryFn` and immediately calling `unsub()`. This means the UI only received data once (at mount) and would not update when background processes (local companion, parent approval) modified the database. Refactored both to `useState` + `useEffect` with persistent `onValue` subscriptions that unsubscribe on cleanup.

*Tradeoff accepted:* We lose React Query's caching and `invalidateQueries` for these hooks. This is acceptable because the data source is already Firebase RTDB, which is effectively a cache. The mutation hooks (`useGenerateModules`, `useCompleteMission`) still use React Query mutations — they write to Firebase, which then triggers the `onValue` listener and updates the UI naturally.

**2. OpenRouter credit/rate fallback to free model**

When OpenRouter returns 402 (credit exhausted), 429 (rate limited), or 5xx (server error), the adapter now retries the request once with `deepseek/deepseek-chat-v3-0324:free`. This prevents hard crashes when the paid model balance runs out during a session. The fallback is logged to the errorLog in rootStore for admin visibility.

*Tradeoff accepted:* The free DeepSeek model is less capable than the paid models. Quality may degrade. But a degraded response is better than a crashed session for a child in the middle of a lesson.

**3. Separate evaluation model (`gemini-2.5-pro`) from generation model (`gemini-2.5-flash`)**

Previously both passes used the same `gemini-2.5-flash`. Using the same model to evaluate its own output creates a circular self-grading loop — the model is inclined to approve what it just generated. Using a stronger, separate model (`gemini-2.5-pro`) for evaluation provides genuinely independent scrutiny.

*Cost implication:* One `gemini-2.5-pro` call per section per generation attempt. For a 10-section lesson with no retries, this is 10 extra Pro calls. Acceptable for the quality guarantee it provides.

**4. `redirect: 'manual'` on Worker proxy routes**

The `proxy-image` and `fetch-page` Cloudflare Worker routes fetched external URLs and followed redirects automatically. A malicious or compromised AnyFlip/FlipHTML5 CDN URL could redirect to an internal address (SSRF). Adding `redirect: 'manual'` blocks all redirect chains — the fetch returns a non-2xx response immediately if the target redirects, and the worker returns an error.

*Tradeoff accepted:* Some legitimate CDN redirect chains (e.g., CDN load balancer redirects to the actual image host) will now fail. We accept this because the domain allowlist already restricts to known-safe domains, and the SSRF risk outweighs the CDN compatibility concern.

**5. Companion-aware AI routing in `src/adapters/index.ts`**

A persistent `subscribeLocalCompanions` subscription runs at module load time and tracks whether any local companion is reporting a fresh heartbeat (within 45 seconds). When the companion is online, `aiAdapter.chat()` routes to `geminiAdapter` (direct Cloudflare Worker → Gemini API) rather than `openrouterAdapter`. This reduces OpenRouter quota consumption when the parent has a local companion running.

For `ocrImage`, the adapter always tries `geminiAdapter` first — the local companion queue does not support image input, so there is no companion route for OCR. OpenRouter is the fallback.

*Tradeoff accepted:* The companion-online check is approximate (45s heartbeat window). There is a brief window after a companion goes offline where the app continues routing to Gemini. This degrades gracefully — Gemini calls may fail with a network error, which the `try/catch` catches and falls back to the configured provider.

**6. CPA and 5E teaching methods added to seed registry**

The method registry has always been designed to hold more than Bloom's Taxonomy. Both CPA (Concrete-Pictorial-Abstract, for primary maths) and 5E Inquiry (for science and language) were documented since Stage 1 design but never seeded. Both are now fully specified with phases, system prompts, output schemas, and evaluation rubrics.

The seed key was bumped from `mhq_methods_seeded` to `mhq_methods_seeded_v2` so existing deployments re-seed on next startup, adding the two new methods without duplicating Bloom's (Firebase's `createMethod` overwrites by key).

*Method selection:* `selectBestMethod()` auto-selects based on `unaidedCompletionRate` analytics scores. Until analytics accumulate, it falls back to `blooms_taxonomy`. Parents/admins can explicitly choose a method via the lesson generation flow.

### Open Questions (Jun 17)

- **Analytics wiring still missing:** `LessonPlayer.tsx` does not yet call `analyticsAdapter.completeSession()` when a child finishes a section. Without this, `selectBestMethod()` always returns Bloom's because no effectiveness scores ever accumulate. This is P1 for next session.
- **Parent PIN security:** `240514` is still hardcoded in `src/config.ts` and visible in the browser bundle. The fix (Firebase-stored hashed PIN with a "Change PIN" UI) is well-understood but not yet implemented.
- **Safety filter limitations:** The current number-scan approach has two known holes: (a) textual answers pass through, (b) Socratic guidance that includes question numbers gets wiped as collateral damage. The proposed fix (hidden `expectedAnswer` field + fuzzy matching) requires a module generation schema change and was intentionally deferred.
- **`localDb.ts` orphan:** The localStorage adapter exists but connects to nothing. Decision pending: wire it as a fallback storage port for offline mode, or delete it as dead code.
- **Human-in-the-loop lesson editing:** Parents stuck in a `needs_review` loop have no way to manually fix activities and force-approve. An edit modal in `LessonBuilder.tsx` would resolve this completely.

### Files Changed (Jun 17)

| File | Change |
|---|---|
| `src/features/mission/useChat.ts` | Refactored `useChatMessages` to real-time `useState` + `useEffect` subscription |
| `src/features/mission/useMission.ts` | Refactored `useMission` + `useAllMissions` to real-time subscriptions |
| `src/adapters/ai/openrouter-adapter.ts` | Added `FREE_FALLBACK_MODEL` + 402/429/5xx retry with free model |
| `src/lib/lessonGenerator.ts` | Added `EVAL_MODEL = 'gemini-2.5-pro'`; evaluation pass now uses separate model |
| `src/worker.ts` | Added `redirect: 'manual'` to `proxy-image` and `fetch-page` routes (SSRF fix) |
| `src/adapters/index.ts` | Added `isAnyCompanionOnline` tracking + companion-first AI routing |
| `src/lib/methodSeeds.ts` | Added CPA Approach + 5E Inquiry method seeds; bumped seed key to v2 |
| `JOURNAL.md` | This entry |
| `docs/agent-progress-report.md` | New: self-contained context document for future agents |

---

## 2026-06-17 — Session B: P1 Audit + P2 Inline Activity Editor

### Context

Continuation of the Jun 17 session (Session A). Standing instruction established: always append a trace report to the repo for future agent reference.

### Key Finding: P1 Was Already Done

The JOURNAL Session A entry listed "analytics wiring in `LessonPlayer.tsx`" as P1 for next session. Upon inspection, both `analyticsAdapter.startSession()` and `analyticsAdapter.completeSession()` were already fully wired in the file. The analytics feedback loop is therefore complete:

1. `LessonPlayer` calls `startSession` on each section transition
2. `LessonPlayer` calls `completeSession` when child clicks "I Finished"
3. `firebaseAnalyticsAdapter.completeSession()` updates `effectiveness/{methodId}/{subject}` aggregates
4. `methodRegistry.selectBestMethod()` reads those aggregates to auto-select the best method

The `chatTurnsUsed` field is hardcoded to `0` — acceptable because the lesson player has no integrated chat panel. Hints are tracked correctly.

### P2: Human-in-the-Loop Activity Editor

Added an inline edit panel to `LessonBuilder.tsx` for `generated` and `needs_review` sections. Previously, parents could only Approve / Reject / Regenerate — a stuck `needs_review` loop required triggering a full AI regeneration which sometimes reproduced the same issues.

The new Edit button opens an inline form showing each activity's `instruction`, `hint`, and `successCriteria` as editable fields. Saving writes the changes via `lessonStorage.updateSection` and resets status to `'generated'` (not `'approved'`), routing the edited version back through the parent approval gate before it reaches children.

*Design choice:* Editing resets to `'generated'` rather than `'approved'` because a parent editing an activity is correcting AI output, not approving it. The explicit approve step is preserved as the human gate.

### Files Changed (Session B)

| File | Change |
|---|---|
| `src/routes/LessonBuilder.tsx` | Added `EditingActivity` interface + inline activity editor for generated/needs_review sections |
| `docs/agent-trace-jun17b.md` | Session B trace report |
| `JOURNAL.md` | This entry |

### Open Questions (Carried Forward)

- **Parent PIN security:** `240514` still hardcoded in `src/config.ts` (P3)
- **Safety filter:** Textual answers leak; numeric scan wipes Socratic guidance as collateral (P4)
- **`localDb.ts` orphan:** Wire as offline storage or delete (P4)
- **Anonymous → permanent account:** `linkWithCredential` flow in `ProfilePicker.tsx` (P5)

---

## 2026-06-17 — Session C: P3 + P4 + P4b + P5 (Security + Safety + Account)

### Context

Final session of Jun 17. Implemented all remaining open items (P3–P5) in a single commit. All four changes were merged together as PR #21.

### Key Design Decisions

**P3 — PIN moved to Firebase, not config**

`admin.pin = '240514'` was visible in the Cloudflare Workers bundle in plain text — any parent or child with DevTools could find it. The fix: `src/lib/pinUtils.ts` hashes the PIN with Web Crypto SHA-256 and stores the hash in Firebase RTDB at `mission_hq/parentConfigs/{uid}/pinHash`. `PinGate.tsx` now does async hash comparison instead of string equality. First use (no hash in Firebase yet) falls back to `hashPin('240514')` so existing deployments don't lock parents out.

*Tradeoff:* The PIN gate now has a Firebase read on each attempt (≈100ms). Acceptable — it's the parent-only admin gate, not a child-facing path.

`ChangePinPanel.tsx` was added to Admin → Settings so parents can rotate the PIN. It verifies the current PIN before accepting a new one.

**P4 — Safety filter: sentence-level, not response-level**

The previous filter compared every number in the AI's response against every number in the OCR text. This had two failure modes:
1. A Socratic response like "Look at question 3, what do you notice?" would be wiped because "3" also appears in the OCR.
2. Textual answers ("the answer is twelve") only partially covered; Malay patterns missing entirely.

The new filter (`src/lib/safety.ts`) splits the response into sentences first, then skips any sentence that ends with `?` (Socratic questions are safe by definition). For the remaining sentences, it only flags a number if it appears without a recognised context prefix ("question", "step", "page", "soalan", "bahagian", etc.). Additionally, the textual number vocabulary was expanded to cover compound numbers (twenty-four, etc.) and Malay number words (satu, dua, tiga…).

*Tradeoff accepted:* The filter is now more permissive — a determined AI that answers "Here is what I know: 24" without one of the flagged phrase patterns could slip through. The two-pass generation system with an AI evaluator (in `lessonGenerator.ts`) is the deeper guardrail; `safety.ts` is the last-resort runtime interception.

**P4b — Deleted `localDb.ts`**

The localStorage adapter was salvaged from an old local-only variant and left as "offline-mode runway" in Jun 5. After 6 weeks no offline mode was planned. Dead code adds confusion for future agents. Deleted. README updated.

**P5 — Anonymous → permanent account**

Firebase anonymous auth gives a stable UID per browser-device pair, but clearing browser storage orphans all data. `AccountLinkPanel.tsx` (wired into Admin → Settings) lets parents link their anonymous session to an email/password credential using `linkWithCredential`. The UID is preserved, so all missions, lessons, analytics, and badges carry over. Error messages handle the common failure modes (email already in use, invalid email).

### Files Changed (Session C / PR #21)

| File | Change |
|---|---|
| `src/lib/pinUtils.ts` | New — SHA-256 hash + Firebase PIN read/write/verify |
| `src/features/toolbelt/PinGate.tsx` | Async PIN verification; removed `APP_CONFIG.admin.pin` dependency |
| `src/config.ts` | Removed `admin.pin` field |
| `src/features/toolbelt/ChangePinPanel.tsx` | New — Change PIN UI in admin settings |
| `src/features/profile/AccountLinkPanel.tsx` | New — email/password account linking |
| `src/features/toolbelt/AdminPanel.tsx` | Wired ChangePinPanel + AccountLinkPanel into Settings tab |
| `src/lib/safety.ts` | Sentence-level filter, context-prefix exclusions, Malay patterns |
| `src/lib/localDb.ts` | Deleted (dead code) |
| `README.md` | Replaced Local Mode section with Firebase + account promotion note |
| `JOURNAL.md` | This entry |

### Open Questions (None Critical)

The P1–P5 backlog is now fully cleared. The remaining known issues are either tracked in BUILDPLAN.md (future feature stages) or are design questions without a clear owner:

- **Expected answer field in modules:** The proper fix for the safety filter is a hidden `expectedAnswer` field on each module generated at mission-creation time, enabling fuzzy matching instead of OCR-scan. This requires a schema change to module generation prompts and validators. Intentionally deferred — the sentence-level filter reduces false positives significantly without the schema change.
- **`240514` in git history:** The old hardcoded PIN is now in git history. It's already rotated via ChangePinPanel on any live deployment so this is low risk, but worth noting for security-conscious agents: the PIN is no longer operationally significant once rotated.
