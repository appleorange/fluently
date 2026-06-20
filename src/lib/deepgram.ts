// Fluently — Deepgram Streaming Client
// Handles microphone access + WebSocket streaming to Deepgram
// Emits only is_final: true word objects with timestamps
// 
// NOTE: Claude Code should use context7 to verify current Deepgram SDK
// streaming API before implementing. SDK has changed across versions.
// Query: "deepgram streaming browser javascript websocket"

import { WordTimestamp } from './types'

export interface DeepgramSession {
  stop: () => void
}

/**
 * Start a Deepgram streaming session.
 * 
 * @param apiKey - Deepgram API key (should come from server-side token endpoint)
 * @param onWord - callback fired for each final word with timestamp
 * @param onError - callback fired on connection or mic errors
 * @returns session object with stop() method
 */
export async function startDeepgramSession(
  apiKey: string,
  onWord: (word: WordTimestamp) => void,
  onError: (error: Error) => void
): Promise<DeepgramSession> {
  // Request microphone access
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (err) {
    onError(new Error('Microphone permission denied or unavailable'))
    return { stop: () => {} }
  }

  // Connect to Deepgram streaming endpoint
  // Key params:
  // - model: nova-2 (best accuracy)
  // - punctuate: false (punctuation breaks alignment)
  // - interim_results: false (final results only)
  // - language: en-US
  const params = new URLSearchParams({
    model: 'nova-2',
    punctuate: 'false',
    interim_results: 'false',
    language: 'en-US'
  })

  const ws = new WebSocket(
    `wss://api.deepgram.com/v1/listen?${params}`,
    ['token', apiKey]
  )

  const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })

  ws.onopen = () => {
    mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
        ws.send(event.data)
      }
    })
    mediaRecorder.start(250) // send chunks every 250ms
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      // Only process final results
      if (!data.is_final) return
      
      const words = data.channel?.alternatives?.[0]?.words ?? []
      words.forEach((w: { word: string; start: number; duration: number; confidence: number }) => {
        onWord({
          word: w.word,
          start: w.start,
          duration: w.duration,
          confidence: w.confidence
        })
      })
    } catch {
      // Ignore parse errors on non-JSON messages
    }
  }

  ws.onerror = () => {
    onError(new Error('Deepgram WebSocket connection failed'))
  }

  const stop = () => {
    mediaRecorder.stop()
    stream.getTracks().forEach(track => track.stop())
    if (ws.readyState === WebSocket.OPEN) {
      ws.close()
    }
  }

  return { stop }
}
