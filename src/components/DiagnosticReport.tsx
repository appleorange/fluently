'use client'

import { ErrorType, Recommendation } from '@/lib/types'

export interface DiagnosticReportProps {
  report: string
  errorType: ErrorType
  recommendation: Recommendation
  reasoning: string
  onAdvance: () => void
  onRetry: () => void
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

export default function DiagnosticReport({ report, errorType, recommendation, reasoning, onAdvance, onRetry }: DiagnosticReportProps) {
  const config = ERROR_TYPE_CONFIG[errorType]
  const paragraphs = report.split(/\n\n+/).filter(p => p.trim().length > 0)
  const isAdvance = recommendation === 'advance'

  return (
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

      <div className="space-y-4 text-[15px]">
        {paragraphs.map((para, i) => (
          <ReportParagraph key={i} text={para} index={i} />
        ))}
      </div>

      <div className="mt-6 pt-5 border-t border-slate-100">
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
  )
}

// Mock data for visual testing — remove once real API is wired
export const MOCK_ERROR_TYPE: ErrorType = 'decoding'

export const MOCK_REPORT = `Maya is reading at approximately 87 words correct per minute, which is below the expected target of 115 WCPM for a Grade 4 student.

The primary pattern observed is **decoding difficulty**. Maya made 3 substitution errors in a 56-word passage, often replacing multi-syllable words with simpler alternatives. This suggests she is relying on word shape recognition rather than phonetic decoding strategies.

One hesitation was noted before "She," indicating a brief pause at a sentence boundary — this is not a concern at this frequency.

**Recommended next steps:**
Practice multi-syllable decoding (compound words, common suffixes -ing, -ed, -tion). Use repeated reading exercises with the same passage to build automaticity. Continue with grade-level texts — fluency should improve with targeted decoding support over 4–6 weeks.`
