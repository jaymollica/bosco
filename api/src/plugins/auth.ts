import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import { JWT_SECRET } from '../lib/config.js'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'

const authPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(jwt, { secret: JWT_SECRET })
  await fastify.register(cookie)

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.code(401).send({ error: 'Unauthorized' })
    }
  })
}

export default fp(authPlugin)
