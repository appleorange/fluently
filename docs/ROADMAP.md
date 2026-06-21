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

- [x] Self-correction detection (error followed immediately by correct word) — `detectSelfCorrections` in `metrics.ts`
- [x] Loading states, error handling, edge cases (page.tsx)
  - [x] Diagnose API errors now surface to the user — `handleSessionEnd` checks `!res.ok || data.error` and throws into the existing catch instead of silently rendering a broken/empty report on Claude failures
  - [x] Fixed stuck-session bug: stopping (manually or via the 60s auto-timeout) with zero words recorded previously left the timer running and mic open forever with no feedback; now stops cleanly and shows "No speech detected. Please try again."
  - [x] Stale error banner now clears when a new recording starts
- [ ] Mobile-responsive layout
- [ ] Demo rehearsal: 60-second reading → full report flow under 90 seconds total
- [ ] Identify best demo passage (something with interesting errors likely — medium complexity, formal register)
- [ ] **Verification:** full end-to-end demo works 3 times in a row without breaking

### Redis AI Integration (Beyond Caching) — targeting Redis sponsor prize
Core concept: Redis vector search finds the optimal next passage across both complexity and register axes simultaneously, based on the reader's current error profile. This is not "find a harder passage" — it's "find the passage in our 2D skill space that targets your specific weak points."

#### Setup
- [ ] Sign up for Redis Cloud at redis.io/try-free (free tier)
- [ ] Install `@redis/client`
- [ ] Add `REDIS_URL` to `.env.local` and `.env.example`
- [ ] Create `src/lib/redis.ts` — initialize client, verify connection

#### Passage vector index
- [ ] Create `src/lib/passageVectors.ts` — defines the vector schema for each passage:
  ```
  {
    passageId: string,
    complexity: number,        // 0-1 Flesch-Kincaid normalized
    register: number,          // 0-1 casual→formal
    avgSentenceLength: number,
    latinateRatio: number,     // Latinate vocab density
    functionWordDensity: number,
    syntacticDepth: number,    // from compromise.js
    targetWCPM: number,
    tolerances: {
      substitution: number,    // acceptable error rate for this passage
      omission: number,
      pausePlacement: number   // target boundary hit rate
    }
  }
  ```
- [ ] Pre-compute vectors for all 9 PassageMap passages and seed Redis on app startup if index doesn't exist
- [ ] Create HNSW vector index in Redis on the passage vector fields

#### Session error profile vector
- [ ] Create `src/lib/sessionVector.ts` — derives a reader's current skill vector from session metrics:
  ```
  {
    complexityHandling: number,   // derived from error rate on polysyllabic words
    registerHandling: number,     // derived from function word error rate
    wcpmPercentile: number,       // WCPM relative to grade benchmark
    pausePlacementScore: number,  // % pauses at syntactic boundaries
    dominantErrorType: string,    // substitution | omission | insertion | hesitation
    selfCorrectionRate: number
  }
  ```
- [ ] The "optimal next passage" vector is computed as: current skill vector + a small step in the direction of weakest dimension. If `registerHandling` is lowest, step right on Y axis. If `complexityHandling` is lowest, stay on X axis. Never step in both directions simultaneously.

#### KNN search
- [ ] After each session, compute the session error profile vector and the optimal next passage vector
- [ ] Run KNN search (k=3) against the passage index to find the 3 closest passages to the optimal next vector
- [ ] Return the top match as the recommended next passage
- [ ] Pass to Claude in the diagnostic prompt: "Based on this reader's error profile, the optimal next passage is [title] — it targets [specific weakness] while keeping [strength dimension] stable"

#### Agent memory
- [ ] Generate persistent `readerId` via `crypto.randomUUID()` stored in localStorage
- [ ] Store each session's error profile vector + metrics in Redis — exact schema below
- [ ] On each new session fetch full history — if `sessionCount >= 3` switch Claude to longitudinal prompt mode

**Exact Redis storage schema:**

Two data structures per reader:

`reader:{readerId}:sessions:{sessionId}` — full JSON document, one per session:
```json
{
  "sessionId": "uuid",
  "readerId": "uuid",
  "timestamp": 1718900000,
  "passageId": "grade4-formal",
  "passageGrade": 4,
  "passageComplexity": 0.6,
  "passageRegister": 0.8,
  "metrics": {
    "wcpm": 94,
    "accuracy": 91,
    "durationSeconds": 58,
    "correctWords": 87,
    "totalWords": 96
  },
  "errorCounts": {
    "substitutions": 4,
    "omissions": 3,
    "insertions": 1,
    "hesitations": 7
  },
  "errorDetail": [
    {
      "type": "substitution",
      "expected": "observed",
      "got": "saw",
      "posExpected": "verb",
      "posGot": "verb",
      "semanticClass": "same",
      "syntacticContext": "clause-boundary"
    },
    {
      "type": "omission",
      "expected": "the",
      "got": null,
      "posExpected": "determiner",
      "syntacticContext": "mid-phrase"
    }
  ],
  "pausePlacement": {
    "totalPauses": 11,
    "atBoundary": 4,
    "midPhrase": 7,
    "boundaryPercent": 36
  },
  "selfCorrections": 2,
  "selfCorrectionRate": 0.22,
  "skillVector": [0.71, 0.38, 0.62, 0.36, 0.22]
}
```

`reader:{readerId}:sessionIndex` — lightweight ordered list of sessionIds in chronological order for efficient history retrieval without key scanning

`skillVector` is a 5-dimensional float array, always in this order:
```
[
  complexityHandling,   // 1 - (error rate on polysyllabic words)
  registerHandling,     // 1 - (function word error rate)
  wcpmPercentile,       // wcpm / grade benchmark capped at 1.0
  pausePlacementScore,  // boundaryPercent / 100
  selfCorrectionRate    // selfCorrections / totalErrors, 0 if no errors
]
```

Passage vectors seeded once at startup, stored as:

`passage:{passageId}` →
```json
{
  "passageId": "grade4-formal",
  "title": "The Observatory",
  "complexity": 0.6,
  "register": 0.8,
  "vector": [0.6, 0.8, 0.71, 0.82, 0.34]
}
```

#### UI updates
- [ ] After `DiagnosticReport` renders, show "Your next passage" card: title, complexity/register position on a mini 2D grid, and one sentence from Claude explaining why this passage was chosen
- [ ] Show the reader's current position on the PassageMap 2D canvas and the recommended next position as an arrow

#### Demo story for judges
> "Redis isn't caching here. It's powering a real-time vector search across a 2D skill space — complexity and register — to find the pedagogically optimal next reading challenge based on where this reader's errors are concentrated. The recommendation isn't just 'harder' — it's 'harder in the right dimension.'"

#### Verification
- [ ] Seed all 9 passage vectors into Redis manually, confirm index created
- [ ] Run a session with high function word errors, confirm recommended next passage moves right on register axis not up on complexity axis
- [ ] Run a session with high polysyllabic substitutions, confirm recommended next passage stays at current register but reduces complexity
- [ ] Run 3 sessions with same readerId, confirm Claude shifts to longitudinal language on session 3

### Deepgram depth
- [x] Switched streaming model from `nova-2` to `nova-3` in `src/lib/deepgram.ts` for better transcription accuracy
- [x] Capture confidence scores from Deepgram word objects — if confidence < 0.7 on an error word, flag as `"uncertain"` instead of `"error"` in the alignment output to avoid penalizing transcription noise
  - [x] Implemented in `alignment.ts` for both the substitution branch and both insertion branches (originally only substitutions were covered — a live test surfaced a confidence-0.21 insertion still counting as a real error; fixed via a shared `isLowConfidence()` helper)
  - [x] **Verified live** (2026-06-20): read a real passage, inspected raw aligned output. Low-confidence substitutions (0.41–0.57) correctly downgraded to `uncertain`; high-confidence substitutions (0.89–0.99) correctly stayed `substitution`; confirmed fix against the exact low-confidence insertion case found live

### Disfluency detection — dropped
Explored using Deepgram's `filler_words` param to distinguish verbal hesitations ("um"/"uh") from silent pauses. Dropped for two reasons: (1) `filler_words` is only supported in **streaming** mode for the base `Nova` model and `Flux` — confirmed via docs and a live test that `nova-3` + `filler_words: true` returns zero filler tokens; (2) more fundamentally, filler words are a feature of spontaneous speech (stalling while generating novel content), not oral reading aloud (the words are already on the page — a struggling reader decodes or pauses, doesn't search for words). `ErrorCounts.hesitations` stays a single gap-based count.

### Self-correction as first-class signal
- [x] Update `src/lib/metrics.ts` — compute self-correction rate as its own top-level metric: `selfCorrections: number`, `totalErrors: number`, `selfCorrectionRate: number` (0–1). Currently buried in the error log; needs to be a named field Claude explicitly receives
- [x] Update `src/lib/types.ts` — add `selfCorrectionRate: number` to the `Metrics` interface
- [x] Update `src/app/api/diagnose/route.ts` — add self-correction to the Claude prompt as a distinct positive signal, not part of the error section. Prompt instructs Claude: if self-correction rate ≥ 20%, explicitly praise it before addressing errors
- [x] Update `DiagnosticReport.tsx` — show self-corrections as a separate stat card with positive visual treatment (green, upward arrow icon), distinct from error metrics (red/yellow). Never group it with errors visually. Verified in browser (2026-06-20): card renders "N self-corrections / X% of errors caught and fixed" when selfCorrections > 0, and is absent entirely at 0
- [ ] **Verification:** simulate a session with 3 self-corrections, confirm Claude report leads with explicit praise for self-corrections before addressing remaining errors

### Longitudinal error tracking (diagnostic arc)
- [ ] Generate persistent `readerId` via `crypto.randomUUID()` stored in localStorage on first visit in `page.tsx`
- [ ] After each session store error log in Redis under key `reader:{readerId}:sessions` as append-only list, TTL 30 days. Each entry: `{sessionId, passageId, passageGrade, wcpm, accuracy, errorCounts, selfCorrectionRate, timestamp}`
- [ ] On each new session fetch full history for this `readerId` before calling Claude. Pass session count to diagnose route
- [ ] If `sessionCount < 3`: use existing snapshot prompt ("here is what happened today")
- [ ] If `sessionCount >= 3`: switch to longitudinal prompt — pass aggregated error history and instruct Claude to identify which error types are persisting, worsening, or resolving. Example structured input to Claude:
  ```
  Session 1: 6 function word omissions, 2 at clause boundary
  Session 2: 4 function word omissions, 3 at clause boundary
  Session 3: 8 function word omissions, 5 at clause boundary
  Pattern: increasing rate at clause boundaries → prosodic chunking issue not attention
  ```
- [ ] Update `DiagnosticReport.tsx` — after 3+ sessions show a "Reading history" section above the current report with a simple timeline of WCPM and accuracy across sessions with trend arrows
- [ ] **Verification:** simulate 3 sessions manually by seeding Redis directly, confirm Claude report language shifts from snapshot to pattern recognition on the 3rd session

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
