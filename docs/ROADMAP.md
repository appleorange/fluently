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

## Phase 3 — Real-Time UI
Goal: live reading session with word-by-word color coding

- [x] `src/components/PassageDisplay.tsx`
  - [x] Renders passage word by word as spans
  - [x] Colors update in real time as Deepgram returns words (via Map<number, WordStatus> prop)
  - [x] Green = correct, Red = error, Yellow = hesitation, gray = pending
  - [x] Smooth, readable layout — flowing text with subtle background highlights
  - [x] Verified rendering in browser with mock data (2026-06-20)
- [ ] Connect Deepgram stream → alignment → PassageDisplay in real time **[post-merge]**
- [x] Session timer (counts up during reading, stops at 60 seconds or manual stop)
  - [x] Counts up in page.tsx state with setInterval ref
  - [x] Auto-stops at 60s, warns at 50s (amber color + countdown)
  - [x] Start Reading / Stop buttons with idle/recording/processing/results states
  - [x] Verified in browser (2026-06-20)
- [ ] **Verification:** read passage live, see words color-coded correctly in real time **[post-merge]**

---

## Phase 4 — Claude Diagnostic Report
Goal: structured metrics → plain-language clinical report

- [ ] `src/app/api/diagnose/route.ts` — POST endpoint **[friend owns this]**
  - [ ] Receives structured metrics JSON (never raw audio or transcript)
  - [ ] Constructs diagnostic prompt with full error log
  - [ ] Returns Claude's plain-language report
- [ ] Prompt engineering: Claude must distinguish decoding vs phrasing fluency issues from structured data **[friend owns this]**
- [x] `src/components/DiagnosticReport.tsx` — renders report cleanly for parent/teacher
  - [x] Error-type badge (fluent/phrasing/mixed/decoding, color-coded)
  - [x] Paragraph rendering with **bold** support for Claude markdown
  - [x] Verified in browser with mock data (2026-06-20)
- [x] `src/components/MetricsDashboard.tsx` — visual breakdown of WCPM, error types, pause placement
  - [x] WCPM prominently displayed with color severity (green/yellow/red vs target)
  - [x] Accuracy + duration stat cards
  - [x] Error breakdown as CSS horizontal bars (substitutions/omissions/insertions/hesitations)
  - [x] Pause placement progress bar with boundary percentage
  - [x] Verified in browser with mock data (2026-06-20)
- [ ] **Verification:** submit fake metrics, get clinically meaningful report back **[after merge]**

---

## Phase 5 — PassageMap (2D Passage Selector)
Goal: replace the simple grade picker with a 2D draggable canvas that selects passages by complexity + register

### Concept
X-axis: **Complexity** (Flesch-Kincaid grade level, sentence length, syllable density)
Y-axis: **Register/Purpose** (formal ↔ casual — measured via contraction density, Latinate vs Germanic vocabulary, passive voice frequency)

The canvas has 9 pre-generated passages at a 3x3 grid of coordinates. Dragging snaps to the nearest passage — feels continuous, no generation latency.

### Passages to pre-generate (3x3 grid)
| | Casual | Neutral | Formal |
|---|---|---|---|
| **Simple** | friendly text message story | simple news story | simple government notice |
| **Medium** | social media thread | newspaper article | HR policy excerpt |
| **Complex** | dense internet/slang dialogue | academic abstract | legal contract clause |

### Tasks
- [ ] `src/lib/passageMap.ts` — register scoring functions
  - [ ] Contraction density (count contractions / total words)
  - [ ] Latinate vocabulary ratio (words with -tion, -ment, -ance, -ity suffixes)
  - [ ] Passive voice density (via compromise.js passive detection)
  - [ ] Flesch-Kincaid computation (already in spec — 1.015 × avg sentence length + 84.6 × avg syllables/word - 15.59)
  - [ ] `scorePassage(text): {complexity: number, register: number}` — returns normalized 0-1 coordinates
- [ ] `public/passages/` — expand to 9 passages covering the 3x3 grid, each with pre-computed x/y coordinates
  - [ ] Remove hardcoded `words` array from all passage files — derive from `text.split(/\s+/)` at runtime
- [ ] `src/components/PassageMap.tsx` — 2D draggable canvas
  - [ ] SVG or Canvas element, 400x400px
  - [ ] 9 passage dots plotted at their computed coordinates
  - [ ] Draggable crosshair snaps to nearest passage on drag
  - [ ] Selected passage highlighted, passage title + coordinates shown below
  - [ ] X-axis label: "Complexity →", Y-axis label: "Formal ↑ Casual ↓"
  - [ ] Quadrant labels: Simple Casual / Simple Formal / Complex Casual / Complex Formal
- [ ] Replace grade picker on main page with PassageMap component
- [ ] Claude diagnostic prompt updated to reference register context: "This was a [formal/casual] [simple/complex] passage — calibrate feedback accordingly"
- [ ] **Verification:** drag to each of the 9 positions, confirm correct passage loads each time

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
