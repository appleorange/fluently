# Fluently — Changelog

## [Unreleased]

---

## 2026-06-20 — Structured JSON API + DiagnosticReport action buttons
- Updated `src/lib/types.ts`: `DiagnosticResponse` now includes `recommendation` ('advance'|'retry'|'repeat') and `reasoning` (string)
- Updated `src/app/api/diagnose/route.ts`:
  - Prompt now asks Claude for JSON only (no markdown, no code fences)
  - Grade benchmarks: G2 90-110 WCPM, G4 125-145, G6 150-170, all ≥95% accuracy threshold
  - Server pre-computes `wcpmStatus` and `accuracyStatus`; Claude interprets flags, never does math
  - `parseClaudeResponse()` strips markdown fences, validates fields, applies safe fallbacks
  - Verified: test POST returned `{errorType:"decoding", recommendation:"repeat", reasoning:"..."}` ✓
- Updated `src/components/DiagnosticReport.tsx`:
  - New props: `recommendation`, `reasoning`, `onAdvance()`, `onRetry()`
  - "advance" → prominent green "Next passage →" + muted "or redo this passage" link
  - "retry"/"repeat" → prominent yellow "Try again" + muted "or advance anyway →" link
  - Reasoning shown in small gray text above buttons
  - No navigation logic inside component — callbacks from page.tsx
- Updated `page.tsx`: added `handleAdvance`/`handleRetry` stubs; wired to DiagnosticReport props

## 2026-06-20 — Phase 3 UI complete (DiagnosticReport + MetricsDashboard)
- Built `src/components/DiagnosticReport.tsx`
  - Props: `report: string`, `errorType: DiagnosticResponse['errorType']`
  - Error-type badge with color (fluent=green, phrasing=yellow, mixed=orange, decoding=red)
  - Paragraph rendering with inline **bold** support for Claude markdown output
- Built `src/components/MetricsDashboard.tsx`
  - Props: `metrics: Metrics`, `targetWCPM?: number`
  - WCPM, accuracy, duration stat cards with color-coded severity
  - Error breakdown as proportional CSS bars (no chart library)
  - Pause placement progress bar with boundary percentage label
- Both wired into page.tsx with mock data; verified in browser (all content present in rendered HTML)
- Git pulled from remote (friend's commit: next-env.d.ts + package-lock.json added)

## 2026-06-20 — PassageDisplay.tsx
- Built `src/components/PassageDisplay.tsx` — renders passage word-by-word as colored spans
- Props: `passage: Passage`, `wordStatuses: Map<number, WordStatus>` (matches types.ts exactly)
- Color scheme: green=correct, red=any error type, yellow=hesitation, gray=pending
- Exports `MOCK_PASSAGE` and `MOCK_WORD_STATUSES` for visual testing without live pipeline
- Wired into page.tsx with mock data; verified correct rendering via browser HTML inspection
- TypeScript check: no errors

## 2026-06-20 — Project Initialized
- Created project structure and all foundation docs
- Defined full product spec, architecture, roadmap
- Defined tech stack: Next.js 14, TypeScript, Tailwind, Deepgram, compromise.js, Anthropic SDK
- Defined key parameters: 60s session, 500ms hesitation threshold, nova-2 model, grade levels 2/4/6
