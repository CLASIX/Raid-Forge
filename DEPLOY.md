# Deploying Raid Forge free

**Your setup:** static React app + the roster saved in your own browser. No
database, no backend, no cost.

- [GitHub Pages](#1-github-pages-no-new-account) — recommended, no new signup
- [No hosting at all](#2-no-hosting-at-all) — send one HTML file
- [Vercel](#3-vercel-optional) — if you'd rather use it
- [How persistence works](#4-how-the-roster-survives-a-reload) — already built in
- [Backups](#5-backups-the-part-that-actually-matters) — the one thing worth doing
- [If you ever need sync](#6-if-you-ever-need-multi-device-sync) — unused, held in reserve

---

## 1. GitHub Pages (no new account)

Every static host ties the site to the deployer's account — that's how they
prevent abuse. **Visitors never need an account on any of them**; the signup is
always yours. So the cheapest option is the account you already have: GitHub.

### One-time setup (3 clicks, no workflow)

1. **Make the repo public.** Pages on a free account only publishes from public
   repositories (private repos need GitHub Pro, $4/mo).
2. **Settings → Pages → Build and deployment:**
   - Source: **Deploy from a branch**
   - Branch: **main**, Folder: **/docs**
   - **Save**

`docs/index.html` is already committed, so the site goes live in about a minute at:

```
https://<your-username>.github.io/Raid-Forge/
```

No asset paths to configure: the build is a single self-contained HTML file, so
it works unchanged from that subdirectory.

### Keeping it up to date

Rebuild and refresh the committed copy:

```bash
npm run build:pages     # builds, then copies dist/index.html -> docs/index.html
git commit -am "Update pages build" && git push
```

### Optional: auto-deploy on push

`deploy/github-pages-workflow.yml` builds and publishes on every push to `main`,
so you never think about it again. GitHub blocks automated tools from writing
workflow files, so to enable it: open that file on GitHub, copy its contents
into a new file at `.github/workflows/deploy-pages.yml`, commit — then switch
Pages source to **GitHub Actions**. After that `docs/` can be deleted.

### Before you make the repo public

The sample roster in `src/utils/rosterImport.ts` (`DEFAULT_CSV`) is **real
guild signup data** — player names, timestamps, and notes. It gets compiled into
the bundle, so a public site ships it to anyone who opens the page. If that
matters, scrub it first (replace with placeholder names) or keep the repo private
and use [option 2](#2-no-hosting-at-all).

### Free-tier reality check (GitHub Pages)

| Limit | Free |
| --- | --- |
| Cost | $0 |
| Public repos | Unlimited |
| Site size | 1 GB |
| Bandwidth | 100 GB/month (soft) |
| Builds | 10/hour (soft) — not applicable to Actions deploys |
| Visitors need an account | No |

---

## 2. No hosting at all

Because the whole app compiles to one file, you can skip hosting entirely:

```bash
npm run build          # produces dist/index.html (~700 KB, everything inlined)
```

Send `dist/index.html` in Discord (well under the 25 MB upload cap), and open it
in a browser. Works offline, no account, no URL, no server.

Trade-offs, honestly:

- **Updates mean re-sending the file.** No auto-deploy.
- **Each person gets their own data.** `localStorage` is per browser, so two
  people opening the same file don't share a roster.
- **`localStorage` on `file://` works in Chrome, Firefox and Edge**, but some
  locked-down setups block it. The app already detects that and shows the red
  "This browser is blocking local storage" warning instead of silently losing
  your edits.

For one person on one machine, this is genuinely enough. For a link you can put
in a Discord channel, use GitHub Pages.

---

## 3. Vercel (optional)

Vercel requires an account, which is why it's not the default above. If you
already have one:

1. <https://vercel.com/new> → **Import Git Repository** → pick the repo.
2. `vercel.json` pre-fills the preset, build command (`npm run build`), output
   directory (`dist`) and install command.
3. Leave env vars empty and **Deploy**.

CLI alternative: `npm i -g vercel && vercel login && vercel --prod`.

---

### Vercel Hobby limits

| Limit | Hobby |
| --- | --- |
| Cost | $0, no card, account required |
| Fast Data Transfer | 100 GB / month |
| Deployments | 100 / day |
| Function invocations | 1,000,000 / month (unused — no backend) |
| Commercial use | **Not allowed** (personal/non-commercial only) |

---

## 4. How the roster survives a reload

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

## 5. Backups (the part that actually matters)

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

## 6. If you ever need multi-device sync

The roster lives in one browser, so it does not follow you between machines.
That's intentional: for one person managing one guild it removes an entire
database, backend, and set of credentials from the project.

If that ever changes, the cheapest path is a hosted Postgres with a serverless
HTTP driver — Neon, Supabase, or Turso. Keep the connection string server-side in
a Vercel function; never put it in the client bundle, because anything the bundle
contains is public. Store the roster as a single JSON document rather than a row
per member, and it will fit comfortably inside every free tier.

That work is not in this repo. `vercel.json` has no `functions` block, there are
no `api/` routes, and no database dependency — the deploy is a static build.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Status bar shows "Saved in this browser" but the roster reverts | You're in a different browser/profile, or a private window |
| "Browser storage is full" | Export a backup, then check for other data on the domain; quota is ~5 MB |
| "This browser is blocking local storage" | Safari private mode, or cookies/site data disabled |
| Roster reverted after clearing browsing data | Expected — restore your exported backup |
| Build fails on Vercel only | Run `npm ci && npm run build` locally; the lockfile is committed |
| Editing a player shows a time like `1am` that isn't in the dropdown list | Kept deliberately — a time imported from a sheet outside 10am–12am stays selectable so it can't be silently blanked |
