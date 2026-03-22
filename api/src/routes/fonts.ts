import type { FastifyPluginAsync } from 'fastify'
import { GOOGLE_FONTS_API_KEY } from '../lib/config.js'

let cache: { family: string; variants: string[] }[] | null = null
let cacheTime = 0
const TTL = 24 * 60 * 60 * 1000 // 24 hours

const fontsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/fonts', { onRequest: [fastify.authenticate] }, async (_request, reply) => {
    if (!GOOGLE_FONTS_API_KEY) {
      return reply.code(500).send({ error: 'Google Fonts API key not configured' })
    }

    if (cache && Date.now() - cacheTime < TTL) {
      return cache
    }

    const res = await fetch(
      `https://www.googleapis.com/webfonts/v1/webfonts?key=${GOOGLE_FONTS_API_KEY}&sort=popularity`
    )
    if (!res.ok) {
      return reply.code(502).send({ error: 'Failed to fetch fonts from Google' })
    }

    const data = await res.json() as { items: { family: string; variants: string[] }[] }
    cache = data.items.map(f => ({ family: f.family, variants: f.variants }))
    cacheTime = Date.now()

    return cache
  })
}

export default fontsRoute
