import { AlignedWord, WordTimestamp } from './types'

function normalize(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9']/g, '')
}

function isLowConfidence(ts: WordTimestamp | undefined): boolean {
  return ts !== undefined && ts.confidence < 0.7
}

export function align(
  expected: string[],
  got: string[],
  timestamps: WordTimestamp[] = []
): AlignedWord[] {
  const m = expected.length
  const n = got.length

  // dp[i][j] = min edits to align expected[0..i-1] with got[0..j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (normalize(expected[i - 1]) === normalize(got[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j - 1], // substitution
          dp[i - 1][j],     // omission (expected word skipped)
          dp[i][j - 1]      // insertion (extra word from reader)
        )
      }
    }
  }

  // Traceback: reconstruct alignment from DP table
  const aligned: AlignedWord[] = []
  let i = m
  let j = n

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && normalize(expected[i - 1]) === normalize(got[j - 1])) {
      aligned.unshift({
        expected: expected[i - 1],
        got: got[j - 1],
        status: 'correct',
        index: i - 1,
        timestamp: timestamps[j - 1]
      })
      i--; j--
    } else if (i === 0) {
      // No expected words left — everything remaining in got is an insertion
      const ts = timestamps[j - 1]
      aligned.unshift({
        expected: '',
        got: got[j - 1],
        status: isLowConfidence(ts) ? 'uncertain' : 'insertion',
        index: 0,
        timestamp: ts
      })
      j--
    } else if (j === 0) {
      // No got words left — everything remaining in expected is an omission
      aligned.unshift({
        expected: expected[i - 1],
        got: null,
        status: 'omission',
        index: i - 1
      })
      i--
    } else {
      // Determine cheapest path; prefer substitution on ties
      const sub = dp[i - 1][j - 1]
      const omit = dp[i - 1][j]
      const ins = dp[i][j - 1]
      const minCost = Math.min(sub, omit, ins)

      if (sub === minCost) {
        const ts = timestamps[j - 1]
        aligned.unshift({
          expected: expected[i - 1],
          got: got[j - 1],
          status: isLowConfidence(ts) ? 'uncertain' : 'substitution',
          index: i - 1,
          timestamp: ts
        })
        i--; j--
      } else if (omit === minCost) {
        aligned.unshift({
          expected: expected[i - 1],
          got: null,
          status: 'omission',
          index: i - 1
        })
        i--
      } else {
        const ts = timestamps[j - 1]
        aligned.unshift({
          expected: '',
          got: got[j - 1],
          status: isLowConfidence(ts) ? 'uncertain' : 'insertion',
          index: i,
          timestamp: ts
        })
        j--
      }
    }
  }

  return aligned
}
