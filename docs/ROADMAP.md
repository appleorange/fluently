# Fluently — Roadmap

## Status Key
- `[ ]` not started
- `[~]` in progress
- `[x]` complete

---

## Phase 1 — Foundation & Deepgram Streaming
Goal: prove audio → word timestamps pipeline works before building anything on top of it

- [ ] Next.js project initialized with TypeScript and Tailwind
- [ ] `.env.local` configured with Deepgram + Anthropic keys
- [ ] `src/lib/deepgram.ts` — browser-side Deepgram streaming client
  - [ ] Microphone permission request
  - [ ] WebSocket connection to Deepgram streaming API
  - [ ] Returns only `is_final: true` word objects with `start`, `duration`, `word` fields
  - [ ] Console.log verified: word timestamps printing correctly
- [ ] `src/components/AudioRecorder.tsx` — start/stop recording button, passes word stream to parent
- [ ] Basic page renders AudioRecorder, prints raw Deepgram output to screen
- [ ] **Verification:** speak 10 words, see 10 word objects with timestamps on screen

---

## Phase 2 — Levenshtein Alignment Pipeline
Goal: deterministic scoring engine working offline before connecting to live audio

- [ ] `public/passages/` — 3 hardcoded passages at grade levels 2, 4, 6 (from Project Gutenberg)
- [ ] `src/lib/alignment.ts` — Levenshtein alignment function
  - [ ] Normalize both strings (lowercase, strip punctuation) before comparing
  - [ ] Return array of word objects: `{expected, got, status: correct|substitution|omission|insertion}`
  - [ ] Tested offline with fake input before connecting to Deepgram
- [ ] `src/lib/metrics.ts` — computes scoring from alignment output + timestamps
  - [ ] WCPM (words correct per minute)
  - [ ] Error count by type (substitution / omission / insertion)
  - [ ] Hesitation detection (pause > 500ms between consecutive words)
  - [ ] Pause placement analysis (pauses at syntactic boundaries vs mid-phrase via compromise.js)
- [ ] **Verification:** paste fake aligned output, see correct metrics computed

---

## Phase 3 — Real-Time UI
Goal: live reading session with word-by-word color coding

- [ ] `src/components/PassageDisplay.tsx`
  - [ ] Renders passage word by word as spans
  - [ ] Colors update in real time as Deepgram returns words
  - [ ] Green = correct, Red = error, Yellow = hesitation
  - [ ] Smooth, readable layout — not a wall of colored text
- [ ] Connect Deepgram stream → alignment → PassageDisplay in real time
- [ ] Session timer (counts up during reading, stops at 60 seconds or manual stop)
- [ ] **Verification:** read passage live, see words color-coded correctly in real time

---

## Phase 4 — Claude Diagnostic Report
Goal: structured metrics → plain-language clinical report

- [ ] `src/app/api/diagnose/route.ts` — POST endpoint
  - [ ] Receives structured metrics JSON (never raw audio or transcript)
  - [ ] Constructs diagnostic prompt with full error log
  - [ ] Returns Claude's plain-language report
- [ ] Prompt engineering: Claude must distinguish decoding vs phrasing fluency issues from structured data
- [ ] `src/components/DiagnosticReport.tsx` — renders report cleanly for parent/teacher
- [ ] `src/components/MetricsDashboard.tsx` — visual breakdown of WCPM, error types, pause placement
- [ ] **Verification:** submit fake metrics, get clinically meaningful report back

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

---

## Session Log
| Session | Date | What was completed |
|---------|------|--------------------|
| 1 | — | Project initialized |

### Semantic substitution classification (stretch — add to Phase 6 if time allows)
- [ ] For each substitution error, classify whether the substituted word preserves semantic class ("dog" → "cat" = same class) vs. doesn't ("dog" → "the" = cross-class)
- [ ] Use compromise.js POS tagging: noun→noun / verb→verb = same class; noun→determiner etc. = cross-class
- [ ] Pass breakdown to Claude in metrics object — same-class = vocabulary gap, cross-class = decoding breakdown
- [ ] Update Claude diagnostic prompt to reference this distinction
