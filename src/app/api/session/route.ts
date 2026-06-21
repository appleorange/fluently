import { getRedis } from '@/lib/redis'
import { Metrics } from '@/lib/types'

const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days

interface SessionLogRequest {
  readerId: string
  sessionId: string
  passageId: string
  passageGrade: number
  passageComplexity?: number
  passageRegister?: number
  metrics: Metrics
  skillVector: number[]
}

export async function POST(request: Request) {
  try {
    const body: SessionLogRequest = await request.json()
    const { readerId, sessionId, passageId, passageGrade, passageComplexity, passageRegister, metrics, skillVector } = body

    if (!readerId || !sessionId || !metrics || !skillVector) {
      return Response.json({ error: 'Missing required session fields' }, { status: 400 })
    }

    const redis = await getRedis()

    // Exact schema per docs/ROADMAP.md "Redis AI Integration" — errorDetail (per-error POS/
    // semantic-class tagging) is omitted for now; that data doesn't exist until the separate
    // "Semantic substitution classification" stretch feature is built.
    const sessionDoc = {
      sessionId,
      readerId,
      timestamp: Date.now(),
      passageId,
      passageGrade,
      passageComplexity,
      passageRegister,
      metrics: {
        wcpm: metrics.wcpm,
        accuracy: metrics.accuracy,
        durationSeconds: metrics.durationSeconds,
        correctWords: metrics.correctWords,
        totalWords: metrics.totalWords
      },
      errorCounts: metrics.errorCounts,
      pausePlacement: metrics.pausePlacement,
      selfCorrections: metrics.selfCorrections,
      selfCorrectionRate: metrics.selfCorrectionRate,
      skillVector
    }

    const sessionKey = `reader:${readerId}:sessions:${sessionId}`
    const indexKey = `reader:${readerId}:sessionIndex`

    await redis.set(sessionKey, JSON.stringify(sessionDoc), { EX: SESSION_TTL_SECONDS })
    const sessionCount = await redis.rPush(indexKey, sessionId)
    await redis.expire(indexKey, SESSION_TTL_SECONDS)

    return Response.json({ sessionCount })
  } catch (error) {
    console.error('Session log error:', error)
    return Response.json({ error: 'Failed to log session' }, { status: 500 })
  }
}
