# Deploying Raid Forge free (Vercel + optional Neon)

**Short version:** this app is 100% client-side React — roster state lives in
memory and is rebuilt from a CSV/XLSX import or the built-in sample. There is no
server code, so **Vercel alone is enough and costs $0.** Neon is a Postgres host;
it only earns its place once you want rosters to *persist* or be *shared between
people* (officers editing one roster, a link you send to the guild). That part is
opt-in and also free at this scale.

- Path A — [Vercel only](#path-a--vercel-only-no-database): ~5 minutes, no accounts beyond Vercel.
- Path B — [Add Neon](#path-b--add-neon-for-sharedpersistent-rosters): ~10 more minutes, needs `api/roster.ts` wired to the UI.

---

## Path A — Vercel only (no database)

The build already produces a single self-contained `dist/index.html` (via
`vite-plugin-singlefile`), so there are no asset paths or SPA rewrites to get wrong.

### 1. Push the repo to GitHub

Already done if you're reading this in the repo.

### 2. Import it on Vercel

1. Go to <https://vercel.com/new> → **Import Git Repository** → pick this repo.
2. Vercel reads `vercel.json` and pre-fills the right settings:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm ci`
3. Leave environment variables empty. Click **Deploy**.

Every push to your branch gets a preview URL; pushes to your production branch
publish to the main domain.

### Or deploy from the CLI

```bash
npm i -g vercel
vercel login
vercel        # preview deployment
vercel --prod # production
```

### 3. That's it

No database = nothing to provision, nothing to break after six months of idling.
Users' imported rosters are not saved between page reloads (that's true of the
app today, locally too) — see [Path B](#path-b--add-neon-for-sharedpersistent-rosters)
if you want that fixed properly.

> **If imports feel slow or the tab freezes on a huge sheet:** the XLSX parser is
> bundled into the client. Vercel's static hosting is not the bottleneck here.

### Free-tier reality check (Vercel Hobby)

| Limit | Hobby |
| --- | --- |
| Cost | $0, no card |
| Fast Data Transfer | 100 GB / month |
| Function invocations | 1,000,000 / month |
| Active CPU | 4 CPU-hours / month |
| Deployments | 100 / day |
| Function max duration | 300s |
| Commercial use | **Not allowed** |

That last row is the one people get bitten by: Vercel's fair-use guidelines
restrict Hobby to *non-commercial, personal* use. A free guild tool for your own
raid group is fine; the moment it's for a paying client, has ads/affiliate links
as a purpose, or someone is paid to build or host it, Vercel wants Pro
($20/seat/month). For a private guild tool, Hobby is the right fit. If you ever
outgrow that, Cloudflare Pages or Netlify have similar free static hosting — this
app is a static folder, so it moves in minutes.

---

## Path B — Add Neon (for shared/persistent rosters)

This repo already contains the pieces; they're inert until you set `DATABASE_URL`:

| File | Purpose |
| --- | --- |
| `db/schema.sql` | One table, `roster_snapshots` (id, `jsonb` data, optional write token) |
| `api/roster.ts` | Serverless endpoint: `GET /api/roster?id=x`, `PUT /api/roster?id=x` |
| `.env.example` | What `DATABASE_URL` looks like |

Why a serverless function instead of talking to Postgres from the browser?
Because the browser would need the connection string in the bundle — that's a
publish-your-database key. `api/roster.ts` keeps it server-side.

### 1. Create the Neon project

1. <https://neon.com> → sign up (no card) → **Create project**.
2. Pick a region near your Vercel functions. Vercel functions default to
   **`iad1` (us-east-1)**, so choose the matching US East region if offered.
3. Copy the **pooled** connection string (Dashboard → **Connect**, the one with
   `-pooler` in the host). That's the right one for serverless.

### 2. Create the table

Easiest: open the **SQL Editor** in Neon, paste `db/schema.sql`, run it.

Or from your machine:

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

### 3. Add the env var on Vercel

Project → **Settings → Environment Variables** → add `DATABASE_URL` with the
pooled string, for Production *and* Preview → **Redeploy** (env changes don't
apply to existing deployments).

Locally, copy `.env.example` to `.env` and fill it in. To exercise the function
locally, run `vercel dev` (plain `npm run dev` serves only the Vite frontend and
will not run `api/`).

### 4. Verify

```bash
curl -X PUT https://your-app.vercel.app/api/roster?id=my-guild \
  -H 'content-type: application/json' \
  -d '{"data":{"raidSize":20,"members":[]}}'

curl https://your-app.vercel.app/api/roster?id=my-guild
```

Expected: `{"id":"my-guild","updatedAt":"..."}` then the document back.

### 5. Wire the UI to it

The endpoint is storage-only; the app still loads its sample roster. To actually
use it, add save/load around the two state values in `src/App.tsx`:

```ts
const SNAPSHOT_ID = 'my-guild'; // comes from the URL in a real multi-roster setup

async function loadRoster() {
  const res = await fetch(`/api/roster?id=${SNAPSHOT_ID}`);
  if (res.status === 404) return null;
  return (await res.json()).data as { members: RosterMember[]; raidSize: RaidSize };
}

async function saveRoster(members: RosterMember[], raidSize: RaidSize) {
  await fetch(`/api/roster?id=${SNAPSHOT_ID}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-roster-token': 'change-me' },
    body: JSON.stringify({ data: { members, raidSize } }),
  });
}
```

Points worth knowing before you wire it up:

- **Lock writes.** Send `x-roster-token` on the first `PUT` and that roster's
  token is fixed; later writes without the matching header get `403`. Without a
  token, the roster is an open edit link — fine for a private URL you only send
  to your guild, not for something you post publicly.
- **No auth.** There is no login. Anyone with the id can read the roster, and the
  token lives in the client bundle if you hardcode it. That's acceptable for
  schedule data; don't reuse it for anything private.
- **Debounce saves.** Every `PUT` is a function invocation and a DB round trip.
  Save on explicit "Save" or a 2–5s debounce after edits, not on every keystroke.
- **Autosave on load conflicts.** Last write wins. If two officers edit at once,
  one loses. Add an `updatedAt` check before writing if that matters.

### Free-tier reality check (Neon Free)

| Limit | Free |
| --- | --- |
| Cost | $0, no card, no time limit |
| Projects | 100 |
| Storage | 1 GB per project (20 GB per account) |
| Compute | 100 CU-hours per project per month |
| Scale to zero | After 5 min idle (cannot be disabled) |
| Public network transfer | 5 GB per project per month |
| Restore window | 6 hours |

A roster of a few hundred players serialized as JSON is tens of kilobytes, so
storage is a non-issue. The real constraint is **100 CU-hours**: a 0.25 CU compute
running flat-out lasts ~400 hours/month. Because free computes sleep after 5 idle
minutes, a guild tool that's used during raid nights costs almost nothing. What
burns CU-hours is a cron job or health check that touches the DB every minute —
don't add one "to keep it warm". The first request after idling pays a ~0.5–1s
cold start; that's the honest tradeoff for free.

---

## Which path should you pick?

- **Just want to send the guild a link** → Path A. Ship it tonight, no DB.
- **Want officers to edit one shared roster, or want imports to survive a reload**
  → Path B. Start with Path A deployed anyway; Path B is additive.
- **Want persistence with zero backend, single user, no sharing** → skip Neon
  and use `localStorage` in `App.tsx`. It's ~10 lines and no account. Neon is
  only worth it for data shared across devices/people.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `500 ... roster_snapshots table is missing` | `db/schema.sql` was never run |
| `500 DATABASE_URL is not configured` | env var missing, or you didn't redeploy after adding it |
| `403 This roster is locked` | write token mismatch — the roster was created with a different one |
| `400 Pass a roster id...` | id must be lowercase letters/digits/dashes, max 64 chars |
| Function works locally with `npm run dev` but not `vercel dev` | `npm run dev` doesn't serve `api/` — use `vercel dev` |
| Build fails on Vercel only | check `npm ci` runs clean locally (lockfile committed) |
