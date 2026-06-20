# Fluently — Lessons Log

Format: **Mistake** | **Rule** | **Date**

---

_No entries yet. Claude updates this after every correction._

---

## Known Gotchas (pre-loaded from project design)

**Deepgram interim results** | Always filter to `is_final: true` only — interim results return partial words that will corrupt Levenshtein alignment | 2026-06-20

**Deepgram punctuate option** | Set `punctuate: false` — punctuation in transcribed words breaks string normalization and alignment | 2026-06-20

**API key exposure** | Deepgram key must never reach the browser — proxy through Next.js API route for session token or use Deepgram's temporary token endpoint | 2026-06-20

**Levenshtein on raw strings** | Always normalize (lowercase, strip punctuation) BOTH expected and got arrays before alignment — "The" vs "the" should not count as a substitution | 2026-06-20

**compromise.js browser import** | Import as `import nlp from 'compromise'` — the package has different entry points for browser vs Node, use the default import in Next.js client components | 2026-06-20
