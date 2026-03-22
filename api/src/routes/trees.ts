import type { FastifyPluginAsync } from 'fastify'
import sql from '../db/client.js'

// Template: Intro → 1 text step → (depth-1) text branching levels → 2^depth end steps
// depth 2 → 4 outcomes, depth 3 → 8 outcomes, depth 4 → 16 outcomes
async function seedDefaultTemplate(versionId: string, depth: 2 | 3 | 4 = 4) {
  const NODE_W = 240
  const LEVEL_H = 200

  // Base canvas width on the maximum leaf count (2^depth) for this tree
  const leafCount = Math.pow(2, depth)
  const totalWidth = leafCount * NODE_W
  const centre = totalWidth / 2 - NODE_W / 2

  const xAt = (levelCount: number, index: number) => {
    const slot = totalWidth / levelCount
    return index * slot + slot / 2 - NODE_W / 2
  }

  // Intro — centred at top
  const [intro] = await sql`
    INSERT INTO steps (tree_version_id, type, position_x, position_y, content)
    VALUES (${versionId}, 'intro', ${centre}, 0,
            '{"title":"","description":"","cta_label":"Begin"}'::jsonb)
    RETURNING id
  `

  // Single step after intro
  const [first] = await sql`
    INSERT INTO steps (tree_version_id, type, position_x, position_y, content)
    VALUES (${versionId}, 'text', ${centre}, ${LEVEL_H},
            '{"headline":"","body":""}'::jsonb)
    RETURNING id
  `

  await sql`INSERT INTO choices (from_step_id, to_step_id, label, sort_order)
            VALUES (${intro.id}, ${first.id}, '', 0)`

  // Build branching levels: 2, 4, ... 2^(depth-1) text nodes, then 2^depth end nodes
  const levels: string[][] = []
  for (let l = 0; l < depth; l++) {
    const count = Math.pow(2, l + 1)
    const isLeaf = l === depth - 1
    const ids: string[] = []
    for (let i = 0; i < count; i++) {
      const [row] = await sql`
        INSERT INTO steps (tree_version_id, type, position_x, position_y, content)
        VALUES (${versionId}, ${isLeaf ? 'end' : 'text'}, ${xAt(count, i)}, ${(l + 2) * LEVEL_H},
                ${isLeaf ? '{"title":"","summary":""}' : '{"headline":"","body":""}'}::jsonb)
        RETURNING id
      `
      ids.push(row.id)
    }
    levels.push(ids)
  }

  // Wire first step → level 0 (2 nodes)
  await sql`INSERT INTO choices (from_step_id, to_step_id, label, sort_order)
            VALUES (${first.id}, ${levels[0][0]}, '', 0)`
  await sql`INSERT INTO choices (from_step_id, to_step_id, label, sort_order)
            VALUES (${first.id}, ${levels[0][1]}, '', 1)`

  // Wire each level to the next (text levels only; end levels have no choices)
  for (let l = 0; l < depth - 1; l++) {
    for (let i = 0; i < levels[l].length; i++) {
      await sql`INSERT INTO choices (from_step_id, to_step_id, label, sort_order)
                VALUES (${levels[l][i]}, ${levels[l + 1][i * 2]}, '', 0)`
      await sql`INSERT INTO choices (from_step_id, to_step_id, label, sort_order)
                VALUES (${levels[l][i]}, ${levels[l + 1][i * 2 + 1]}, '', 1)`
    }
  }
}

const treeRoutes: FastifyPluginAsync = async (fastify) => {
  // List author's trees
  fastify.get('/api/trees', { onRequest: [fastify.authenticate] }, async (request) => {
    const { id: authorId } = request.user as { id: string }
    return sql`
      SELECT t.*, tv.version_number, tv.created_at as version_created_at,
        (SELECT COUNT(*)::int FROM sessions s WHERE s.tree_id = t.id AND s.completed = true) AS completed_sessions
      FROM trees t
      LEFT JOIN tree_versions tv ON tv.id = t.current_version_id
      WHERE t.author_id = ${authorId} AND t.status != 'archived'
      ORDER BY t.created_at DESC
    `
  })

  // List archived trees
  fastify.get('/api/trees/archived', { onRequest: [fastify.authenticate] }, async (request) => {
    const { id: authorId } = request.user as { id: string }
    return sql`
      SELECT t.*, tv.version_number, tv.created_at as version_created_at
      FROM trees t
      LEFT JOIN tree_versions tv ON tv.id = t.current_version_id
      WHERE t.author_id = ${authorId} AND t.status = 'archived'
      ORDER BY t.created_at DESC
    `
  })

  // Create tree
  fastify.post('/api/trees', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id: authorId } = request.user as { id: string }
    const { title, slug, depth = 4 } = request.body as { title: string; slug: string; depth?: number }

    if (![2, 3, 4].includes(depth)) return reply.code(400).send({ error: 'depth must be 2, 3, or 4' })

    // Check slug uniqueness
    const [existing] = await sql`SELECT id FROM trees WHERE slug = ${slug}`
    if (existing) return reply.code(409).send({ error: 'Slug already taken' })

    const [tree] = await sql`
      INSERT INTO trees (author_id, title, slug)
      VALUES (${authorId}, ${title}, ${slug})
      RETURNING *
    `

    // Create initial draft version
    const [version] = await sql`
      INSERT INTO tree_versions (tree_id, version_number, theme)
      VALUES (${tree.id}, 1, '{}'::jsonb)
      RETURNING *
    `

    await seedDefaultTemplate(version.id, depth as 2 | 3 | 4)

    // Point tree at this version
    await sql`UPDATE trees SET current_version_id = ${version.id} WHERE id = ${tree.id}`

    return reply.code(201).send({ ...tree, current_version_id: version.id })
  })

  // Get tree with full step/choice graph
  fastify.get('/api/trees/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: authorId } = request.user as { id: string }

    const [tree] = await sql`
      SELECT t.*, tv.theme, tv.version_number
      FROM trees t
      JOIN tree_versions tv ON tv.id = t.current_version_id
      WHERE t.id = ${id} AND t.author_id = ${authorId}
    `
    if (!tree) return reply.code(404).send({ error: 'Not found' })

    const steps = await sql`
      SELECT * FROM steps WHERE tree_version_id = ${tree.current_version_id} ORDER BY created_at
    `
    const choices = await sql`
      SELECT c.* FROM choices c
      JOIN steps s ON s.id = c.from_step_id
      WHERE s.tree_version_id = ${tree.current_version_id}
      ORDER BY c.sort_order
    `

    return { ...tree, steps, choices }
  })

  // Update tree metadata
  fastify.put('/api/trees/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: authorId } = request.user as { id: string }
    const { title, slug } = request.body as { title?: string; slug?: string }

    const [tree] = await sql`SELECT * FROM trees WHERE id = ${id} AND author_id = ${authorId}`
    if (!tree) return reply.code(404).send({ error: 'Not found' })

    if (slug && slug !== tree.slug) {
      const [existing] = await sql`SELECT id FROM trees WHERE slug = ${slug} AND id != ${id}`
      if (existing) return reply.code(409).send({ error: 'Slug already taken' })
    }

    const [updated] = await sql`
      UPDATE trees SET
        title = COALESCE(${title ?? null}, title),
        slug  = COALESCE(${slug ?? null}, slug)
      WHERE id = ${id}
      RETURNING *
    `
    return updated
  })

  // Archive tree
  fastify.delete('/api/trees/:id', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: authorId } = request.user as { id: string }

    const [tree] = await sql`SELECT * FROM trees WHERE id = ${id} AND author_id = ${authorId}`
    if (!tree) return reply.code(404).send({ error: 'Not found' })

    await sql`UPDATE trees SET status = 'archived' WHERE id = ${id}`
    return reply.code(204).send()
  })

  // Publish tree
  fastify.post('/api/trees/:id/publish', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: authorId } = request.user as { id: string }

    const [tree] = await sql`
      SELECT t.*, tv.id as version_id, tv.version_number, tv.theme
      FROM trees t
      JOIN tree_versions tv ON tv.id = t.current_version_id
      WHERE t.id = ${id} AND t.author_id = ${authorId}
    `
    if (!tree) return reply.code(404).send({ error: 'Not found' })

    const steps = await sql`SELECT * FROM steps WHERE tree_version_id = ${tree.version_id}`
    const choices = await sql`
      SELECT c.* FROM choices c
      JOIN steps s ON s.id = c.from_step_id
      WHERE s.tree_version_id = ${tree.version_id}
    `

    // Validation
    const errors: string[] = []

    const introSteps = steps.filter((s: { type: string }) => s.type === 'intro')
    const endSteps = steps.filter((s: { type: string }) => s.type === 'end')

    if (introSteps.length === 0) errors.push('Tree must have an Intro Card')
    if (endSteps.length === 0) errors.push('Tree must have an End Card')

    for (const step of steps) {
      const c = step.content as Record<string, unknown>
      if (step.type === 'intro' && (!c.title || !c.cta_label)) {
        errors.push(`Intro Card is missing title or CTA label`)
      }
      if ((step.type === 'text' || step.type === 'image') && !c.headline) {
        errors.push(`Step "${step.id}" is missing a headline`)
      }
      if (step.type === 'end' && !c.title) {
        errors.push(`End Card is missing a title`)
      }
      if (step.type !== 'end') {
        const stepChoices = choices.filter((ch: { from_step_id: string }) => ch.from_step_id === step.id)
        const minChoices = step.type === 'intro' ? 1 : 2
        if (stepChoices.length < minChoices) {
          errors.push(`Step "${step.id}" needs at least ${minChoices} choice${minChoices > 1 ? 's' : ''}`)
        }
        for (const ch of stepChoices) {
          // Intro CTA label comes from step content, not the choice label
          if (step.type !== 'intro' && !ch.label) errors.push(`A choice on step "${step.id}" is missing a label`)
          if (!ch.to_step_id) errors.push(`A choice on step "${step.id}" has no target step`)
        }
      }
    }

    if (errors.length > 0) return reply.code(422).send({ errors })

    // Create new published version by copying rows
    const newVersionNumber = tree.version_number + 1
    const [newVersion] = await sql`
      INSERT INTO tree_versions (tree_id, version_number, theme)
      VALUES (${id}, ${newVersionNumber}, ${tree.theme})
      RETURNING *
    `

    // Copy steps with new version id, tracking old->new id map
    const idMap: Record<string, string> = {}
    for (const step of steps) {
      const [newStep] = await sql`
        INSERT INTO steps (tree_version_id, type, position_x, position_y, content)
        VALUES (${newVersion.id}, ${step.type}, ${step.position_x}, ${step.position_y}, ${step.content})
        RETURNING id
      `
      idMap[step.id] = newStep.id
    }

    // Copy choices with remapped step ids
    for (const choice of choices) {
      await sql`
        INSERT INTO choices (from_step_id, to_step_id, label, internal_note, sort_order)
        VALUES (
          ${idMap[choice.from_step_id]},
          ${idMap[choice.to_step_id]},
          ${choice.label},
          ${choice.internal_note ?? null},
          ${choice.sort_order}
        )
      `
    }

    // Handle slug history if slug changed
    const body = request.body as { slug?: string } | null
    if (body?.slug && body.slug !== tree.slug) {
      await sql`
        INSERT INTO tree_slug_history (tree_id, old_slug, new_slug)
        VALUES (${id}, ${tree.slug}, ${body.slug})
      `
      await sql`UPDATE trees SET slug = ${body.slug} WHERE id = ${id}`
    }

    const [updated] = await sql`
      UPDATE trees SET
        status = 'published',
        published_at = now(),
        current_version_id = ${newVersion.id}
      WHERE id = ${id}
      RETURNING *
    `

    return updated
  })

  // Unpublish
  fastify.post('/api/trees/:id/unpublish', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: authorId } = request.user as { id: string }

    const [tree] = await sql`SELECT * FROM trees WHERE id = ${id} AND author_id = ${authorId}`
    if (!tree) return reply.code(404).send({ error: 'Not found' })

    await sql`UPDATE trees SET status = 'draft' WHERE id = ${id}`
    return { ok: true }
  })

  // Rollback to prior version
  fastify.put('/api/trees/:id/rollback', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: authorId } = request.user as { id: string }
    const { version_id } = request.body as { version_id: string }

    const [tree] = await sql`SELECT * FROM trees WHERE id = ${id} AND author_id = ${authorId}`
    if (!tree) return reply.code(404).send({ error: 'Not found' })

    const [version] = await sql`SELECT * FROM tree_versions WHERE id = ${version_id} AND tree_id = ${id}`
    if (!version) return reply.code(404).send({ error: 'Version not found' })

    const [updated] = await sql`
      UPDATE trees SET current_version_id = ${version_id} WHERE id = ${id} RETURNING *
    `
    return updated
  })

  // Analytics — Sankey nodes + links + session stats (authenticated, by tree ID)
  fastify.get('/api/trees/:id/analytics', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: authorId } = request.user as { id: string }

    const [tree] = await sql`
      SELECT id, title, current_version_id AS version_id
      FROM trees WHERE id = ${id} AND author_id = ${authorId}
    `
    if (!tree) return reply.code(404).send({ error: 'Not found' })
    if (!tree.version_id) return { title: tree.title, stats: { total_sessions: 0, completed_sessions: 0 }, nodes: [], links: [], topPaths: [] }

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

    // Top paths: most common completed session paths (by ordered choice sequence)
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
      LIMIT 5
    `

    const stepLabel = (s: { type: string; content: Record<string, unknown> }) => {
      const c = s.content as Record<string, string>
      if (s.type === 'intro') return c.title || 'Intro'
      if (s.type === 'text' || s.type === 'image') return c.headline || s.type
      if (s.type === 'end') return c.title || 'End'
      return s.type
    }

    const nodes = steps.map((s: { id: string; type: string; content: Record<string, unknown> }) => ({
      id: s.id,
      type: s.type,
      label: stepLabel(s),
    }))

    return { title: tree.title, stats, nodes, links, topPaths }
  })

  // Update theme
  fastify.put('/api/trees/:id/theme', { onRequest: [fastify.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: authorId } = request.user as { id: string }
    const theme = request.body as Record<string, unknown>

    const [tree] = await sql`SELECT * FROM trees WHERE id = ${id} AND author_id = ${authorId}`
    if (!tree) return reply.code(404).send({ error: 'Not found' })

    const [updated] = await sql`
      UPDATE tree_versions SET theme = ${sql.json(theme)}
      WHERE id = ${tree.current_version_id}
      RETURNING theme
    `
    return updated
  })
}

export default treeRoutes
