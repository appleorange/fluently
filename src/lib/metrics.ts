// Fluently — Metrics Computation
// Pure function — takes alignment output + timestamps, returns structured Metrics object
// No API calls, no side effects

import { AlignedWord, ErrorCounts, Metrics, PausePlacement, WordTimestamp } from './types'

const HESITATION_THRESHOLD_MS = 500 // 500ms pause = hesitation marker

/**
 * Detect hesitations from timestamp gaps between consecutive words
 */
function detectHesitations(timestamps: WordTimestamp[]): number[] {
  const hesitationIndices: number[] = []
  for (let i = 1; i < timestamps.length; i++) {
    const prev = timestamps[i - 1]
    const curr = timestamps[i]
    const gapMs = (curr.start - (prev.start + prev.duration)) * 1000
    if (gapMs > HESITATION_THRESHOLD_MS) {
      hesitationIndices.push(i)
    }
  }
  return hesitationIndices
}

/**
 * Analyze pause placement relative to syntactic boundaries in the passage.
 * Uses compromise.js to identify phrase boundaries in the TARGET text.
 * Pauses at boundaries = good phrasing. Pauses mid-phrase = phrasing fluency issue.
 * 
 * NOTE: Claude Code should use context7 to get up-to-date compromise.js docs
 * before implementing this function. Import compromise client-side only.
 */
async function analyzePausePlacement(
  timestamps: WordTimestamp[],
  passageText: string
): Promise<PausePlacement> {
  // Dynamic import for browser-only usage
  const nlp = (await import('compromise')).default
  const doc = nlp(passageText)

  // Get phrase boundary positions from compromise
  // Phrases end at: sentence boundaries, clause boundaries, prepositional phrases
  const phrases = doc.json() as Array<{ terms: Array<{ text: string }> }>
  const boundaryWords = new Set<string>()
  phrases.forEach(phrase => {
    if (phrase.terms.length > 0) {
      const lastWord = phrase.terms[phrase.terms.length - 1].text.toLowerCase()
      boundaryWords.add(lastWord)
    }
  })

  const pauseTimestamps = detectHesitations(timestamps)
  let atBoundary = 0
  let midPhrase = 0

  pauseTimestamps.forEach(idx => {
    const prevWord = timestamps[idx - 1]?.word?.toLowerCase() ?? ''
    if (boundaryWords.has(prevWord)) {
      atBoundary++
    } else {
      midPhrase++
    }
  })

  const totalPauses = pauseTimestamps.length
  return {
    totalPauses,
    atBoundary,
    midPhrase,
    boundaryPercent: totalPauses > 0 ? Math.round((atBoundary / totalPauses) * 100) : 100
  }
}

/**
 * Detect self-corrections: an error immediately followed by the correct word
 */
function detectSelfCorrections(aligned: AlignedWord[]): number {
  let count = 0
  for (let i = 0; i < aligned.length - 1; i++) {
    if (
      aligned[i].status === 'substitution' &&
      aligned[i + 1].status === 'correct' &&
      aligned[i + 1].expected === aligned[i].expected
    ) {
      count++
    }
  }
  return count
}

/**
 * Main metrics computation
 */
export async function computeMetrics(
  aligned: AlignedWord[],
  timestamps: WordTimestamp[],
  passageText: string
): Promise<Metrics> {
  const correctWords = aligned.filter(w => w.status === 'correct').length
  const totalExpected = aligned.filter(w => w.status !== 'insertion').length

  // Duration from first to last word timestamp
  const durationSeconds = timestamps.length >= 2
    ? (timestamps[timestamps.length - 1].start + timestamps[timestamps.length - 1].duration) - timestamps[0].start
    : 0

  const wcpm = durationSeconds > 0
    ? Math.round((correctWords / durationSeconds) * 60)
    : 0

  const errorCounts: ErrorCounts = {
    substitutions: aligned.filter(w => w.status === 'substitution').length,
    omissions: aligned.filter(w => w.status === 'omission').length,
    insertions: aligned.filter(w => w.status === 'insertion').length,
    hesitations: detectHesitations(timestamps).length
  }

  const pausePlacement = await analyzePausePlacement(timestamps, passageText)
  const selfCorrections = detectSelfCorrections(aligned)
  const accuracy = totalExpected > 0
    ? Math.round((correctWords / totalExpected) * 100)
    : 0

  return {
    wcpm,
    correctWords,
    totalWords: totalExpected,
    durationSeconds,
    errorCounts,
    pausePlacement,
    selfCorrections,
    accuracy
  }
}
