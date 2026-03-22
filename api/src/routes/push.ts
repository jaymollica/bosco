import type { FastifyPluginAsync } from 'fastify'
import sql from '../db/client.js'
import { VAPID_PUBLIC_KEY } from '../lib/config.js'

const pushRoutes: FastifyPluginAsync = async (fastify) => {
  // Return VAPID public key for client subscription
  fastify.get('/api/push/vapid-key', async () => {
    return { key: VAPID_PUBLIC_KEY || null }
  })

  // Subscribe to push notifications
  fastify.post('/api/push/subscribe', async (request, reply) => {
    const { endpoint, keys } = request.body as {
      endpoint: string
      keys: { p256dh: string; auth: string }
    }
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return reply.code(400).send({ error: 'Missing subscription data' })
    }

    await sql`
      INSERT INTO push_subscriptions (endpoint, p256dh, auth)
      VALUES (${endpoint}, ${keys.p256dh}, ${keys.auth})
      ON CONFLICT (endpoint) DO UPDATE SET p256dh = ${keys.p256dh}, auth = ${keys.auth}
    `
    return reply.code(201).send({ ok: true })
  })

  // Unsubscribe from push notifications
  fastify.delete('/api/push/subscribe', async (request) => {
    const { endpoint } = request.body as { endpoint: string }
    if (endpoint) {
      await sql`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`
    }
    return { ok: true }
  })
}

export default pushRoutes
