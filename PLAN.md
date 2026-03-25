# Bosco — Technical Plan

## Resolved Schema Decisions

- **Relational is canonical.** `Step` and `Choice` are relational rows. `TreeVersion` has no `graph` JSON column.
- **Publish = row copy.** Publishing creates a new `TreeVersion` and copies all current `Step` + `Choice` rows into new rows stamped with the new `tree_version_id`. Rollback is achieved by pointing `Tree.current_version_id` at an older version.
- **Slug redirects** are tracked in a `TreeSlugHistory` table.
- **LQIP** (blur placeholder) is generated server-side at upload time using Sharp and stored alongside the full image.

---

## Deployment Architecture

```
Internet
    │
  Apache2 (port 80/443, Let's Encrypt SSL)
    ├── /api/*        → reverse proxy → Node.js Fastify (port 3001)
    ├── /uploads/*    → Alias → /var/www/bosco/uploads/ (static files)
    └── /*            → static React build (Studio + Player, SPA fallback)

PostgreSQL (local, port 5432)
Local filesystem for images: /var/www/bosco/uploads/
```

Node.js runs as a systemd service (`bosco-api.service`) to survive reboots.

---

## Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | React + TypeScript (Vite) | Single repo, two entry points: `/studio` and `/` (player) |
| Canvas | React Flow | MIT core covers all needed features |
| Sankey | D3 + d3-sankey | Client-rendered, session data fetched at tour end |
| Font picker | Google Fonts API | Full 1935-font catalogue, proxied through backend (key server-side), 24h cache |
| Backend | Node.js + Fastify | REST API, runs on port 3001 |
| Database | PostgreSQL | Local install |
| Auth | Custom JWT | bcrypt password hashing + @fastify/jwt; single seeded author, no registration |
| Image processing | Sharp | LQIP generation + WebP normalization at upload |
| File storage | Local filesystem | `/var/www/bosco/uploads/`, served via Apache Alias at `/uploads/*` |
| Process manager | systemd | Keeps Node process alive |
| Build | Vite | Outputs static files to `/var/www/bosco/public` |

---

## Data Model

```sql
-- Authors
CREATE TABLE authors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Trees
CREATE TABLE trees (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id           UUID REFERENCES authors(id),
  title               TEXT NOT NULL,
  slug                TEXT UNIQUE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'draft',  -- draft | published | archived
  current_version_id  UUID,  -- FK set after first publish (circular, set post-insert)
  created_at          TIMESTAMPTZ DEFAULT now(),
  published_at        TIMESTAMPTZ
);

-- Slug redirect history (when slug changes on re-publish)
CREATE TABLE tree_slug_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id     UUID REFERENCES trees(id),
  old_slug    TEXT NOT NULL,
  new_slug    TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Versions (immutable snapshots created on each publish)
CREATE TABLE tree_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id        UUID REFERENCES trees(id),
  version_number INT NOT NULL,
  theme          JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tree_id, version_number)
);

-- Steps (copied per version on publish)
CREATE TABLE steps (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_version_id  UUID REFERENCES tree_versions(id),
  type             TEXT NOT NULL,  -- intro | text | image | end
  position_x       FLOAT NOT NULL DEFAULT 0,
  position_y       FLOAT NOT NULL DEFAULT 0,
  content          JSONB NOT NULL DEFAULT '{}',
  -- content schema by type:
  -- intro: { title, description, hero_image_url, blur_placeholder, cta_label }
  -- text:  { headline?, body? }  (not rendered in player; choices carry the content)
  -- image: { image_url, blur_placeholder, alt_text, caption }
  -- end:   { title, summary, cta_label, cta_url }
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Choices (copied per version on publish)
CREATE TABLE choices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_step_id    UUID REFERENCES steps(id),
  to_step_id      UUID REFERENCES steps(id),
  label           TEXT NOT NULL,
  internal_note   TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Sessions (anonymous)
CREATE TABLE sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id          UUID REFERENCES trees(id),
  tree_version_id  UUID REFERENCES tree_versions(id),
  started_at       TIMESTAMPTZ DEFAULT now(),
  completed_at     TIMESTAMPTZ,
  completed        BOOLEAN NOT NULL DEFAULT false
);

-- Session events (step visits and choice selections)
CREATE TABLE session_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID REFERENCES sessions(id),
  step_id     UUID REFERENCES steps(id),
  choice_id   UUID REFERENCES choices(id),  -- null on step arrival, set on choice selection
  timestamp   TIMESTAMPTZ DEFAULT now()
);

-- Uploads (image library, per author)
CREATE TABLE uploads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id        UUID REFERENCES authors(id),
  filename         TEXT NOT NULL,
  url              TEXT NOT NULL,
  blur_placeholder TEXT,
  caption          TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);
```

**Key indexes:**
```sql
CREATE INDEX ON steps(tree_version_id);
CREATE INDEX ON choices(from_step_id);
CREATE INDEX ON choices(to_step_id);
CREATE INDEX ON sessions(tree_id) WHERE completed = true;
CREATE INDEX ON session_events(session_id);
CREATE INDEX ON session_events(choice_id);
CREATE INDEX ON tree_slug_history(old_slug);
```

---

## Theme Schema

Theme is stored as JSONB on `tree_versions.theme`:

```typescript
interface Theme {
  titleFont?: { family: string; weight: string }   // Google Font family + weight
  bodyFont?:  { family: string; weight: string }
  textColor?: string                                // CSS color string
  background?: {
    type: 'solid' | 'gradient'
    color?: string   // for solid: CSS color string
    css?: string     // for gradient: raw CSS value e.g. "linear-gradient(135deg, #f5c6a0, #a0c4f5)"
  }
}
```

---

## API Design

All routes under `/api`. Author routes require JWT. Player/analytics routes are public.

### Auth
```
POST   /api/auth/login         Email + password → JWT
POST   /api/auth/logout
GET    /api/auth/me
```

### Trees (author)
```
GET    /api/trees               List author's non-archived trees
GET    /api/trees/archived      List archived trees
POST   /api/trees               Create new tree (seeds default template; accepts depth: 2|3|4)
GET    /api/trees/:id           Get tree with current draft steps + choices
PUT    /api/trees/:id           Update tree metadata (title, slug)
DELETE /api/trees/:id           Archive tree

POST   /api/trees/:id/publish   Validate, copy rows → new TreeVersion, set current_version_id
POST   /api/trees/:id/unpublish Set status = draft
PUT    /api/trees/:id/theme     Update theme JSON on working draft version
```

### Steps + Choices (author, draft editing)
```
POST   /api/trees/:id/steps           Add step to working draft
PUT    /api/trees/:id/steps/:stepId   Update step content or position
DELETE /api/trees/:id/steps/:stepId   Remove step (cascades choices)

POST   /api/trees/:id/choices              Add choice (connect two steps)
PUT    /api/trees/:id/choices/:choiceId    Update choice label/note/order
DELETE /api/trees/:id/choices/:choiceId    Remove choice
```

### Uploads (author)
```
POST   /api/uploads    Upload image → Sharp converts to WebP, generates LQIP, saves to DB
GET    /api/uploads    List all uploads for authenticated author
```

### Fonts (author)
```
GET    /api/fonts      Returns full Google Fonts catalogue [{family, variants}]; 24h server-side cache
```

### Player (public)
```
GET    /api/published   List all published trees (id, title, slug, published_at)
GET    /api/t/:slug     Resolve slug → tree + full step/choice graph for current version
                        (Also checks TreeSlugHistory and 301s if slug changed)
```

### Sessions (public)
```
POST   /api/sessions                    Create session → returns session_id
POST   /api/sessions/:id/events         Record step visit or choice selection
POST   /api/sessions/:id/complete       Mark completed, record completed_at
```

### Analytics (Phase 3 — not yet built)
```
GET    /api/trees/:id/analytics         Sankey edge weights, session count, threshold status
```

---

## Default Tree Template

When a tree is created, a template is seeded based on `depth` (2, 3, or 4):

```
Intro → 1 text step → (depth-1) levels of binary text branching → 2^depth leaf text steps (choices → results)
```

- depth 2 → 4 outcomes (Intro + 1 + 2 + 4 leaf = 8 steps total)
- depth 3 → 8 outcomes (Intro + 1 + 2 + 4 + 8 leaf = 16 steps total)
- depth 4 → 16 outcomes (Intro + 1 + 2 + 4 + 8 + 16 leaf = 32 steps total)

**Key constraints from publish validation:**
- Intro step requires title and CTA label, exactly 1 choice
- All non-intro steps require ≥ 2 choices (labels optional — image-only choices are valid)
- Leaf steps have choices with `to_step_id = NULL` (navigate directly to results)
- There is no `end` step type — terminal behaviour is determined by null-target choices
- No headline requirements on any step type

---

## Image Upload Pipeline

1. Author uploads image in the Studio (or via `POST /api/uploads` directly)
2. Server receives file via `@fastify/multipart`; fields must come **before** the file in the multipart stream
3. Passes through Sharp:
   - Converts to WebP at 85% quality (full image)
   - Generates 20px-wide LQIP at 20% quality, base64-encoded
4. Saves both files to `/var/www/bosco/uploads/`
5. Inserts row into `uploads` table (url, blur_placeholder, caption, author_id)
6. Returns `{ id, url, blur_placeholder, caption }`
7. Player renders blur placeholder immediately, swaps to full image on load

---

## Publish Flow

1. Client calls `POST /api/trees/:id/publish`
2. Server runs validation checklist
3. If pass:
   - Increment `version_number`
   - Insert new `tree_versions` row
   - Copy all draft `steps` rows → new rows with new `tree_version_id`
   - Copy all `choices` rows → new rows referencing the new step IDs (ID remapping)
   - Set `trees.current_version_id` to new version
   - Set `trees.status = 'published'`, `trees.published_at = now()`
   - If slug changed → insert into `tree_slug_history`

---

## Phased Delivery

### Phase 1 — Authoring Core ✅ COMPLETE
- Postgres schema + migrations (including uploads table)
- Fastify API: custom JWT auth, trees CRUD, steps/choices CRUD, publish/unpublish, theme, uploads, fonts
- React Flow canvas: drag to reposition, connect steps, inline edit, draft save
- Step types: Intro, Text, Image, End Card
- Full theming: Google Fonts picker (1935 fonts), text color, solid/gradient background
- Image upload with LQIP + image library (browse/select from previously uploaded images)
- Depth selector at tree creation (2/3/4 levels → 4/8/16 outcomes)
- Archived trees hidden from main list; "View archived trees" link reveals them

### Phase 2 — Player MVP ✅ COMPLETE
- Public home page: swipeable full-viewport title cards with dot indicators, each card renders the tour's theme
- Player route (`/t/:slug`): load tree by slug, client-side navigation with 400ms fade transitions
- Fixed viewport layout (`position: fixed`, `overflow: hidden`) — no bounce scrolling on mobile
- Intro step: book-cover layout — title and description top-left, optional full-bleed hero image with gradient scrim, tap icon + "tap to begin" hint, tapping anywhere navigates
- Text steps are choice-only (no headline/body prompt) — choices describe what comes next, reader infers the path
- Zelle-style choice UI: large full-width tiles splitting viewport equally, adaptive text sizing (4 tiers: ≤30/60/100/140 chars), 140-char max with ellipsis, alternating subtle shading
- Choices with `to_step_id = NULL` navigate directly to the results view (no intermediate step)
- BlurImage component: LQIP blur-up loading for all images
- ChoiceList: locks after selection (highlights chosen, fades others over 500ms); remounts per step via `key={stepId}`
- Session recording: create on load, arrival events, choice events, complete on step with no outgoing choices
- Theme applied from tree config: Google Fonts injected into `<head>`, background (solid/gradient), text color
- Studio hides headline/body fields for text steps (data model preserved for future re-enablement)
- Global `box-sizing: border-box` in index.css (prevents padding overflow on mobile)
- Global CSS `h1 { color: var(--text-h) }` overridden with `color: inherit` in player components

### Phase 3 — Analytics & Sharing ✅ COMPLETE
- Custom vertical Sankey chart (top-to-bottom, no d3-sankey) with BFS depth assignment, proportional width slicing per level, filled bezier bands (80/20 control points), 10px inter-band gaps
- Results view: fits one viewport — stats side-by-side ("X% explored" + "X% took your path"), vertical Sankey filling remaining space, "Play again" + "Share" buttons at bottom
- "% explored" = distinct terminal steps reached / total terminal steps (detected by absence of outgoing choices)
- "% took your path" = sessions matching exact choice path / completed sessions
- Share modal: QR code (via `qrcode` npm, `toDataURL` for mobile compatibility) + copyable URL
- Analytics API: public `GET /api/t/:slug/analytics` returns nodes, links, stats (total_sessions, completed_sessions, total_endings, endings_reached), and top 10 paths
- Authenticated `GET /api/trees/:id/analytics` for studio
- Studio analytics page (`/studio/trees/:id/analytics`): stat cards, Sankey flow chart, most-traveled paths with choice labels
- Analytics button in editor toolbar
- Session summary endpoint `GET /api/sessions/:id/summary` for path reconstruction
- Published trees endpoint returns theme + intro content for home page rendering

### Phase 4 — Progressive Web App
- Web app manifest (`manifest.json`): app name, icons, theme color, `display: standalone` for homescreen install
- Service worker: cache app shell (HTML/CSS/JS) + tour data and images for offline playback
- Web Push notifications when a new tour is published (VAPID keys, server-side subscription storage, push via `web-push` library; iOS requires PWA to be added to homescreen first)

### Phase 5 — Import / Export & HTML Trees

#### JSON Export & Import
- `GET /api/trees/:id/export` — returns full tree as a portable JSON bundle (steps, choices, theme, images as data URIs or `/uploads/` paths)
- `POST /api/trees/import` — accepts a JSON bundle, creates a new tree with all steps/choices/images; remaps IDs
- Studio UI: "Export" button in editor toolbar downloads `.json` file; "Import" option on tree list page accepts `.json` upload

#### HTML ↔ Tree Conversion
A structured HTML document serves as a **dual-format source**: readable linearly as a web page, or playable as a branching tree in Bosco.

**HTML structure convention:**
```html
<article data-bosco-tree>
  <section data-step="intro">
    <h1>Tour Title</h1>
    <p>Description text</p>
    <img src="hero.jpg" alt="...">
  </section>

  <section data-step="text">
    <div data-choice="Label for option A">
      <section data-step="text">
        <!-- nested branching continues -->
        <div data-choice="Terminal choice" data-terminal>
          <p>This path ends here.</p>
        </div>
      </section>
    </div>
    <div data-choice="Label for option B">
      <section data-step="image">
        <img src="painting.jpg" alt="...">
        <figcaption>Caption text</figcaption>
      </section>
    </div>
  </section>
</article>
```

- `<section data-step="intro|text|image">` maps to a Bosco step
- `<div data-choice="label">` maps to a choice; its children are the target step
- `data-terminal` marks a choice as going directly to results (`to_step_id = NULL`)
- Nesting depth = tree depth; sibling `data-choice` divs = branching
- Images inside sections become step images or choice images
- `**bold**` and `*italic*` in choice labels preserved

**Import flow (`POST /api/trees/import-html`):**
1. Parse HTML with a lightweight parser (e.g., `node-html-parser`)
2. Walk the DOM tree recursively: each `<section data-step>` → Step row, each `<div data-choice>` → Choice row
3. Auto-assign canvas positions based on tree depth/breadth (reuse template layout logic)
4. Upload referenced images to `/uploads/` (fetch remote URLs or accept as multipart)
5. Create tree + version + steps + choices in one transaction

**Export flow (`GET /api/trees/:id/export-html`):**
1. Load full tree graph (steps + choices)
2. BFS/DFS traversal from intro step, building nested HTML structure
3. Return a self-contained `.html` file with inline styles and embedded images (data URIs) or relative paths
4. The HTML is readable as a standalone document (linear path through all branches) with semantic headings

**Use cases:**
- Author a tour in Google Docs or any HTML editor, import into Bosco
- Export a Bosco tree as a static HTML fallback for accessibility or archiving
- Version-control tree content as HTML in git
- Share tree structure with collaborators who don't have Bosco access

### Phase 6 — Theming Polish
- Font pairing presets
- WCAG AA contrast checker

### Phase 7 — Scale & Accessibility
- Version history UI + rollback
- Full WCAG AA audit
- Alt text enforcement at publish validation
- Performance pass for large trees

---

## Apache Config

`/etc/apache2/sites-available/bosco.vaguespac.es.conf` — HTTP redirects to HTTPS (managed by Certbot).

`/etc/apache2/sites-available/bosco.vaguespac.es-le-ssl.conf` — SSL vhost (managed by Certbot):
```apache
ProxyPass        /api  http://127.0.0.1:3001/api
ProxyPassReverse /api  http://127.0.0.1:3001/api
Alias /uploads /var/www/bosco/uploads
DocumentRoot /var/www/bosco/public
FallbackResource /index.html
```

---

## Resolved Setup

1. **Domain** — `bosco.vaguespac.es`, SSL via Let's Encrypt
2. **Author accounts** — Single author. No registration flow. One seeded account.
3. **Image storage** — Local filesystem at `/var/www/bosco/uploads/`, served via Apache Alias at `/uploads/*`
4. **Runtime** — Node.js v22, PostgreSQL 16. Database `bosco` with user `bosco`.

## Project Structure

```
/var/www/bosco/
  api/        Fastify backend (Node.js)
  web/        React + Vite frontend (studio + player)
  uploads/    Local image storage (served by Apache)
  public/     Built React output (Vite dist)
  PLAN.md
  CLAUDE.md
```
