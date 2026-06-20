# Fluently — Changelog

## [Unreleased]

---

## 2026-06-20 — Phase 2 Complete
- Built `src/lib/alignment.ts`: Levenshtein DP with clean traceback, substitution priority on ties, normalization (lowercase, strip punctuation)
- Built `src/lib/metrics.ts`: WCPM, error counts, hesitation detection (>500ms gaps), pause placement via compromise.js (sentence + clause boundaries)
- Verified offline: all four statuses correct, WCPM/accuracy/hesitation/boundary detection all passing

## 2026-06-20 — Phase 1 Complete
- Built `src/lib/deepgram.ts`: WebSocket streaming, is_final filtering, mic access, CloseStream on stop
- Fixed word timestamp field: Deepgram returns `end` not `duration` — compute `duration = end - start`
- Built `src/components/AudioRecorder.tsx`: start/stop button, token fetch from API route, live timer, error display
- Wired AudioRecorder into `page.tsx` with raw word stream debug panel
- Verified live: 25 words with correct timestamps, durations, and pause gaps captured

## 2026-06-20 — Project Initialized
- Created project structure and all foundation docs
- Defined full product spec, architecture, roadmap
- Defined tech stack: Next.js 14, TypeScript, Tailwind, Deepgram, compromise.js, Anthropic SDK
- Defined key parameters: 60s session, 500ms hesitation threshold, nova-2 model, grade levels 2/4/6
