# Mission HQ — Build Plan
**Created:** 2026-06-09  
**Branch:** `claude/app-design-architecture-ai-jb1r10`

## Vision

Expand Mission HQ from a homework-chunking tool into a full adaptive learning platform. A parent or teacher uploads a PDF workbook; the system extracts, structures, and stores the content permanently in Firebase; Gemini applies a chosen teaching methodology to generate lesson materials; analytics measure which methods work best per child per subject; the registry of teaching methods is expandable without code changes.

---

## Architecture Principles

1. **Adapter-driven** — all new features follow the existing ports/adapters pattern; swap providers by editing `src/adapters/index.ts` only
2. **Methods as data** — teaching methodologies live in Firebase, not in code; adding a new method = writing a document
3. **Process once, reuse forever** — PDF content is extracted and stored in RTDB on first upload; Gemini never re-reads the PDF
4. **Guardrails through structure** — each teaching method carries its own output schema and evaluation rubric; probabilistic output is constrained by deterministic validation
5. **Human review gate** — all AI-generated lesson materials require parent approval before children see them

---

## Stage Map

| Stage | Name | Status |
|---|---|---|
| 1 | Data Layer Foundation | ✅ Complete |
| 2 | PDF Ingestion Pipeline | ⬜ Not started |
| 3 | Teaching Method Engine | ⬜ Not started |
| 4 | Lesson UI + Parent Review | ⬜ Not started |
| 5 | Analytics + Feedback Loop | ⬜ Not started |

---

## Stage 1 — Data Layer Foundation

**Goal:** Define every type, port, and adapter needed by all future stages. No UI. No AI calls. Just the data contracts and Firebase wiring.

### Files Created
| File | Purpose |
|---|---|
| `src/types/index.ts` | Add `TeachingMethod`, `LessonPhase`, `Lesson`, `LessonSection`, `LessonActivity`, `AnalyticsSession` |
| `src/ports/lesson-port.ts` | `MethodRegistryPort`, `LessonStoragePort`, `AnalyticsPort` interfaces |
| `src/adapters/storage/firebase-methods-adapter.ts` | RTDB adapter for teaching method registry |
| `src/adapters/storage/firebase-lessons-adapter.ts` | RTDB adapter for PDF-sourced lessons |
| `src/adapters/analytics/firebase-analytics-adapter.ts` | RTDB adapter for session event recording |
| `src/lib/methodSeeds.ts` | Bloom's Taxonomy seed document + seeder function |

### Files Modified
| File | Change |
|---|---|
| `src/adapters/index.ts` | Wire new adapters: `methodRegistry`, `lessonStorage`, `analyticsAdapter` |
| `database.rules.json` | Add RTDB rules for `teachingMethods`, `lessons`, `analytics` |

### Firebase RTDB Paths Added
```
mission_hq/
  teachingMethods/{methodId}          ← global registry, auth-read / admin-write
  lessons/{uid}/{lessonId}            ← per-user PDF lessons
  analytics/
    sessions/{uid}/{sessionId}        ← per-user session events
    effectiveness/{methodId}/{subject} ← aggregated (Stage 5)
```

---

## Stage 2 — PDF Ingestion Pipeline

**Goal:** User uploads a PDF; system extracts a TOC and per-section Markdown via Gemini; content is stored permanently in Firebase. The PDF is never needed again for lesson generation.

### New Files
| File | Purpose |
|---|---|
| `src/lib/pdfIngestion.ts` | Orchestrates the two-phase Gemini extraction |
| `src/lib/validators.ts` (update) | Add `tocSchema`, `lessonSectionSchema` |
| `src/lib/prompts.ts` (update) | Add `buildTocPrompt()`, `buildSectionMarkdownPrompt()` |
| `src/worker.ts` (update) | Add `/api/ai/pdf-toc` and `/api/ai/pdf-section` routes |
| `src/adapters/ai/gemini-adapter.ts` (update) | Add `extractPdfToc()` and `extractSectionMarkdown()` to `AIPort` |
| `src/ports/ai-port.ts` (update) | Extend `AIPort` with PDF methods |

### Two-Phase Gemini Strategy
```
Phase 1 — Structure (one call, temp 0.1):
  PDF file → Gemini Files API → TOC JSON { sectionId, title, level, pageStart }

Phase 2 — Content (parallel calls per section, temp 0.1):
  PDF section range → Gemini → Markdown text

Result stored in Firebase lessons/{uid}/{lessonId}
  sections[].markdown = full extracted text (permanent)
  sections[].status = "raw"
```

### Storage Strategy
- Original PDF → Firebase Storage at `lessons/{uid}/{lessonId}/original.pdf`
- Gemini Files API = temporary processing only (48h TTL, irrelevant after extraction)
- All subsequent Gemini calls use stored Markdown text, never the PDF again

---

## Stage 3 — Teaching Method Engine

**Goal:** Given a lesson section's Markdown and a chosen teaching method, generate structured learning activities via a two-pass Gemini pattern (generate → evaluate). Output is validated against the method's schema.

### New Files
| File | Purpose |
|---|---|
| `src/lib/methodRegistry.ts` | Load methods from Firebase, cache 5min, auto-select best by analytics |
| `src/lib/lessonGenerator.ts` | Two-pass generate + evaluate; retry logic; fallback |
| `src/lib/prompts.ts` (update) | Add `buildLessonActivityPrompt()`, `buildEvaluationPrompt()` |
| `src/lib/validators.ts` (update) | Dynamic Zod validator built from method's `outputSchema` |

### Two-Pass Generation Pattern
```
Pass 1 — Generate (temp 0.3):
  method.systemPrompt + section.markdown → Gemini → activities JSON

Pass 2 — Evaluate (temp 0.1):
  activities JSON + method.evaluationRubric → Gemini → { checks, overallPass, issues }

If overallPass = false:
  Retry Pass 1 with issues appended as constraints (max 2 retries)
  If still failing: flag section as "needs_review" for parent

On success:
  Write section.activities to Firebase
  Set section.status = "generated"
```

### Method Auto-Selection (uses Stage 5 analytics)
```ts
methodRegistry.selectBestMethod(subject, profileId)
  → reads analytics/effectiveness/{methodId}/{subject}
  → returns methodId with highest unaided_completion_rate
  → falls back to "blooms_taxonomy" if no data
```

---

## Stage 4 — Lesson UI + Parent Review

**Goal:** A new `/lesson-builder` route where parents upload PDFs and children work through generated lessons. Parent review gate enforced before child access.

### New Files
| File | Purpose |
|---|---|
| `src/routes/LessonBuilder.tsx` | Main lesson management page |
| `src/routes/LessonView.tsx` | Child-facing lesson player |
| `src/features/lesson/PdfUploadDropzone.tsx` | PDF upload with progress |
| `src/features/lesson/TocNavigator.tsx` | Sidebar TOC for lesson sections |
| `src/features/lesson/SectionViewer.tsx` | Renders section Markdown + activities |
| `src/features/lesson/ParentReviewGate.tsx` | PIN/approval UI before lesson goes live |
| `src/features/lesson/MethodPicker.tsx` | Select teaching method per section |
| `src/features/lesson/useLesson.ts` | React Query hooks for lesson state |

### Parent Review Gate
- Lessons with `parentReviewed: false` show a lock screen to children
- Parent enters PIN (same 240514 as admin) to review + approve
- On approval: `lesson.parentReviewed = true`, `section.status = "approved"`
- Children only see `status === "approved"` sections

---

## Stage 5 — Analytics + Feedback Loop

**Goal:** Track how children perform with each teaching method per subject. Aggregate effectiveness scores. Surface in admin dashboard. Enable auto-selection of best method.

### New Files
| File | Purpose |
|---|---|
| `src/lib/useAnalytics.ts` | React hooks: start session, record hint, complete session |
| `src/lib/useMethodEffectiveness.ts` | Subscribe to aggregated effectiveness scores |
| `src/features/toolbelt/LessonStats.tsx` | Admin panel section: method effectiveness grid |

### Analytics Events Recorded
| Event | When | Data |
|---|---|---|
| `session_start` | Child opens a lesson section | lessonId, sectionId, methodId, subject |
| `hint_requested` | Child asks for help | sessionId, chatTurn |
| `session_complete` | Child marks section done | sessionId, timeMs, chatTurns, completedWithoutHelp |

### Effectiveness Aggregation
- Runs client-side on session completion (Firebase transactions)
- Updates `analytics/effectiveness/{methodId}/{subject}`:
  - `completionRate`, `avgChatTurns`, `avgTimeToCompleteMs`, `unaidedCompletionRate`
- Admin dashboard reads these and ranks methods per subject
- `methodRegistry.selectBestMethod()` uses this data for auto-selection

---

## Implementation Notes

### Adding a New Teaching Method
1. Write a `TeachingMethod` document to `mission_hq/teachingMethods/{methodId}` in Firebase
2. No code changes required
3. The method becomes available in `MethodPicker` automatically
4. Analytics will begin tracking it immediately

### Supported Teaching Frameworks (planned)
| Method ID | Framework | Best For |
|---|---|---|
| `blooms_taxonomy` | Cognitive | All subjects (Stage 1 seed) |
| `5e_inquiry` | Inquiry | Science, discovery topics |
| `cpa_approach` | Constructivist | Maths (Concrete → Pictorial → Abstract) |
| `socratic_dialogue` | Socratic | Language, reasoning (already used in chat) |
| `spaced_repetition` | Behavioural | Vocabulary, facts |
