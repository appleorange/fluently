// Fluently — Shared TypeScript Interfaces

export interface WordTimestamp {
  word: string
  start: number      // seconds from session start
  duration: number   // seconds
  confidence: number // 0-1 from Deepgram
}

export type WordStatus = 'correct' | 'substitution' | 'omission' | 'insertion' | 'hesitation' | 'uncertain' | 'pending'

export interface AlignedWord {
  expected: string
  got: string | null      // null for omissions
  status: WordStatus
  index: number           // position in expected passage
  timestamp?: WordTimestamp
}

export interface ErrorCounts {
  substitutions: number
  omissions: number
  insertions: number
  hesitations: number
}

export interface PausePlacement {
  totalPauses: number
  atBoundary: number      // pauses at syntactic boundaries
  midPhrase: number       // pauses mid-phrase (problematic)
  boundaryPercent: number // % of pauses at correct boundaries
}

export interface Metrics {
  wcpm: number
  correctWords: number
  totalWords: number
  durationSeconds: number
  errorCounts: ErrorCounts
  pausePlacement: PausePlacement
  selfCorrections: number
  totalErrors: number          // substitutions + omissions + insertions (denominator for selfCorrectionRate)
  selfCorrectionRate: number   // 0-1, selfCorrections / totalErrors (0 if no errors)
  accuracy: number        // 0-100 percentage
}

export interface Passage {
  grade: number
  title: string
  source: string
  text: string
  words: string[]
  targetWCPM: number
  complexity?: number  // 0-1, present on AI-generated passages
  register?: number    // 0-1, present on AI-generated passages
}

export type ErrorType = 'decoding' | 'phrasing' | 'mixed' | 'fluent'
export type Recommendation = 'advance' | 'retry' | 'repeat'

export interface DiagnosticResponse {
  report: string
  errorType: ErrorType
  recommendation: Recommendation
  reasoning: string
}

export type SessionState = 'idle' | 'recording' | 'processing' | 'results'
