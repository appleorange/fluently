'use client'

// Fluently — Main Session Page
// Orchestrates the full reading session state machine:
// idle → recording → processing → results
// All state lives here, passed down to child components as props

import { useState, useCallback, useRef } from 'react'
import { SessionState, WordTimestamp, AlignedWord, Metrics, Passage } from '@/lib/types'

// TODO: import components as they are built
// import AudioRecorder from '@/components/AudioRecorder'
// import PassageDisplay from '@/components/PassageDisplay'
// import DiagnosticReport from '@/components/DiagnosticReport'
// import MetricsDashboard from '@/components/MetricsDashboard'

const PASSAGES: Record<number, string> = {
  2: '/passages/grade2.json',
  4: '/passages/grade4.json',
  6: '/passages/grade6.json'
}

export default function Home() {
  const [sessionState, setSessionState] = useState<SessionState>('idle')
  const [selectedGrade, setSelectedGrade] = useState<number>(4)
  const [passage, setPassage] = useState<Passage | null>(null)
  const [wordStream, setWordStream] = useState<WordTimestamp[]>([])
  const [aligned, setAligned] = useState<AlignedWord[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [report, setReport] = useState<string>('')
  const [error, setError] = useState<string>('')

  // Load passage on grade selection
  const loadPassage = useCallback(async (grade: number) => {
    const res = await fetch(PASSAGES[grade])
    const data: Passage = await res.json()
    setPassage(data)
  }, [])

  // Called by AudioRecorder when a new word arrives from Deepgram
  const handleWord = useCallback((word: WordTimestamp) => {
    setWordStream(prev => [...prev, word])
  }, [])

  // Called when recording stops — runs full pipeline
  const handleSessionEnd = useCallback(async () => {
    if (!passage || wordStream.length === 0) return
    setSessionState('processing')

    try {
      // 1. Align transcript against expected passage
      const { align } = await import('@/lib/alignment')
      const gotWords = wordStream.map(w => w.word)
      const alignedWords = align(passage.words, gotWords, wordStream)
      setAligned(alignedWords)

      // 2. Compute metrics
      const { computeMetrics } = await import('@/lib/metrics')
      const computedMetrics = await computeMetrics(alignedWords, wordStream, passage.text)
      setMetrics(computedMetrics)

      // 3. Get Claude diagnostic report
      const res = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: computedMetrics,
          passageGrade: passage.grade,
          passageTitle: passage.title
        })
      })
      const data = await res.json()
      setReport(data.report)
      setSessionState('results')
    } catch (err) {
      setError('Something went wrong processing the session. Please try again.')
      setSessionState('idle')
    }
  }, [passage, wordStream])

  const handleReset = () => {
    setSessionState('idle')
    setWordStream([])
    setAligned([])
    setMetrics(null)
    setReport('')
    setError('')
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Fluently</h1>
        <p className="text-slate-500 mb-8">Oral reading fluency assessment</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Grade selector — only shown when idle */}
        {sessionState === 'idle' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Select grade level
            </label>
            <div className="flex gap-3">
              {[2, 4, 6].map(grade => (
                <button
                  key={grade}
                  onClick={() => { setSelectedGrade(grade); loadPassage(grade) }}
                  className={`px-6 py-2 rounded-lg border font-medium transition-colors ${
                    selectedGrade === grade
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
                  }`}
                >
                  Grade {grade}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Components render here — Claude Code fills these in as phases complete */}
        {/* <PassageDisplay passage={passage} aligned={aligned} sessionState={sessionState} /> */}
        {/* <AudioRecorder onWord={handleWord} onStop={handleSessionEnd} sessionState={sessionState} setSessionState={setSessionState} /> */}
        {/* {sessionState === 'results' && metrics && <MetricsDashboard metrics={metrics} />} */}
        {/* {sessionState === 'results' && report && <DiagnosticReport report={report} />} */}

        {/* Placeholder UI until components are built */}
        {passage && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
            <h2 className="font-semibold text-slate-700 mb-3">{passage.title} — Grade {passage.grade}</h2>
            <p className="text-slate-600 leading-relaxed">{passage.text}</p>
          </div>
        )}

        <div className="text-slate-400 text-sm">
          Session state: <span className="font-mono">{sessionState}</span>
          {wordStream.length > 0 && ` — ${wordStream.length} words captured`}
        </div>

        {sessionState === 'results' && (
          <button
            onClick={handleReset}
            className="mt-4 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
          >
            Start new session
          </button>
        )}
      </div>
    </main>
  )
}
