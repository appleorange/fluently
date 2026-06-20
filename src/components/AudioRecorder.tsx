'use client'

import { useEffect, useRef } from 'react'
import { startDeepgramSession, DeepgramSession } from '@/lib/deepgram'
import { WordTimestamp, SessionState } from '@/lib/types'

interface Props {
  sessionState: SessionState
  onWord: (word: WordTimestamp) => void
  onError: (error: string) => void
}

// Headless component — no UI. Watches sessionState and starts/stops Deepgram accordingly.
// Page's own Start/Stop buttons drive sessionState; this component reacts to it.
export default function AudioRecorder({ sessionState, onWord, onError }: Props) {
  const sessionRef = useRef<DeepgramSession | null>(null)

  useEffect(() => {
    if (sessionState !== 'recording') {
      sessionRef.current?.stop()
      sessionRef.current = null
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch('/api/deepgram-token')
        const data = await res.json()
        if (cancelled) return
        if (!data.key) throw new Error('Could not get Deepgram token')

        const session = await startDeepgramSession(data.key, onWord, (err) => {
          onError(err.message)
        })
        if (cancelled) { session.stop(); return }
        sessionRef.current = session
      } catch (err) {
        if (!cancelled) onError(err instanceof Error ? err.message : 'Failed to start recording')
      }
    })()

    return () => {
      cancelled = true
      sessionRef.current?.stop()
      sessionRef.current = null
    }
  }, [sessionState])

  return null
}
