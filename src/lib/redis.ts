import { createClient, type RedisClientType } from 'redis'

// Cache the client on globalThis so Next.js dev-mode hot reloads don't pile up
// new connections on every module re-evaluation.
const globalForRedis = globalThis as unknown as { redisClient?: RedisClientType }

function buildClient(): RedisClientType {
  const url = process.env.REDIS_URL
  if (!url) {
    throw new Error('REDIS_URL is not set — add it to .env.local')
  }
  const client = createClient({
    url,
    socket: {
      // Idle connections on Redis Cloud's free tier get dropped silently; keepAlive pings
      // periodically so dead sockets are detected and reconnected before a real command
      // hits one and hangs until OS-level TCP timeout (~60s, the ETIMEDOUT we saw live).
      keepAlive: true,
      keepAliveInitialDelay: 5000,
      reconnectStrategy: (retries) => Math.min(retries * 100, 2000)
    }
  })
  // If the socket dies between requests, drop the cached reference so the next getRedis()
  // call rebuilds a fresh client instead of repeatedly handing back a zombie connection.
  client.on('error', (err) => {
    console.error('Redis client error:', err.message)
    if (globalForRedis.redisClient === client) {
      globalForRedis.redisClient = undefined
    }
  })
  return client
}

export async function getRedis(): Promise<RedisClientType> {
  if (!globalForRedis.redisClient) {
    globalForRedis.redisClient = buildClient()
  }
  const client = globalForRedis.redisClient
  if (!client.isOpen) {
    await client.connect()
  }
  return client
}
