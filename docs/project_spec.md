# Fluently — Project Specification

---

## Part 1: Product Requirements

### Who is it for?
- Parents of children (ages 5-12) who are learning to read or struggling with reading
- Teachers and homeschoolers without access to a reading specialist
- ESL learners practicing English oral fluency
- Under-resourced schools that cannot afford commercial platforms like Renaissance Learning ($thousands/year)

### What problem does it solve?
Oral reading fluency assessment — the gold standard diagnostic for early reading difficulties — requires a trained human specialist. That means it's inaccessible to most families and under-resourced schools. Fluently automates the assessment using the same clinical metrics specialists use, for free, in any browser.

### What does it do? (specific behaviors)
1. User selects a passage at a target grade level (2, 4, or 6)
2. User clicks "Start Reading" — microphone activates, Deepgram begins streaming
3. Child reads passage aloud for up to 60 seconds
4. As Deepgram returns word-level results, each word in the displayed passage updates color in real time:
   - Green = read correctly
   - Red = error (substitution, omission, or insertion)
   - Yellow = hesitation (pause > 500ms before this word)
5. User clicks "Stop" or session auto-stops at 60 seconds
6. Levenshtein alignment runs against full Deepgram output
7. Metrics computed: WCPM, error count by type, pause placement score, hesitation count
8. Structured metrics object sent to Claude API
9. Claude returns plain-language diagnostic report distinguishing decoding vs. phrasing fluency issues
10. Report + visual metrics dashboard displayed to user

### What does it NOT do? (v1 scope)
- No user accounts or saved history
- No audio playback of the session
- No dynamic passage generation (passages are hardcoded)
- No real-time intervention during reading (assessment only, not tutoring)
- No mobile app (browser only)
- No backend database
- Does not work offline (requires Deepgram + Anthropic API)

### Success Metrics
- Levenshtein alignment correctly classifies >90% of errors on a clean recording
- WCPM computation accurate within ±2 words of manual count
- Full session (read → report) completes in under 90 seconds
- Claude report distinguishes error type (decoding vs. phrasing) correctly for >80% of test cases
- Demo runs end-to-end without error 3 consecutive times

---

## Part 2: Engineering Requirements

### Data Flow
```
Microphone input
    ↓
Web Audio API (browser)
    ↓
Deepgram Streaming API (WebSocket)
    ↓ word objects: {word, start, duration, confidence}
Levenshtein Alignment (src/lib/alignment.ts)
    ↓ aligned array: [{expected, got, status, timestamp}]
Metrics Computation (src/lib/metrics.ts)
    ↓ structured object: {wcpm, errorsByType, pausePlacement, hesitations}
Claude API Route (src/app/api/diagnose/route.ts)
    ↓ plain-language diagnostic report string
DiagnosticReport Component (src/components/DiagnosticReport.tsx)
    ↓
User sees report + MetricsDashboard
```

### Project Folder Structure
```
fluently/
├── CLAUDE.md                          # Auto-read every session
├── .env.local                         # API keys — never committed
├── .env.example                       # Key template — safe to commit
├── docs/
│   ├── ROADMAP.md                     # Phase-by-phase task tracking
│   ├── project_spec.md                # This file
│   ├── architecture.md                # Data flow + component responsibilities
│   ├── changelog.md                   # Dated log of completions
│   ├── project_status.md              # Current milestone status
│   └── lessons.md                     # Claude self-improvement log
├── public/
│   └── passages/
│       ├── grade2.json                # Passage + metadata for grade 2
│       ├── grade4.json                # Passage + metadata for grade 4
│       └── grade6.json                # Passage + metadata for grade 6
└── src/
    ├── app/
    │   ├── page.tsx                   # Main reading session page
    │   ├── layout.tsx                 # Root layout
    │   └── api/
    │       └── diagnose/
    │           └── route.ts           # POST: receives metrics, returns Claude report
    ├── components/
    │   ├── AudioRecorder.tsx          # Mic permission + start/stop controls
    │   ├── PassageDisplay.tsx         # Word-by-word colored passage display
    │   ├── DiagnosticReport.tsx       # Claude report rendered for parent/teacher
    │   └── MetricsDashboard.tsx       # Visual WCPM, error breakdown, pause score
    └── lib/
        ├── deepgram.ts                # Deepgram WebSocket streaming client
        ├── alignment.ts               # Levenshtein alignment — pure function
        ├── metrics.ts                 # Scoring computation from alignment output
        └── types.ts                   # Shared TypeScript interfaces
```

### Tech Stack
| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 14 (App Router) | Known stack, API routes built in |
| Language | TypeScript | Type safety critical for alignment pipeline |
| Styling | Tailwind CSS | Fast UI development |
| Audio streaming | Deepgram SDK (@deepgram/sdk) | Word-level timestamps, best accuracy |
| Text alignment | Custom Levenshtein (no library) | 50 lines, full control over output format |
| Syntactic parsing | compromise.js | Lightweight, browser-native, no server needed |
| Claude integration | Anthropic SDK (@anthropic-ai/sdk) | Diagnostic report generation |
| Diff visualization | diff-match-patch | Side-by-side original vs. simplified view |

### Engineering Rules
1. Deepgram client runs browser-side — API key proxied through Next.js API route, never exposed to client
2. Alignment function is pure — takes two string arrays, returns alignment array, no side effects
3. Metrics function is pure — takes alignment array + timestamp array, returns metrics object
4. Claude API route receives structured JSON only — never raw audio, never raw transcript string
5. All Deepgram word processing uses `is_final: true` results only — interim results discarded
6. Word normalization (lowercase, strip punctuation) applied to BOTH expected and got before alignment
7. No state management library — React useState/useReducer only, no Redux/Zustand
8. Error boundaries on AudioRecorder and PassageDisplay — mic failures must not crash the app

### Key Parameters Table
| Parameter | Value | Reason |
|-----------|-------|--------|
| Session duration | 60 seconds max | Standard WCPM assessment window |
| Hesitation threshold | 500ms pause | Clinical standard for disfluency marker |
| Pause placement boundary | Syntactic phrase boundary via compromise.js | Distinguishes phrasing vs. decoding issues |
| WCPM formula | correctWords / (durationSeconds / 60) | Gold standard formula |
| Deepgram model | `nova-2` | Best accuracy for speech |
| Deepgram punctuate | false | Punctuation interferes with alignment |
| Deepgram interim_results | false | Final results only for clean alignment |
| Claude model | claude-sonnet-4-6 | Speed + quality balance for report |
| Max tokens (Claude) | 500 | Report should be concise, not overwhelming |
| Grade levels | 2, 4, 6 | Covers early, mid, upper elementary range |
| PassageMap grid | 3x3 (9 passages) | Snapping grid — feels continuous, no generation latency |
| Complexity axis (X) | Flesch-Kincaid 0-1 normalized | FK = 1.015 × avg_sentence_len + 84.6 × avg_syllables - 15.59 |
| Register axis (Y) | 0 (casual) → 1 (formal) | Weighted: contraction density + Latinate ratio + passive voice density |
| Passage words field | Derived at runtime | `text.split(/\s+/)` — no hardcoded words array in JSON |
| WCPM benchmarks (DIBELS 8th Ed.) | G2: strategic 99 / green 125 / blue 159 · G4: strategic 125 / green 141 / blue 160 · G6: strategic 121 / green 135 / blue 159 | Three-tier fluency screening (intensive / strategic / core) per official DIBELS 8th Edition |
| Accuracy threshold | 96% (DIBELS 8th Edition) | Below this, accuracy concerns push the tier toward strategic/intensive regardless of WCPM |
