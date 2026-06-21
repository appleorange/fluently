# Fluently

Oral reading fluency assessment tool. A child reads a passage aloud, Deepgram transcribes with word-level timestamps, a deterministic Levenshtein alignment pipeline scores the reading against the expected passage, and Claude generates a plain-language diagnostic report.

Fluently also tracks a reader's skill profile across sessions in Redis (vector search over an AI-generated passage library) to recommend the next passage's difficulty and register, and to give Claude longitudinal context ("this is the student's 3rd session — has phrasing improved?") instead of grading every session in isolation.

## Prerequisites

- Node.js 18+
- **Redis Stack** (not plain Redis — vector search needs the RediSearch module, which plain Redis doesn't include)
- A [Deepgram](https://console.deepgram.com) API key
- An [Anthropic](https://console.anthropic.com) API key

### Installing Redis Stack (macOS)

```bash
brew tap redis-stack/redis-stack
brew install --cask redis-stack-server
```

Start it manually before running the app (it's a cask, so `brew services` doesn't manage it):

```bash
redis-stack-server
```

Leave that running in its own terminal tab. It listens on `redis://localhost:6379` by default.

For other platforms, see [redis.io/docs/install/install-stack](https://redis.io/docs/install/install-stack/) — or point `REDIS_URL` at a hosted Redis Cloud database (free tier supports RediSearch) if you don't want to run it locally.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Add API keys
cp .env.example .env.local
# Fill in DEEPGRAM_API_KEY, ANTHROPIC_API_KEY, and REDIS_URL in .env.local
# (REDIS_URL=redis://localhost:6379 if you're running Redis Stack locally per above)

# 3. Make sure redis-stack-server is running (see Prerequisites)

# 4. Run dev server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |

## Pages

- `/` — landing page
- `/practice` — the core flow: pick a passage (drag a point on the complexity/register map, or read an existing one), record yourself reading it, get a diagnostic report and a recommended next passage
- `/progress` — longitudinal view of a reader's session history

## Architecture

See `docs/architecture.md` for full data flow, and `docs/ROADMAP.md` for current build status vs. what's planned.

**The pipeline:**
1. Deepgram streams word-level transcription with timestamps
2. Levenshtein alignment scores every word (correct / substitution / omission / insertion / uncertain)
3. Metrics computation derives WCPM, error counts, pause placement, self-corrections
4. A skill vector (complexity handling, register handling, WCPM, pause placement, self-correction) is computed per session and stored in Redis
5. Redis vector search (`FT.CREATE`/`FT.SEARCH`) matches the reader's next-best passage target against a library of AI-generated passages, or generates a new one if nothing close exists
6. Claude receives a structured JSON object (metrics + DIBELS tier + prior-session history table) and generates the diagnostic report

Claude never sees raw audio or transcript — only structured data from the deterministic pipeline.

## Tech Stack

- Next.js 14 (App Router), TypeScript, Tailwind CSS
- Deepgram SDK (streaming, word timestamps)
- Anthropic SDK (diagnostic report generation, passage generation)
- Redis Stack (`redis` npm package) — vector search over the passage library, per-reader session history
- compromise.js (syntactic boundary detection for pause placement)
- gsap (animated passage-map dot grid)

## Hackathon — UC Berkeley AI Hackathon 2026
Track: Ddoski's World
Sponsors: Deepgram, Anthropic, Redis
