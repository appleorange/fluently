import Anthropic from '@anthropic-ai/sdk'
import { Metrics, Recommendation } from '@/lib/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const BENCHMARKS: Record<number, { wcpmLow: number; wcpmHigh: number }> = {
  2: { wcpmLow: 90,  wcpmHigh: 110 },
  4: { wcpmLow: 125, wcpmHigh: 145 },
  6: { wcpmLow: 150, wcpmHigh: 170 },
}

interface DiagnoseRequest {
  metrics: Metrics
  passageGrade: number
  passageTitle: string
  complexity?: number  // 0-1, present for AI-generated passages
  register?: number    // 0-1, present for AI-generated passages
}

function complexityContext(c: number): string {
  if (c < 0.15) return 'kindergarten / early first grade'
  if (c < 0.30) return 'early elementary (grades 1–2)'
  if (c < 0.45) return 'upper elementary (grades 3–4)'
  if (c < 0.60) return 'middle school (grades 5–7)'
  if (c < 0.75) return 'high school (grades 9–11)'
  if (c < 0.90) return 'advanced high school / early college'
  return 'adult proficiency (18+)'
}

function registerContext(r: number): string {
  if (r < 0.2) return 'very casual and social — contractions, informal phrasing, and relaxed vocabulary are expected and normal in this register'
  if (r < 0.4) return 'friendly and conversational — some informality is expected'
  if (r < 0.6) return 'professional-casual — polished but approachable'
  if (r < 0.8) return 'formal professional — precise, measured language expected'
  return 'highly formal — academic or legal register; precision and formality matter'
}

function buildPrompt(
  metrics: Metrics,
  grade: number,
  wcpmStatus: string,
  accuracyStatus: string,
  complexity?: number,
  register?: number
): string {
  const { wcpm, accuracy, errorCounts, pausePlacement, selfCorrections } = metrics
  const bench = BENCHMARKS[grade] ?? { wcpmLow: grade * 30 + 50, wcpmHigh: grade * 30 + 70 }

  const passageContext = (complexity !== undefined && register !== undefined)
    ? `- Passage complexity: ${complexityContext(complexity)}
- Passage register: ${registerContext(register)}`
    : `- Grade ${grade} passage`

  return `You are a reading specialist analyzing a child's oral reading fluency assessment.

Return ONLY a JSON object — no markdown, no explanation, nothing else — in exactly this shape:
{"report":"...","recommendation":"advance"|"retry"|"repeat","reasoning":"..."}

Rules for the report field:
- Plain-language diagnostic for a parent or teacher, under 150 words
- First sentence states the key finding
- Distinguish DECODING issues (wrong words) from PHRASING FLUENCY issues (poor pausing)
- Calibrate your feedback to the passage register — e.g. for a very casual passage, some informality from the reader is expected; for a formal passage, precision matters more
- Give 1-2 specific actionable exercises
- Warm and encouraging tone, not clinical
- Refer to the reader as "the student" — never use character names from the passage

Rules for recommendation:
- "advance": wcpmStatus is "at benchmark" AND accuracyStatus is "passing" → student is ready for harder material
- "repeat": wcpmStatus is "at benchmark" BUT accuracyStatus is "below threshold" → speed is fine but accuracy needs work, try a different passage at same level
- "retry": wcpmStatus is "below benchmark" → not ready to move on, practice this passage again

Rules for reasoning:
- One sentence explaining the recommendation, referencing the specific numbers

ASSESSMENT DATA:
${passageContext}
- WCPM benchmark: ${bench.wcpmLow}–${bench.wcpmHigh}, accuracy threshold: 95%
- WCPM: ${wcpm} → wcpmStatus: "${wcpmStatus}"
- Accuracy: ${accuracy}% → accuracyStatus: "${accuracyStatus}"
- Substitutions: ${errorCounts.substitutions}, Omissions: ${errorCounts.omissions}, Insertions: ${errorCounts.insertions}
- Hesitations: ${errorCounts.hesitations} (pauses >500ms)
- Self-corrections: ${selfCorrections}
- Pause placement: ${pausePlacement.boundaryPercent}% at natural phrase boundaries (below 50% = phrasing issue)`
}

function parseRecommendation(raw: string): Recommendation {
  if (raw === 'advance' || raw === 'retry' || raw === 'repeat') return raw
  return 'retry'
}

export async function POST(request: Request) {
  try {
    const body: DiagnoseRequest = await request.json()
    const { metrics, passageGrade, complexity, register } = body

    if (!metrics) {
      return Response.json({ error: 'Missing metrics' }, { status: 400 })
    }

    const bench = BENCHMARKS[passageGrade] ?? { wcpmLow: passageGrade * 30 + 50, wcpmHigh: passageGrade * 30 + 70 }
    const wcpmStatus = metrics.wcpm >= bench.wcpmLow ? 'at benchmark' : 'below benchmark'
    const accuracyStatus = metrics.accuracy >= 95 ? 'passing' : 'below threshold'

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [
        { role: 'user', content: buildPrompt(metrics, passageGrade, wcpmStatus, accuracyStatus, complexity, register) }
      ]
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    // Strip markdown code fences if Claude wraps the JSON
    const jsonStr = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    const parsed = JSON.parse(jsonStr)

    return Response.json({
      report: parsed.report ?? '',
      recommendation: parseRecommendation(parsed.recommendation),
      reasoning: parsed.reasoning ?? ''
    })
  } catch (error) {
    console.error('Diagnose API error:', error)
    return Response.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
