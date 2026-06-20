# Fluently

Oral reading fluency assessment tool. A child reads a passage aloud, Deepgram transcribes with word-level timestamps, a deterministic Levenshtein alignment pipeline scores the reading against the expected passage, and Claude generates a plain-language diagnostic report.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Add API keys
cp .env.example .env.local
# Fill in DEEPGRAM_API_KEY and ANTHROPIC_API_KEY in .env.local

# 3. Run dev server
npm run dev
```

## Architecture

See `docs/architecture.md` for full data flow.

**The pipeline:**
1. Deepgram streams word-level transcription with timestamps
2. Levenshtein alignment scores every word (correct / substitution / omission / insertion)
3. Metrics computation derives WCPM, error counts, pause placement
4. Claude receives structured JSON object and generates diagnostic report

Claude never sees raw audio or transcript — only structured data from the deterministic pipeline.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Deepgram SDK (streaming, word timestamps)
- compromise.js (syntactic boundary detection)
- Anthropic SDK (diagnostic report)

## Hackathon — UC Berkeley AI Hackathon 2026
Track: Ddoski's World
Sponsors: Deepgram, Anthropic
