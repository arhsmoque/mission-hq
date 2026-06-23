---
artifact_kind: progress_report
schema_version: 1
created_at: 2026-06-17
author: claude-sonnet-4-6
system: mission-hq
lifecycle: current
---

# Mission HQ — Cumulative Agent Progress Report

Self-contained context document for any agent picking up this codebase.
Do NOT need to re-upload historical trace files — everything is captured here.

---

## 1. What This App Is

**Mission HQ** is an adaptive AI-powered learning platform for three specific Malaysian primary school children: Asma (Tahun 3, SRJKC), Aflah (Tahun 1), Haidar (Tahun 5, KAFA). Ages 7–12.

**Core philosophy:** AI as scaffolding, never as answer machine. Every architectural decision (Socratic chat, two-pass evaluation, parent review gate, safety filter) enforces that the child does the thinking.

**Stack:** Vite + React 19 + TypeScript + TailwindCSS v4 + Firebase RTDB + Cloudflare Workers + Gemini + OpenRouter.

**Architecture pattern:** Ports & Adapters (hexagonal). `src/ports/` defines contracts. `src/adapters/` provides implementations. Swapping a provider = editing `src/adapters/index.ts` only.

---

## 2. Core Workflows

### Workflow A — Quick Worksheet Mission
1. Child/parent uploads worksheet photo → `NewMission.tsx`
2. OCR via Gemini vision (Cloudflare Worker proxy) → fallback to Tesseract.js
3. AI breaks content into 3–8 Socratic modules → `useGenerateModules()`
4. Child works through modules with Socratic tutor chat → `MissionView.tsx` / `ModuleChat.tsx`
5. Tutoring policy enforces hint escalation, rapid-attempt blocking, PIN-gated answer reveal

### Workflow B — Flipbook/PDF Lesson (Multi-page textbooks)
1. Admin adds AnyFlip/FlipHTML5/PDF URL to resource directory
2. Worker proxy fetches pages, Gemini Vision extracts Markdown → stored permanently in Firebase
3. Two-pass AI generation: Pass 1 (Gemini Flash, temp 0.3) generates activities; Pass 2 (Gemini Pro, temp 0.1) evaluates against rubric
4. Retry up to 2x with issues as constraints; persistent failure → `needs_review` for parent
5. Parent reviews/approves in `LessonBuilder.tsx` (PIN-gated)
6. Child plays in `LessonPlayer.tsx` (locked until `parentReviewed: true`)

### Workflow C — Daily Agenda (Campaigns)
Campaigns group sessions (review/practice/quiz) scheduled by deadline. `Today.tsx` surface aggregates them. AI generates session content on demand, cached in Firebase.

---

## 3. Route Map

| Route | Component | Status |
|---|---|---|
| `/` | Dashboard | ✅ Complete |
| `/new-mission` | NewMission | ✅ Complete |
| `/mission/:missionId` | MissionView | ✅ Complete |
| `/today` | Today | ✅ Complete |
| `/chinese-lab` | ChineseLab | ✅ Complete |
| `/lesson-builder` | LessonBuilder | ✅ Complete |
| `/lesson/:lessonId` | LessonPlayer | ✅ Complete |
| `/toolbelt` | Toolbelt | ✅ Complete |
| `/parent` | ParentDashboard | ❌ Stubbed ("Phase 6") |

---

## 4. Key File Locations

| Concern | File |
|---|---|
| AI prompts | `src/lib/prompts.ts` |
| Safety filter (Socratic enforcement) | `src/lib/safety.ts` |
| Two-pass lesson generation | `src/lib/lessonGenerator.ts` |
| Teaching method seeds | `src/lib/methodSeeds.ts` |
| Method registry (cache + selectBestMethod) | `src/lib/methodRegistry.ts` |
| Tutoring policy state machine | `src/features/mission/tutoringPolicy.ts` |
| Adapter wiring (single swap point) | `src/adapters/index.ts` |
| Gemini adapter (Cloudflare Worker proxy) | `src/adapters/ai/gemini-adapter.ts` |
| OpenRouter adapter | `src/adapters/ai/openrouter-adapter.ts` |
| Firebase RTDB missions/chat | `src/adapters/storage/firebase-rtdb-adapter.ts` |
| Firebase lessons adapter | `src/adapters/storage/firebase-lessons-adapter.ts` |
| Firebase analytics adapter | `src/adapters/analytics/firebase-analytics-adapter.ts` |
| Companion status subscription | `src/lib/localCompanionStatus.ts` |
| localStorage adapter (offline) | `src/lib/localDb.ts` (exists, unwired) |
| Cloudflare Worker routes | `src/worker.ts` |
| Global state (Zustand) | `src/stores/rootStore.ts` |
| All data types | `src/types/index.ts` |
| Firebase RTDB rules | `database.rules.json` |
| Build plan (5 stages) | `BUILDPLAN.md` |
| Design journal | `JOURNAL.md` |
| This document | `docs/agent-progress-report.md` |

---

## 5. Agent History & What Each Did

### Claude (Jun 5) — Session Handoff to Kimi
Found and documented 4 bugs; salvaged `src/lib/localDb.ts` (localStorage adapter, 146 lines) from a deleted local variant. All 4 bugs were subsequently fixed:
- BUG-1: Cache invalidation key missing `uid` → fixed
- BUG-2: Gamification state not persisted across refresh → fixed (localStorage per profile)
- BUG-3: Safety filter only ran on responses <150 chars → fixed (length gate removed)
- BUG-4: RTDB paths used `profileId` string (`asma`) not Firebase `uid` → fixed

### Kimi (Jun 10) — Guardrails + Lesson UI
- Fixed critical: AI judge parse failure was `overallPass = true` → changed to `false`
- Added Zod schema validation (`LessonSectionOutputSchema`) to lesson generation
- Added `regenerateSection()` exported function
- Added `EvaluationAttempt` interface + `evaluationLog`/`parentNotes` to `LessonSection` type
- Wrote `LessonBuilder.tsx` and `LessonPlayer.tsx`

### Codex (Jun 11) — OpenRouter Hardening + Tutoring Policy
- Added `fetchWithTimeout.ts` (20s default, 45s for OCR)
- Added `AppErrorBoundary.tsx` (prevents blank crash screens)
- Added full tutoring policy: intent classification, light/specific/guided hints, worked example, rapid-attempt blocking (90s lockout), parent-PIN answer reveal
- Added OpenRouter gateway improvements: JSON mode detection, timeout, gateway fallback headers
- Added deterministic OCR-to-basic-mission fallback when AI generation fails

### Gemini (Jun 14) — Architecture Study + Hardening (LOCAL ONLY — NEVER PUSHED)
Gemini did a thorough architecture study, identified gaps, then implemented hardening changes **locally on `D:\ARH-GITHUB\mission-hq`** but **never committed or pushed**. These changes were lost. The only Jun 14 commit that made it into the repo is `c5dd275` (agy companion script + safety updates).

**Lost changes that need re-implementation:**
1. `useChat.ts` + `useMission.ts` → refactor from React Query single-poll to real-time `onValue` subscriptions
2. OpenRouter 402/429/5xx → retry with free fallback model
3. Evaluation pass → upgrade from `gemini-2.5-flash` to `gemini-2.5-pro`
4. Robust JSON extraction in `lessonGenerator.ts` (regex `{...}` before `JSON.parse`)
5. `redirect: 'manual'` SSRF hardening in `worker.ts` proxy routes
6. `isAnyCompanionOnline()` + companion-first AI routing in `src/adapters/index.ts`

### Claude (Jun 17) — This Session
- Performed comprehensive codebase audit, synthesized all agent history
- Re-implemented all 6 lost Gemini hardening fixes
- Added CPA + 5E teaching method seeds to `methodSeeds.ts`
- Updated `JOURNAL.md`
- Wrote this document

---

## 6. Current Implementation Status

### ✅ Complete and Working
- Missions: upload → OCR → modules → Socratic chat → completion
- Lesson generation: two-pass AI (generate + evaluate), retry, parent review gate, child player
- Chinese tools: pinyin annotation, translation, vocab bank, flashcard quiz
- Daily agenda: campaigns, sessions (review/practice/quiz activities)
- Gamification: badges, gadgets, XP (profile-persisted in localStorage)
- Safety filter: blocks direct number answers, textual answers, spelled-out numbers
- Tutoring policy: hint escalation, rapid-attempt lockout, PIN-gated reveal
- Adapter pattern: clean ports, all Firebase wired, AI provider swappable at runtime
- Worker: Gemini + OpenRouter proxies, CORS image proxy for AnyFlip/FlipHTML5
- Tests: safety filter, tutoring policy, mission normalization (23 tests passing)
- Teaching methods: Bloom's Taxonomy + CPA Approach + 5E Inquiry (seeded Jun 17)
- Real-time subscriptions: `useChatMessages`, `useMission`, `useAllMissions` (fixed Jun 17)

### ⚠️ Partial / Stubbed
- `localDb.ts` — localStorage adapter exists, imported nowhere (dead code)
- Analytics-driven method selection — `selectBestMethod()` falls back to Bloom's (effectiveness scores never accumulate because `completeSession()` is not called in `LessonPlayer.tsx`)
- Spaced repetition — `VocabEntry` has `reviewCount`/`nextReview` fields; no SM-2 algorithm
- Parent Dashboard (`/parent`) — placeholder "Phase 6"

### ❌ Not Started
- Semantic answer guard (replace naive number filter with `expectedAnswer` fuzzy match)
- Structured tutoring JSON output (`{ reasoning, intent, responseMode, assistantMessage }`)
- Secure/mutable parent PIN (currently hardcoded `240514` in `src/config.ts`)
- Anonymous → permanent account promotion (`linkWithCredential` flow)
- Human-in-the-loop lesson editor (Edit button for `needs_review` sections)
- Analytics aggregation wiring in `LessonPlayer.tsx`
- Method effectiveness dashboard (admin view)
- Export/print lessons or missions

---

## 7. Known Technical Debt

| Debt | Location | Severity |
|---|---|---|
| Admin PIN `240514` hardcoded in bundle | `src/config.ts` | High — visible in DevTools |
| `localDb.ts` unwired | `src/lib/localDb.ts` | Medium — offline mode unreachable |
| Analytics never accumulate | `LessonPlayer.tsx` missing `completeSession()` call | Medium — method selection always Bloom's |
| Safety filter: textual answer leakage | `src/lib/safety.ts` | Medium — non-numeric answers not caught |
| Safety filter: collateral wipeout | `src/lib/safety.ts` | Medium — Socratic hints with numbers get wiped |
| No SM-2 for vocab | `ChineseLab.tsx` / `FlashcardQuiz.tsx` | Low |
| Firebase free tier limits | Infrastructure | Low for now, watch if multi-family |
| `src/adapters/storage/` — heavy Firebase cast | Multiple adapters | Low |

---

## 8. Teaching Methods in Registry

As of Jun 17, three methods are seeded:

| Method ID | Name | Best For | Bloom Level |
|---|---|---|---|
| `blooms_taxonomy` | Bloom's Taxonomy | All subjects | 1–6 (cognitive hierarchy) |
| `cpa_approach` | Concrete-Pictorial-Abstract | Primary maths | N/A (3 phases: physical → visual → symbolic) |
| `five_e_inquiry` | 5E Inquiry Model | Science, language comprehension | N/A (5 phases: Engage → Explore → Explain → Elaborate → Evaluate) |

**Important:** Existing deployments that already seeded Bloom's only need the localStorage key `mhq_methods_seeded` cleared (or changed to `mhq_methods_seeded_v2`) to trigger re-seeding with all three methods. The `seedMethodsIfEmpty()` function now uses `mhq_methods_seeded_v2` key.

---

## 9. Security Notes

- Firebase keys are public by design (Firebase anonymous auth + RTDB rules restrict access)
- Gemini and OpenRouter API keys live in Cloudflare Worker env secrets (`GEMINI_API_KEY`, `OPENROUTER_API_KEY`) — not in client bundle
- Admin PIN `240514` IS in client bundle (in `src/config.ts`) — this is a known issue, not yet fixed
- RTDB rules: all mission/lesson/chat data scoped to `uid`; resources/methods shared across auth users
- SSRF: `proxy-image` and `fetch-page` worker routes use `redirect: 'manual'` (fixed Jun 17) and allowlist domains

---

## 10. Priority Next Steps for Any Agent

**P1 — Wire analytics aggregation (30 min)**
In `src/routes/LessonPlayer.tsx`, call `analyticsAdapter.completeSession()` when user completes a section. This is the missing link that makes method auto-selection work.

**P2 — Human-in-the-loop lesson editor (2h)**
Add "Edit Activities" button in `LessonBuilder.tsx` for sections with `status === 'needs_review'`. Opens a textarea with raw JSON; parent can fix and force-approve. Removes the infinite regeneration loop.

**P3 — Secure parent PIN (3h)**
Move `240514` from `src/config.ts` to Firebase `mission_hq/parentConfigs/{uid}/pinHash` (SHA-256). Add "Change PIN" panel in `Toolbelt.tsx` admin section.

**P4 — Semantic safety filter (4h)**
During module generation, have AI output a hidden `expectedAnswer` field per module (stored in Firebase, not rendered to child). Replace number-scan in `safety.ts` with fuzzy semantic comparison against `expectedAnswer`.

**P5 — Account permanence (2h)**
Add `linkWithCredential` (email/password or Google) flow in `ProfilePicker.tsx`. Prevents data loss on browser clear.
