'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { SessionState, WordTimestamp, AlignedWord, Metrics, Passage, WordStatus, DiagnosticResponse } from '@/lib/types'
import AudioRecorder from '@/components/AudioRecorder'
import PassageDisplay from '@/components/PassageDisplay'
import DiagnosticReport from '@/components/DiagnosticReport'
import MetricsDashboard from '@/components/MetricsDashboard'

const PASSAGES: Record<number, string> = {
  2: '/passages/grade2.json',
  4: '/passages/grade4.json',
  6: '/passages/grade6.json'
}

const SESSION_DURATION = 60

function formatTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function getErrorType(metrics: Metrics): DiagnosticResponse['errorType'] {
  const decodingIssue = metrics.accuracy < 90
  const phrasingIssue = metrics.pausePlacement.boundaryPercent < 50
  if (decodingIssue && phrasingIssue) return 'mixed'
  if (decodingIssue) return 'decoding'
  if (phrasingIssue) return 'phrasing'
  return 'fluent'
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
  const passageRef = useRef<Passage | null>(null)

  // Keep passageRef in sync so real-time alignment can read it without stale closure
  useEffect(() => { passageRef.current = passage }, [passage])

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => () => stopTimer(), [stopTimer])

  // Load default passage on mount
  useEffect(() => {
    fetch(PASSAGES[4]).then(r => r.json()).then(setPassage)
  }, [])

  const loadPassage = useCallback(async (grade: number) => {
    const res = await fetch(PASSAGES[grade])
    const data: Passage = await res.json()
    setPassage(data)
  }, [])

  const handleWord = useCallback((word: WordTimestamp) => {
    setWordStream(prev => [...prev, word])
  }, [])

  // Real-time alignment: runs after every new word during recording
  useEffect(() => {
    if (sessionState !== 'recording' || !passageRef.current || wordStream.length === 0) return

    const run = async () => {
      const { align } = await import('@/lib/alignment')
      const gotWords = wordStream.map(w => w.word)
      // Look ahead by 3 to catch insertions without marking unread words as omissions
      const lookAhead = Math.min(gotWords.length + 3, passageRef.current!.words.length)
      const partialExpected = passageRef.current!.words.slice(0, lookAhead)
      const alignedWords = align(partialExpected, gotWords, wordStream)
      setAligned(alignedWords)
    }
    run()
  }, [wordStream, sessionState])

  // wordStatuses Map for PassageDisplay — alignment statuses + real-time hesitation detection
  const wordStatuses = useMemo(() => {
    const map = new Map<number, WordStatus>()

    aligned.forEach(w => {
      if (w.status !== 'insertion') map.set(w.index, w.status)
    })

    // Overlay hesitations: if gap > 500ms before a word, mark it yellow
    // Only override 'correct' — keep error colors on error words
    for (let i = 1; i < wordStream.length; i++) {
      const gap = (wordStream[i].start - (wordStream[i - 1].start + wordStream[i - 1].duration)) * 1000
      if (gap > 500) {
        const hit = aligned.find(w => w.timestamp?.start === wordStream[i].start)
        if (hit && map.get(hit.index) === 'correct') {
          map.set(hit.index, 'hesitation')
        }
      }
    }

    return map
  }, [aligned, wordStream])

  const handleSessionEnd = useCallback(async () => {
    const currentPassage = passageRef.current
    if (!currentPassage || wordStream.length === 0) return
    stopTimer()
    setSessionState('processing')

    try {
      const { align } = await import('@/lib/alignment')
      const gotWords = wordStream.map(w => w.word)
      const alignedWords = align(currentPassage.words, gotWords, wordStream)
      setAligned(alignedWords)

      const { computeMetrics } = await import('@/lib/metrics')
      const computedMetrics = await computeMetrics(alignedWords, wordStream, currentPassage.text)
      setMetrics(computedMetrics)

      const res = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: computedMetrics,
          passageGrade: currentPassage.grade,
          passageTitle: currentPassage.title
        })
      })
      const data = await res.json()
      setReport(data.report)
      setSessionState('results')
    } catch {
      setError('Something went wrong. Please try again.')
      setSessionState('idle')
    }
  }, [wordStream, stopTimer])

  const startRecording = useCallback(() => {
    setTimerSeconds(0)
    setWordStream([])
    setAligned([])
    setSessionState('recording')
    timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000)
  }, [])

  // Auto-stop at 60s
  useEffect(() => {
    if (timerSeconds >= SESSION_DURATION && sessionState === 'recording') {
      handleSessionEnd()
    }
  }, [timerSeconds, sessionState, handleSessionEnd])

  const handleReset = useCallback(() => {
    stopTimer()
    setTimerSeconds(0)
    setSessionState('idle')
    setWordStream([])
    setAligned([])
    setMetrics(null)
    setReport('')
    setError('')
  }, [stopTimer])

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

        {/* Headless Deepgram manager — reacts to sessionState */}
        <AudioRecorder
          sessionState={sessionState}
          onWord={handleWord}
          onError={(msg) => { setError(msg); setSessionState('idle'); stopTimer() }}
        />

        {/* Grade selector */}
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

        {/* Session timer + controls */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          {sessionState === 'idle' && (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-700">Ready to read</p>
                <p className="text-sm text-slate-400 mt-0.5">60 second session</p>
              </div>
              <button
                onClick={startRecording}
                disabled={!passage}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold rounded-lg transition-colors"
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
                onClick={handleSessionEnd}
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

        {/* Passage — always visible when loaded, colors update in real time */}
        {passage && (
          <PassageDisplay passage={passage} wordStatuses={wordStatuses} />
        )}

        {/* Results — only shown after session completes */}
        {sessionState === 'results' && metrics && (
          <MetricsDashboard metrics={metrics} targetWCPM={passage?.targetWCPM} />
        )}
        {sessionState === 'results' && report && metrics && (
          <DiagnosticReport report={report} errorType={getErrorType(metrics)} />
        )}
      </div>
    </main>
  )
}
