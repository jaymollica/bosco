import Fastify from 'fastify'
import multipart from '@fastify/multipart'
import cors from '@fastify/cors'
import authPlugin from './plugins/auth.js'
import authRoutes from './routes/auth.js'
import treeRoutes from './routes/trees.js'
import stepRoutes from './routes/steps.js'
import uploadRoutes from './routes/uploads.js'
import fontsRoute from './routes/fonts.js'
import playerRoutes from './routes/player.js'
import { PORT } from './lib/config.js'

const fastify = Fastify({ logger: true })

// Augment fastify type for authenticate decorator
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

await fastify.register(cors, {
  origin: ['https://bosco.vaguespac.es', 'http://localhost:5173'],
  credentials: true,
})
await fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }) // 10MB
await fastify.register(authPlugin)

await fastify.register(authRoutes)
await fastify.register(treeRoutes)
await fastify.register(stepRoutes)
await fastify.register(uploadRoutes)
await fastify.register(fontsRoute)
await fastify.register(playerRoutes)

fastify.get('/api/health', async () => ({ ok: true }))

try {
  await fastify.listen({ port: PORT, host: '127.0.0.1' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
