# Bosco — AI Context

A decision tree authoring and player app. See `PLAN.md` for the full technical plan.

## Stack
- **Frontend**: React + TypeScript (Vite) — `/var/www/bosco/web/`
- **Backend**: Node.js + Fastify — `/var/www/bosco/api/`
- **Database**: PostgreSQL 16, database `bosco`, user `bosco`
- **Auth**: Custom JWT — bcrypt + @fastify/jwt; single seeded author, no registration flow
- **Images**: Stored locally at `/var/www/bosco/uploads/`, served at `https://bosco.vaguespac.es/uploads/`
- **Serving**: Apache2 reverse proxy → Node.js on port 3001; static React build at `/var/www/bosco/public/`

## Key Decisions
- Single author — no registration flow, one seeded account
- Relational schema is canonical (no graph JSON blob) — see PLAN.md for full schema
- Publish = copy Step/Choice rows into new TreeVersion (immutable snapshots)
- Slug changes on re-publish are tracked in `tree_slug_history`
- LQIP blur placeholders generated at upload time via Sharp, stored in `uploads.blur_placeholder`
- Gradient background uses raw CSS string (paste from Josh Comeau generator), not a stops/angle builder
- Google Fonts served via backend proxy (`GET /api/fonts`) — key stays server-side, 24h memory cache

## Theme Shape
```typescript
{
  titleFont?: { family: string; weight: string }
  bodyFont?:  { family: string; weight: string }
  textColor?: string
  background?: { type: 'solid' | 'gradient'; color?: string; css?: string }
}
```

## Step Content Types
- `intro`: `{ title, description, hero_image_url?, blur_placeholder?, cta_label }`
- `text`: `{ headline?, body? }` — headline/body exist in schema but are **not rendered in the player**; choices carry the content (see Player Behaviour). Studio hides these fields for now (data model preserved for future use).
- `image`: `{ image_url, blur_placeholder?, alt_text, caption, headline }`

There is no `end` step type. All branching is done with `text` steps. Terminal behaviour is determined by choices: a choice with `to_step_id = NULL` navigates directly to the results/summary view.

## Default Tree Template
Tree creation accepts `depth: 2 | 3 | 4`. Template seeded:
```
Intro → 1 text step → (depth-1) binary text levels → 2^depth leaf text steps (choices → results)
```
- Leaf steps are `text` type with 2 choices whose `to_step_id` is NULL (go to results)
- Intro validation: requires exactly 1 choice (CTA navigates to first text step)
- Text/image validation: requires ≥ 2 choices (labels are optional — image-only choices are valid)

## Player Routes (public, no auth)
- `GET /api/published` — list all published trees (includes theme + intro_content for home page rendering)
- `GET /api/t/:slug` — full tree graph (steps + choices + theme) for the published version; 301s on old slugs
- `GET /api/t/:slug/analytics` — Sankey nodes/links, session stats (total_sessions, completed_sessions, total_endings, endings_reached), top 10 paths. Terminal steps detected by having only NULL-target choices (all outgoing `to_step_id IS NULL`).
- `POST /api/sessions` — create anonymous session `{ tree_id, tree_version_id }`
- `POST /api/sessions/:id/events` — record `{ step_id, choice_id? }` (null choice_id = arrival)
- `POST /api/sessions/:id/complete` — mark session done
- `GET /api/sessions/:id/summary` — returns ordered choice_ids for path reconstruction

## Frontend Routes
- `/` → Home (swipeable title card carousel)
- `/t/:slug` → Player
- `/studio/*` → Author Studio

## Player Behaviour
- **Fixed viewport** — player wrapper uses `position: fixed; overflow: hidden` with `100dvh` (not `100vh`) to account for mobile browser chrome (URL bar)
- **Intro step (book-cover layout)** — title and description top-left, optional full-bleed hero image with top-down gradient scrim, tap icon centered + "tap to begin" at bottom. Tapping anywhere navigates. Text forced to `color: inherit` to override global `h1 { color: var(--text-h) }` CSS rule.
- **Text steps are choice-only** — no headline/body prompt; the choice labels describe what comes next and the reader infers the path
- **Zelle-style choice tiles** — choices are large full-width blocks that split the viewport equally; adaptive text sizing in 4 tiers (≤30 chars → 1.75rem, ≤60 → 1.4rem, ≤100 → 1.15rem, ≤140 → 1rem), 140-char max with ellipsis truncation. Alternating subtle background shading, weight 300, no borders.
- Step wrapper uses `key={currentStepId}` — forces full remount on navigation, resetting ChoiceList state
- Choices lock after selection (chosen highlighted, others fade to 15% opacity over 500ms); `disabled` prevents double-tap
- Fade transition: opacity → 0 over 400ms, then step changes, then opacity → 1 over 400ms
- **Terminal choices** — choices with `to_step_id = NULL` go directly to the results view (no intermediate step). Session is marked complete on selection.
- **Results view** — single viewport, no scroll: stats side-by-side ("X% explored" = distinct endings reached / total endings, "X% took your path"), custom vertical Sankey chart filling remaining space, "Play again" + "Share" buttons at bottom (same horizontal padding as Sankey)
- **Share modal** — QR code via `qrcode` npm (`toDataURL` for mobile compatibility, not `toString` SVG) + copyable URL
- **Session completion** triggers when a choice with `to_step_id = NULL` is selected, or when a step has no outgoing choices
- Google Fonts loaded by injecting a `<link>` into `<head>` from the theme's font families
- **Home page** — horizontal scroll-snap carousel of full-viewport title cards, each rendering with its tour's theme/fonts/background. Dot indicators at bottom. All tour fonts loaded via single Google Fonts link.

## Uploads Table
`uploads(id, author_id, filename, url, blur_placeholder, caption, created_at)`
Image library in the studio browses this table. When uploading via multipart, caption field **must come before** the file in the stream (multipart parsing limitation).

## CSS
Global `*, *::before, *::after { box-sizing: border-box }` is set in `index.css`. All layout uses inline styles — no CSS modules or utility classes.

**Gotcha:** `index.css` sets `h1, h2 { color: var(--text-h) }` which overrides inherited text color in player components. Player h1 elements must use `color: 'inherit'` inline to respect the theme's text color (especially on mobile dark mode where `--text-h` becomes white).

## Domain
`bosco.vaguespac.es` — Apache vhost at `/etc/apache2/sites-available/bosco.vaguespac.es.conf` (HTTP→HTTPS redirect) and `-le-ssl.conf` (SSL, managed by Certbot)

## Dev Notes
- API runs on port 3001 via systemd service (`bosco-api.service`), runs as `www-data`
- Rebuild frontend: `cd /var/www/bosco/web && npm run build` → outputs to `public/`
- Restart API: `systemctl restart bosco-api`
- All player routes are public; author studio routes require JWT (`fastify.authenticate`)
- Choices queries use JOIN (not sql.array()) to avoid `uuid = text` operator error in postgres.js
- Phase 1 ✅ Phase 2 ✅ Phase 3 ✅ Phase 4 ✅ Phase 5 = Theming Polish (font pairing presets, WCAG AA contrast checker)
- QR code: uses `qrcode` npm package with `toDataURL` (not `toString` SVG — browser build doesn't support SVG output)
- Vertical Sankey: custom implementation in `VerticalSankeyChart.tsx` (no d3-sankey), BFS depth assignment, proportional width slicing

## Choice Schema
`choices(id, from_step_id, to_step_id, label, internal_note, sort_order, image_url, blur_placeholder, caption)`
- `to_step_id` is nullable — NULL means "navigate to results" (terminal choice)
- `image_url` / `blur_placeholder` / `caption` support image choices with LQIP blur loading
- Choices with images render with `objectFit: contain` (no cropping), padded within the tile

## Choice Label Styling
Choice labels support inline markdown: `**bold**`, `*italic*`, `***bold italic***`. Parsed by `parseStyledText()` in `web/src/shared/lib/styledText.tsx`. Studio editor uses a textarea with B/I toolbar buttons that toggle markers around selected text. Character counter uses `stripMarkers()` to show visual length (excluding markers). The `BlurImage` component accepts an `objectFit` prop (`cover` default, `contain` for choice tiles).

## Publish Validation
- Intro step requires title and CTA label
- All non-intro steps require ≥ 2 choices
- No label or headline requirements (image-only tours are valid)
- Terminal choices (`to_step_id = NULL`) are always valid

## Studio Editor — Results Node
The tree editor shows a synthetic "Results" node (green, non-editable, non-deletable) representing the Sankey summary view. Choices with `to_step_id = NULL` render as dashed green animated edges connecting to this node. Authors can draw connections to the Results node to create terminal choices. The node is implemented in `ResultsNode.tsx` with ID `__results__`.
