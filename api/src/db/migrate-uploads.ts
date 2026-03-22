import postgres from 'postgres'
import { DB_URL } from '../lib/config.js'

const sql = postgres(DB_URL)

await sql.unsafe(`
  CREATE TABLE IF NOT EXISTS uploads (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id        UUID REFERENCES authors(id),
    filename         TEXT NOT NULL,
    url              TEXT NOT NULL,
    blur_placeholder TEXT,
    created_at       TIMESTAMPTZ DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS uploads_author_id ON uploads(author_id);
  CREATE INDEX IF NOT EXISTS uploads_created_at ON uploads(created_at DESC);
`)

console.log('Uploads migration complete.')
await sql.end()
