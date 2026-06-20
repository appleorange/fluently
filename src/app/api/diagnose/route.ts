// Fluently — Diagnostic API Route
// POST /api/diagnose
// Receives structured Metrics object + passage metadata
// Returns plain-language diagnostic report from Claude
// NEVER receives raw audio or raw transcript

import Anthropic from '@anthropic-ai/sdk'
import { Metrics } from '@/lib/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

interface DiagnoseRequest {
  metrics: Metrics
  passageGrade: number
  passageTitle: string
}

function buildPrompt(metrics: Metrics, grade: number): string {
  const { wcpm, accuracy, errorCounts, pausePlacement, selfCorrections } = metrics

  return `You are a reading specialist analyzing a child's oral reading fluency assessment. Based on the structured data below, write a plain-language diagnostic report for a parent or teacher. The report should:
1. State the key finding in the first sentence (what the data shows most clearly)
2. Distinguish whether this is primarily a DECODING issue (getting words wrong) or a PHRASING FLUENCY issue (correct words but poor phrasing/pausing)
3. Give 1-2 specific, actionable exercises targeting the identified issue
4. Be warm and encouraging in tone — not clinical or alarming
5. Be under 150 words

ASSESSMENT DATA:
- Grade level passage: Grade ${grade}
- Words correct per minute (WCPM): ${wcpm} (grade ${grade} benchmark: ${grade * 30 + 50} WCPM)
- Accuracy: ${accuracy}%
- Substitution errors: ${errorCounts.substitutions} (reader said a different word)
- Omission errors: ${errorCounts.omissions} (reader skipped a word)
- Insertion errors: ${errorCounts.insertions} (reader added a word not in passage)
- Hesitations: ${errorCounts.hesitations} (pauses longer than 500ms mid-reading)
- Self-corrections: ${selfCorrections} (caught and fixed their own errors — positive sign)
- Pause placement: ${pausePlacement.boundaryPercent}% of pauses at natural phrase boundaries (higher is better; below 50% suggests phrasing fluency issues)

Based on this data, write the diagnostic report:`
}

export async function POST(request: Request) {
  try {
    const body: DiagnoseRequest = await request.json()
    const { metrics, passageGrade, passageTitle } = body

    if (!metrics) {
      return Response.json({ error: 'Missing metrics' }, { status: 400 })
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: buildPrompt(metrics, passageGrade)
        }
      ]
    })

    const report = message.content[0].type === 'text' ? message.content[0].text : ''

    return Response.json({ report, passageTitle })
  } catch (error) {
    console.error('Diagnose API error:', error)
    return Response.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
