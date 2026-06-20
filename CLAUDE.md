# Fluently — Claude Code Instructions

## What This Project Is
Fluently is an oral reading fluency assessment tool. A user reads a passage aloud, Deepgram transcribes with word-level timestamps, a deterministic Levenshtein alignment pipeline scores the reading against the expected passage, and Claude generates a plain-language diagnostic report. No AI does the detection — AI only interprets structured output from the deterministic pipeline.

## Session Start Checklist
Before writing any code, Claude must:
1. Read `docs/project_status.md` — know current phase and what's next
2. Read `docs/ROADMAP.md` — know what tasks are complete vs in progress
3. Read `docs/architecture.md` — understand data flow before touching any file
4. Read `docs/lessons.md` — avoid repeating past mistakes
5. Check `docs/changelog.md` — know what was built last session
6. Then ask: "Ready to continue Phase X — starting with [task]?" before writing any code

## Workflow Rules
- **Plan before code.** State what you're about to build and why before writing it.
- **One module at a time.** Build, verify it works, then move on. Never stack unverified modules.
- **Use context7 MCP** before implementing any library (Deepgram SDK, compromise.js, diff-match-patch). Always get up-to-date docs.
- **Verify in browser** before marking anything complete. Console.log the raw Deepgram response to confirm word timestamps exist before building anything on top of them.
- **Feature branches only.** Never commit directly to main. Branch naming: `feature/[module-name]`
- **Never hardcode API keys.** Always read from `.env.local`. If a key is missing, throw a clear error.
- **Update docs after every completed module.** ROADMAP.md, changelog.md, project_status.md must reflect reality at all times.

## Self-Improvement Loop
After any correction or mistake:
1. Identify what went wrong
2. Add an entry to `docs/lessons.md` in format: `Mistake | Rule | Date`
3. Apply the rule immediately going forward

## Architecture Rules (read architecture.md for full detail)
- The Levenshtein alignment function lives in `src/lib/alignment.ts` — pure function, no side effects, fully testable offline
- Deepgram streaming lives in `src/lib/deepgram.ts` — handles connection, word timestamp extraction only
- Metrics computation lives in `src/lib/metrics.ts` — takes alignment output, returns structured scoring object
- Claude API call lives in `src/app/api/diagnose/route.ts` — receives structured metrics object, never raw audio or transcript
- UI components in `src/components/` — PassageDisplay, AudioRecorder, DiagnosticReport, MetricsDashboard

## Critical Technical Rules
- Deepgram must return `is_final: true` words only — interim results cause alignment chaos
- Word timestamps: use `start` and `duration` fields from Deepgram word objects
- Levenshtein alignment must normalize both strings (lowercase, strip punctuation) before comparing
- WCPM formula: `(correctWords / (durationSeconds / 60))` — use first word start to last word end for duration
- Hesitation threshold: pause > 500ms between consecutive words = hesitation marker
- Claude receives a structured JSON object only — never raw transcript text
- Pause placement uses compromise.js to identify syntactic boundaries in the TARGET passage text, not the transcript

## MCP Servers
- **context7** — use before implementing any library. Query: "deepgram streaming browser javascript", "compromise.js constituency parsing", "diff-match-patch nodejs"
- Use context7 especially before Deepgram integration — their streaming API has changed across SDK versions

## Git Discipline
- `main` — stable, demo-ready only
- `feature/[name]` — all development work
- Commit messages: `feat: [what]`, `fix: [what]`, `docs: [what]`
- Never commit `.env.local`, never commit broken code

## Environment Variables
All keys in `.env.local` (never `.env`, never committed):
```
DEEPGRAM_API_KEY=
ANTHROPIC_API_KEY=
```
Access in Next.js API routes: `process.env.DEEPGRAM_API_KEY`
Access in browser: must proxy through API route — never expose keys client-side

## Documentation Maintenance
After every completed module, update:
- `docs/ROADMAP.md` — mark task complete, update session log
- `docs/changelog.md` — dated entry of what was built
- `docs/project_status.md` — current phase, what's done, what's next
- `docs/lessons.md` — any mistakes made and rules derived
