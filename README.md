# Bosco

A decision tree authoring and player platform. Authors build branching narratives in a visual studio; readers experience them as mobile-first, swipeable stories.

**Live:** [bosco.vaguespac.es](https://bosco.vaguespac.es)

## Stack

- **Frontend:** React + TypeScript (Vite)
- **Backend:** Node.js + Fastify
- **Database:** PostgreSQL
- **Auth:** JWT (single author, seeded account)

## Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 14+

### Database

```bash
createdb bosco
cd api
npx tsx src/db/migrate.ts
npx tsx src/db/seed.ts
```

### Backend

```bash
cd api
npm install
```

Create `api/.env` (or export these):

```
DATABASE_URL=postgres://bosco:yourpassword@localhost:5432/bosco
JWT_SECRET=some-random-secret
GOOGLE_FONTS_API_KEY=your-key    # optional, enables font picker
```

```bash
npx tsx src/server.ts
```

API runs on `http://localhost:3001`.

### Frontend

```bash
cd web
npm install
npm run dev
```

Dev server runs on `http://localhost:5173` and proxies `/api` to the backend.

For production:

```bash
npm run build    # outputs to ../public/
```

### Production

Serve `public/` as static files with SPA fallback, reverse proxy `/api` to port 3001, and alias `/uploads` to the `uploads/` directory. See `PLAN.md` for the full Apache config.

## Project Structure

```
api/          Fastify backend
web/          React frontend (studio + player)
uploads/      Image storage (gitignored)
public/       Built frontend output (gitignored)
PLAN.md       Technical plan and data model
CLAUDE.md     AI context file
```

## License

Private.
