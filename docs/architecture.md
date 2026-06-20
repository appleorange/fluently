# Fluently — Architecture

## System Overview
Fluently is a client-heavy Next.js application. The browser handles microphone access, Deepgram streaming, real-time UI updates, and all deterministic computation (alignment, metrics). The only server-side work is proxying the Deepgram API key on session init and calling the Anthropic API at session end. Claude never sees raw audio or transcript — only a structured metrics object produced by the deterministic pipeline.

## Data Flow Diagram
```
┌─────────────────────────────────────────────────────────┐
│                        BROWSER                          │
│                                                         │
│  Microphone → Web Audio API                             │
│                    ↓                                    │
│  deepgram.ts → Deepgram WebSocket (streaming)           │
│                    ↓                                    │
│         word objects {word, start, duration}            │
│                    ↓                                    │
│  PassageDisplay.tsx ← real-time color updates           │
│                    ↓ (on session end)                   │
│  alignment.ts → Levenshtein align(expected[], got[])    │
│                    ↓                                    │
│  [{expected, got, status, timestamp}]                   │
│                    ↓                                    │
│  metrics.ts → compute(alignedWords, timestamps)         │
│                    ↓                                    │
│  {wcpm, errorsByType, pausePlacement, hesitations}      │
│                    ↓                                    │
└──────────────────────┬──────────────────────────────────┘
                       │ POST /api/diagnose
                       ↓
┌─────────────────────────────────────────────────────────┐
│                     SERVER (Next.js)                    │
│                                                         │
│  route.ts → Anthropic API (claude-sonnet-4-6)           │
│           → plain-language diagnostic report string     │
└──────────────────────┬──────────────────────────────────┘
                       │ response
                       ↓
┌─────────────────────────────────────────────────────────┐
│                        BROWSER                          │
│                                                         │
│  DiagnosticReport.tsx → renders report                  │
│  MetricsDashboard.tsx → renders visual breakdown        │
└─────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### src/lib/deepgram.ts
- Opens WebSocket connection to Deepgram streaming API
- Requests microphone access via getUserMedia
- Streams audio to Deepgram
- Filters to `is_final: true` results only
- Emits word objects: `{word: string, start: number, duration: number, confidence: number}`
- Handles connection errors and mic permission denial gracefully
- Does NOT do any alignment or scoring

### src/lib/alignment.ts
- Pure function: `align(expected: string[], got: string[]): AlignedWord[]`
- Normalizes both arrays (lowercase, strip punctuation) before comparing
- Runs Levenshtein edit distance to find optimal alignment
- Returns: `[{expected: string, got: string, status: 'correct'|'substitution'|'omission'|'insertion', index: number}]`
- No side effects, no API calls, fully testable offline
- Does NOT know about timestamps

### src/lib/metrics.ts
- Pure function: `computeMetrics(aligned: AlignedWord[], timestamps: WordTimestamp[]): Metrics`
- Computes WCPM from correct word count and session duration
- Classifies hesitations from timestamp gaps > 500ms
- Computes pause placement using compromise.js on target passage text
- Returns structured Metrics object for Claude consumption
- Does NOT call any API

### src/lib/types.ts
- All shared TypeScript interfaces
- `WordTimestamp`, `AlignedWord`, `Metrics`, `DiagnosticResponse`, `Passage`

### src/components/AudioRecorder.tsx
- Renders start/stop button
- Manages recording state (idle, recording, processing)
- Calls deepgram.ts on start, tears down on stop
- Passes word stream up to parent via callback
- Shows live word count and timer during recording

### src/components/PassageDisplay.tsx
- Renders passage as individual word spans
- Accepts `wordStatuses: Map<number, WordStatus>` prop
- Updates word colors in real time as statuses arrive
- Green = correct, Red = error, Yellow = hesitation
- Does not do any alignment logic itself

### src/components/DiagnosticReport.tsx
- Receives Claude report string as prop
- Renders formatted for parent/teacher readability
- Highlights key findings (error type, recommended exercises)
- Clean, calm visual design — not clinical/scary

### src/components/MetricsDashboard.tsx
- Receives Metrics object as prop
- Renders WCPM prominently
- Bar chart of error types (substitution/omission/insertion/hesitation counts)
- Pause placement score (% of pauses at syntactic boundaries)
- Color-coded severity indicators

### src/app/api/diagnose/route.ts
- POST endpoint, receives `{ metrics: Metrics, passage: string }` JSON body
- Constructs diagnostic prompt with structured error data
- Calls Anthropic API (claude-sonnet-4-6, max 500 tokens)
- Returns `{ report: string }`
- Never logs raw transcript or audio data

### src/app/page.tsx
- Orchestrates the full session state machine:
  - `idle` → `recording` → `processing` → `results`
- Holds passage selection, word stream accumulation, final metrics
- Passes data down to child components
- Manages the POST to /api/diagnose on session end
