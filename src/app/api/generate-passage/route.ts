import { generatePassage } from '@/lib/generatePassage'

export async function POST(request: Request) {
  try {
    const { complexity, register } = await request.json()

    if (typeof complexity !== 'number' || typeof register !== 'number') {
      return Response.json({ error: 'Missing complexity or register' }, { status: 400 })
    }

    const passage = await generatePassage(complexity, register)
    return Response.json(passage)
  } catch (error) {
    console.error('generate-passage error:', error)
    return Response.json({ error: 'Failed to generate passage' }, { status: 500 })
  }
}
