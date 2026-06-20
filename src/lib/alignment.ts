// Fluently — Levenshtein Alignment Pipeline
// Pure function — no side effects, no API calls, fully testable offline
// Takes expected word array and transcribed word array, returns aligned result

import { AlignedWord, WordTimestamp } from './types'

/**
 * Normalize a word for comparison:
 * - lowercase
 * - strip punctuation
 * This ensures "The" === "the" and "dog," === "dog"
 */
function normalize(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9']/g, '')
}

/**
 * Core Levenshtein alignment using dynamic programming.
 * Returns the minimum edit sequence to transform `got` into `expected`.
 * 
 * Each operation is one of:
 * - correct: word matches
 * - substitution: different word in same position
 * - omission: word in expected but missing from got (reader skipped it)
 * - insertion: word in got but not in expected (reader added it)
 */
export function align(
  expected: string[],
  got: string[],
  timestamps: WordTimestamp[] = []
): AlignedWord[] {
  const m = expected.length
  const n = got.length

  // Build DP table
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (normalize(expected[i - 1]) === normalize(got[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],     // omission (skip expected word)
          dp[i][j - 1],     // insertion (extra word from reader)
          dp[i - 1][j - 1]  // substitution
        )
      }
    }
  }

  // Traceback to reconstruct alignment
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
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] <= dp[i - 1][j] && dp[i][j - 1] <= dp[i - 1][j - 1])) {
      // Insertion — reader said a word that wasn't in the passage
      aligned.unshift({
        expected: '',
        got: got[j - 1],
        status: 'insertion',
        index: i,
        timestamp: timestamps[j - 1]
      })
      j--
    } else if (i > 0 && (j === 0 || dp[i - 1][j] <= dp[i][j - 1] && dp[i - 1][j] <= dp[i - 1][j - 1])) {
      // Omission — reader skipped a word
      aligned.unshift({
        expected: expected[i - 1],
        got: null,
        status: 'omission',
        index: i - 1
      })
      i--
    } else {
      // Substitution — reader said wrong word
      aligned.unshift({
        expected: expected[i - 1],
        got: got[j - 1],
        status: 'substitution',
        index: i - 1,
        timestamp: timestamps[j - 1]
      })
      i--
      j--
    }
  }

  return aligned
}
