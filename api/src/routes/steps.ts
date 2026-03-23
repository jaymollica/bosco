import type { FastifyPluginAsync } from 'fastify'
import sql from '../db/client.js'

const stepRoutes: FastifyPluginAsync = async (fastify) => {
  // Add step
  fastify.post('/api/trees/:id/steps', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id: treeId } = request.params as { id: string }
    const { id: authorId } = request.user as { id: string }
    const { type, position_x, position_y, content } = request.body as {
      type: string
      position_x: number
      position_y: number
      content: Record<string, unknown>
    }

    const [tree] = await sql`SELECT * FROM trees WHERE id = ${treeId} AND author_id = ${authorId}`
    if (!tree) return reply.code(404).send({ error: 'Not found' })

    const [step] = await sql`
      INSERT INTO steps (tree_version_id, type, position_x, position_y, content)
      VALUES (${tree.current_version_id}, ${type}, ${position_x}, ${position_y}, ${sql.json(content)})
      RETURNING *
    `
    return reply.code(201).send(step)
  })

  // Update step
  fastify.put('/api/trees/:id/steps/:stepId', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id: treeId, stepId } = request.params as { id: string; stepId: string }
    const { id: authorId } = request.user as { id: string }
    const { position_x, position_y, content } = request.body as {
      position_x?: number
      position_y?: number
      content?: Record<string, unknown>
    }

    const [tree] = await sql`SELECT * FROM trees WHERE id = ${treeId} AND author_id = ${authorId}`
    if (!tree) return reply.code(404).send({ error: 'Not found' })

    const [step] = await sql`SELECT * FROM steps WHERE id = ${stepId} AND tree_version_id = ${tree.current_version_id}`
    if (!step) return reply.code(404).send({ error: 'Step not found' })

    const [updated] = await sql`
      UPDATE steps SET
        position_x = COALESCE(${position_x ?? null}, position_x),
        position_y = COALESCE(${position_y ?? null}, position_y),
        content    = COALESCE(${content ? sql.json(content) : null}, content)
      WHERE id = ${stepId}
      RETURNING *
    `
    return updated
  })

  // Delete step (cascades choices)
  fastify.delete('/api/trees/:id/steps/:stepId', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id: treeId, stepId } = request.params as { id: string; stepId: string }
    const { id: authorId } = request.user as { id: string }

    const [tree] = await sql`SELECT * FROM trees WHERE id = ${treeId} AND author_id = ${authorId}`
    if (!tree) return reply.code(404).send({ error: 'Not found' })

    await sql`DELETE FROM steps WHERE id = ${stepId} AND tree_version_id = ${tree.current_version_id}`
    return reply.code(204).send()
  })

  // Add choice
  fastify.post('/api/trees/:id/choices', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id: treeId } = request.params as { id: string }
    const { id: authorId } = request.user as { id: string }
    const { from_step_id, to_step_id, label, internal_note, sort_order, image_url, blur_placeholder, caption } = request.body as {
      from_step_id: string
      to_step_id: string
      label: string
      internal_note?: string
      sort_order?: number
      image_url?: string
      blur_placeholder?: string
      caption?: string
    }

    const [tree] = await sql`SELECT * FROM trees WHERE id = ${treeId} AND author_id = ${authorId}`
    if (!tree) return reply.code(404).send({ error: 'Not found' })

    // Prevent duplicate connections
    const [existing] = to_step_id
      ? await sql`SELECT id FROM choices WHERE from_step_id = ${from_step_id} AND to_step_id = ${to_step_id}`
      : await sql`SELECT id FROM choices WHERE from_step_id = ${from_step_id} AND to_step_id IS NULL`
    if (existing) return reply.code(409).send({ error: 'Connection already exists' })

    const [choice] = await sql`
      INSERT INTO choices (from_step_id, to_step_id, label, internal_note, sort_order, image_url, blur_placeholder, caption)
      VALUES (${from_step_id}, ${to_step_id}, ${label}, ${internal_note ?? null}, ${sort_order ?? 0}, ${image_url ?? null}, ${blur_placeholder ?? null}, ${caption ?? null})
      RETURNING *
    `
    return reply.code(201).send(choice)
  })

  // Update choice
  fastify.put('/api/trees/:id/choices/:choiceId', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { choiceId } = request.params as { id: string; choiceId: string }
    const { label, internal_note, sort_order, image_url, blur_placeholder, caption } = request.body as {
      label?: string
      internal_note?: string
      sort_order?: number
      image_url?: string | null
      blur_placeholder?: string | null
      caption?: string | null
    }

    const [updated] = await sql`
      UPDATE choices SET
        label            = COALESCE(${label ?? null}, label),
        internal_note    = COALESCE(${internal_note ?? null}, internal_note),
        sort_order       = COALESCE(${sort_order ?? null}, sort_order)
        ${image_url !== undefined ? sql`, image_url = ${image_url}` : sql``}
        ${blur_placeholder !== undefined ? sql`, blur_placeholder = ${blur_placeholder}` : sql``}
        ${caption !== undefined ? sql`, caption = ${caption}` : sql``}
      WHERE id = ${choiceId}
      RETURNING *
    `
    if (!updated) return reply.code(404).send({ error: 'Not found' })
    return updated
  })

  // Delete choice
  fastify.delete('/api/trees/:id/choices/:choiceId', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { choiceId } = request.params as { id: string; choiceId: string }
    await sql`DELETE FROM choices WHERE id = ${choiceId}`
    return reply.code(204).send()
  })
}

export default stepRoutes
