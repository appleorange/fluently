'use client'

import { useEffect, useRef, useState } from 'react'
import { startDeepgramSession, DeepgramSession } from '@/lib/deepgram'
import { WordTimestamp, SessionState } from '@/lib/types'

interface Props {
  onWord: (word: WordTimestamp) => void
  onStop: () => void
  sessionState: SessionState
  setSessionState: (state: SessionState) => void
}

export default function AudioRecorder({ onWord, onStop, sessionState, setSessionState }: Props) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [error, setError] = useState<string>('')
  const sessionRef = useRef<DeepgramSession | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startTimer = () => {
    setElapsedSeconds(0)
    timerRef.current = setInterval(() => {
      setElapsedSeconds(s => s + 1)
    }, 1000)
  }

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const handleStart = async () => {
    setError('')
    try {
      const res = await fetch('/api/deepgram-token')
      const data = await res.json()
      if (!data.key) throw new Error('Could not get Deepgram token')

      const session = await startDeepgramSession(
        data.key,
        onWord,
        (err) => {
          setError(err.message)
          stopTimer()
          setSessionState('idle')
        }
      )
      sessionRef.current = session
      setSessionState('recording')
      startTimer()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording')
    }
  }

  const handleStop = () => {
    sessionRef.current?.stop()
    sessionRef.current = null
    stopTimer()
    onStop()
  }

  useEffect(() => {
    return () => {
      sessionRef.current?.stop()
      stopTimer()
    }
  }, [])

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4">
        {sessionState === 'idle' || sessionState === 'results' ? (
          <button
            onClick={handleStart}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 active:scale-95 transition-all"
          >
            Start Reading
          </button>
        ) : sessionState === 'recording' ? (
          <>
            <button
              onClick={handleStop}
              className="px-6 py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 active:scale-95 transition-all"
            >
              Stop
            </button>
            <div className="flex items-center gap-2 text-slate-600">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono text-lg">{formatTime(elapsedSeconds)}</span>
            </div>
          </>
        ) : (
          <div className="text-slate-500 text-sm">Processing...</div>
        )}
      </div>
    </div>
  )
}
