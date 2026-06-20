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

export async function computeMetrics(
  aligned: AlignedWord[],
  timestamps: WordTimestamp[],
  passageText: string
): Promise<Metrics> {
  const correctWords = aligned.filter(w => w.status === 'correct').length
  const totalExpected = aligned.filter(w => w.status !== 'insertion').length

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
  const accuracy = totalExpected > 0 ? Math.round((correctWords / totalExpected) * 100) : 0

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
