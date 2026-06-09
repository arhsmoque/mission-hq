# Changelog

All notable changes to Mission HQ are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added — Stage 3: Teaching Method Engine

- **`src/lib/methodRegistry.ts`** — 5-minute client-side cache over Firebase method adapter; `selectBestMethod(subject)` falls back to Bloom's Taxonomy (Stage 5 will wire analytics-driven selection)
- **`src/lib/lessonGenerator.ts`** — `generateLesson()` orchestrator: builds sections from TOC + PAGE markers, runs two-pass Gemini (generate at temp 0.3 → evaluate at temp 0.1), retries up to twice with evaluation issues as extra constraints, saves all sections to Firebase
- **`src/lib/prompts.ts`** — `buildLessonActivityPrompt()` and `buildEvaluationPrompt()` for the two-pass engine
- **`src/main.tsx`** — `seedMethodsIfEmpty()` called on first authenticated session (seeds Bloom's Taxonomy once)
- **`src/features/toolbelt/ResourceDirectory.tsx`** — Generate Lesson button on extracted resources: profile picker (Asma/Aflah/Haidar), live progress (preparing → generating section N/total → done)

### Added — Stage 2: AnyFlip / FlipHTML5 Extraction Pipeline

- **`src/worker.ts`** — `GET /api/resource/proxy-image` CORS proxy (allowlist: AnyFlip, FlipHTML5 domains); returns `{ found, base64, mimeType }` for safe client-side fetching
- **`src/worker.ts`** — `POST /api/ai/extract-pages` batch vision endpoint; accepts up to 8 page images, makes a single multi-image Gemini call, returns extracted text + token usage
- **`src/lib/resourceExtractor.ts`** — Full orchestration: binary-search page probing (up to 300 pages), 8-page batch extraction loop, Gemini-powered TOC generation, Firebase save
- **`src/features/toolbelt/ResourceDirectory.tsx`** — Extract button for flipbook resources (pending/error state); live progress labels (probing → extracting page N/total → generating TOC → saving); collapsible TOC preview once ready
- **`src/types/index.ts`** — `ResourceEntry.extractedContent` field (`{ fullText, toc }`)

### Added — Stage 1: Data Layer Foundation

- **`src/types/index.ts`** — New domain types: `TeachingMethod`, `MethodPhase`, `EvaluationCriteria`, `LessonTocEntry`, `LessonSection`, `LessonActivity`, `Lesson`, `AnalyticsSession`
- **`src/ports/lesson-port.ts`** — Three new port interfaces: `MethodRegistryPort`, `LessonStoragePort`, `AnalyticsPort`
- **`src/adapters/storage/firebase-methods-adapter.ts`** — Firebase RTDB adapter for the teaching method registry (global, auth-read)
- **`src/adapters/storage/firebase-lessons-adapter.ts`** — Firebase RTDB adapter for PDF-sourced lessons (per-user)
- **`src/adapters/analytics/firebase-analytics-adapter.ts`** — Firebase RTDB adapter for analytics session events
- **`src/lib/methodSeeds.ts`** — Bloom's Taxonomy seed document and `seedMethodsIfEmpty()` bootstrap function
- **`BUILDPLAN.md`** — Full five-stage implementation plan with file maps, architecture decisions, and design principles
- **`JOURNAL.md`** — Development journal

### Modified — Stage 1

- **`src/adapters/index.ts`** — Wired three new adapters: `methodRegistry`, `lessonStorage`, `analyticsAdapter`
- **`database.rules.json`** — Added RTDB security rules for `teachingMethods`, `lessons`, `analytics`

---

## [0.3.0] — 2026-06-05

### Added
- Cloudflare Workers + Assets deployment (replaces Pages)
- GitHub Actions CI/CD pipeline auto-deploying on push to `master`
- Gemini adapter replacing OpenRouter as primary AI provider
- Worker-side API proxy (`/api/ai/chat`, `/api/ai/ocr`) keeping `GEMINI_API_KEY` out of the browser bundle
- Tesseract.js fallback OCR when Gemini vision is unavailable

### Fixed
- Cloudflare API token misconfiguration preventing first deploy
- `.node-version` set to `20` (Vite 8 requires Node ≥ 20.19)

---

## [0.2.0] — 2026-05-20

### Added
- Chinese language lab: pinyin annotation, Malay/English translation, vocab bank, flashcard quiz
- Gamification: badges on mission completion, gadgets unlocked by progress
- Toolbelt: Hint Machine, Vocab Definer, Error Spotter, and three additional gadgets
- Three child profiles (Asma, Aflah, Haidar) with per-profile state persistence

---

## [0.1.0] — 2026-05-01

### Added
- Initial release: worksheet image upload → OCR → AI module generation → per-module Socratic chat
- Firebase RTDB for missions, chat, vocab, progress
- Firebase Anonymous Auth
- Adapter-driven architecture with ports for AI and storage
- Socratic safety filter blocking direct numeric answers
