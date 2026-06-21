'use client'

import { ErrorType, Recommendation, HistoryPoint, NextPassageRecommendation } from '@/lib/types'

export interface DiagnosticReportProps {
  report: string
  errorType: ErrorType
  recommendation: Recommendation
  reasoning: string
  selfCorrections: number
  selfCorrectionRate: number
  history: HistoryPoint[]
  nextPassage: NextPassageRecommendation | null
  onAdvance: () => void
  onRetry: () => void
  onAcceptRecommendation: () => void
}

const ERROR_TYPE_CONFIG: Record<ErrorType, { label: string; badge: string }> = {
  fluent:   { label: 'Fluent Reader',              badge: 'bg-green-100 text-green-700'  },
  phrasing: { label: 'Phrasing Difficulty',        badge: 'bg-yellow-100 text-yellow-700' },
  mixed:    { label: 'Mixed Fluency Challenges',   badge: 'bg-orange-100 text-orange-700' },
  decoding: { label: 'Decoding Difficulty',        badge: 'bg-red-100 text-red-700'      },
}

function ReportParagraph({ text, index }: { text: string; index: number }) {
  // Handle **bold** from Claude markdown output
  const parts = text.split(/\*\*(.*?)\*\*/g)
  return (
    <p key={index} className="text-slate-700 leading-relaxed">
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i} className="font-semibold text-slate-800">{part}</strong> : part
      )}
    </p>
  )
}

function TrendArrow({ delta }: { delta: number }) {
  if (delta > 0) return <span className="text-green-600">↑</span>
  if (delta < 0) return <span className="text-red-500">↓</span>
  return <span className="text-slate-400">→</span>
}

function ReadingHistory({ history }: { history: HistoryPoint[] }) {
  return (
    <div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Reading history</h3>
      <div className="flex gap-4 overflow-x-auto">
        {history.map((point, i) => {
          const prev = history[i - 1]
          return (
            <div key={i} className="shrink-0 text-center min-w-[72px]">
              <p className="text-[11px] text-slate-400 mb-1">Session {i + 1}</p>
              <p className="text-sm font-semibold text-slate-700">
                {point.wcpm} <span className="text-[11px] text-slate-400">wcpm</span>
                {prev && <TrendArrow delta={point.wcpm - prev.wcpm} />}
              </p>
              <p className="text-sm font-semibold text-slate-700">
                {point.accuracy}% <span className="text-[11px] text-slate-400">acc</span>
                {prev && <TrendArrow delta={point.accuracy - prev.accuracy} />}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function complexityLabel(c: number): string {
  if (c < 0.3) return 'easier'
  if (c < 0.6) return 'medium difficulty'
  return 'harder'
}

function registerLabel(r: number): string {
  if (r < 0.4) return 'casual'
  if (r < 0.6) return 'professional-casual'
  return 'formal'
}

function NextPassageCard({ nextPassage, onAccept }: { nextPassage: NextPassageRecommendation; onAccept: () => void }) {
  const { target, recommended } = nextPassage
  if (!recommended) return null
  return (
    <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl p-4">
      <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Your next passage</h3>
      <p className="text-sm font-semibold text-slate-800 mb-1">{recommended.title}</p>
      <p className="text-xs text-slate-500 mb-3">
        {complexityLabel(target.complexity)}, {registerLabel(target.register)} — targets your weakest area this session ({nextPassage.weakestDimension})
      </p>
      <button
        onClick={onAccept}
        className="text-sm font-medium text-blue-700 hover:text-blue-900 transition-colors"
      >
        Read this passage →
      </button>
    </div>
  )
}

export default function DiagnosticReport({ report, errorType, recommendation, reasoning, selfCorrections, selfCorrectionRate, history, nextPassage, onAdvance, onRetry, onAcceptRecommendation }: DiagnosticReportProps) {
  const config = ERROR_TYPE_CONFIG[errorType]
  const paragraphs = report.split(/\n\n+/).filter(p => p.trim().length > 0)
  const isAdvance = recommendation === 'advance'

  return (
    <>
    {history.length > 1 && <ReadingHistory history={history} />}
    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="font-semibold text-slate-800 text-lg">Reading Assessment Report</h2>
          <p className="text-xs text-slate-400 mt-0.5">For parent or teacher review</p>
        </div>
        <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${config.badge}`}>
          {config.label}
        </span>
      </div>

      {selfCorrections > 0 && (
        <div className="mb-5 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-green-100 shrink-0">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-green-800">
              {selfCorrections} self-correction{selfCorrections > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-green-600">
              {Math.round(selfCorrectionRate * 100)}% of errors caught and fixed — a real strength
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4 text-[15px]">
        {paragraphs.map((para, i) => (
          <ReportParagraph key={i} text={para} index={i} />
        ))}
      </div>

      <div className="mt-6 pt-5 border-t border-slate-100">
        {nextPassage && <NextPassageCard nextPassage={nextPassage} onAccept={onAcceptRecommendation} />}

        <p className="text-xs text-slate-400 mb-3">{reasoning}</p>

        {isAdvance ? (
          <div className="flex flex-col gap-2">
            <button
              onClick={onAdvance}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors"
            >
              Next passage →
            </button>
            <button
              onClick={onRetry}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              or redo this passage
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              onClick={onRetry}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors"
            >
              Try again
            </button>
            <button
              onClick={onAdvance}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              or advance to next passage anyway →
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  )
}

// Mock data for visual testing — remove once real API is wired
export const MOCK_ERROR_TYPE: ErrorType = 'decoding'

export const MOCK_REPORT = `Maya is reading at approximately 87 words correct per minute, which is below the expected target of 115 WCPM for a Grade 4 student.

The primary pattern observed is **decoding difficulty**. Maya made 3 substitution errors in a 56-word passage, often replacing multi-syllable words with simpler alternatives. This suggests she is relying on word shape recognition rather than phonetic decoding strategies.

One hesitation was noted before "She," indicating a brief pause at a sentence boundary — this is not a concern at this frequency.

**Recommended next steps:**
Practice multi-syllable decoding (compound words, common suffixes -ing, -ed, -tion). Use repeated reading exercises with the same passage to build automaticity. Continue with grade-level texts — fluency should improve with targeted decoding support over 4–6 weeks.`
