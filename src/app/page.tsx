'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { SessionState, WordTimestamp, AlignedWord, Metrics, Passage, WordStatus, DiagnosticResponse, Recommendation } from '@/lib/types'
import AudioRecorder from '@/components/AudioRecorder'
import PassageDisplay from '@/components/PassageDisplay'
import DiagnosticReport from '@/components/DiagnosticReport'
import MetricsDashboard from '@/components/MetricsDashboard'
import PassageMap from '@/components/PassageMap'

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
  const [passage, setPassage] = useState<Passage | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [mapComplexity, setMapComplexity] = useState(0.5)
  const [mapRegister, setMapRegister] = useState(0.5)
  const [wordStream, setWordStream] = useState<WordTimestamp[]>([])
  const [aligned, setAligned] = useState<AlignedWord[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [report, setReport] = useState<string>('')
  const [recommendation, setRecommendation] = useState<Recommendation>('retry')
  const [reasoning, setReasoning] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [timerSeconds, setTimerSeconds] = useState(0)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const passageRef = useRef<Passage | null>(null)

  useEffect(() => { passageRef.current = passage }, [passage])

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => () => stopTimer(), [stopTimer])

  const handleGeneratePassage = useCallback(async (complexity: number, register: number) => {
    setMapComplexity(complexity)
    setMapRegister(register)
    setIsGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/generate-passage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complexity, register })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPassage(data)
    } catch {
      setError('Failed to generate passage. Please try again.')
    } finally {
      setIsGenerating(false)
    }
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
      const lookAhead = Math.min(gotWords.length + 3, passageRef.current!.words.length)
      const partialExpected = passageRef.current!.words.slice(0, lookAhead)
      const alignedWords = align(partialExpected, gotWords, wordStream)
      setAligned(alignedWords)
    }
    run()
  }, [wordStream, sessionState])

  const wordStatuses = useMemo(() => {
    const map = new Map<number, WordStatus>()

    aligned.forEach(w => {
      if (w.status !== 'insertion') map.set(w.index, w.status)
    })

    // Hesitation overlay: gap > 500ms before a word, only overrides 'correct'
    for (let i = 1; i < wordStream.length; i++) {
      const gap = (wordStream[i].start - (wordStream[i - 1].start + wordStream[i - 1].duration)) * 1000
      if (gap > 500) {
        const hit = aligned.find(w => w.timestamp?.start === wordStream[i].start)
        if (hit && map.get(hit.index) === 'correct') {
          map.set(hit.index, 'hesitation')
        }
      }
    }

    // Uncertain overlay: low-confidence substitutions may be transcription noise
    const CONFIDENCE_THRESHOLD = 0.8
    aligned.forEach(w => {
      const status = map.get(w.index)
      if ((status === 'substitution' || status === 'insertion') &&
          w.timestamp && w.timestamp.confidence < CONFIDENCE_THRESHOLD) {
        map.set(w.index, 'uncertain')
      }
    })

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
          passageTitle: currentPassage.title,
          complexity: currentPassage.complexity,
          register: currentPassage.register
        })
      })
      const data = await res.json()
      setReport(data.report)
      setRecommendation(data.recommendation ?? 'retry')
      setReasoning(data.reasoning ?? '')
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

  useEffect(() => {
    if (timerSeconds >= SESSION_DURATION && sessionState === 'recording') {
      handleSessionEnd()
    }
  }, [timerSeconds, sessionState, handleSessionEnd])

  const resetSession = useCallback((keepPassage: boolean) => {
    stopTimer()
    setTimerSeconds(0)
    setSessionState('idle')
    setWordStream([])
    setAligned([])
    setMetrics(null)
    setReport('')
    setRecommendation('retry')
    setReasoning('')
    setError('')
    if (!keepPassage) setPassage(null)
  }, [stopTimer])

  const handleRetry = useCallback(() => resetSession(true), [resetSession])
  const handleAdvance = useCallback(() => resetSession(false), [resetSession])

  const isNearEnd = timerSeconds >= 50
  const remaining = SESSION_DURATION - timerSeconds
  const showMap = sessionState === 'idle' || sessionState === 'results'

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

        {/* Headless Deepgram manager */}
        <AudioRecorder
          sessionState={sessionState}
          onWord={handleWord}
          onError={(msg) => { setError(msg); setSessionState('idle'); stopTimer() }}
        />

        {/* PassageMap — visible when idle or reviewing results */}
        {showMap && (
          <div className="mb-6">
            <p className="text-sm font-medium text-slate-700 mb-3">
              {passage ? 'Passage selected — drag to change' : 'Drop a pin to generate a passage'}
            </p>
            <PassageMap
              onGenerate={handleGeneratePassage}
              isGenerating={isGenerating}
              initialComplexity={mapComplexity}
              initialRegister={mapRegister}
            />
          </div>
        )}

        {/* Session timer + controls */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          {sessionState === 'idle' && (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-700">
                  {passage ? passage.title : 'No passage selected'}
                </p>
                <p className="text-sm text-slate-400 mt-0.5">
                  {passage ? '60 second session' : 'Drop a pin above to generate one'}
                </p>
              </div>
              <button
                onClick={startRecording}
                disabled={!passage || isGenerating}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
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
            </div>
          )}
        </div>

        {/* Passage — visible when loaded */}
        {passage && (
          <PassageDisplay passage={passage} wordStatuses={wordStatuses} />
        )}

        {/* Results */}
        {sessionState === 'results' && metrics && (
          <MetricsDashboard metrics={metrics} targetWCPM={passage?.targetWCPM} />
        )}
        {sessionState === 'results' && report && metrics && (
          <DiagnosticReport
            report={report}
            errorType={getErrorType(metrics)}
            recommendation={recommendation}
            reasoning={reasoning}
            onAdvance={handleAdvance}
            onRetry={handleRetry}
          />
        )}
      </div>
    </main>
  )
}
