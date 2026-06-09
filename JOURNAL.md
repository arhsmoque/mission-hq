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
