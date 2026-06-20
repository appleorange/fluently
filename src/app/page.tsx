'use client'

// Fluently — Main Session Page
// Orchestrates the full reading session state machine:
// idle → recording → processing → results
// All state lives here, passed down to child components as props

import { useState, useCallback, useRef, useEffect } from 'react'
import { SessionState, WordTimestamp, AlignedWord, Metrics, Passage } from '@/lib/types'
import AudioRecorder from '@/components/AudioRecorder'
import PassageDisplay, { MOCK_PASSAGE, MOCK_WORD_STATUSES } from '@/components/PassageDisplay'
import DiagnosticReport, { MOCK_REPORT, MOCK_ERROR_TYPE } from '@/components/DiagnosticReport'
import MetricsDashboard, { MOCK_METRICS } from '@/components/MetricsDashboard'

const PASSAGES: Record<number, string> = {
  2: '/passages/grade2.json',
  4: '/passages/grade4.json',
  6: '/passages/grade6.json'
}

const SESSION_DURATION = 60

function formatTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
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
  const [timerSeconds, setTimerSeconds] = useState(0)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Auto-stop at 60 seconds
  useEffect(() => {
    if (timerSeconds >= SESSION_DURATION && sessionState === 'recording') {
      stopTimer()
      // TODO: call handleSessionEnd() here after pipeline is connected
      setSessionState('idle')
    }
  }, [timerSeconds, sessionState, stopTimer])

  // Cleanup on unmount
  useEffect(() => () => stopTimer(), [stopTimer])

  const startRecording = useCallback(() => {
    setTimerSeconds(0)
    setSessionState('recording')
    timerRef.current = setInterval(() => {
      setTimerSeconds(s => s + 1)
    }, 1000)
  }, [])

  const stopRecording = useCallback(() => {
    stopTimer()
    // TODO: call handleSessionEnd() here after pipeline is connected
    setSessionState('idle')
  }, [stopTimer])

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
    stopTimer()
    setTimerSeconds(0)
    setSessionState('idle')
    setWordStream([])
    setAligned([])
    setMetrics(null)
    setReport('')
    setError('')
  }

  const isNearEnd = timerSeconds >= 50
  const remaining = SESSION_DURATION - timerSeconds

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

        {/* Session timer display */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          {sessionState === 'idle' && (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-700">Ready to read</p>
                <p className="text-sm text-slate-400 mt-0.5">60 second session</p>
              </div>
              <button
                onClick={startRecording}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                Start Reading
              </button>
            </div>
          )}

          {sessionState === 'recording' && (
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-4">
                <span className={`text-5xl font-bold tabular-nums transition-colors ${isNearEnd ? 'text-amber-500' : 'text-slate-800'}`}>
                  {formatTime(timerSeconds)}
                </span>
                {isNearEnd && (
                  <span className="text-sm font-medium text-amber-500">{remaining}s left</span>
                )}
              </div>
              <button
                onClick={stopRecording}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg transition-colors"
              >
                Stop
              </button>
            </div>
          )}

          {sessionState === 'processing' && (
            <div className="flex items-center gap-3 text-slate-500">
              <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="font-medium">Processing results…</span>
            </div>
          )}

          {sessionState === 'results' && (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-700">Session complete</p>
                <p className="text-sm text-slate-400 mt-0.5">{formatTime(timerSeconds)} recorded</p>
              </div>
              <button
                onClick={handleReset}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors"
              >
                New session
              </button>
            </div>
          )}
        </div>

        {/* AudioRecorder — handles mic access and Deepgram streaming */}
        <div className="mb-6">
          <AudioRecorder
            onWord={handleWord}
            onStop={handleSessionEnd}
            sessionState={sessionState}
            setSessionState={setSessionState}
          />
        </div>

        {/* Phase 1 verification: raw word stream — remove once pipeline is verified */}
        {wordStream.length > 0 && (
          <div className="bg-slate-900 rounded-xl p-4 mb-6">
            <p className="text-slate-400 text-xs font-mono mb-3">
              DEEPGRAM OUTPUT — {wordStream.length} words
            </p>
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              {wordStream.map((w, i) => (
                <div key={i} className="font-mono text-xs text-green-400">
                  {String(i + 1).padStart(2, '0')}. &quot;{w.word}&quot; — start: {w.start.toFixed(3)}s  duration: {w.duration.toFixed(3)}s  conf: {(w.confidence * 100).toFixed(0)}%
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Passage display — always visible so reader can follow along */}
        {/* TODO: replace mock with live passage + wordStatuses from pipeline */}
        <PassageDisplay passage={MOCK_PASSAGE} wordStatuses={MOCK_WORD_STATUSES} />

        {/* Results — shown after session ends */}
        {/* TODO: gate on sessionState === 'results' once pipeline is connected */}
        <MetricsDashboard metrics={MOCK_METRICS} targetWCPM={MOCK_PASSAGE.targetWCPM} />
        <DiagnosticReport report={MOCK_REPORT} errorType={MOCK_ERROR_TYPE} />
      </div>
    </main>
  )
}
