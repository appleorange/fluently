import Anthropic from '@anthropic-ai/sdk'
import { storePassageVector, type StoredPassage } from './passageVectors'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function complexityDescriptor(c: number): string {
  if (c < 0.15) return 'kindergarten level — 3-6 word sentences, only the most basic everyday words (cat, run, big, home, water, happy)'
  if (c < 0.30) return 'early elementary (grade 1-2) — short simple sentences, familiar everyday vocabulary'
  if (c < 0.45) return 'upper elementary (grade 3-4) — some compound sentences, grade-appropriate vocabulary'
  if (c < 0.60) return 'middle school (grade 5-7) — varied sentence structures, some content-specific vocabulary'
  if (c < 0.75) return 'high school (grade 9-11) — complex sentences, sophisticated vocabulary, subordinate clauses'
  if (c < 0.90) return 'advanced high school or early college — complex syntax, academic or specialized vocabulary'
  return 'adult proficiency (18+) — complex multi-clause syntax, nuanced vocabulary, varied rhetorical structure'
}

function registerDescriptor(r: number): string {
  if (r < 0.2) return 'very casual and conversational — like chatting with close friends at a social gathering; contractions, relaxed informal phrasing, casual word choices'
  if (r < 0.4) return 'friendly and warm — like talking to a neighbor you know well or writing to someone familiar; conversational but not slangy'
  if (r < 0.6) return 'professional-casual — like making small talk at a work event or meeting a new colleague; polished but approachable'
  if (r < 0.8) return 'formal professional — like a job interview, business presentation, or professional correspondence; measured and precise'
  return 'highly formal — like an academic paper, legal document, or official speech; no contractions, formal diction throughout'
}

function gradeFromComplexity(c: number): number {
  return Math.max(1, Math.round(1 + c * 11))
}

// DIBELS 8th Edition end-of-year "at benchmark" WCPM targets
const DIBELS_EOY: Record<number, number> = {
  1: 71, 2: 107, 3: 124, 4: 133, 5: 142,
  6: 142, 7: 146, 8: 151, 9: 153, 10: 155, 11: 157, 12: 160
}

function wcpmFromComplexity(c: number): number {
  const grade = gradeFromComplexity(c)
  return DIBELS_EOY[Math.min(grade, 12)] ?? 160
}

export type GeneratedPassage = StoredPassage

export async function generatePassage(complexity: number, register: number): Promise<GeneratedPassage> {
  const prompt = `Write a passage for an oral reading fluency assessment.

Reading level: ${complexityDescriptor(complexity)}
Tone and register: ${registerDescriptor(register)}

Requirements:
- 60-80 words of coherent prose (a narrative moment or vivid description)
- No dialogue or quotation marks
- No lists or bullet points
- Flows naturally when read aloud
- Provide a concise title (2-5 words)

Respond with JSON only, no markdown fences:
{"title": "...", "text": "..."}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }]
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  // Strip markdown fences if Claude added them despite instructions
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const { title, text } = JSON.parse(cleaned)

  // Build words array matching the format of the static passage JSON files
  const words = text
    .replace(/["""'']/g, '')  // strip smart quotes
    .split(/\s+/)
    .map((w: string) => w.replace(/[^a-zA-Z'-]/g, ''))  // strip punctuation except hyphens and apostrophes
    .filter(Boolean)

  const passageId = crypto.randomUUID()
  const passage: GeneratedPassage = {
    passageId,
    title,
    text,
    words,
    grade: gradeFromComplexity(complexity),
    targetWCPM: wcpmFromComplexity(complexity),
    source: 'AI Generated',
    complexity,
    register
  }

  // Fire-and-forget — a failed vector-index write shouldn't block the caller getting their passage
  storePassageVector(passage).catch(err => console.error('Passage vector store failed:', err))

  return passage
}
