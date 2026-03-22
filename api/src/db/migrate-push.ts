import sql from './client.js'

async function migratePush() {
  await sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      endpoint    TEXT UNIQUE NOT NULL,
      p256dh      TEXT NOT NULL,
      auth        TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS push_subscriptions_endpoint ON push_subscriptions(endpoint)`
  console.log('Push subscriptions table created')
  process.exit(0)
}

migratePush().catch(err => { console.error(err); process.exit(1) })
