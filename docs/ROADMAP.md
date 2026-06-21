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
- [x] Redis instance running — switched from Redis Cloud to local **Redis Stack** (`brew install redis-stack-server`, not plain `redis`) after (1) Redis Cloud showed repeated `ETIMEDOUT` errors including one that silently dropped a real session write, and (2) plain Homebrew `redis` doesn't include the RediSearch module needed for `FT.CREATE`/vector search at all — only Redis Stack or managed Redis Cloud bundle it. Started manually (not via `brew services`, since cask services aren't managed that way) — needs a manual restart if the machine reboots.
- [x] Install `redis` (the original spec said `@redis/client`, but that's the bare core client — vector search (`.ft.create`/`.ft.search`) requires the full `redis` package, which bundles the search module)
- [x] Add `REDIS_URL` to `.env.local` and `.env.example` (currently `redis://localhost:6379`)
- [x] Create `src/lib/redis.ts` — singleton client with keep-alive + auto-reconnect-on-error (added after live testing surfaced real connection drops)

#### Passage vector index
- [x] Create `src/lib/passageVectors.ts`. **Simplified from the original 7-field schema** to just what's actually used:
  ```
  {
    passageId: string,
    title: string,
    complexity: number,   // 0-1
    register: number,     // 0-1
    vector: [complexity, register]   // 2D, not the originally-sketched 5D — see note below
  }
  ```
  The vector is 2D rather than 5D because the recommendation logic (below) only ever moves along the complexity/register axes — the other 3 skill dimensions (wcpm/pause/self-correction) have no corresponding PassageMap axis, so a 5D passage vector would carry 3 dimensions nothing ever searches on.
- [x] No fixed "9 passages" to pre-seed — Phase 5 replaced the fixed grid with infinite on-demand generation. Instead, `generate-passage/route.ts` stores each passage's vector incrementally, fire-and-forget, the moment it's created. The library grows as more passages get generated; KNN search runs against whatever's accumulated so far.
- [x] Index uses **FLAT** not HNSW (HNSW is for >1M vectors; this library will have at most a few hundred). Found and fixed a real bug during testing: the schema initially only declared `complexity`/`register`/`vector` fields, so `FT.SEARCH`'s `RETURN` couldn't fetch `passageId`/`title` (came back as literal `"undefined"` strings) — fixed by adding explicit TEXT schema fields for them.
- [x] **Verified live**: ran a real session, confirmed the generated passage's vector landed in Redis correctly, confirmed `FT.SEARCH` KNN correctly found it as the nearest match to its own coordinates, and confirmed it correctly returns `null` when nothing is within a useful distance (~0.1) of the target.

#### Session error profile vector
- [x] `src/lib/sessionVector.ts`'s `computeSkillVector` (built in an earlier round) — 5 dimensions: `[complexityHandling, registerHandling, wcpmPercentile, pausePlacementScore, selfCorrectionRate]`. No `dominantErrorType` field was added — `weakestDimensionLabel()` in `passageVectors.ts` covers the same need (identify the weakest dimension) without a separate categorical field.
- [x] "Optimal next passage" target logic resolved two open design questions the original spec didn't address, per user decision:
  1. **Non-map-axis weakness** (wcpm/pause/self-correction is weakest): target stays at the current passage's exact position — no fake heuristic mapping onto complexity/register, since there's no real relationship to encode. Claude's existing exercise recommendations address it directly instead.
  2. **Direction of movement**: only escalate (step further into the weak axis) when the session's recommendation was "advance." On "retry," stay put — more reps at the same difficulty, not a harder version of what they're already struggling with.
  - Implemented as `computeNextTarget()` in `passageVectors.ts`, hand-verified against 5 scenarios (escalate complexity, escalate register, non-map weakness stays put, retry stays put, escalation clamps at 1.0) — all matched exactly.

#### KNN search
- [x] After each session, compute the skill vector and the optimal next-passage target (`diagnose/route.ts`)
- [x] Run KNN search against the passage index for the single closest match (simplified from k=3 — only the top match is ever used, so there was no reason to fetch and discard two more)
- [x] Pass the recommendation to Claude in the diagnostic prompt, including the nearest existing match's title when one is found within a useful distance
- [x] **Verified live end-to-end**: hit the real `/api/diagnose` route with real session data. Confirmed the response correctly included the computed target, the matched existing passage, and confirmed Claude's own generated reasoning explicitly referenced the right thing — *"directly targeting the one dimension — self-correction rate — that has shown zero growth across both sessions."*
- [x] Auto-generate a fresh passage when no close match exists — extracted the passage-generation logic out of `generate-passage/route.ts` into a shared `src/lib/generatePassage.ts` so `diagnose/route.ts` can call it directly (no internal HTTP round-trip). `findNearestPassage` now also fetches the *full* stored passage (text/words/grade/targetWCPM), not just the search-indexed fields, via a follow-up `JSON.GET` — needed so an "existing" match can actually be served to the reader without regenerating. Also excludes the passage just read from counting as its own recommendation.
- [x] **Verified live** (2026-06-20): ran a real session whose weakest dimension was `pausePlacementScore` (non-map-axis) — confirmed the target correctly stayed at the current passage's exact position, confirmed KNN correctly rejected the one other existing passage (too far, ~0.34 distance vs. the 0.1 threshold), and confirmed the auto-generated fallback passage landed at the *exact* target coordinates.

#### Agent memory
- [x] Generate persistent `readerId` via `crypto.randomUUID()` stored in localStorage — `page.tsx`
- [x] Store each session's error profile vector + metrics in Redis — exact schema below. Implemented in `src/lib/redis.ts` (singleton client), `src/lib/sessionVector.ts` (pure `computeSkillVector`, offline-verified by hand), `src/app/api/session/route.ts` (writes `reader:{readerId}:sessions:{sessionId}` + appends to `reader:{readerId}:sessionIndex`, both TTL 30 days). **Live-verified** (2026-06-20): ran a real session, confirmed the actual Redis document and index list match the schema exactly. This same mechanism also satisfies the "Longitudinal error tracking" storage bullets below — see note there.
- [x] On each new session fetch full history and switch Claude prompt mode accordingly — implemented as 3 modes (snapshot/comparison/pattern-recognition), not just a single `>= 3` cutoff. See "Longitudinal error tracking" below for the implementation and live-verification notes.

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

**Note**: this example schema is the original spec — actual implementation diverged (see "Passage vector index" above). Passages are not pre-seeded; each one is stored incrementally the moment `generate-passage` creates it, and the vector is 2D (`[complexity, register]`) rather than 5D, since the recommendation logic only ever searches on those two axes. Actual shape:

`passage:{passageId}` →
```json
{
  "passageId": "uuid",
  "title": "The Saturday Market",
  "complexity": 0.37,
  "register": 0.32,
  "text": "...",
  "words": ["Every", "Saturday", ...],
  "grade": 5,
  "targetWCPM": 142,
  "source": "AI Generated",
  "vector": [0.37, 0.32]
}
```

#### UI updates
- [x] `DiagnosticReport.tsx` — "Your next passage" card (title + plain-language complexity/register descriptors + weakest dimension, "Read this passage →" button that loads the recommendation directly via `handleAcceptRecommendation` in `page.tsx`, no regeneration needed). Skipped the literal "mini 2D grid" — the PassageMap arrow below already shows position visually, a second mini-map would be redundant.
- [x] `PassageMap.tsx` — `recommendedPosition` prop draws a dashed blue arrow + arrowhead from the current pin to the recommended position, only when they differ meaningfully (>6px)
- [x] `DiagnosticReport.tsx` — "Reading history" timeline (WCPM/accuracy per session with ↑/↓/→ trend arrows vs. the previous session), shown whenever 2+ sessions exist (not gated to exactly "3+" like the original spec — the data is just as valid at 2, comparison mode already explains it)
- [x] **Verified**: visually confirmed all three (arrow, history, card) render correctly with mock data via a temporary test route + screenshots, confirmed the card's accept button fires correctly, then confirmed the full real-data path end-to-end via the live session above (3rd passage in the index, 2 sessions in history)

#### Demo story for judges
> "Redis isn't caching here. It's powering a real-time vector search across a 2D skill space — complexity and register — to find the pedagogically optimal next reading challenge based on where this reader's errors are concentrated. The recommendation isn't just 'harder' — it's 'harder in the right dimension.'"

#### Verification
- [x] Confirmed `FT.CREATE` index creation works against real Redis Stack (synthetic test, then live)
- [x] Confirmed non-map-axis weakness (selfCorrectionRate lowest, then separately pausePlacementScore lowest) correctly keeps the target at the current passage's exact position — both via 2 separate real sessions
- [x] Confirmed KNN correctly rejects a too-far existing passage and falls through to auto-generation, landing at the exact target coordinates
- [x] Confirmed 5 real sessions correctly shift Claude's language from snapshot → comparison → pattern-recognition (see "Longitudinal error tracking" below)
- [ ] **Gap**: map-axis weakness (complexityHandling or registerHandling lowest, with "advance" recommendation) escalating in the right direction has only been verified via `computeNextTarget`'s pure-function hand test — not yet confirmed through a full real session + live `/api/diagnose` call. Worth doing before the demo if there's time, since it's the literal "harder, in the right dimension" headline behavior.

### Deepgram depth
- [x] Switched streaming model from `nova-2` to `nova-3` in `src/lib/deepgram.ts` for better transcription accuracy
- [x] Capture confidence scores from Deepgram word objects — if confidence < 0.75 on an error word, flag as `"uncertain"` instead of `"error"` in the alignment output to avoid penalizing transcription noise (threshold raised from 0.7 → 0.75 as part of accent fairness work, below)
  - [x] Implemented in `alignment.ts` for both the substitution branch and both insertion branches (originally only substitutions were covered — a live test surfaced a confidence-0.21 insertion still counting as a real error; fixed via a shared `isLowConfidence()` helper)
  - [x] **Verified live** (2026-06-20): read a real passage, inspected raw aligned output. Low-confidence substitutions (0.41–0.57) correctly downgraded to `uncertain`; high-confidence substitutions (0.89–0.99) correctly stayed `substitution`; confirmed fix against the exact low-confidence insertion case found live

### Accent fairness
Children shouldn't be penalized for accent. Two changes:
- [x] `src/lib/deepgram.ts` — `language: 'en-US'` → `'en'` (accent-agnostic English recognition instead of optimizing for American pronunciation norms specifically)
- [x] Confidence threshold raised from 0.7 → 0.75 (see "Deepgram depth" above — same mechanism, just a stricter cutoff so more borderline-confidence words get treated as uncertain rather than a confirmed error)
- [x] `src/lib/metrics.ts` — added `uncertainCount` as a real `Metrics` field (computed from `aligned`), and fixed a real bug found along the way: the accuracy denominator (`totalExpected`) excluded `insertion` status but not `uncertain`, so an uncertain word was silently dragging accuracy down despite not counting as any error type. Now excluded from both.
- [x] `src/app/api/diagnose/route.ts` — passes `uncertainCount` to Claude as its own line, separate from the error taxonomy, instructing Claude not to reference uncertain words as errors (they may reflect accent variation or background noise, not a reading mistake)
- [x] `src/components/PassageDisplay.tsx` — uncertain words show an "unclear audio" tooltip on hover. Started with the native HTML `title` attribute (confirmed present in the DOM, but native tooltips proved unreliable — delay-sensitive, sometimes suppressed by the OS); replaced with an instant custom CSS tooltip instead
- [x] `docs/project_spec.md` — added the accent-fairness note to Engineering Rules
- [x] **Verified live** (2026-06-21): ran two real sessions with deliberately unclear pronunciation — confirmed multiple words rendered gray/italic (not red), confirmed the count matched what was visually shown, confirmed the custom tooltip appears instantly on hover

### Disfluency detection — dropped
Explored using Deepgram's `filler_words` param to distinguish verbal hesitations ("um"/"uh") from silent pauses. Dropped for two reasons: (1) `filler_words` is only supported in **streaming** mode for the base `Nova` model and `Flux` — confirmed via docs and a live test that `nova-3` + `filler_words: true` returns zero filler tokens; (2) more fundamentally, filler words are a feature of spontaneous speech (stalling while generating novel content), not oral reading aloud (the words are already on the page — a struggling reader decodes or pauses, doesn't search for words). `ErrorCounts.hesitations` stays a single gap-based count.

### Self-correction as first-class signal
- [x] Update `src/lib/metrics.ts` — compute self-correction rate as its own top-level metric: `selfCorrections: number`, `totalErrors: number`, `selfCorrectionRate: number` (0–1). Currently buried in the error log; needs to be a named field Claude explicitly receives
- [x] Update `src/lib/types.ts` — add `selfCorrectionRate: number` to the `Metrics` interface
- [x] Update `src/app/api/diagnose/route.ts` — add self-correction to the Claude prompt as a distinct positive signal, not part of the error section. Prompt instructs Claude: if self-correction rate ≥ 20%, explicitly praise it before addressing errors
- [x] Update `DiagnosticReport.tsx` — show self-corrections as a separate stat card with positive visual treatment (green, upward arrow icon), distinct from error metrics (red/yellow). Never group it with errors visually. Verified in browser (2026-06-20): card renders "N self-corrections / X% of errors caught and fixed" when selfCorrections > 0, and is absent entirely at 0
- [ ] **Verification:** simulate a session with 3 self-corrections, confirm Claude report leads with explicit praise for self-corrections before addressing remaining errors

### Longitudinal error tracking (diagnostic arc)
- [x] Generate persistent `readerId` + store each session in Redis — same mechanism as "Agent memory" above (Redis AI Integration section), built once and shared by both roadmap items. See that section for implementation details and live-verification notes.
- [x] On each new session fetch full history for this `readerId` before calling Claude (`fetchPriorSessions` in `diagnose/route.ts`, gracefully degrades to snapshot mode on any Redis error)
- [x] Three prompt modes implemented (more granular than the original 2-mode spec): **snapshot** (0 prior sessions, unchanged existing behavior), **comparison** (1 prior — explicit "what improved/regressed" framing), **pattern-recognition** (2+ priors — persisting/worsening/resolving language). History is passed to Claude as a markdown table (WCPM/accuracy/error counts/boundary%/self-correction% per session) rather than prose lines — switched after an early test showed Claude misstating a historical number; the table + an explicit "re-read every number from the table, don't recall from memory" instruction fixed it.
- [x] Update `DiagnosticReport.tsx` — "Reading history" timeline. Built and verified — see "UI updates" in the Redis AI Integration section above (built together with the next-passage card since both render in the same component).
- [x] **Verified live** (2026-06-20): ran 5 real sessions in sequence. Confirmed snapshot → comparison → pattern-recognition mode switches correctly at each threshold, confirmed the session count and history table are accurate, and confirmed Claude's report correctly cited every number from a 5-session table with zero errors after the table-format fix. Also found and fixed a real race condition along the way: `page.tsx` was firing the session-log write before awaiting `diagnose`, so a fast Redis write could complete before `diagnose`'s history fetch ran, making a session see itself as its own prior. Fixed by reordering so `diagnose` always runs first.

**Infra note**: switched from Redis Cloud to a local Homebrew-installed Redis instance (`REDIS_URL=redis://localhost:6379`) after the cloud instance showed repeated `ETIMEDOUT` errors (including one that silently dropped a real session write). Local Redis has been completely stable. Worth deciding before the demo whether to stay local (simpler, no internet dependency) or move back to cloud (more "real" for judges) — `redis.ts` now also has keep-alive + auto-reconnect-on-error handling either way.
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
