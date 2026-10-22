# Deploying Raid Forge free

**Your setup:** static React app on Vercel + the roster saved in your own browser.
No database, no accounts, no cost. That's the right fit for one person managing
one guild's roster.

- [Vercel deploy](#1-deploy-to-vercel) — 5 minutes
- [How persistence works](#2-how-the-roster-survives-a-reload) — already built in
- [Backups](#3-backups-the-part-that-actually-matters) — the one thing worth doing
- [If you ever need sync](#4-if-you-ever-need-multi-device-sync) — unused, held in reserve

---

## 1. Deploy to Vercel

The build produces a single self-contained `dist/index.html` (via
`vite-plugin-singlefile`), so there are no asset paths or SPA rewrites to get
wrong. `vercel.json` already specifies the preset, build command, output
directory, and install command.

### Via the dashboard

1. Push the repo to GitHub.
2. Go to <https://vercel.com/new> → **Import Git Repository** → pick the repo.
3. Vercel reads `vercel.json` and fills everything in. Leave env vars empty.
4. **Deploy.**

Pushes to your production branch publish to your domain; other branches get
preview URLs.

### Via the CLI

```bash
npm i -g vercel
vercel login
vercel          # preview deployment
vercel --prod   # production
```

### Free-tier reality check (Vercel Hobby)

| Limit | Hobby |
| --- | --- |
| Cost | $0, no card |
| Fast Data Transfer | 100 GB / month |
| Deployments | 100 / day |
| Build time | 45 min / deploy |
| Function invocations | 1,000,000 / month (unused here — see §4) |
| Commercial use | **Not allowed** |

The last row is the one worth knowing: Vercel's fair-use guidelines restrict
Hobby to non-commercial, personal use. A private guild tool for your own raid
group is squarely in that category.

Raid Forge is a static folder of one file, so if you ever want to move it,
Cloudflare Pages and Netlify host it identically in minutes.

---

## 2. How the roster survives a reload

Persistence is built in and needs no configuration. Implementation:
`src/utils/storage.ts`, wired up in `src/App.tsx`.

- **What's saved:** roster members (including your edits to role, spec, notes and
  availability), the selected raid size, and the import source label.
- **Where:** `localStorage` under the key `raid-forge:roster`, as one versioned
  JSON document.
- **When:** 400ms after any change, plus an immediate flush if you close or
  background the tab mid-edit.
- **On load:** the saved roster is read before the first paint, so you never see
  the sample data flash first. First-ever visit falls back to the built-in sample.

It's deliberately hard to break:

- Corrupt or hand-edited JSON → ignored, app falls back to the sample roster.
- Partially damaged data → salvageable members are kept, unusable rows dropped.
- Unknown class/role values from a future version → coerced to `Unknown` rather
  than crashing a component.
- Storage blocked (Safari private mode, cookies off) or full → the app keeps
  working in memory and tells you in the status bar that changes won't persist.

Look at the top of the page: **"Saved in this browser · just now"** confirms the
write landed.

### What this does *not* cover

`localStorage` is per-browser and per-device. The roster survives reloads,
restarts, and closing the tab — but **not** clearing site data, "clear browsing
data", a different browser, incognito, or a different computer. That's a real
failure mode, and it's why the next section exists.

---

## 3. Backups (the part that actually matters)

No database means no backup job — so make backups trivial, which is what
**Export backup** in the status bar does:

- **Export backup** → downloads `raid-forge-backup-YYYY-MM-DD.json`.
- **Restore** → loads that file back, replacing the current roster.

Do this after any big import and maybe once a month. Drop the file in Google
Drive, Dropbox, or the guild Discord. It's a few hundred KB, and it's your only
recovery path if browser data gets wiped.

Restoring is also how you move the roster to another machine: export on the old
one, restore on the new one.

---

## 4. If you ever need multi-device sync

Not needed for one user on one browser, so it is **not wired up** — but the
repo already contains a working, tested option for later:

| File | Purpose |
| --- | --- |
| `db/schema.sql` | One table, `roster_snapshots` (id, `jsonb` data, optional write token) |
| `api/roster.ts` | Serverless endpoint: `GET /api/roster?id=x`, `PUT /api/roster?id=x` |
| `.env.example` | What `DATABASE_URL` looks like |

It's inert until you set `DATABASE_URL`, and nothing in the UI calls it yet. Use
it if you want officers editing one shared roster, or the roster following you
across devices. Neon's free plan (100 CU-hours/project/month, 1 GB storage,
sleeps after 5 idle minutes) covers a guild roster many times over; the tradeoff
is a ~0.5–1s cold start on the first request after idling.

If you decide you'll never want that, delete `api/`, `db/`, `.env.example`, and
the `@neondatabase/serverless` dependency — none of it ships to the browser.

### Why not connect to Postgres from the browser directly?

The connection string would have to be in the client bundle, which publishes your
database credentials. The serverless function exists purely to keep it server-side.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Status bar shows "Saved in this browser" but the roster reverts | You're in a different browser/profile, or a private window |
| "Browser storage is full" | Export a backup, then check for other data on the domain; quota is ~5 MB |
| "This browser is blocking local storage" | Safari private mode, or cookies/site data disabled |
| Roster reverted after clearing browsing data | Expected — restore your exported backup |
| Build fails on Vercel only | Run `npm ci && npm run build` locally; the lockfile is committed |
