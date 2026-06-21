# Fluently — Roadmap

## Status Key
- `[ ]` not started
- `[~]` in progress
- `[x]` complete

---

## Phase 1 — Foundation & Deepgram Streaming ✓
Goal: prove audio → word timestamps pipeline works before building anything on top of it

- [x] Next.js project initialized with TypeScript and Tailwind
- [x] `.env.local` configured with Deepgram + Anthropic keys
- [x] `src/lib/deepgram.ts` — browser-side Deepgram streaming client
  - [x] Microphone permission request
  - [x] WebSocket connection to Deepgram streaming API
  - [x] Returns only `is_final: true` word objects with `start`, `duration`, `word` fields
  - [x] Console.log verified: word timestamps printing correctly
- [x] `src/components/AudioRecorder.tsx` — start/stop recording button, passes word stream to parent
- [x] Basic page renders AudioRecorder, prints raw Deepgram output to screen
- [x] **Verification:** spoke 25 words, timestamps + durations + confidence all correct. Pause gaps correctly captured (hesitation detection data confirmed).

---

## Phase 2 — Levenshtein Alignment Pipeline ✓
Goal: deterministic scoring engine working offline before connecting to live audio

- [x] `public/passages/` — 3 hardcoded passages at grade levels 2, 4, 6 (from Project Gutenberg)
- [x] `src/lib/alignment.ts` — Levenshtein alignment function
  - [x] Normalize both strings (lowercase, strip punctuation) before comparing
  - [x] Return array of word objects: `{expected, got, status: correct|substitution|omission|insertion}`
  - [x] Tested offline with fake input before connecting to Deepgram
- [x] `src/lib/metrics.ts` — computes scoring from alignment output + timestamps
  - [x] WCPM (words correct per minute)
  - [x] Error count by type (substitution / omission / insertion)
  - [x] Hesitation detection (pause > 500ms between consecutive words)
  - [x] Pause placement analysis (pauses at syntactic boundaries vs mid-phrase via compromise.js)
- [x] **Verification:** offline test with fake aligned output — all statuses, WCPM, hesitation, and pause placement correct

---

## Phase 3 — Real-Time UI ✓
Goal: live reading session with word-by-word color coding

- [x] `src/components/PassageDisplay.tsx`
  - [x] Renders passage word by word as spans
  - [x] Colors update in real time as Deepgram returns words (via Map<number, WordStatus> prop)
  - [x] Green = correct, Red = error, Yellow = hesitation, gray = pending
  - [x] Smooth, readable layout — flowing text with subtle background highlights
  - [x] Verified rendering in browser with mock data (2026-06-20)
- [x] Connect Deepgram stream → alignment → PassageDisplay in real time
- [x] Session timer (counts up during reading, stops at 60 seconds or manual stop)
  - [x] Counts up in page.tsx state with setInterval ref
  - [x] Auto-stops at 60s, warns at 50s (amber color + countdown)
  - [x] Start Reading / Stop buttons with idle/recording/processing/results states
  - [x] Verified in browser (2026-06-20)
- [x] **Verification:** read passage live, words color-coded in real time, hesitations highlighted yellow, punctuation displayed correctly

---

## Phase 4 — Claude Diagnostic Report ✓
Goal: structured metrics → plain-language clinical report

- [x] `src/app/api/diagnose/route.ts` — POST endpoint
  - [x] Receives structured metrics JSON (never raw audio or transcript)
  - [x] Returns structured JSON: `{report, recommendation, reasoning}`
  - [x] Computes wcpmStatus/accuracyStatus from grade benchmarks (G2: 90-110, G4: 125-145, G6: 150-170)
  - [x] Claude makes advance/retry/repeat recommendation based on status flags
- [x] Prompt engineering: distinguishes decoding vs phrasing fluency, references student not character names
- [x] `src/components/DiagnosticReport.tsx` — advance/retry action buttons with reasoning
  - [x] Green "Next passage →" button when recommendation is "advance"
  - [x] Amber "Try again" button when recommendation is "retry" or "repeat"
  - [x] Muted secondary option always available (user can override recommendation)
  - [x] Reasoning shown in small gray text above buttons
- [x] `src/components/MetricsDashboard.tsx` — visual breakdown of WCPM, error types, pause placement
- [x] Confidence score filtering: low-confidence Deepgram words flagged as "uncertain" instead of definite errors
- [x] **Verified:** API returns valid JSON with correct recommendation logic

---

## Phase 5 — PassageMap (2D Passage Selector with AI Generation) ✓
Goal: replace the simple grade picker with a 2D canvas that generates unlimited passages on demand via Claude

### Concept
X-axis: **Complexity** — kindergarten (left) to adult 18+ proficiency (right)
Y-axis: **Register** — Casual at bottom (leisure/social), Formal at top (academic/professional)
The full register range implicitly encompasses: casual → friendly → networking → interview → formal

User drags a red-orange pin anywhere on the dotted canvas. On release, Claude generates a fresh ~70-word passage matching those coordinates. Spinner overlays canvas while generating; passage appears below. No fixed grid — unlimited variety.

### Tasks
- [x] `src/app/api/generate-passage/route.ts` — POST endpoint
  - [x] Receives `{ complexity: number, register: number }` (both 0–1)
  - [x] Translates coordinates into plain-English descriptors across 7 complexity tiers and 5 register tiers
  - [x] Prompts Claude to write a ~70-word prose passage with no dialogue, suitable for oral reading
  - [x] Returns `{ text, words, title, grade, targetWCPM, source, complexity, register }`
- [x] `src/components/PassageMap.tsx` — 2D SVG dotted canvas
  - [x] 360×360px SVG with dot grid (dot every 20px, slate-200 dots, r=2)
  - [x] Red-orange draggable pin (r=8, #f97316, drop shadow) — bolder than grid dots
  - [x] Pointer capture for smooth mouse + touch drag
  - [x] Spinner overlay while generating, canvas locked during generation
  - [x] X-axis labels: "Easy" / "Difficult"; Y-axis labels: "Formal" (top) / "Casual" (bottom) only
- [x] Replace grade picker in `page.tsx` with PassageMap
  - [x] Passage starts null — user must generate before Start Reading enables
  - [x] Map stays visible in idle and results states; hidden during recording/processing
  - [x] "Advance" clears passage so user picks a new harder position; "Retry" keeps same passage
- [x] Update diagnose prompt to reference complexity/register context — Claude now receives complexity tier and register descriptor, calibrates feedback accordingly (e.g. informality not penalised on casual passages)
- [x] **Verification:** 5 positions tested via API — distinct passages confirmed, complexity (grade 2→11, WCPM 74→186) and register (casual slang vs formal prose) both correct

---

## Phase 6 — Polish & Demo Prep
Goal: reliable, beautiful demo for judges

- [ ] Self-correction detection (error followed immediately by correct word)
- [ ] Loading states, error handling, edge cases
- [ ] Mobile-responsive layout
- [ ] Demo rehearsal: 60-second reading → full report flow under 90 seconds total
- [ ] Identify best demo passage (something with interesting errors likely — medium complexity, formal register)
- [ ] **Verification:** full end-to-end demo works 3 times in a row without breaking

### Redis session caching
- [ ] Sign up for Upstash at upstash.com, get REST URL and token
- [ ] Install `@upstash/redis`
- [ ] Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `.env.local` and `.env.example`
- [ ] `src/lib/redis.ts` — initialize Upstash Redis client, verify connection with a test read/write
- [ ] Update `src/app/api/diagnose/route.ts` — check Redis for previous attempt on same passage before calling Claude, include previous metrics in Claude prompt if found, store current attempt with 24hr TTL after Claude responds
- [ ] Update `DiagnosticReport.tsx` — if previous attempt exists in response, show comparison row above report ("Last attempt: 87 WCPM → This attempt: 94 WCPM" with green arrow if improved, red if regressed)
- [ ] Update `page.tsx` — generate `sessionId` with `crypto.randomUUID()` on first load, pass to diagnose API call
- [ ] **Verification:** do two reads of the same passage, confirm second report references the first attempt's metrics

### Deepgram depth
- [ ] Capture confidence scores from Deepgram word objects (already in the response, just not used) — if confidence < 0.7 on an error word, flag as `"uncertain"` instead of `"error"` in the alignment output to avoid penalizing transcription noise
- [ ] Enable disfluency detection in Deepgram params — detect verbal hesitations ("um", "uh", repetitions) as a second hesitation signal alongside timestamp gap detection. Pass disfluency count separately in the metrics object so Claude can distinguish verbal vs silent hesitations

### Self-correction as first-class signal
- [ ] Update `src/lib/metrics.ts` — compute self-correction rate as its own top-level metric: `selfCorrections: number`, `totalErrors: number`, `selfCorrectionRate: number` (0–1). Currently buried in the error log; needs to be a named field Claude explicitly receives
- [ ] Update `src/lib/types.ts` — add `selfCorrectionRate: number` to the `Metrics` interface
- [ ] Update `src/app/api/diagnose/route.ts` — add self-correction to the Claude prompt as a distinct positive signal, not part of the error section. Prompt should instruct Claude: if `selfCorrectionRate > 0`, explicitly praise it before addressing errors (e.g. "You caught and fixed 4 of your 6 errors — that metacognitive monitoring is a real strength."). If `selfCorrectionRate` is 0 and error count is high, note the absence as a signal worth working on
- [ ] Update `DiagnosticReport.tsx` — show self-corrections as a separate stat card with positive visual treatment (green, upward arrow icon), distinct from error metrics (red/yellow). Never group it with errors visually
- [ ] **Verification:** simulate a session with 3 self-corrections, confirm Claude report leads with explicit praise for self-corrections before addressing remaining errors

### Longitudinal error tracking (diagnostic arc)
- [ ] Extend Redis schema to store per-session error log: `{type, word, syntacticContext, passageId, timestamp}` per error instance, keyed by a persistent `readerId` (simple UUID stored in localStorage)
- [ ] After 3+ sessions, change the Claude diagnostic prompt from snapshot mode to longitudinal mode — pass the aggregated error history and ask Claude to identify which error types are persisting, worsening, or resolving across sessions
- [ ] Structured longitudinal input to Claude:
  ```
  Session 1: 6 function word omissions, 2 at clause boundary
  Session 2: 4 function word omissions, 3 at clause boundary
  Session 3: 8 function word omissions, 5 at clause boundary
  Pattern: increasing rate, concentrated at clause boundaries → prosodic chunking issue
  ```
- [ ] Update `DiagnosticReport.tsx` — after 3+ sessions show a "Reading history" section above the current report with a simple timeline of WCPM and accuracy across sessions
- [ ] Update `project_spec.md` to document the `readerId` localStorage key and Redis schema for longitudinal data
- [ ] **Verification:** simulate 3 sessions manually, confirm Claude report shifts from snapshot language to pattern language

---

## Session Log
| Session | Date | What was completed |
|---------|------|--------------------|
| 1 | 2026-06-20 | Project initialized, docs created |
| 2 | 2026-06-20 | Phase 1 complete — Deepgram streaming verified with live timestamps |

| 1 | — | Project initialized |
| 2 | 2026-06-20 | PassageDisplay.tsx — Phase 3 UI layer, word-by-word color coding component |
| 3 | 2026-06-20 | DiagnosticReport.tsx + MetricsDashboard.tsx — Phase 3 UI complete |
| 4 | 2026-06-20 | Reverted Phase 4 changes — API route and prompt engineering are friend's responsibility |

### Semantic substitution classification (stretch — add to Phase 6 if time allows)
- [ ] For each substitution error, classify whether the substituted word preserves semantic class ("dog" → "cat" = same class) vs. doesn't ("dog" → "the" = cross-class)
- [ ] Use compromise.js POS tagging: noun→noun / verb→verb = same class; noun→determiner etc. = cross-class
- [ ] Pass breakdown to Claude in metrics object — same-class = vocabulary gap, cross-class = decoding breakdown
- [ ] Update Claude diagnostic prompt to reference this distinction
