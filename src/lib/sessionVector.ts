import { AlignedWord, Metrics } from './types'

const FUNCTION_WORDS = new Set([
  'a', 'an', 'the',
  'in', 'on', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up',
  'down', 'of', 'off', 'over', 'under',
  'and', 'but', 'or', 'nor', 'so', 'yet', 'although', 'because', 'since', 'unless', 'while',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their', 'this', 'that', 'these', 'those',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'can', 'could'
])

function normalize(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9']/g, '')
}

function isPolysyllabic(word: string): boolean {
  const vowelClusters = normalize(word).match(/[aeiouy]+/g) ?? []
  return vowelClusters.length >= 3
}

// Error rate among aligned words matching `predicate`, scored over correct/substitution/omission
// only — insertions have no real "expected" word, and "uncertain" is excluded since low-confidence
// words may be transcription noise rather than a genuine reader error.
function errorRate(aligned: AlignedWord[], predicate: (word: string) => boolean): number {
  let attempted = 0
  let errors = 0
  for (const w of aligned) {
    if (!w.expected || !predicate(w.expected)) continue
    if (w.status === 'correct' || w.status === 'substitution' || w.status === 'omission') {
      attempted++
      if (w.status === 'substitution' || w.status === 'omission') errors++
    }
  }
  return attempted > 0 ? errors / attempted : 0
}

// 5-dimensional reader skill vector: [complexityHandling, registerHandling, wcpmPercentile,
// pausePlacementScore, selfCorrectionRate] — see docs/ROADMAP.md "Redis AI Integration" for the spec.
export function computeSkillVector(aligned: AlignedWord[], metrics: Metrics, benchmarkWCPM: number): number[] {
  const complexityHandling = 1 - errorRate(aligned, isPolysyllabic)
  const registerHandling = 1 - errorRate(aligned, w => FUNCTION_WORDS.has(normalize(w)))
  const wcpmPercentile = benchmarkWCPM > 0 ? Math.min(metrics.wcpm / benchmarkWCPM, 1) : 0
  const pausePlacementScore = metrics.pausePlacement.boundaryPercent / 100
  const selfCorrectionRate = metrics.selfCorrectionRate

  return [complexityHandling, registerHandling, wcpmPercentile, pausePlacementScore, selfCorrectionRate]
}
