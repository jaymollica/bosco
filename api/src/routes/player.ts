import type { FastifyPluginAsync } from 'fastify'
import sql from '../db/client.js'

const playerRoutes: FastifyPluginAsync = async (fastify) => {
  // List all published trees (public)
  fastify.get('/api/published', async () => {
    return sql`
      SELECT t.id, t.title, t.slug, t.published_at, tv.theme,
             (SELECT s.content FROM steps s WHERE s.tree_version_id = tv.id AND s.type = 'intro' LIMIT 1) AS intro_content
      FROM trees t
      JOIN tree_versions tv ON tv.id = t.current_version_id
      WHERE t.status = 'published'
      ORDER BY t.published_at DESC
    `
  })

  // Get published tree by slug (public)
  fastify.get('/api/t/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string }

    const [tree] = await sql`
      SELECT t.id, t.title, t.slug, tv.id AS tree_version_id, tv.theme
      FROM trees t
      JOIN tree_versions tv ON tv.id = t.current_version_id
      WHERE t.slug = ${slug} AND t.status = 'published'
    `

    if (!tree) {
      const [history] = await sql`
        SELECT t.slug
        FROM tree_slug_history h
        JOIN trees t ON t.id = h.tree_id
        WHERE h.old_slug = ${slug}
        ORDER BY h.created_at DESC
        LIMIT 1
      `
      if (history) return reply.redirect(301, `/t/${history.slug}`)
      return reply.code(404).send({ error: 'Not found' })
    }

    const steps = await sql`
      SELECT id, type, content
      FROM steps
      WHERE tree_version_id = ${tree.tree_version_id}
    `

    const choices = await sql`
      SELECT c.id, c.from_step_id, c.to_step_id, c.label, c.sort_order, c.image_url, c.blur_placeholder, c.caption
      FROM choices c
      JOIN steps s ON s.id = c.from_step_id
      WHERE s.tree_version_id = ${tree.tree_version_id}
      ORDER BY c.sort_order
    `

    return { id: tree.id, title: tree.title, slug: tree.slug, tree_version_id: tree.tree_version_id, theme: tree.theme, steps, choices }
  })

  // Create anonymous session (public)
  fastify.post('/api/sessions', async (request, reply) => {
    const { tree_id, tree_version_id } = request.body as { tree_id: string; tree_version_id: string }
    const [session] = await sql`
      INSERT INTO sessions (tree_id, tree_version_id)
      VALUES (${tree_id}, ${tree_version_id})
      RETURNING id
    `
    return reply.code(201).send({ id: session.id })
  })

  // Record session event: step arrival (choice_id null) or choice selection (choice_id set)
  fastify.post('/api/sessions/:id/events', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { step_id, choice_id } = request.body as { step_id: string; choice_id?: string | null }
    await sql`
      INSERT INTO session_events (session_id, step_id, choice_id)
      VALUES (${id}, ${step_id}, ${choice_id ?? null})
    `
    return reply.code(201).send({ ok: true })
  })

  // Complete session
  fastify.post('/api/sessions/:id/complete', async (request) => {
    const { id } = request.params as { id: string }
    await sql`
      UPDATE sessions SET completed = true, completed_at = now()
      WHERE id = ${id} AND completed = false
    `
    return { ok: true }
  })

  // Session summary — returns ordered choice_ids for path highlighting
  fastify.get('/api/sessions/:id/summary', async (request, reply) => {
    const { id } = request.params as { id: string }
    const [session] = await sql`SELECT id, completed FROM sessions WHERE id = ${id}`
    if (!session) return reply.code(404).send({ error: 'Not found' })
    const events = await sql`
      SELECT choice_id
      FROM session_events
      WHERE session_id = ${id} AND choice_id IS NOT NULL
      ORDER BY timestamp
    `
    return {
      session_id: id,
      completed: session.completed,
      choice_ids: events.map((e: { choice_id: string }) => e.choice_id),
    }
  })

  // Analytics — Sankey nodes + links + session stats (public)
  fastify.get('/api/t/:slug/analytics', async (request, reply) => {
    const { slug } = request.params as { slug: string }
    const [tree] = await sql`
      SELECT t.id, t.title, t.current_version_id as version_id
      FROM trees t
      WHERE t.slug = ${slug} AND t.status = 'published'
    `
    if (!tree) return reply.code(404).send({ error: 'Not found' })

    const steps = await sql`
      SELECT id, type, content FROM steps WHERE tree_version_id = ${tree.version_id}
    `

    const links = await sql`
      WITH counts AS (
        SELECT se.choice_id, COUNT(*)::int AS value
        FROM session_events se
        JOIN sessions sess ON sess.id = se.session_id
        WHERE sess.tree_id = ${tree.id} AND se.choice_id IS NOT NULL
        GROUP BY se.choice_id
      )
      SELECT c.id AS choice_id, c.from_step_id AS source, c.to_step_id AS target,
             c.label, COALESCE(cn.value, 0) AS value
      FROM choices c
      JOIN steps s ON s.id = c.from_step_id AND s.tree_version_id = ${tree.version_id}
      LEFT JOIN counts cn ON cn.choice_id = c.id
      ORDER BY c.sort_order
    `

    const [stats] = await sql`
      SELECT COUNT(*)::int AS total_sessions,
             COUNT(*) FILTER (WHERE completed = true)::int AS completed_sessions
      FROM sessions WHERE tree_id = ${tree.id}
    `

    // Terminal steps = steps whose outgoing choices all have to_step_id IS NULL
    const [endStepStats] = await sql`
      SELECT
        (SELECT COUNT(*)::int FROM steps s
         WHERE s.tree_version_id = ${tree.version_id}
         AND EXISTS (SELECT 1 FROM choices c WHERE c.from_step_id = s.id AND c.to_step_id IS NULL)
         AND NOT EXISTS (SELECT 1 FROM choices c WHERE c.from_step_id = s.id AND c.to_step_id IS NOT NULL)
        ) AS total_endings,
        (SELECT COUNT(DISTINCT se.step_id)::int
         FROM session_events se
         JOIN sessions sess ON sess.id = se.session_id
         JOIN steps s ON s.id = se.step_id
         WHERE sess.tree_id = ${tree.id}
         AND EXISTS (SELECT 1 FROM choices c WHERE c.from_step_id = s.id AND c.to_step_id IS NULL)
         AND NOT EXISTS (SELECT 1 FROM choices c WHERE c.from_step_id = s.id AND c.to_step_id IS NOT NULL)
         AND se.choice_id IS NULL
        ) AS endings_reached
    `

    const topPaths = await sql`
      WITH paths AS (
        SELECT sess.id AS session_id,
               ARRAY_AGG(se.choice_id ORDER BY se.timestamp) AS choice_path
        FROM sessions sess
        JOIN session_events se ON se.session_id = sess.id
        WHERE sess.tree_id = ${tree.id} AND sess.completed = true AND se.choice_id IS NOT NULL
        GROUP BY sess.id
      )
      SELECT choice_path, COUNT(*)::int AS count
      FROM paths
      GROUP BY choice_path
      ORDER BY count DESC
      LIMIT 10
    `

    const nodes = steps.map((s: { id: string; type: string; content: Record<string, unknown> }) => ({
      id: s.id,
      type: s.type,
      label: stepLabel(s),
    }))

    return { title: tree.title, stats: { ...stats, ...endStepStats }, nodes, links, topPaths }
  })
}

function stepLabel(step: { type: string; content: Record<string, unknown> }): string {
  const c = step.content as Record<string, string>
  if (step.type === 'intro') return c.title || 'Intro'
  if (step.type === 'text' || step.type === 'image') return c.headline || step.type
  return step.type
}

export default playerRoutes
