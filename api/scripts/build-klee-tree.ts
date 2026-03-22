/**
 * Builds the "Discover Your Klee" sample tree.
 * Run: cd /var/www/bosco/api && npx tsx scripts/build-klee-tree.ts
 */
import fs from 'fs/promises'
import path from 'path'
import { createWriteStream } from 'fs'
import { pipeline } from 'stream/promises'
import FormData from 'form-data'
import fetch from 'node-fetch'

const API = 'http://127.0.0.1:3001/api'
const EMAIL = 'admin@vaguespac.es'
const PASSWORD = 'changeme'

// ── Images ────────────────────────────────────────────────────────────────────

const IMAGES = {
  hero:       { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Paul_Klee_by_Hugo_Erfurth%2C_1922.jpg/960px-Paul_Klee_by_Hugo_Erfurth%2C_1922.jpg',       caption: 'Paul Klee, photographed by Hugo Erfurth, 1922' },
  twittering: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Die_Zwitscher-Maschine_%28Twittering_Machine%29%2C_1922_-_Paul_Klee.jpg/960px-Die_Zwitscher-Maschine_%28Twittering_Machine%29%2C_1922_-_Paul_Klee.jpg', caption: 'Paul Klee, Twittering Machine, 1922' },
  fish:       { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Fish_Magic%2C_1925_-_Paul_Klee.jpg/1280px-Fish_Magic%2C_1925_-_Paul_Klee.jpg',            caption: 'Paul Klee, Fish Magic, 1925' },
  adparnassum:{ url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Ad_Parnassum_%28originaler%2C_gefasster_Holzrahmen%29%2C_Paul_Klee_%281932%29.jpg/1280px-Ad_Parnassum_%28originaler%2C_gefasster_Holzrahmen%29%2C_Paul_Klee_%281932%29.jpg', caption: 'Paul Klee, Ad Parnassum, 1932' },
  death:      { url: 'https://upload.wikimedia.org/wikipedia/commons/d/d9/Death_and_Fire_%281940%29_-_Paul_Klee_%28Zentrum_Paul_Klee%29.jpg',                            caption: 'Paul Klee, Death and Fire, 1940' },
  fugue:      { url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/Paul_Klee_Fuge_in_Rot.jpg',                                                                    caption: 'Paul Klee, Fugue in Red, 1921' },
  fire:       { url: 'https://upload.wikimedia.org/wikipedia/commons/d/df/Fire_in_the_Evening_by_Paul_Klee_in_the_MOMA.jpg',                                             caption: 'Paul Klee, Fire in the Evening, 1929' },
  senecio:    { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Paul_Klee%2C_1922%2C_Senecio%2C_oil_on_gauze%2C_40.3_%C3%97_37.4_cm%2C_Kunstmuseum_Basel.jpg/1280px-Paul_Klee%2C_1922%2C_Senecio%2C_oil_on_gauze%2C_40.3_%C3%97_37.4_cm%2C_Kunstmuseum_Basel.jpg', caption: 'Paul Klee, Senecio, 1922' },
  angelus:    { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Paul_Klee_~_Angelus_Novus_~_1920.jpg/1280px-Paul_Klee_~_Angelus_Novus_~_1920.jpg',        caption: 'Paul Klee, Angelus Novus, 1920' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiPost(path: string, body: unknown, token?: string) {
  const r = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`POST ${path} → ${r.status}: ${await r.text()}`)
  return r.json() as Promise<Record<string, unknown>>
}

async function apiPut(path: string, body: unknown, token: string) {
  const r = await fetch(`${API}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`PUT ${path} → ${r.status}: ${await r.text()}`)
  return r.json() as Promise<Record<string, unknown>>
}

async function apiGet(path: string, token: string) {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}: ${await r.text()}`)
  return r.json() as Promise<Record<string, unknown>>
}

async function downloadToTmp(imgUrl: string, filename: string): Promise<string> {
  const tmpPath = `/tmp/${filename}`
  const r = await fetch(imgUrl, { headers: { 'User-Agent': 'BoscoBot/1.0' } })
  if (!r.ok) throw new Error(`Download failed: ${imgUrl} → ${r.status}`)
  await pipeline(r.body as NodeJS.ReadableStream, createWriteStream(tmpPath))
  return tmpPath
}

async function uploadImage(tmpPath: string, caption: string, token: string): Promise<{ url: string; blur_placeholder: string }> {
  const form = new FormData()
  form.append('caption', caption)
  form.append('file', await fs.readFile(tmpPath), { filename: path.basename(tmpPath) })
  const r = await fetch(`${API}/uploads`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
    body: form,
  })
  if (!r.ok) throw new Error(`Upload failed: ${r.status}: ${await r.text()}`)
  return r.json() as Promise<{ url: string; blur_placeholder: string }>
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔑 Logging in…')
  const { token } = await apiPost('/auth/login', { email: EMAIL, password: PASSWORD }) as { token: string }

  // ── Upload all images ──
  console.log('🖼  Downloading and uploading images…')
  const uploaded: Record<string, { url: string; blur_placeholder: string }> = {}
  for (const [key, { url, caption }] of Object.entries(IMAGES)) {
    process.stdout.write(`   ${key}… `)
    const ext = url.includes('.jpg') || url.includes('.JPG') ? '.jpg' : '.png'
    const tmpPath = await downloadToTmp(url, `klee-${key}${ext}`)
    uploaded[key] = await uploadImage(tmpPath, caption, token)
    console.log('✓')
    await new Promise(r => setTimeout(r, 3500))
  }

  // ── Create tree ──
  console.log('🌳 Creating tree…')
  // Delete existing if present
  const trees = await apiGet('/trees', token) as unknown as Array<{ id: string; slug: string }>
  const existing = Array.isArray(trees) ? trees.find((t: { slug: string }) => t.slug === 'discover-your-klee') : null
  if (existing) {
    await fetch(`${API}/trees/${existing.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    console.log('   (deleted existing draft)')
  }

  const tree = await apiPost('/trees', { title: 'Discover Your Klee', slug: 'discover-your-klee', depth: 3 }, token) as { id: string }
  const treeId = tree.id
  console.log(`   Tree ID: ${treeId}`)

  // ── Load tree graph ──
  const full = await apiGet(`/trees/${treeId}`, token) as { steps: Array<{ id: string; type: string }>; choices: Array<{ id: string; from_step_id: string; to_step_id: string; sort_order: number }> }
  const steps = full.steps
  const choices = full.choices

  // Build adjacency: stepId → sorted children
  const childMap = new Map<string, string[]>()
  for (const c of choices) {
    const kids = childMap.get(c.from_step_id) ?? []
    kids.push(c.to_step_id)
    childMap.set(c.from_step_id, kids)
  }
  // Sort children by sort_order
  const sortedChoices = [...choices].sort((a, b) => a.sort_order - b.sort_order)
  const childMapSorted = new Map<string, Array<{ id: string; to_step_id: string }>>()
  for (const c of sortedChoices) {
    const kids = childMapSorted.get(c.from_step_id) ?? []
    kids.push({ id: c.id, to_step_id: c.to_step_id })
    childMapSorted.set(c.from_step_id, kids)
  }

  // BFS to get ordered step IDs by level
  const intro = steps.find((s: { type: string }) => s.type === 'intro')!
  const levelSteps: string[][] = [[intro.id]]
  let frontier = [intro.id]
  while (frontier.length) {
    const next: string[] = []
    for (const id of frontier) {
      const kids = childMapSorted.get(id) ?? []
      next.push(...kids.map(k => k.to_step_id))
    }
    if (next.length) levelSteps.push(next)
    frontier = next
  }
  // levelSteps[0] = [intro]
  // levelSteps[1] = [step1]
  // levelSteps[2] = [step2a, step2b]
  // levelSteps[3] = [3aa,3ab,3ba,3bb]
  // levelSteps[4] = [end0..end7]

  const [l0, l1, l2, l3, l4] = levelSteps
  const introId = l0[0]
  const step1Id = l1[0]
  const [s2aId, s2bId] = l2
  const [s3aaId, s3abId, s3baId, s3bbId] = l3
  const [e0,e1,e2,e3,e4,e5,e6,e7] = l4

  console.log(`   Levels: ${levelSteps.map(l => l.length).join(' → ')}`)

  // ── Helper to update step content ──
  const setContent = async (stepId: string, content: Record<string, unknown>) => {
    await apiPut(`/trees/${treeId}/steps/${stepId}`, { content }, token)
  }

  // ── Helper to update choice labels ──
  const choicesBetween = (fromId: string) => childMapSorted.get(fromId) ?? []
  const setChoices = async (fromId: string, labels: string[]) => {
    const kids = choicesBetween(fromId)
    for (let i = 0; i < labels.length; i++) {
      if (kids[i]) {
        await apiPut(`/trees/${treeId}/choices/${kids[i].id}`, { label: labels[i] }, token)
      }
    }
  }

  console.log('✍️  Writing step content…')

  // Intro
  await setContent(introId, {
    title: 'Discover Your Klee',
    description: 'Paul Klee (1879–1940) made over 9,000 works in his lifetime — paintings, drawings, and watercolors that blur the boundaries between childhood and sophistication, color and form, dream and geometry. Follow the choices to find the painting that speaks to you.',
    hero_image_url: uploaded.hero.url,
    blur_placeholder: uploaded.hero.blur_placeholder,
    cta_label: 'Find my Klee →',
  })

  // Step 1
  await setContent(step1Id, {
    headline: 'Where does your eye go first?',
    body: 'Klee once wrote: "Art does not reproduce the visible; rather, it makes visible." His work reaches you in different ways. What pulls you in?',
  })
  await setChoices(step1Id, ['Color — I feel before I think', 'Line — I look for structure and meaning'])

  // Step 2a (Color path)
  await setContent(s2aId, {
    headline: 'What kind of feeling?',
    body: "Klee's color work ranges from joyful, playful canvases to deeply unsettling dreamscapes. He used color the way a composer uses tone — mood, temperature, tension.",
  })
  await setChoices(s2aId, ['Something warm and alive — I want to feel good', 'Something strange, mysterious — I want to be unsettled'])

  // Step 2b (Line path)
  await setContent(s2bId, {
    headline: 'What kind of order?',
    body: "Klee studied music as seriously as painting. His linear work reflects this — some pieces feel like musical scores, others like architectural blueprints or maps of imaginary places.",
  })
  await setChoices(s2bId, ['Rhythm and music — order with life in it', 'Structure and architecture — precise, layered, built'])

  // Step 3aa (Color + Warm)
  await setContent(s3aaId, {
    headline: 'What kind of joy?',
    body: "Klee often said the best art looks effortless — like a child made it, but with a master's skill hidden underneath. His joyful work comes in two flavors.",
  })
  await setChoices(s3aaId, ['Pure play — humor, movement, absurdity', 'Wonder — magic, enchantment, the unexplained'])

  // Step 3ab (Color + Strange)
  await setContent(s3abId, {
    headline: 'How dark?',
    body: "Klee's late work turned toward the ominous. Diagnosed with scleroderma in 1935, his final years produced haunting images — raw, stripped-down, confrontational.",
  })
  await setChoices(s3abId, ['Surreal dreamscape — layered, allusive, complex', 'Direct confrontation — simplified, stark, final'])

  // Step 3ba (Line + Rhythm)
  await setContent(s3baId, {
    headline: 'How do you feel about improvisation?',
    body: "Klee was an accomplished violinist who believed painting and music operated by the same laws. His musical paintings range from loose and gestural to tightly composed.",
  })
  await setChoices(s3baId, ['Loose and flowing — like improvisation', 'Tight and bold — like a composed piece'])

  // Step 3bb (Line + Structure)
  await setContent(s3bbId, {
    headline: 'Surface or depth?',
    body: "Klee's architectural paintings are some of his most meditative — grids, towers, layers of paint that feel almost like illuminated manuscripts or stained glass.",
  })
  await setChoices(s3bbId, ['Shimmering, luminous — color as surface', 'Quiet and elemental — one face, one light'])

  // End cards
  await setContent(e0, {
    title: 'Twittering Machine, 1922',
    summary: 'Mechanical birds perch on a hand-cranked wheel, their beaks open in perpetual song. Klee\'s satire of industrial modernity — or perhaps just a piece of beautiful nonsense — this painting moves. You can almost hear it.',
    image_url: uploaded.twittering.url,
    blur_placeholder: uploaded.twittering.blur_placeholder,
    alt_text: 'Paul Klee, Twittering Machine, 1922, watercolor and pen on paper',
  })
  await setContent(e1, {
    title: 'Fish Magic, 1925',
    summary: "A clock ticks in an underwater world where fish, flowers, and a figure share space without apparent logic. It's a dream you don't want to leave. Klee at his most enchanting.",
    image_url: uploaded.fish.url,
    blur_placeholder: uploaded.fish.blur_placeholder,
    alt_text: 'Paul Klee, Fish Magic, 1925, oil and watercolor on canvas',
  })
  await setContent(e2, {
    title: 'Ad Parnassum, 1932',
    summary: 'Built from thousands of tiny dots of color — a pointillist mountain, a gate, a sun. Klee\'s most technically ambitious work took months to complete. It rewards time. It rewards silence.',
    image_url: uploaded.adparnassum.url,
    blur_placeholder: uploaded.adparnassum.blur_placeholder,
    alt_text: 'Paul Klee, Ad Parnassum, 1932, oil on canvas',
  })
  await setContent(e3, {
    title: 'Death and Fire, 1940',
    summary: "Painted in the last year of his life, with hands so damaged by illness he could barely hold a brush. A skull-face, a sun, a figure. Three letters — T, O, D — German for death. Klee's final statement.",
    image_url: uploaded.death.url,
    blur_placeholder: uploaded.death.blur_placeholder,
    alt_text: 'Paul Klee, Death and Fire, 1940, oil and colored paste on burlap',
  })
  await setContent(e4, {
    title: 'Fugue in Red, 1921',
    summary: "Klee was a gifted violinist who saw no separation between music and painting. This piece is literally a fugue — overlapping geometric voices that enter, develop, and resolve across a warm red field.",
    image_url: uploaded.fugue.url,
    blur_placeholder: uploaded.fugue.blur_placeholder,
    alt_text: 'Paul Klee, Fugue in Red, 1921, watercolor on paper',
  })
  await setContent(e5, {
    title: 'Fire in the Evening, 1929',
    summary: "Horizontal bands of color that compress and intensify toward a glowing red center. There is nothing here but color and proportion — and yet something is on fire. Klee at his most abstract and most direct.",
    image_url: uploaded.fire.url,
    blur_placeholder: uploaded.fire.blur_placeholder,
    alt_text: 'Paul Klee, Fire in the Evening, 1929, oil on cardboard',
  })
  await setContent(e6, {
    title: 'Senecio, 1922',
    summary: "A face built from colored circles, divided by a grid. Half tender, half alien. Named after the genus of flowering plants — and in Latin, 'old man'. Klee's most reproduced work, and his most mysterious.",
    image_url: uploaded.senecio.url,
    blur_placeholder: uploaded.senecio.blur_placeholder,
    alt_text: 'Paul Klee, Senecio, 1922, oil on gauze, Kunstmuseum Basel',
  })
  await setContent(e7, {
    title: 'Angelus Novus, 1920',
    summary: "An angel who seems about to move away from something it is staring at. Walter Benjamin owned this painting and called it 'the angel of history' — blown backward into the future by the storm we call progress. You can't unsee it.",
    image_url: uploaded.angelus.url,
    blur_placeholder: uploaded.angelus.blur_placeholder,
    alt_text: 'Paul Klee, Angelus Novus, 1920, oil transfer and watercolor on paper',
  })

  // ── Theme ──
  console.log('🎨 Setting theme…')
  await apiPut(`/trees/${treeId}/theme`, {
    titleFont: { family: 'Playfair Display', weight: '700' },
    bodyFont: { family: 'Source Serif 4', weight: '400' },
    textColor: '#2c2416',
    background: { type: 'solid', color: '#f5f0e8' },
  }, token)

  // ── Publish ──
  console.log('🚀 Publishing…')
  const result = await apiPost(`/trees/${treeId}/publish`, {}, token)
  console.log(`   Status: ${result.status}`)

  console.log(`\n✅ Done! Visit: https://bosco.vaguespac.es/t/discover-your-klee`)
}

main().catch(e => { console.error(e); process.exit(1) })
