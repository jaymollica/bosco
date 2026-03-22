import type { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcrypt'
import sql from '../db/client.js'

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string }

    const [author] = await sql`
      SELECT * FROM authors WHERE email = ${email}
    `
    if (!author) {
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(password, author.password)
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    const token = fastify.jwt.sign({ id: author.id, email: author.email })
    return { token, author: { id: author.id, email: author.email, name: author.name } }
  })

  fastify.get('/api/auth/me', { onRequest: [fastify.authenticate] }, async (request) => {
    const { id } = request.user as { id: string }
    const [author] = await sql`
      SELECT id, email, name, created_at FROM authors WHERE id = ${id}
    `
    return author
  })

  fastify.post('/api/auth/logout', async (_request, reply) => {
    return reply.send({ ok: true })
  })
}

export default authRoutes
