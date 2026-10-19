# Deferred setup and decisions

Last updated: **2026-10-19**

This file records work that is implemented in code but intentionally **not
enabled yet**, so it can be picked up later without re-investigating. Nothing
here is required for the rest of the app to work.

---

## 1. Monthly billing cron — `CRON_SECRET` (not configured)

**Status:** code done, deployment secret not set.

**What exists**
- `app/api/cron/billing/route.ts` — cron entrypoint, validates a bearer secret.
- `lib/billing/generate-monthly.ts` — shared, idempotent due-generation logic.
- `app/api/billing/generate-monthly/route.ts` — the existing staff-triggered
  endpoint (owner / super_manager / manager / accountant).
- `vercel.json` — schedule `0 0 1 * *` pointing at `/api/cron/billing`.

**Current behaviour without the secret**
- The cron endpoint returns `503` ("CRON_SECRET environment variable is missing").
- No dues are generated automatically.
- The manual **Generate Monthly Dues** action in the owner dashboard still works.

**Why it is deferred:** the Vercel project is owned by a friend; nobody who can
edit Vercel is available right now.

**How to enable later (project owner, ~1 minute)**
1. Generate a secret: `openssl rand -hex 32`
2. Vercel → Project → Settings → Environment Variables → add `CRON_SECRET`
   (Production; optionally Preview) and redeploy.
3. Verify:
   - `curl -i -H "Authorization: Bearer <secret>" https://<domain>/api/cron/billing`
     → `200`
   - same request without the header → `401`
4. The next scheduled run is the 1st of the month at 00:00 UTC. Check the Vercel
   Cron logs afterwards.

**Security:** never commit the value. To rotate, update the env var and redeploy.

---

## 2. Desktop offline sync — `VAULT_SYNC_TOKEN` (not configured)

**Status:** code done, deployment secret not set.

**What exists**
- `POST /api/vault/sync` — validates the bearer token, upserts attendance.
- `electron/main.js` — `offline-queue.json`, `appendQueue`, `syncQueue`, and
  automatic flush on startup / reconnect / manual sync.
- `electron/preload.js` — queue IPC bridge.
- `electron/offline/index.html` — offline attendance form, queue count and
  "Sync Queued Actions Now" button.

**Current behaviour without the secret**
- The sync endpoint returns `503`.
- The desktop app shows `VAULT_SYNC_TOKEN is not configured on this PC` and keeps
  every queued entry in `offline-queue.json`. **Nothing is lost.**
- Online usage of the website is unaffected.

**How to enable later**
1. Generate one secret and reuse it everywhere: `openssl rand -hex 32`
2. Add `VAULT_SYNC_TOKEN=<secret>` to the Vercel project and redeploy.
3. On each Windows PC, set the same `VAULT_SYNC_TOKEN` environment variable
   before launching the app (the main process currently reads
   `process.env.VAULT_SYNC_TOKEN`).
4. Test:
   - Save offline attendance in the desktop shell → the **Queued Actions** count
     increases.
   - Restore internet → the queue flushes automatically (or press
     **Sync Queued Actions Now** in the Vault tab).
   - Re-saving the same batch/date/student updates the queued entry instead of
     duplicating it (`client_id = attendance:<batch>:<student>:<date>`).
   - Server upserts on `(student_id, batch_id, date)`, so replays are idempotent.

**Scope:** attendance only. Offline **payments** are intentionally not written;
the vault keeps them read-only. Extending to payments needs its own idempotency
key and ledger review.

---

## 3. Cloudflare migration — evaluated, deferred

**Decision (2026-10-19):** stay on Vercel for now; no migration scheduled.

**Assessment**
- Ran `npx vinext check`: **95% compatible**.
- 63 pages, 36 route handlers, 3 layouts, `proxy.ts` (Next 16), redirects,
  rewrites and headers are all supported.
- The only warning was `__dirname` / `__filename` in `electron/main.js`, which is
  the desktop main process and is never deployed to Cloudflare.
- No database changes would be required; Supabase stays as-is.

**If this is revisited later**
- Cloudflare currently recommends `vinext` for Next.js 16; `@opennextjs/cloudflare`
  is the mature fallback.
- Replace `vercel.json` cron with a Cloudflare Cron Trigger.
- Set secrets with `wrangler secret put` (this also removes the dependency on the
  current Vercel owner).
- Add the new domain to Supabase Auth → Site URL / Redirect URLs.
- Update the Electron `APP_SERVER_URL` default (currently the Vercel domain).
- Use Workers Paid (~$5/month) for the CPU budget and enable Smart Placement so
  Workers run near the Supabase region.
- Test on the free `*.workers.dev` URL before switching DNS.

No Cloudflare-specific code or config was added to the repository.

---

## 4. Current operational snapshot

- Web app fixes are committed: B-02, B-03, B-06, B-07, B-08, B-10, B-11, B-23,
  B-26, B-28 (see `BUG_REPORT.md` for hashes and impact).
- Supabase migrations `035` and `036` are applied; `037` is reserved for the RLS
  hardening work (B-01).
- `APP_SERVER_URL` still defaults to the Vercel deployment.
- The two secrets above are the only remaining deployment steps for the
  automations; everything else works without them.
