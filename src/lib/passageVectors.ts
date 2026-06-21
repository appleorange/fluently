import { SCHEMA_FIELD_TYPE, SCHEMA_VECTOR_FIELD_ALGORITHM } from 'redis'
import { getRedis } from './redis'
import { Recommendation } from './types'

export interface PassageTarget {
  complexity: number
  register: number
}

// Skill vector dimension order, matching src/lib/sessionVector.ts exactly
const SKILL_DIMENSIONS = ['complexityHandling', 'registerHandling', 'wcpmPercentile', 'pausePlacementScore', 'selfCorrectionRate'] as const
const STEP = 0.15

// selfCorrectionRate is excluded from "weakest dimension" comparisons. Unlike the other 4
// dimensions (which can all cleanly reach 1.0 for a strong reader), selfCorrectionRate =
// selfCorrections / totalErrors is structurally capped low for any skilled reader — it's 0 both
// in the worst case (errors, none caught) AND the best case (zero errors, nothing to catch). That
// makes it win the "weakest" comparison almost by construction, regardless of real improvement,
// since it's not on a comparable scale to the other four. Still stored in the vector for trend
// tracking (e.g. Progress page) — just not used to decide what the reader's core weakness is.
const COMPARABLE_DIMENSIONS = 4 // indices 0-3; index 4 (selfCorrectionRate) excluded

function weakestComparableIndex(skillVector: number[]): number {
  const comparable = skillVector.slice(0, COMPARABLE_DIMENSIONS)
  return comparable.indexOf(Math.min(...comparable))
}

// Only complexityHandling/registerHandling map to a real PassageMap axis (X/Y). The other two
// comparable dimensions (wcpm, pause placement) have no axis to move along, so a weakness there
// leaves the target unchanged — Claude's existing per-session exercises address it instead.
// Escalation (moving further into the weak axis) only happens when the session recommendation
// was "advance" — on retry, more reps at the same difficulty beats piling on a harder version of
// what the reader is already struggling with.
export function computeNextTarget(
  skillVector: number[],
  recommendation: Recommendation,
  currentComplexity: number,
  currentRegister: number
): PassageTarget {
  const weakestIndex = weakestComparableIndex(skillVector)
  const isMapAxisWeakness = weakestIndex === 0 || weakestIndex === 1
  const shouldEscalate = recommendation === 'advance'

  if (!isMapAxisWeakness || !shouldEscalate) {
    return { complexity: currentComplexity, register: currentRegister }
  }

  if (weakestIndex === 0) {
    return { complexity: Math.min(currentComplexity + STEP, 1), register: currentRegister }
  }
  return { complexity: currentComplexity, register: Math.min(currentRegister + STEP, 1) }
}

export function weakestDimensionLabel(skillVector: number[]): string {
  return SKILL_DIMENSIONS[weakestComparableIndex(skillVector)]
}

const INDEX_NAME = 'idx:passages'
const KEY_PREFIX = 'passage:'

async function ensurePassageIndex(): Promise<void> {
  const redis = await getRedis()
  try {
    await redis.ft.create(INDEX_NAME, {
      '$.passageId': { type: SCHEMA_FIELD_TYPE.TEXT, AS: 'passageId' },
      '$.title': { type: SCHEMA_FIELD_TYPE.TEXT, AS: 'title' },
      '$.complexity': { type: SCHEMA_FIELD_TYPE.NUMERIC, AS: 'complexity' },
      '$.register': { type: SCHEMA_FIELD_TYPE.NUMERIC, AS: 'register' },
      '$.vector': {
        type: SCHEMA_FIELD_TYPE.VECTOR,
        AS: 'vector',
        ALGORITHM: SCHEMA_VECTOR_FIELD_ALGORITHM.FLAT,
        TYPE: 'FLOAT32',
        DIM: 2,
        DISTANCE_METRIC: 'L2'
      }
    }, { ON: 'JSON', PREFIX: KEY_PREFIX })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('Index already exists')) throw error
  }
}

// Full passage payload, not just the search-indexed fields — so a KNN match can be served
// directly to the reader without regenerating. Only passageId/title/complexity/register/vector
// are part of the FT.CREATE schema; text/words/grade/targetWCPM/source just ride along in the
// same JSON document, fetched via a follow-up JSON.GET after KNN narrows down the passageId.
export interface StoredPassage {
  passageId: string
  title: string
  complexity: number
  register: number
  text: string
  words: string[]
  grade: number
  targetWCPM: number
  source: string
}

export async function storePassageVector(passage: StoredPassage): Promise<void> {
  await ensurePassageIndex()
  const redis = await getRedis()
  await redis.json.set(`${KEY_PREFIX}${passage.passageId}`, '$', {
    ...passage,
    vector: [passage.complexity, passage.register]
  })
}

function toFloat32Buffer(values: number[]): Buffer {
  return Buffer.from(new Float32Array(values).buffer)
}

// Returns the closest stored passage to `target`, or null if the library is empty or nothing
// is close enough to be a meaningful suggestion (max distance ~0.1 across both axes combined).
const MAX_USEFUL_DISTANCE = 0.1

export async function findNearestPassage(target: PassageTarget): Promise<StoredPassage | null> {
  try {
    await ensurePassageIndex()
    const redis = await getRedis()
    const result = await redis.ft.search(INDEX_NAME, '*=>[KNN 1 @vector $B AS score]', {
      PARAMS: { B: toFloat32Buffer([target.complexity, target.register]) },
      RETURN: ['score', 'passageId'],
      DIALECT: 2
    })
    if (result.total === 0) return null
    const score = Number(result.documents[0].value.score)
    if (!Number.isFinite(score) || score > MAX_USEFUL_DISTANCE) return null

    const passageId = String(result.documents[0].value.passageId)
    const full = await redis.json.get(`${KEY_PREFIX}${passageId}`)
    return full as StoredPassage | null
  } catch (error) {
    console.error('Passage vector search failed:', error)
    return null
  }
}
