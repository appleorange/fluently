// Fluently — Deepgram Token Endpoint
// Returns the Deepgram API key server-side so it never reaches the browser directly
// In production, this would use Deepgram's temporary token API

export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'Deepgram API key not configured' }, { status: 500 })
  }
  // For hackathon: return key directly
  // For production: use Deepgram's /v1/auth/grant endpoint for temporary tokens
  return Response.json({ key: apiKey })
}
