import bcrypt from 'bcrypt'
import sql from './client.js'

const email = process.env.AUTHOR_EMAIL ?? 'admin@bosco.local'
const password = process.env.AUTHOR_PASSWORD ?? 'changeme'
const name = process.env.AUTHOR_NAME ?? 'Admin'

const hash = await bcrypt.hash(password, 12)

await sql`
  INSERT INTO authors (email, name, password)
  VALUES (${email}, ${name}, ${hash})
  ON CONFLICT (email) DO UPDATE SET password = ${hash}, name = ${name}
`

console.log(`Author seeded: ${email}`)
await sql.end()
