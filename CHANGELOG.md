# Changelog

All notable changes to Mission HQ are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

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
