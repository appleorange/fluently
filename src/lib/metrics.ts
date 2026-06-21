import { AlignedWord, ErrorCounts, Metrics, PausePlacement, WordTimestamp } from './types'

const HESITATION_THRESHOLD_MS = 500

function detectHesitations(timestamps: WordTimestamp[]): number[] {
  const indices: number[] = []
  for (let i = 1; i < timestamps.length; i++) {
    const gap = (timestamps[i].start - (timestamps[i - 1].start + timestamps[i - 1].duration)) * 1000
    if (gap > HESITATION_THRESHOLD_MS) indices.push(i)
  }
  return indices
}

async function analyzePausePlacement(
  timestamps: WordTimestamp[],
  passageText: string
): Promise<PausePlacement> {
  const nlp = (await import('compromise')).default
  const doc = nlp(passageText)

  const boundaryWords = new Set<string>()

  // Sentence-level boundaries from compromise
  const sentences = doc.sentences().json() as Array<{ terms: Array<{ text: string }> }>
  sentences.forEach(s => {
    if (s.terms?.length > 0) {
      const last = s.terms[s.terms.length - 1].text.toLowerCase().replace(/[^a-z0-9']/g, '')
      if (last) boundaryWords.add(last)
    }
  })

  // Clause-level boundaries: words immediately before commas, semicolons, colons
  const clausePattern = /([\w']+)[,;:]/g
  let match
  while ((match = clausePattern.exec(passageText)) !== null) {
    boundaryWords.add(match[1].toLowerCase())
  }

  const pauseIndices = detectHesitations(timestamps)
  let atBoundary = 0
  let midPhrase = 0

  pauseIndices.forEach(idx => {
    const prevWord = timestamps[idx - 1]?.word?.toLowerCase().replace(/[^a-z0-9']/g, '') ?? ''
    if (boundaryWords.has(prevWord)) {
      atBoundary++
    } else {
      midPhrase++
    }
  })

  const totalPauses = pauseIndices.length
  return {
    totalPauses,
    atBoundary,
    midPhrase,
    boundaryPercent: totalPauses > 0 ? Math.round((atBoundary / totalPauses) * 100) : 100
  }
}

// A self-correction (wrong word immediately followed by the reader re-saying it correctly) is
// classified by the Levenshtein alignment as an 'insertion' (the wrong attempt — it matches no
// expected word) followed by 'correct' (the real word, now in its rightful position) — NOT as
// 'substitution' followed by 'correct'. Substituting then re-matching the same expected word would
// cost more edits than treating the wrong attempt as a throwaway insertion, so the optimal
// alignment never produces that pattern. Also keep the substitution+matching-expected check as a
// fallback for the rare case where the passage itself repeats a word consecutively.
function detectSelfCorrections(aligned: AlignedWord[]): number {
  let count = 0
  for (let i = 0; i < aligned.length - 1; i++) {
    const isInsertionThenCorrect = aligned[i].status === 'insertion' && aligned[i + 1].status === 'correct'
    const isSubstitutionThenRematch =
      aligned[i].status === 'substitution' &&
      aligned[i + 1].status === 'correct' &&
      aligned[i + 1].expected === aligned[i].expected
    if (isInsertionThenCorrect || isSubstitutionThenRematch) {
      count++
    }
  }
  return count
}

export async function computeMetrics(
  aligned: AlignedWord[],
  timestamps: WordTimestamp[],
  passageText: string
): Promise<Metrics> {
  const correctWords = aligned.filter(w => w.status === 'correct').length
  // Uncertain words (low-confidence transcription, not a confirmed error) are excluded from the
  // accuracy denominator too — otherwise they'd silently penalize accuracy despite not counting
  // toward any error type. Accent fairness: a word shouldn't cost accuracy just because Deepgram
  // was unsure how to transcribe it.
  const totalExpected = aligned.filter(w => w.status !== 'insertion' && w.status !== 'uncertain').length
  const uncertainCount = aligned.filter(w => w.status === 'uncertain').length

  const durationSeconds = timestamps.length >= 2
    ? (timestamps[timestamps.length - 1].start + timestamps[timestamps.length - 1].duration) - timestamps[0].start
    : 0

  const wcpm = durationSeconds > 0 ? Math.round((correctWords / durationSeconds) * 60) : 0

  const errorCounts: ErrorCounts = {
    substitutions: aligned.filter(w => w.status === 'substitution').length,
    omissions: aligned.filter(w => w.status === 'omission').length,
    insertions: aligned.filter(w => w.status === 'insertion').length,
    hesitations: detectHesitations(timestamps).length
  }

  const pausePlacement = await analyzePausePlacement(timestamps, passageText)
  const selfCorrections = detectSelfCorrections(aligned)
  const totalErrors = errorCounts.substitutions + errorCounts.omissions + errorCounts.insertions
  const selfCorrectionRate = totalErrors > 0 ? selfCorrections / totalErrors : 0
  const accuracy = totalExpected > 0 ? Math.round((correctWords / totalExpected) * 100) : 0

  return {
    wcpm,
    correctWords,
    totalWords: totalExpected,
    durationSeconds,
    errorCounts,
    pausePlacement,
    selfCorrections,
    totalErrors,
    selfCorrectionRate,
    accuracy,
    uncertainCount
  }
}
