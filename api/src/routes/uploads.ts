import type { FastifyPluginAsync } from 'fastify'
import path from 'path'
import fs from 'fs/promises'
import sharp from 'sharp'
import sql from '../db/client.js'
import { UPLOADS_DIR, UPLOADS_URL } from '../lib/config.js'

const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  // Upload a new image
  fastify.post('/api/uploads', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id: authorId } = request.user as { id: string }
    const data = await request.file()
    if (!data) return reply.code(400).send({ error: 'No file provided' })

    const caption = (data.fields.caption as { value?: string } | undefined)?.value ?? null

    const ext = path.extname(data.filename).toLowerCase() || '.jpg'
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
    if (!allowed.includes(ext)) {
      return reply.code(400).send({ error: 'Unsupported file type' })
    }

    const id = crypto.randomUUID()
    const filename = `${id}.webp`
    const fullPath = path.join(UPLOADS_DIR, filename)
    const url = `${UPLOADS_URL}/${filename}`

    const buffer = await data.toBuffer()

    await sharp(buffer).webp({ quality: 85 }).toFile(fullPath)

    const lqipBuffer = await sharp(buffer).resize(20).webp({ quality: 20 }).toBuffer()
    const blurPlaceholder = `data:image/webp;base64,${lqipBuffer.toString('base64')}`

    await fs.writeFile(path.join(UPLOADS_DIR, `${id}-lqip.webp`), lqipBuffer)

    await sql`
      INSERT INTO uploads (id, author_id, filename, url, blur_placeholder, caption)
      VALUES (${id}, ${authorId}, ${filename}, ${url}, ${blurPlaceholder}, ${caption})
    `

    return reply.code(201).send({ id, url, blur_placeholder: blurPlaceholder, caption })
  })

  // List all uploaded images for this author
  fastify.get('/api/uploads', { onRequest: [fastify.authenticate] }, async (request) => {
    const { id: authorId } = request.user as { id: string }
    return sql`
      SELECT id, url, blur_placeholder, caption, created_at
      FROM uploads
      WHERE author_id = ${authorId}
      ORDER BY created_at DESC
    `
  })
}

export default uploadRoutes
