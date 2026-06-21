import { WordTimestamp } from './types'

export interface DeepgramSession {
  stop: () => void
}

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

  const params = new URLSearchParams({
    model: 'nova-3',
    punctuate: 'false',
    interim_results: 'false',
    language: 'en' // accent-agnostic English, not en-US-optimized — accent fairness
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
      if (!data.is_final) return

      const words = data.channel?.alternatives?.[0]?.words ?? []
      words.forEach((w: { word: string; start: number; end: number; confidence: number }) => {
        onWord({
          word: w.word,
          start: w.start,
          duration: w.end - w.start,
          confidence: w.confidence
        })
      })
    } catch {
      // ignore non-JSON control messages from Deepgram
    }
  }

  ws.onerror = () => {
    onError(new Error('Deepgram WebSocket connection failed'))
  }

  ws.onclose = (event) => {
    if (!event.wasClean) {
      onError(new Error(`Deepgram connection closed unexpectedly (code ${event.code})`))
    }
  }

  const stop = () => {
    mediaRecorder.stop()
    stream.getTracks().forEach(track => track.stop())
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'CloseStream' }))
      ws.close()
    }
  }

  return { stop }
}
