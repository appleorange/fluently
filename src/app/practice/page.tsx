'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { SessionState, WordTimestamp, AlignedWord, Metrics, Passage, WordStatus, DiagnosticResponse, Recommendation, HistoryPoint, NextPassageRecommendation } from '@/lib/types'
import { align } from '@/lib/alignment'
import AudioRecorder from '@/components/AudioRecorder'
import PassageDisplay from '@/components/PassageDisplay'
import DiagnosticReport, { ReadingHistory } from '@/components/DiagnosticReport'
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

function slugify(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

const READER_ID_KEY = 'fluently-reader-id'

export default function PracticePage() {
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
  const [nextPassage, setNextPassage] = useState<NextPassageRecommendation | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [processingStep, setProcessingStep] = useState<1 | 2 | 3>(1)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const passageRef = useRef<Passage | null>(null)
  const readerIdRef = useRef<string>('')
  const sessionIdRef = useRef<string>('')

  useEffect(() => { passageRef.current = passage }, [passage])

  useEffect(() => {
    let id = localStorage.getItem(READER_ID_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(READER_ID_KEY, id)
    }
    readerIdRef.current = id
  }, [])

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
      setSessionState('idle')
      setWordStream([])
      setAligned([])
      setMetrics(null)
      setReport('')
      setRecommendation('retry')
      setReasoning('')
      setNextPassage(null)
      setHistory([])
    } catch {
      setError('Failed to generate passage. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }, [])

  const handleWord = useCallback((word: WordTimestamp) => {
    setWordStream(prev => [...prev, word])
  }, [])

  useEffect(() => {
    if (sessionState !== 'recording' || !passageRef.current || wordStream.length === 0) return
    const gotWords = wordStream.map(w => w.word)
    const lookAhead = Math.min(gotWords.length + 3, passageRef.current!.words.length)
    const partialExpected = passageRef.current!.words.slice(0, lookAhead)
    setAligned(align(partialExpected, gotWords, wordStream))
  }, [wordStream, sessionState])

  const wordStatuses = useMemo(() => {
    const map = new Map<number, WordStatus>()
    aligned.forEach(w => {
      if (w.status !== 'insertion') map.set(w.index, w.status)
    })
    for (let i = 1; i < wordStream.length; i++) {
      const gap = (wordStream[i].start - (wordStream[i - 1].start + wordStream[i - 1].duration)) * 1000
      if (gap > 500) {
        const hit = aligned.find(w => w.timestamp?.start === wordStream[i].start)
        if (hit && map.get(hit.index) === 'correct') {
          map.set(hit.index, 'hesitation')
        }
      }
    }
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
    if (!currentPassage) return
    stopTimer()
    if (wordStream.length === 0) {
      setSessionState('idle')
      setError('No speech detected. Please try again.')
      return
    }
    setSessionState('processing')
    setProcessingStep(1)
    try {
      const gotWords = wordStream.map(w => w.word)
      const alignedWords = align(currentPassage.words, gotWords, wordStream)
      setAligned(alignedWords)
      setProcessingStep(2)
      const { computeMetrics } = await import('@/lib/metrics')
      const computedMetrics = await computeMetrics(alignedWords, wordStream, currentPassage.text)
      setProcessingStep(3)
      setMetrics(computedMetrics)

      const { computeSkillVector } = await import('@/lib/sessionVector')
      const skillVector = computeSkillVector(alignedWords, computedMetrics, currentPassage.targetWCPM)

      // diagnose must run BEFORE the session gets logged — otherwise a fast Redis write can
      // complete before diagnose's history fetch, making a session see itself as its own prior
      const res = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: computedMetrics,
          passageGrade: currentPassage.grade,
          passageTitle: currentPassage.title,
          passageId: currentPassage.passageId,
          targetWCPM: currentPassage.targetWCPM,
          readerId: readerIdRef.current,
          complexity: currentPassage.complexity,
          register: currentPassage.register,
          skillVector
        })
      })

      // Fire-and-forget session log — a failed write shouldn't block the user seeing their report
      fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          readerId: readerIdRef.current,
          sessionId: sessionIdRef.current,
          passageId: currentPassage.passageId ?? `${slugify(currentPassage.title)}-g${currentPassage.grade}`,
          passageTitle: currentPassage.title,
          passageGrade: currentPassage.grade,
          passageComplexity: currentPassage.complexity,
          passageRegister: currentPassage.register,
          metrics: computedMetrics,
          skillVector
        })
      }).catch(err => console.error('Session log failed:', err))
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to generate report')
      setReport(data.report)
      setRecommendation(data.recommendation ?? 'retry')
      setReasoning(data.reasoning ?? '')
      setNextPassage(data.nextPassage ?? null)
      setHistory(data.history ?? [])
      setSessionState('results')
    } catch {
      setError('Something went wrong. Please try again.')
      setSessionState('idle')
    }
  }, [wordStream, stopTimer])

  const startRecording = useCallback(() => {
    sessionIdRef.current = crypto.randomUUID()
    setError('')
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
    setProcessingStep(1)
    if (!keepPassage) setPassage(null)
  }, [stopTimer])

  const handleRetry = useCallback(() => resetSession(true), [resetSession])
  const handleAdvance = useCallback(() => resetSession(false), [resetSession])

  const handleAcceptRecommendation = useCallback(() => {
    const recommended = nextPassage?.recommended
    if (!recommended) return
    setPassage({
      passageId: recommended.passageId,
      title: recommended.title,
      source: recommended.source,
      text: recommended.text,
      words: recommended.words,
      grade: recommended.grade,
      targetWCPM: recommended.targetWCPM,
      complexity: recommended.complexity,
      register: recommended.register
    })
    setMapComplexity(recommended.complexity)
    setMapRegister(recommended.register)
    resetSession(true)
  }, [nextPassage, resetSession])

  const isNearEnd = timerSeconds >= 50
  const remaining = SESSION_DURATION - timerSeconds

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Headless Deepgram manager */}
      <AudioRecorder
        sessionState={sessionState}
        onWord={handleWord}
        onError={(msg) => { setError(msg); setSessionState('idle'); stopTimer() }}
      />

      {/* ── Blue gradient hero (idle + recording) ── */}
      {(sessionState === 'idle' || sessionState === 'recording') && (
        <div className="relative bg-gradient-to-br from-sky-400 via-blue-600 to-indigo-900 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.12)_0%,_transparent_60%)] pointer-events-none" />
          <div className="max-w-5xl mx-auto px-6 py-14 relative">
            {sessionState === 'idle' && (
              <>
                <h1 className="text-3xl font-bold text-white">Let&apos;s practice!</h1>
                <p className="text-blue-100 mt-1.5 text-base">
                  Read the passage aloud. We&apos;ll listen and give feedback.
                </p>
              </>
            )}
            {sessionState === 'recording' && (
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    {passage?.title ?? 'Reading…'}
                  </h1>
                  <p className="text-blue-100 mt-1 text-sm">
                    Oral Reading Fluency · 60 second session
                  </p>
                  {/* Animated waveform bars */}
                  <div className="flex items-end gap-[3px] h-6 mt-3">
                    {[0.6, 1, 0.75, 1, 0.5, 0.85, 0.65, 1, 0.7, 0.9, 0.55, 0.8].map((delay, i) => (
                      <span
                        key={i}
                        className="waveform-bar block w-1 rounded-full bg-white/70"
                        style={{ height: '100%', animationDelay: `${(i * delay * 0.12).toFixed(2)}s` }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <span className={`text-5xl font-bold tabular-nums ${isNearEnd ? 'text-amber-300' : 'text-white'}`}>
                      {formatTime(timerSeconds)}
                    </span>
                    {isNearEnd && (
                      <p className="text-amber-300 text-sm font-medium mt-0.5">{remaining}s left</p>
                    )}
                  </div>
                  <button
                    onClick={handleSessionEnd}
                    className="px-6 py-3 bg-white text-blue-700 hover:bg-blue-50 font-semibold rounded-xl text-sm transition-colors"
                  >
                    Stop
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        {/* ── Idle state ── */}
        {sessionState === 'idle' && (
          <div className="grid grid-cols-[360px_1fr] gap-6 items-start">
            {/* PassageMap — no selection shown at all until a passage has actually been chosen */}
            <PassageMap
              onGenerate={handleGeneratePassage}
              isGenerating={isGenerating}
              initialComplexity={passage ? mapComplexity : undefined}
              initialRegister={passage ? mapRegister : undefined}
              recommendedPosition={null}
            />

            {/* Passage info card */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 h-full flex flex-col">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
                Choose Your Passage
              </p>

              {passage ? (
                <>
                  <h2 className="text-lg font-bold text-slate-800">{passage.title}</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Grade {passage.grade} · Target: {passage.targetWCPM} WCPM
                  </p>
                  <p className="text-sm text-slate-400 mt-0.5">60 second session</p>
                </>
              ) : (
                <p className="text-sm text-slate-400 leading-relaxed">
                  Drop a pin anywhere on the canvas to generate a passage at that reading level.
                </p>
              )}

              <div className="mt-auto pt-6">
                <button
                  onClick={startRecording}
                  disabled={!passage || isGenerating}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-colors"
                >
                  {isGenerating ? 'Generating…' : 'Start Reading'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Passage skeleton while generating */}
        {sessionState === 'idle' && isGenerating && (
          <div className="mt-6 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="h-3 bg-slate-100 rounded-full w-1/4 mb-5 animate-pulse" />
            <div className="space-y-2.5">
              {[1, 0.95, 0.88, 1, 0.72, 0.9, 0.6].map((w, i) => (
                <div
                  key={i}
                  className="h-2.5 bg-slate-100 rounded-full animate-pulse"
                  style={{ width: `${w * 100}%`, animationDelay: `${i * 0.07}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Passage display — idle (preview) */}
        {sessionState === 'idle' && passage && !isGenerating && (
          <div className="mt-6">
            <PassageDisplay passage={passage} wordStatuses={wordStatuses} />
          </div>
        )}

        {/* ── Recording state — passage with live color coding ── */}
        {sessionState === 'recording' && passage && (
          <PassageDisplay passage={passage} wordStatuses={wordStatuses} />
        )}

        {/* ── Processing state ── */}
        {sessionState === 'processing' && (
          <div className="flex flex-col items-center justify-center py-24 gap-8">
            <div className="text-center">
              <h2 className="text-lg font-semibold text-slate-800">Processing results</h2>
              <p className="text-sm text-slate-400 mt-1">Hang tight, this takes a few seconds</p>
            </div>

            <div className="flex flex-col gap-4 w-full max-w-xs">
              {([
                { label: 'Aligning transcript', step: 1 },
                { label: 'Computing metrics',   step: 2 },
                { label: 'Writing your report', step: 3 },
              ] as const).map(({ label, step }) => {
                const done   = processingStep > step
                const active = processingStep === step
                return (
                  <div key={step} className={`flex items-center gap-3 transition-opacity duration-300 ${active || done ? 'opacity-100' : 'opacity-30'}`}>
                    <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                      {done ? (
                        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : active ? (
                        <svg className="animate-spin w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-slate-200" />
                      )}
                    </div>
                    <span className={`text-sm font-medium transition-colors duration-300 ${done ? 'text-green-600' : active ? 'text-slate-800' : 'text-slate-400'}`}>
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="w-full max-w-xs h-1 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${((processingStep - 1) / 3) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Results state ── */}
        {sessionState === 'results' && (
          <>
            {/* Session complete header */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Session Complete 🎉</h2>
                <p className="text-slate-500 text-sm mt-1">Great job! Here&apos;s how you did.</p>
                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  {formatTime(timerSeconds)} recorded
                </p>
              </div>
              <div className="text-5xl select-none" aria-hidden="true">🏆</div>
            </div>

            {passage && (
              <div className="mb-6">
                <PassageDisplay passage={passage} wordStatuses={wordStatuses} />
              </div>
            )}

            {metrics && <MetricsDashboard metrics={metrics} targetWCPM={passage?.targetWCPM} />}

            {history.length > 1 && <ReadingHistory history={history} />}

            {report && metrics && (
              <DiagnosticReport
                report={report}
                errorType={getErrorType(metrics)}
                recommendation={recommendation}
                reasoning={reasoning}
                selfCorrections={metrics.selfCorrections}
                selfCorrectionRate={metrics.selfCorrectionRate}
                history={history}
                nextPassage={nextPassage}
                onAdvance={handleAdvance}
                onRetry={handleRetry}
                onAcceptRecommendation={handleAcceptRecommendation}
              />
            )}

            {nextPassage?.recommended && passage?.complexity !== undefined && passage?.register !== undefined && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mt-6">
                <h2 className="font-semibold text-slate-800 mb-1">Where this fits on the map</h2>
                <p className="text-xs text-slate-400 mb-4">
                  Orange is where you just read; blue is the recommended next position.
                </p>
                <PassageMap
                  key={passage.passageId}
                  onGenerate={() => {}}
                  isGenerating={false}
                  initialComplexity={passage.complexity}
                  initialRegister={passage.register}
                  recommendedPosition={nextPassage.target}
                  readOnly
                />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
