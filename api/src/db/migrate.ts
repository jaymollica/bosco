import postgres from 'postgres'
import { DB_URL } from '../lib/config.js'

const sql = postgres(DB_URL)

async function migrate() {
  await sql.unsafe(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    -- Authors
    CREATE TABLE IF NOT EXISTS authors (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email      TEXT UNIQUE NOT NULL,
      name       TEXT NOT NULL,
      password   TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Trees
    CREATE TABLE IF NOT EXISTS trees (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      author_id          UUID REFERENCES authors(id),
      title              TEXT NOT NULL,
      slug               TEXT UNIQUE NOT NULL,
      status             TEXT NOT NULL DEFAULT 'draft',
      current_version_id UUID,
      created_at         TIMESTAMPTZ DEFAULT now(),
      published_at       TIMESTAMPTZ
    );

    -- Slug redirect history
    CREATE TABLE IF NOT EXISTS tree_slug_history (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tree_id    UUID REFERENCES trees(id),
      old_slug   TEXT NOT NULL,
      new_slug   TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Tree versions
    CREATE TABLE IF NOT EXISTS tree_versions (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tree_id        UUID REFERENCES trees(id),
      version_number INT NOT NULL,
      theme          JSONB NOT NULL DEFAULT '{}',
      created_at     TIMESTAMPTZ DEFAULT now(),
      UNIQUE (tree_id, version_number)
    );

    -- Steps
    CREATE TABLE IF NOT EXISTS steps (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tree_version_id  UUID REFERENCES tree_versions(id) ON DELETE CASCADE,
      type             TEXT NOT NULL,
      position_x       FLOAT NOT NULL DEFAULT 0,
      position_y       FLOAT NOT NULL DEFAULT 0,
      content          JSONB NOT NULL DEFAULT '{}',
      created_at       TIMESTAMPTZ DEFAULT now()
    );

    -- Choices
    CREATE TABLE IF NOT EXISTS choices (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      from_step_id  UUID REFERENCES steps(id) ON DELETE CASCADE,
      to_step_id    UUID REFERENCES steps(id) ON DELETE CASCADE,
      label         TEXT NOT NULL DEFAULT '',
      internal_note TEXT,
      sort_order    INT NOT NULL DEFAULT 0,
      created_at    TIMESTAMPTZ DEFAULT now()
    );

    -- Sessions (anonymous)
    CREATE TABLE IF NOT EXISTS sessions (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tree_id          UUID REFERENCES trees(id),
      tree_version_id  UUID REFERENCES tree_versions(id),
      started_at       TIMESTAMPTZ DEFAULT now(),
      completed_at     TIMESTAMPTZ,
      completed        BOOLEAN NOT NULL DEFAULT false
    );

    -- Session events
    CREATE TABLE IF NOT EXISTS session_events (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
      step_id    UUID REFERENCES steps(id),
      choice_id  UUID REFERENCES choices(id),
      timestamp  TIMESTAMPTZ DEFAULT now()
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS steps_tree_version_id ON steps(tree_version_id);
    CREATE INDEX IF NOT EXISTS choices_from_step_id ON choices(from_step_id);
    CREATE INDEX IF NOT EXISTS choices_to_step_id ON choices(to_step_id);
    CREATE INDEX IF NOT EXISTS sessions_tree_id_completed ON sessions(tree_id) WHERE completed = true;
    CREATE INDEX IF NOT EXISTS session_events_session_id ON session_events(session_id);
    CREATE INDEX IF NOT EXISTS session_events_choice_id ON session_events(choice_id);
    CREATE INDEX IF NOT EXISTS tree_slug_history_old_slug ON tree_slug_history(old_slug);
  `)

  console.log('Migration complete.')
  await sql.end()
}

migrate().catch((err) => {
  console.error(err)
  process.exit(1)
})
