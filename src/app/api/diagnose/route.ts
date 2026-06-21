import Anthropic from '@anthropic-ai/sdk'
import { Metrics, Recommendation } from '@/lib/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// DIBELS 8th Edition benchmarks — exact strategic/green/blue tiers for the original fixed grades
const BENCHMARKS: Record<number, { strategic: number; green: number; blue: number }> = {
  2: { strategic: 99,  green: 125, blue: 159 },
  4: { strategic: 125, green: 141, blue: 160 },
  6: { strategic: 121, green: 135, blue: 159 },
}
// DIBELS 8th Edition end-of-year "at benchmark" WCPM, grades 1-12 — fallback for AI-generated
// passages outside 2/4/6 (PassageMap spans the full grade 1-12 complexity range)
const DIBELS_EOY: Record<number, number> = {
  1: 71, 2: 107, 3: 124, 4: 133, 5: 142,
  6: 142, 7: 146, 8: 151, 9: 153, 10: 155, 11: 157, 12: 160
}
const ACCURACY_THRESHOLD = 96 // DIBELS 8th Edition

interface DiagnoseRequest {
  metrics: Metrics
  passageGrade: number
  passageTitle: string
  targetWCPM?: number  // from generate-passage; preferred benchmark source when present
  complexity?: number  // 0-1, present for AI-generated passages
  register?: number    // 0-1, present for AI-generated passages
}

type Tier = 'intensive' | 'strategic' | 'core'
type Bench = { strategic: number; green: number; blue: number }

// Grades 2/4/6 have exact published tier cut points. For any other grade, derive
// approximate strategic/blue tiers from a single benchmark point (the passage's own
// targetWCPM when available, else the DIBELS EOY grade lookup) using the average
// ratio observed across the three known grades (~0.85 / ~1.2).
function resolveBench(grade: number, targetWCPM?: number): Bench {
  const exact = BENCHMARKS[grade]
  if (exact) return exact
  const green = targetWCPM ?? DIBELS_EOY[Math.min(Math.max(Math.round(grade), 1), 12)] ?? 160
  return { strategic: Math.round(green * 0.85), green, blue: Math.round(green * 1.2) }
}

function getTier(wcpm: number, accuracy: number, bench: Bench): Tier {
  if (wcpm < bench.strategic || accuracy < 91) return 'intensive'
  if (wcpm < bench.green || accuracy < ACCURACY_THRESHOLD) return 'strategic'
  return 'core'
}

function recommendationForTier(
  tier: Tier,
  wcpm: number,
  bench: Bench
): { recommendation: Recommendation; tierLabel: string } {
  if (tier === 'intensive') return { recommendation: 'retry', tierLabel: 'intensive (needs intervention)' }
  if (tier === 'strategic') return { recommendation: 'retry', tierLabel: 'strategic (needs support)' }
  const tierLabel = wcpm >= bench.blue
    ? 'core, exceeding benchmark — increase difficulty'
    : 'core (on track)'
  return { recommendation: 'advance', tierLabel }
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
  bench: Bench,
  tier: Tier,
  tierLabel: string,
  complexity?: number,
  register?: number
): string {
  const { wcpm, accuracy, errorCounts, pausePlacement, selfCorrections } = metrics
  const totalErrors = errorCounts.substitutions + errorCounts.omissions + errorCounts.insertions
  const scRate = totalErrors > 0 ? Math.round((selfCorrections / totalErrors) * 100) : 0

  const passageContext = (complexity !== undefined && register !== undefined)
    ? `- Passage complexity: ${complexityContext(complexity)}
- Passage register: ${registerContext(register)}`
    : `- Grade ${grade} passage`

  const tierGuidance: Record<Tier, string> = {
    intensive: 'INTENSIVE tier — this student needs intervention. Use urgent, direct language and give specific, concrete exercises targeting the exact error pattern.',
    strategic: 'STRATEGIC tier — this student needs targeted support. Use encouraging language, acknowledge what is working, and give targeted practice for the specific weak area.',
    core: 'CORE tier — this student is on track. Lead with genuine praise, then push them forward with a slightly harder challenge or refinement.'
  }

  return `You are a reading specialist analyzing a child's oral reading fluency assessment. Use DIBELS 8th Edition and NAEP standards as your clinical reference.

Return ONLY a JSON object — no markdown, no explanation, nothing else — in exactly this shape:
{"report":"...","recommendation":"advance"|"retry"|"repeat","reasoning":"..."}

Rules for the report field:
- Plain-language diagnostic for a parent or teacher, under 150 words
- First sentence states the key finding
- Distinguish DECODING issues (wrong words) from PHRASING FLUENCY issues (poor pausing)
- Calibrate your feedback to the passage register — for casual passages some informality is normal; for formal passages, precision matters more
- If self-correction rate ≥ 20%, open with praise for metacognitive monitoring before addressing errors
- ${tierGuidance[tier]}
- Give 1-2 specific, actionable exercises matched to the primary error type
- Refer to the reader as "the student" — never use character names from the passage

Rules for recommendation:
- "advance": tier is "core" → student is ready for harder material
- "retry": tier is "strategic" or "intensive" → not ready to move on, practice this passage again

Rules for reasoning:
- One sentence citing the specific numbers and tier that drove the recommendation

ASSESSMENT DATA:
${passageContext}
- DIBELS tier: ${tierLabel}

WCPM (DIBELS 8th Ed. tiers — strategic: ${bench.strategic}, green/benchmark: ${bench.green}, blue/above benchmark: ${bench.blue}):
- Student: ${wcpm} WCPM

ACCURACY (DIBELS 8th Edition threshold: ${ACCURACY_THRESHOLD}%; standard reading-level taxonomy for context):
- Student: ${accuracy}%
- ≥ 95% = independent level | 90–94% = instructional level | < 90% = frustration level

ERROR TAXONOMY:
- Substitutions: ${errorCounts.substitutions} (decoding breakdown — wrong word read)
- Omissions: ${errorCounts.omissions} (skipped expected word)
- Insertions: ${errorCounts.insertions} (added word not in text)
- Hesitations: ${errorCounts.hesitations} (pause > 500ms, not counted as errors)
- Self-corrections: ${selfCorrections} of ${totalErrors} errors corrected (${scRate}% self-correction rate)
  → Self-corrections signal active metacognitive monitoring; ≥ 20% rate is a meaningful strength

PROSODIC FLUENCY (NAEP Oral Reading Fluency rubric proxy):
- ${pausePlacement.boundaryPercent}% of pauses at syntactic phrase boundaries (${pausePlacement.atBoundary} of ${pausePlacement.totalPauses} pauses)
- ≥ 75% = fluent prosody (NAEP Level 3–4) | 50–74% = developing (Level 2–3) | < 50% = phrasing issue (Level 1–2)`
}

function parseRecommendation(raw: string): Recommendation {
  if (raw === 'advance' || raw === 'retry' || raw === 'repeat') return raw
  return 'retry'
}

export async function POST(request: Request) {
  try {
    const body: DiagnoseRequest = await request.json()
    const { metrics, passageGrade, targetWCPM, complexity, register } = body

    if (!metrics) {
      return Response.json({ error: 'Missing metrics' }, { status: 400 })
    }

    const bench = resolveBench(passageGrade, targetWCPM)
    const tier = getTier(metrics.wcpm, metrics.accuracy, bench)
    const { tierLabel } = recommendationForTier(tier, metrics.wcpm, bench)

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [
        { role: 'user', content: buildPrompt(metrics, passageGrade, bench, tier, tierLabel, complexity, register) }
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
