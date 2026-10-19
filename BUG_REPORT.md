# BUG REPORT — MedhaShiree Coaching Management System

- **Created:** 2026-10-03
- **Last updated:** 2026-10-19
- **Base commit:** `ab6d812` (main) · **Re-verified at:** `854fe9a` (post-merge of `origin/main`)
- **Status:** Read-only audit (security/infra **+** follow-up feature/UX audit). All items are OPEN unless the status table or "FIXES LANDED" says otherwise.
- **How to use this file (for humans or AI):**
  1. Pick ONE bug at a time, top-down by PRIORITY.
  2. Read the bug's section: symptoms → evidence (file:line) → root cause → fix plan → verification.
  3. Implement on a branch, verify with the stated checks, then **update the status table below** to `FIXED (commit-hash)`.
  4. Entry `VERIFIED-OK` items are NOT bugs (already mitigated or claim was wrong) — do not "fix" them.
  5. Commit policy for this repo: **no bot/AI co-author trailers, author = the owner**. Note: a NaraCLI-managed hook at `.git/hooks/prepare-commit-msg` re-adds `Co-authored-by: ByNara` — check for it before committing and remove it if present.

## Status summary

| ID | Sev | Title | Area | Status |
|----|-----|-------|------|--------|
| B-01 | CRITICAL | Whole DB publicly readable/writable (40 `USING(true)` RLS policies) | Supabase/RLS | OPEN |
| B-02 | HIGH | `POST /api/attendance/scan` has no authentication | API security | FIXED (3784284) |
| B-03 | HIGH | Desktop offline vault never syncs back to cloud on reconnect | Electron | FIXED (68a4ff2, b0ec909) |
| B-04 | HIGH | Bengali text garbled in jsPDF receipts / ID cards | PDF | OPEN |
| B-05 | MED | AudioContext leak kills scanner chimes after ~6–10 scans; biometric page has no audio at all | Attendance UI | OPEN |
| B-06 | MED | Public `/api/enroll/submit` — no throttle/dedup (spam + ID-sequence abuse) | API abuse | FIXED (d422e3b) |
| B-07 | LOW-MED | No Unicode SMS segment counter on bulk-SMS page | SMS | FIXED (65004bf) |
| B-08 | LOW | Float precision on fee math in display paths | Finance | FIXED (3784284, 65004bf) |
| B-09 | LOW | `requireAuthOrSelf()` silently passes any user when called with `undefined` | Auth lib | OPEN |
| B-10 | LOW | Duplicate migration numbers (002/007/019/024) — setup ambiguity | DB setup docs | FIXED (a663bd8) |
| B-11 | HIGH | Vercel monthly-billing cron always 401s (staff-auth wall) → dues never auto-generate | CI/CD | FIXED (3784284) |
| B-12 | MED | No CI at all — no lint/typecheck/build gates on PR, no test framework | CI/CD | OPEN |
| B-13 | MED | DB schema managed by hand-run SQL — no migration pipeline, dev/prod drift | CI/CD / DB | OPEN |
| B-14 | MED | Desktop app: no release pipeline, no signing, server URL hardcoded to production | CI/CD / Electron | OPEN |
| B-15 | LOW | Vercel function timeout can cut off bulk monthly-dues generation at scale | CI/CD | OPEN |
| B-16 | CRITICAL | Student online exam-taking completely broken (`auth_id` column + `/student/dashboard` 404) | Student portal | FIXED (2602556) |
| B-17 | HIGH | Student exam-results page crashes (Rules of Hooks) | Student portal | FIXED (766ba87) |
| B-18 | HIGH | Receptionist denied on attendance/resequence/SMS APIs (`reception` vs `receptionist`) | Auth / RBAC | FIXED (c362e46) |
| B-19 | HIGH | Fee-Dues "Send SMS" is a mock — no message is sent | Fee Dues / SMS | FIXED (b594f67) |
| B-20 | MED-HIGH | Payment approve/reject 403 for branch directors & designated approvers | Payments / RBAC | OPEN |
| B-21 | MED | Notice save/delete 403 for branch directors | Notices / RBAC | OPEN |
| B-22 | MED | Public QR verify page (`/verify`) requires login | Public / QR | OPEN |
| B-23 | MED | Notification dropdown links all roles to owner-only URLs | Navigation | FIXED (65004bf) |
| B-24 | MED | Teacher area leaks all-branch exams; Courses/Results are dead stubs | Teacher portal | OPEN |
| B-25 | MED | Enrollment ignores `discount_price` (overcharge); marketplace discount reversed | Enrollment / billing | OPEN |
| B-26 | MED | Silent "success" on failed writes (student delete, feedback, profile save) | UX correctness | FIXED (d422e3b) |
| B-27 | LOW | Parent portal exact-match lookup → false "Student not found" | Parent portal | OPEN |
| B-28 | LOW | Online-result login param mismatch (`returnUrl` vs `redirect`) | Auth / UX | FIXED (65004bf) |

| ID | Verdict | Note |
|----|---------|------|
| V-01 | VERIFIED-OK | Camera cleanup on unmount already implemented (claimed "bug 1.2") |
| V-02 | VERIFIED-OK | Unentered-marks→"F" is guarded at all call sites (claimed "bug 3.1") |
| V-03 | VERIFIED-OK | Bengali day-of-week timezone shift does NOT occur for BD users (claimed "bug 3.2") |
| V-04 | VERIFIED-OK | SMS 880-prefix normalization already in live path; raw-number providers are dead code (claimed "bug 4.2") |

Recommended fix order: **B-02 → B-11 → B-20 → B-21 → B-22 → B-01 → B-06 → B-12 → B-13 → B-03 → B-04 → B-05 → B-25 → B-26 → B-23 → B-24 → B-07 → B-08 → B-27 → B-28 → B-09 → B-14 → B-15 → B-10.**
(B-02/B-03/B-06/B-07/B-08/B-10/B-11/B-16/B-17/B-18/B-19/B-23/B-26/B-28 are DONE — see FIXES LANDED. B-01 is the biggest; everything client-side that writes via the anon key must move to server routes as part of it. B-12 unblocks all later work by catching regressions.)

## FIXES LANDED (since base commit `ab6d812`)

Already fixed on `main` (latest batch: 2026-10-19) — do not redo.

| Fix | Commit | Note |
|-----|--------|------|
| `students.guardian_phone` made nullable; bulk-enroll stores `NULL` instead of the placeholder; migration added | `e48ccd1` | **Still requires running `supabase/migrations/035_nullable_guardian_phone.sql` in Supabase.** |
| Owner exam view defaults to a daily tab (was weekly aggregate) | `346bd76` | Superseded/expanded by the `origin/main` merge (now today-aware). |
| Homepage hydration mismatch (branding `localStorage` read inside a `useState` initializer) | `73d6409` | `components/providers/BrandingContext.tsx:38` now seeds `DEFAULT_BRANDING`. |
| Bulk Excel result import + weekly marks persistence (teammate) | `210d375` / `ccfb577` (merged into `854fe9a`) | — |
| **B-16** student exam: query `students.auth_user_id` (was nonexistent `auth_id`); post-load fallback redirects to `/student/profile` (was 404 `/student/dashboard`) | 2602556 | `app/student/exam/[id]/page.tsx` |
| **B-17** student results: moved derived day values + `displayedLeaderboard`/`rank` `useMemo`s above the early returns (Rules of Hooks) | 766ba87 | `app/student/exam/[id]/results/page.tsx` |
| **B-18** RBAC: `requireStaffRole` now normalizes `reception` → `receptionist`; call sites standardized to `receptionist` | c362e46 | `lib/api-auth.ts` + 6 routes |
| **B-19** Fee-Dues SMS modal now POSTs to `/api/sms/send` with real success/error handling (was a mock toast) | b594f67 | `app/dashboard/owner/fee-dues/FeeDuesClient.tsx` |
| **B-02** attendance QR scan requires a staff session | 3784284 | `app/api/attendance/scan/route.ts` |
| **B-11** monthly billing now runs from a `CRON_SECRET`-guarded cron route | 3784284 | Shared `lib/billing/generate-monthly.ts`; **set `CRON_SECRET` in Vercel** and keep the staff endpoint for manual runs |
| **B-06** public enrollment throttled per IP and phone | d422e3b | In-memory limiter (best-effort per serverless instance); DB pending/transaction checks remain the hard guard |
| **B-26** failed writes are surfaced instead of silently "succeeding" | d422e3b | Student delete, homepage feedback, student profile |
| **B-23** notification feed and dropdown are role-aware | 65004bf | Admin-only items filtered server-side; admin tabs/footer hidden for other roles |
| **B-28** online-result login uses the `redirect` param | 65004bf | `app/online-result/page.tsx` |
| **B-07** SMS composer shows correct GSM/Unicode segment counts | 65004bf | Fixed the multi-part formula (160/153 and 70/67) |
| **B-08** fee math rounded to 2 decimals | 3784284 / 65004bf | `round2()` in `lib/utils.ts`, accountant previews, scan due totals |
| **B-03** offline attendance queue syncs on reconnect | 68a4ff2 / b0ec909 | `POST /api/vault/sync`; **set the same `VAULT_SYNC_TOKEN` in Vercel and on each desktop PC** |
| **B-10** migration ordering documented | a663bd8 | `supabase/migrations/README.md` |

---

## B-01 — CRITICAL: Whole database is publicly readable/writable (RLS open)

**Area:** Supabase RLS / data layer
**Status:** OPEN

### Symptom
Anyone on the internet (no login) can read all tables (student PII, guardian phones, fees) and **write** `exam_results`, `fee_dues`, `attendance`, etc. — via the Supabase REST API using the anon key, which is public (embedded in the app's JS bundle). Consequences: mark tampering, PII leak, arbitrary row insertion/deletion.

### Evidence
- `supabase/COMPLETE_SETUP.sql:1449-1460` — e.g. `CREATE POLICY "Public full access exam_results" ON public.exam_results FOR ALL USING (true);`. **All 40** policies in the file are blanket `FOR ALL USING (true)`; there are **zero** restrictive policies and no `GRANT`/`REVOKE` statements anywhere in the file.
- Supabase default privileges already grant `anon` + `authenticated` on the `public` schema, so the permissive policies are effective for anonymous clients.
- The app *depends* on this hole: the owner exam page upserts `exam_results` with the anon client at `app/dashboard/owner/exams/[id]/page.tsx:2034` (plus ~10 more `exam_results.upsert` calls in that file; client created from `@/lib/supabase/client`) and in `app/student/exam/[id]/page.tsx`.

### Root cause
RLS was set to `USING (true)` everywhere to make quick client-side writes work, instead of scoping by role + moving writes to the server.

### Fix plan (coordinate all steps; do NOT ship steps 1–2 without step 3 or marks entry breaks)
1. New migration `supabase/migrations/037_restrictive_rls.sql` (numbers `035` = `035_nullable_guardian_phone.sql` and `036` = `036_enrollment_roll_unique_per_batch.sql` are taken):
   - Add a `SECURITY DEFINER` helper, e.g. `is_staff(uid uuid)` (checks `staff` table + optional `site_settings.staff_custom_roles`), and `is_owner(uid)`.
   - `DROP POLICY` all `"Public full access *"` policies.
   - Per-table policies:
     - `exams`, `exam_results`, `exam_submissions`, `exam_questions`, `exam_answers`: SELECT for staff (and for `authenticated`/`anon` ONLY where published: keep a read policy on `exams` `WHERE is_published = true` + a public-results policy on `exam_results` joined to published exams, mirroring `app/api/online-results` visibility rules); INSERT/UPDATE/DELETE: **no anon policy** (service role bypasses RLS, so app writes go through API routes).
     - `students`, `enrollments`, `batches`, `fee_dues`, `payments` (incl. `payments` + approval tables), `expenses`, `attendance`, `biometric_logs`, `sms_queue`, `materials*`: staff-only read+write via `is_staff(auth.uid())`.
     - `staff`, `branches`, `site_settings`: `is_owner(auth.uid())` write; staff read.
     - `courses`, `course_content`, `course_reviews`: published → anon/authenticated read; owner/teacher write.
     - `feedback`, `blogs`, `notices`: anon read where public; staff write.
   - Add `WITH CHECK` on write policies matching the `USING` predicate.
2. Audit: run `grep -rn "from(\"<table>\")" app components | grep -v admin` style audit for every table you lock; any client-side (anon) write must move to a server route handler using `createAdminClient()`.
   - Known anon-write sites to migrate: `app/dashboard/owner/exams/[id]/page.tsx` (`exam_results.upsert` at `:2034`, `:2137`, `:2298`, `:2466`, `:2545`, `:3139`, … → reuse `POST /api/exams/[id]/results`), plus any others found by the audit.
3. Apply to a **dev Supabase project first**, run full feature regression (login, exam marks entry/save, public online-results, enrollment, payments, dashboard loads), then apply to production and repoint env vars.

### Verification
- With only the anon key: `POST {project}.supabase.co/rest/v1/exam_results` → expect **403/401**, and `GET` on `students` → empty/403.
- Teacher/owner logged in: marks entry + save works (goes through the new API route).
- Public pages (`/online-result`, `/marketplace`, `/enroll`) still load.

### Risk
Highest in this report. Wrong policy scoping silently breaks client reads → dashboards show empty. Keep a dev project + the old policies as backup; do NOT delete blanket policies until step 2's migration list is complete.

---

## B-02 — HIGH: `POST /api/attendance/scan` has no authentication

**Area:** API security / attendance
**Status:** FIXED (3784284) — 2026-10-19
**Impact (after fix):** Unauthenticated callers can no longer read student fee status or write attendance through the QR scan endpoint. A staff session is required, matching the sibling attendance routes.

### Symptom
Any anonymous caller can:
- mark any student present/absent in any batch/date (writes attendance with the **admin/service client**),
- read a student's fee dues (`due_amount`, due dates),
- spam-create attendance rows (DoS),
- trigger QR generation for arbitrary students.

### Evidence
- `app/api/attendance/scan/route.ts:9` — `export async function POST(req)` with **no** `requireAuth`/`requireStaffRole`/`getUser` anywhere in the file (the only auth-adjacent import, `createClient` line 3, is created at line 26 but never used for auth).
- Line 11: `rawQr = body.qr_code || body.code || body.token || body.student_id` — raw `student_id` accepted as input.
- Lines 231-240: `admin.from("attendance").insert(...)` / `.upsert(...)`, `admin` = service-role client (line 25).

### Fix plan
1. Add at the top of `POST`: `const auth = await requireStaffRole(["owner", "reception", "teacher", "accountant", "manager", "branch_super_manager", "branch_director"]); if (isAuthError(auth)) return auth;` (confirm the exact role strings against `supabase` role values used elsewhere, e.g. `app/api/sms/send/route.ts:86`).
2. Decide: keep the `body.student_id` fallback? If it exists only for testing, gate it behind owner role or remove.
3. Remove the unused `createClient()` call.
4. Check sibling routes `app/api/attendance/batch-data/route.ts` for the same gap.

### Verification
- `curl -X POST http://localhost:3000/api/attendance/scan -H 'Content-Type: application/json' -d '{"qr_code":"MS-10001"}'` → **401** before, **403/401** without a staff session after.
- Receptionist-logged-in browser scan → still works (200, attendance row created).

### Risk
Low. The UI page that calls it is already behind the middleware, so legit traffic is unaffected.

---

## B-03 — HIGH: Desktop offline vault never syncs back to cloud on reconnect

**Area:** Electron desktop app
**Status:** FIXED (68a4ff2, b0ec909) — 2026-10-19
**Impact (after fix):** Offline attendance saved in the desktop shell is persisted to `offline-queue.json` and retried on startup, reconnect and manual sync until the server acknowledges every entry. Queue size is visible in the shell. Payment entries are still not written offline (read-only in the vault) and remain a follow-up.

**Deployment note (2026-10-19):** `VAULT_SYNC_TOKEN` is not set yet, so the sync endpoint returns `503` and queued attendance stays safely on the PC. Enable steps: `docs/PENDING_SETUP.md` §2.

### Symptom
Staff record attendance/payments in Offline Mode on the PC (saved to `local-vault.json`). When internet returns, the app just reloads the live website — **nothing flushes the offline data to Supabase**. The offline UI explicitly promises otherwise: `electron/offline/index.html:403` ("will auto-sync when internet is connected") and `:423` ("stays in continuous sync with the cloud server"). Data recorded offline is silently lost.

### Evidence
- `electron/main.js`: on reconnect the heartbeat handler only fires a notification + `loadApplication()` (loads `DEFAULT_SERVER_URL`). No flush/merge logic.
- `getQueuePath()` (`electron/main.js:36`) defines `offline-queue.json` but **nothing ever writes to or reads from it** (grep `queuePath` in the repo: only that one definition).
- `electron/preload.js` exposes only `vault:get / vault:save / vault:get-info` — no sync/flush IPC.
- `electron/offline/index.html:602-618`: reconnect button and network listener both just call `loadServer()`.

### Fix plan
1. **Offline UI writes pending entries to a queue** (not just overwriting the vault): in `electron/offline/index.html`, on each local record, also push `{type:"attendance"|"payment", payload, ts, client_id: uuid}` to `offline-queue.json` via `electronAPI` (add `appendQueue(entry)` / `getQueue()` / `clearQueue()` IPC to `preload.js` + `ipcMain` handlers in `main.js`).
2. **New server endpoint** `POST /api/vault/sync` (auth: `requireStaffRole`) that accepts a batch of queued entries and idempotently upserts them (attendance upsert on `(student_id,batch_id,date)` — same key as `app/api/attendance/scan/route.ts:240`; payments need a client-generated `idempotency_key`).
3. **`main.js` flush on reconnect:** in the heartbeat handler, when `isOnline` becomes true → read queue → POST to `APP_SERVER_URL + /api/vault/sync` (auth strategy: reuse the staff session or a dedicated token — flag as design decision) → on 200 `clearQueue()` + notify "N records synced"; on failure keep queue + notify count.
4. UI: show `stat-queue` (already rendered, `electron/offline/index.html:322`) with live queue count + "last synced" + manual sync button.

### Verification
- `npm run electron:dev`, kill network, record 3 attendance entries → queue count 3.
- Restore network → notification "3 records synced", queue empty, rows visible on cloud web app.
- Kill sync mid-flight → queue preserved, no duplicates after retry (idempotency).

### Risk
Medium. Payment records need careful idempotency (never double-apply fees). Option: scope B-03 to attendance first; payments sync is the harder half.

---

## B-04 — HIGH: Bengali text garbled in jsPDF receipts & ID cards

**Area:** PDF generation
**Status:** OPEN (blocked on font asset — see checklist)

### Symptom
"Download PDF Receipt" / PDF ID card for a student whose name/branch is Bengali (e.g. "মোহাশ্রী কোচিং") prints `????` or boxes, because jsPDF's default `helvetica` is WinAnsi-encoded and cannot render Bengali (U+0980–U+09FF).

### Evidence
- `app/dashboard/owner/payments/PaymentsClient.tsx:678-739` — receipt PDF built with `doc.setFont("helvetica", ...)` only; zero font embedding.
- `app/dashboard/owner/students/new/NewStudentForm.tsx:1621+` — same pattern for the ID card PDF.
- `lib/id-card-generator.ts` — the 67 KB HTML + `window.print` path renders Bengali fine via browser/system fonts; only the jsPDF paths are affected. Confirm during the fix which of the 3 files actually embeds Bengali text.
- No `addFileToVFS` / `addFont` anywhere in the repo.

### Fix plan
1. **Obtain a bundlable Unicode Bengali TTF** (Kalpurush and SolaimanLipi are OFL-licensed). Keep it in the repo, e.g. `public/fonts/kalpurush.ttf` (a few hundred KB).
2. In each jsPDF call site:
   ```ts
   const buf = await (await fetch("/fonts/kalpurush.ttf")).arrayBuffer()
   const fontBase64 = btoa(String.fromCharCode(...new Uint8Array(buf))) // or chunked
   doc.addFileToVFS("Kalpurush.ttf", fontBase64)
   doc.addFont("Kalpurush.ttf", "Bengali", "normal")
   ```
   Pick font per text chunk: `/[\u0980-\u09FF]/.test(text) ? "Bengali" : "helvetica"`.
3. For `jspdf-autotable` receipt tables: set `styles.font` per cell where Bengali is detected.

### Verification
- Generate receipt + ID card PDF for a test student named "রহিম আহমদ", batch "মোহাশ্রী কোচিং" → open PDF, Bengali renders correctly.
- English-only receipts unchanged (helvetica, file size stable).

### Blocked-on checklist
- [ ] Owner supplies/approves a TTF + license (OFL is fine).
- [ ] Decide: fetch from `/fonts/` at runtime vs base64 inlined module (inlining is simpler; ~500 KB once, shared).

---

## B-05 — MED: AudioContext leak kills scanner chimes; biometric page has no audio

**Area:** Attendance UI / Web Audio
**Status:** OPEN

### Symptom
The claimed "siren.mp3 autoplay block" does **not** exist — there is no `siren.mp3` and no `new Audio()` anywhere; the siren is oscillator-based. BUT `playTone()` creates a **new `AudioContext` on every call and never closes it**. Chromium hard-caps active AudioContexts (~6): after ~6–10 scans in one session, newly created contexts stay suspended → success/warning chimes stop silently. That is exactly the "receptionist stops hearing due alerts" outcome, just via a different mechanism. Separately, the fingerprint/biometric screen shows text "Alert siren activated" with **no audio at all**.

### Evidence
- `components/attendance/AttendanceCameraScannerModal.tsx:62-87` — `const ctx = new AudioCtx()` inside `playTone`; no `ctx.close()` anywhere; `playSuccessChime` spawns a second context via `setTimeout`.
- No `Audio(` / oscillator usage in `app/dashboard/reception/biometric/page.tsx` (line 90 is text + icon only).

### Fix plan
1. Module-level singleton context: `let sharedCtx: AudioContext | null` — create lazily on first **user gesture** (pointerdown), call `sharedCtx.resume()`, reuse for all tones; schedule both chime oscillators on the same context (drop the `setTimeout`-spawned second context).
2. Extract `playSuccessChime` / `playWarningChime` into a shared `lib/audio-alerts.ts` and use it on the biometric page for the RED alert — fixes the "no siren on biometric screen" gap.
3. Optional hygiene: `sharedCtx.close()` on `pagehide`.

### Verification
- Open scanner, do 15 rapid scans (valid + due + invalid) → chime still plays at #15.
- Biometric page RED state → audible warning tone.

### Risk
Low.

---

## B-06 — MED: Public `/api/enroll/submit` — no throttle / dedup (spam + ID-sequence abuse)

**Area:** Public enrollment API
**Status:** FIXED (d422e3b) — 2026-10-19
**Impact (after fix):** Enrollment submissions are throttled per IP and per phone number (HTTP 429), while the existing pending-submission and duplicate transaction-ID checks still apply.

### Symptom
`POST /api/enroll/submit` is intentionally public (online enrollment). It creates `students` + `enrollments` + `fee_dues` rows and consumes the sequential `MS-####` student-ID sequence (`app/api/enroll/submit/route.ts:92-117`), with **no** rate limit, captcha, or dedup. An attacker can flood the DB with junk students, burn the ID sequence, and manufacture fake fee dues.

### Evidence
- `app/api/enroll/submit/route.ts` — no `getUser`, no throttle, no `rate`/`limit`/`captcha` markers anywhere in the file (grep returns nothing).
- `app/api/enroll/submit/route.ts:367-390` — silently upserts/merges dues for any phone match.

### Fix plan (pick the depth; all safe)
1. **Dedup window:** before creating, if a submission with the same `guardian_phone` + same batch exists in the last N minutes, return the existing student instead of a new one.
2. **Rate limit:** in-memory Map (by IP, e.g. 5 submits / 10 min / IP) for small scale; or a `rate_limits` table if one already exists (check `site_settings`).
3. **Queue-to-review (business decision — confirm with owner):** mark public enrollments `status: 'pending'` and activate only on staff approval. Biggest protection, changes enrollment UX (student not instantly visible in batches).

### Verification
- 20 rapid identical `curl` posts → 1 student row (or 5 + 429s), no 20 new `MS-` IDs consumed.
- Legit enrollment (unique phone) still completes instantly (unless 3 chosen).

### Risk
Low for 1+2; medium for 3 (UX change).

---

## B-07 — LOW-MED: No Unicode SMS segment counter on bulk-SMS page

**Area:** Bulk SMS
**Status:** FIXED (65004bf) — 2026-10-19
**Impact (after fix):** The SMS composer now shows accurate GSM (160/153) and Unicode (70/67) character/segment counts, and the campaign estimate multiplies recipients by the correct number of parts.

### Symptom
Owner types a Bengali bulk SMS. Bengali is UCS-2 → 70 chars/segment (vs 160 GSM). A 75-char Bengali notice silently costs 2 gateway units per guardian (500 guardians → 1000 units). No preview, no cap, no warning.

### Evidence
- `app/dashboard/owner/sms/page.tsx` — no `length`-based character/segment logic for the message body (the `length` hits in that file are params/branch arrays, not message counting).
- Gateway dispatch: `app/api/sms/send/route.ts` posts the raw `task.message` unchanged (correct — splitting is the gateway's job; the missing piece is client-side visibility).

### Fix plan
- On the SMS message field: live counter — `chars = msg.length; isUnicode = /[\u0800-\uFFFF]/.test(msg); per = isUnicode ? 70 : 160; segments = Math.max(1, Math.ceil(chars / per))`; show `“X chars · Y SMS units per guardian · total Y × N guardians”`.
- Warn (amber) at >70, hard-cap input at e.g. 340 chars (5 segments) to prevent typos.
- Also compute the interpolated final message (after `{name}`-style param substitution — see the params system in the page).

### Verification
- 75 Bengali chars → counter shows 2 units. 150 English chars → 1 unit.

### Risk
Trivial.

---

## B-08 — LOW: Float precision on fee math in display paths

**Area:** Finance display
**Status:** FIXED (3784284, 65004bf) — 2026-10-19
**Impact (after fix):** Monetary previews, stored payment amounts and outstanding due totals are rounded to two decimals, so values no longer display floating-point artifacts.

### Symptom
With decimal amounts, `due - paid` in JS can surface as `666.6700000000001` on screen / PDF. Real but low probability: fees are usually whole BDT, and the DB stores money as exact `NUMERIC(10,2)`.

### Evidence
- DB side exact: `supabase/migrations/006_payment_system.sql:27-29` (`NUMERIC(10,2)`).
- JS display paths: `app/api/attendance/scan/route.ts:157,170,284` (`Number(d.due_amount) - Number(d.paid_amount)`), `app/dashboard/accountant/AccountantClient.tsx:2760,2805` (`Math.max(0, parseFloat(payAmount) - parseFloat(payDiscount))` rendered directly into JSX).

### Fix plan
- Add to `lib/utils.ts`: `export const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100`.
- Apply at the two boundaries: (a) server responses that emit computed money (scan route `due_amount` totals), (b) the client display expressions listed above.
- Leave DB values untouched (NUMERIC already correct).

### Verification
- Seed a due of `0.29`, pay `0.05` → UI shows `0.24`, receipt shows `0.24` (no 0.23999…).

### Risk
Trivial.

---

## B-09 — LOW: `requireAuthOrSelf()` silently passes any user when called with `undefined`

**Area:** Auth lib
**Status:** OPEN

### Symptom
`requireAuthOrSelf(studentAuthUserId?)` in `lib/api-auth.ts` — if a future route calls it *without* the student id, any authenticated non-staff user gets access (the self-check is skipped when `studentAuthUserId` is falsy). No current callers (grep: zero), so it's a landmine, not an active hole.

### Evidence
- `lib/api-auth.ts` — `if (studentAuthUserId && user.id !== studentAuthUserId)` — `undefined` → gate passes.

### Fix plan
- Make the parameter required: `requireAuthOrSelf(studentAuthUserId: string)` — or delete the helper (recommended: delete, until a real consumer appears).

### Verification
- `npx tsc --noEmit` / `npm run lint` — no compile breakage; grep confirms zero callers.

### Risk
Trivial.

---

## B-10 — LOW: Duplicate migration numbers (002 / 007 / 019 / 024 pairs)

**Area:** DB setup docs
**Status:** FIXED (a663bd8) — 2026-10-19
**Impact (after fix):** Operators have a documented, deterministic application order for the duplicated migration numbers and the status of recent migrations.

### Symptom
`supabase/migrations/` contains two `002_*`, two `007_*`, two `019_*`, and two `024_*` files, so “run them in order” is ambiguous for fresh setups.

### Evidence
- `002_add_referral_columns.sql` + `002_batch_details.sql`; `007_batch_status_and_online_exams.sql` + `007_notices_feedback_settings.sql`; `019_performance_indexes_for_scale.sql` + `019_seed_default_notices.sql`; `024_add_branch_director_role.sql` + `024_batch_roll_numbers.sql`.
- `supabase/COMPLETE_SETUP.sql` (1,652 lines) is the canonical one-shot idempotent script that supersedes the numbered migrations.

### Fix plan
- Rename to unambiguous order (e.g. `002a/002b`, `007a/007b`, `019a/019b`, `024a/024b`) — or just add a `supabase/migrations/README.md`: “New setup: run `COMPLETE_SETUP.sql` only. Numbered files are historical.”

### Verification
- Fresh Supabase project + `COMPLETE_SETUP.sql` → app works (documented flow; docs-only change).

### Risk
None (docs/renames).

---

## CI/CD — current pipeline map (as of 2026-10-03)

```
git push main ─► GitHub ─► Vercel (linked repo)
                      ├─ npm install + next build   ← the ONLY automated gate
                      ├─ build fails  → deploy blocked, site stays on previous version
                      └─ build passes → promoted to Production
                      └─ vercel.json cron: 0 0 1 * * → /api/billing/generate-monthly  (broken, see B-11)

NOT in any pipeline:
- DB schema: copy-paste SQL in Supabase dashboard (COMPLETE_SETUP.sql / numbered migrations) — manual
- Desktop app: manual `npm run electron:build` on a Windows machine → dist/ → distributed by hand
- lint / typecheck / tests: nowhere (no test framework exists)
```

## B-11 — HIGH: Vercel monthly-billing cron always 401s — dues never auto-generate

**Area:** CI/CD (Vercel cron) + billing API
**Status:** FIXED (3784284) — 2026-10-19
**Impact (after fix):** The Vercel cron now authenticates with `CRON_SECRET` and generates monthly dues without a staff session; staff can still trigger the same idempotent logic manually.

**Deployment note (2026-10-19):** `CRON_SECRET` is not set on Vercel yet, so the cron returns `503` and automatic billing stays off; the manual generate action still works. Enable steps: `docs/PENDING_SETUP.md` §1.

### Symptom
`vercel.json` schedules `GET /api/billing/generate-monthly` at `0 0 1 * *` (1st of every month, 00:00 UTC). The route is guarded by `requireStaffRole(["owner", ...])` — a cron request carries **no user session**, so it gets **401/403 every single month**. Vercel's cron UI shows the invocation as delivered (it delivered a 401), so the failure is invisible. **Monthly `fee_dues` are not auto-created**; an owner must open the app and trigger generation manually.

### Evidence
- `vercel.json` → `"crons": [{"path": "/api/billing/generate-monthly", "schedule": "0 0 1 * *"}]`.
- `app/api/billing/generate-monthly/route.ts:9,15` — both `GET` and `POST` start with `requireStaffRole(...)`.

### Fix plan
1. Add a cron-only entry point that authenticates by **secret, not by user session**: `GET /api/cron/billing` checking `req.headers["authorization"] === `Bearer ${process.env.CRON_SECRET}`` (set `CRON_SECRET` in Vercel env), delegating to the same `handleGenerate`.
   - Vercel crons can attach a static `Authorization` header via the cron config (`headers` field) or you keep the secret check on the endpoint — either way: no Supabase user auth involved.
2. Point the `vercel.json` cron at `/api/cron/billing`.
3. Keep the existing staff-guarded `POST /api/billing/generate-monthly` for manual owner triggering (add `?month=YYYY-MM` param docs).
4. Idempotency is already in place (existing-dues check, `route.ts:84-90`) — re-runs are safe.

### Verification
- Deploy, then in Vercel → Cron Triggers: next fire (or manual "Run now") returns **200** and `fee_dues` gains the target month's rows.
- `curl` the cron URL without the header → 401/403.

### Risk
Low. Isolated endpoint + env secret; existing manual flow untouched.

---

## B-12 — MED: No CI at all — zero automated gates on the code path

**Area:** CI/CD (GitHub Actions)
**Status:** OPEN

### Symptom
No `.github/workflows`, no lint/typecheck/build jobs on PR or push. The only check in the system is Vercel's deploy-time `next build` — which blocks a broken deploy but gives **zero early signal** (a reviewer merges a type error and finds out at deploy). No test framework exists (`package.json` has no jest/vitest/playwright), so even a CI job has nothing test-y to run yet.

### Evidence
- `ls .github` → no such directory.
- `package.json` scripts: `dev/build/start/lint/electron:*` — no `test`.

### Fix plan
1. Add `.github/workflows/ci.yml` on PR + push to main:
   ```yaml
   - npm ci
   - npm run lint
   - npx tsc --noEmit
   - npx next build     # same gate Vercel runs, now ~minutes earlier, on PRs
   ```
2. Mark required check on `main` (repo settings) so bad merges stop at PR.
3. Later (optional): add Vitest for `lib/utils.ts` money/grade helpers; Playwright smoke against a dev Supabase project for the login→dashboard path.

### Verification
- Open a PR with a deliberate TS error → CI fails, merge blocked.

### Risk
None — additive. First run may surface a pile of pre-existing lint/type noise; fix-or-`eslint-disable`-with-reason in a separate commit first if needed.

---

## B-13 — MED: DB schema managed by hand-run SQL — no migration pipeline, dev/prod drift guaranteed

**Area:** CI/CD / database
**Status:** OPEN

### Symptom
Schema changes are copy-pasted into the Supabase SQL editor (`supabase/COMPLETE_SETUP.sql` + 35 numbered files, several duplicate-numbered — see B-10). Nothing tracks *which* migration each environment has run. A missed/aborted migration on the prod project → runtime `.select()` errors that only surface when some branch happens to touch that column. No rollback path either.

### Evidence
- No `supabase` CLI in `devDependencies` (`package.json` has only `@supabase/ssr` + `@supabase/supabase-js`).
- `supabase/` dir contains raw SQL files, no `config.toml`/managed-migrations setup.

### Fix plan (pick depth)
1. **Light:** adopt Supabase **managed migrations** (Supabase CLI: `supabase migration up`) wired to each environment; retire the raw-SQL-editor workflow; keep `COMPLETE_SETUP.sql` only for brand-new projects.
2. **Heavier:** `supabase start` local + `supabase db push` in CI against a staging DB + diff check before prod.
3. **Minimum viable guard (do this even if 1/2 is deferred):** a CI job (extending B-12's workflow) that dumps both dev/prod schemas and fails on drift: `pg_dump --schema-only` + `diff` (needs DB read creds in GitHub secrets).

### Verification
- Fresh Supabase project: `supabase migration up` from empty → app works.
- Drift guard: introduce a column only in dev → CI red.

### Risk
Medium if schema resets are needed (managed migrations rewrites history) — coordinate with B-01 (RLS lockdown lands as one new migration too). Do B-01 + B-13 as one combined DB workstream.

---

## B-14 — MED: Desktop app — no release pipeline, no signing, hardcoded production URL

**Area:** CI/CD (Electron) / desktop distribution
**Status:** OPEN

### Symptom
Desktop releases are built by hand: `npm run electron:build` on a Windows machine → electron-builder → `dist/` → installers shared manually (probably Telegram/WhatsApp). No CI build, no code-signing (unsigned NSIS → SmartScreen warnings for every user), no auto-update, and `electron/main.js:6` hardcodes `DEFAULT_SERVER_URL = https://medhashiree.vercel.app` — so **there is no dev/staging target** and any future domain move silently breaks every installed client.

### Evidence
- `package.json` `build` block: `"win": { "target": [nsis, portable], "icon": "icon.ico" }` — no `certificateFile`/`cscLink` (no signing), Windows-only targets.
- No GitHub Actions job touching `electron/` (no CI exists at all, B-12).
- `electron/main.js:6`: `const DEFAULT_SERVER_URL = process.env.APP_SERVER_URL || "https://medhashiree.vercel.app"`.

### Fix plan
1. GitHub Actions `windows-latest` job on tag: `npm ci` → `npm run electron:build` → upload `dist/*` as release artifacts (auto-publish on tag v*).
2. Env flavors: build-time injection of `APP_SERVER_URL` (dev tag → staging URL, stable tag → prod URL).
3. Code-signing cert (even a free EV-less OV cert) to kill SmartScreen prompts.
4. Optional: wire `electron-updater` for auto-update against the release feed.

### Verification
- Tag `desktop-v1.0.1` → release with NSIS + portable artifacts, signed; installed client on `APP_SERVER_URL` flavor hits the right domain.

### Risk
Low–medium; independent of web pipeline. Signing cert is a purchase/Org-verification step on the owner.

---

## B-15 — LOW: Vercel function timeout can cut off bulk monthly-dues generation at scale

**Area:** CI/CD (serverless limits)
**Status:** OPEN

### Symptom
`handleGenerate` loops all active batches → enrollments → students and batch-inserts `fee_dues` (route `app/api/billing/generate-monthly/route.ts`). On Vercel Hobby the function default max is **10 s**; with thousands of students/branches the insert batches can exceed it → **partial month generated**. Re-runs are safe (idempotent, B-11 §4), but nothing re-triggers automatically.

### Evidence
- Route has no `maxDuration` export (`grep "maxDuration" app/api/billing/generate-monthly/route.ts` → 0).
- No chunking/batching limit visible in the insert loop beyond the existing-dues skip.

### Fix plan
1. `export const maxDuration = 60` (or 300 on Pro) in the route.
2. Chunk the inserts (e.g. 500 rows/batch) and process month-by-month slices so a re-run only fills the gap.
3. Log a completion marker (`site_settings.last_billing_run = {month, count, ok}`) so the UI/cron can alert on incomplete months.

### Verification
- Dev project seeded with ~10k enrollments → generation completes within limit, marker written.

### Risk
Low.

---

## B-16 — CRITICAL: Student online exam-taking is completely broken

**Area:** Student portal / exams
**Status:** OPEN

### Symptom
No student can open or take an online exam. Opening an exam shows "Student profile not found" and then redirects to `/student/dashboard`, which **does not exist** (404). Submitting an exam whose results are not shown immediately lands on the same 404.

### Evidence
- `app/student/exam/[id]/page.tsx:38` — `.eq("auth_id", user.id)`; the `students` table has **no `auth_id`** column (the column is `auth_user_id`, `supabase/COMPLETE_SETUP.sql:48`). PostgREST errors → `throw new Error("Student profile not found")` (`:40`).
- `:101` (catch) and `:182` (post-submit, non-immediate results) both `router.push("/student/dashboard")` — no such route exists (only `app/student/page.tsx` and `app/student/profile/page.tsx`).
- The correct column is used elsewhere: `app/api/student/profile/route.ts`, `app/student/batch/[id]/page.tsx`, `app/batch/[id]/EnrollButton.tsx`.

### Root cause
Wrong column name (`auth_id`) plus a stale redirect target (`/student/dashboard`).

### Fix plan
1. `app/student/exam/[id]/page.tsx:38` → `.eq("auth_user_id", user.id)`.
2. Replace both `/student/dashboard` redirects (`:101`, `:182`) with a real route (`/student/profile`, or the student home `app/student/page.tsx` — confirm intended target).
3. Sweep for the same typo: `grep -rn 'eq("auth_id"' app`.

### Verification
- Log in as a student with an assigned exam → exam opens and questions render.
- Submit an exam with `show_results_immediately = false` → lands on a real page (no 404).

### Risk
Low (a couple of one-line changes).

---

## B-17 — HIGH: Student exam-results page crashes (Rules of Hooks)

**Area:** Student portal / exams
**Status:** OPEN

### Symptom
Opening a student's exam results throws the React error "Rendered more hooks than during the previous render"; the page fails to render, so results are unreachable.

### Evidence
- `app/student/exam/[id]/results/page.tsx` — `const [loading, setLoading] = useState(true)` (`:31`); early returns `if (loading) return …` (`:133`) and `if (!exam) return …` (`:142`); **after** those returns, `useMemo` at `:223` and `:248`.
- First render (`loading === true`) returns before the `useMemo`s; when `loading` becomes false the component runs two extra hooks → hook-count mismatch.

### Root cause
Conditional early returns placed above hook calls.

### Fix plan
- Move the two `useMemo`s (`:223`, `:248`) above the `if (loading)` / `if (!exam)` early returns (keep dependency arrays), or extract the loaded view into a child component.

### Verification
- Open `/student/exam/<id>/results` for a published exam → renders, no console error (weekly and non-weekly).

### Risk
Low.

---

## B-18 — HIGH: Receptionist denied on attendance/resequence/SMS APIs (`reception` vs `receptionist`)

**Area:** Auth / RBAC
**Status:** OPEN

### Symptom
A receptionist opens Reception → Attendance and the student list is empty; Save/resequence does nothing; some SMS actions fail. The fetch failure is only `console.error`'d, so it looks like there is simply no data.

### Evidence
- Canonical DB role value is `receptionist`: `supabase/COMPLETE_SETUP.sql:1128` — `CHECK (role IN ('owner','branch_director','super_manager','manager','receptionist','teacher','accountant','course_teacher'))`. There is **no `reception` role**.
- `requireStaffRole` does an exact `roles.includes(staffData.role)` (`lib/api-auth.ts:79`).
- Routes that pass only `"reception"` (so a `receptionist` gets 403): `app/api/attendance/batch-data/route.ts:11,156`; `app/api/batches/next-roll/route.ts:118,297`; `app/api/sms/send/route.ts:106`; `app/api/export/csv/route.ts:41` (dead code, no callers).
- Routes that correctly allow both: `app/api/student/bulk-enroll/route.ts:107`, `app/api/student/create-account/route.ts:6`, `app/api/student/enrollment/route.ts:20`.

### Root cause
Inconsistent role aliases; the canonical value is `receptionist`.

### Fix plan
1. Standardize on `receptionist` (accept `reception` as a temporary alias) in every `requireStaffRole([...])`. Prefer a shared constant, e.g. `STAFF_ROLES` / `RECEPTION_ROLES` in `lib/api-auth.ts`.
2. Best: normalize `reception` → `receptionist` once inside `requireStaffRole` so call sites cannot drift.

### Verification
- Log in as `receptionist` → Attendance list loads; Save and next-roll work; SMS send returns 200 (not 403).

### Risk
Low. Additive.

---

## B-19 — HIGH: Fee-Dues "Send SMS" is a mock — nothing is sent

**Area:** Fee Dues / SMS
**Status:** OPEN

### Symptom
Staff click "Send SMS" on an unpaid due, see a success toast, but no SMS goes out and nothing is logged/queued.

### Evidence
- `app/dashboard/owner/fee-dues/FeeDuesClient.tsx:783` — handler is `onClick={() => { toast.success("SMS sent (mock)!"); setSmsModal(null) }}`; it never calls `/api/sms/send`.
- Working senders for reference: `app/dashboard/owner/students/StudentsClient.tsx` (~`895-929`), `app/dashboard/owner/accountant/AccountantClient.tsx` (~`1195-1231`).

### Fix plan
- Replace the mock handler with a real `POST /api/sms/send` call using the due's guardian phone + a message template (reuse the params/interpolation from the bulk-SMS page); show real success/error from the response.

### Verification
- Send a due reminder → a row appears in the SMS log/queue and the (mock) provider logs the send.

### Risk
Low.

---

## B-20 — MED-HIGH: Payment approve/reject 403 for branch directors & designated approvers

**Area:** Payments / RBAC
**Status:** OPEN

### Symptom
Branch directors (and staff listed in `payment_approvers`) see Approve/Reject buttons on Payment Approvals, but clicking returns 403 "Forbidden — requires one of: owner, super_manager, manager".

### Evidence
- `app/api/payments/approve/route.ts:6` and `app/api/payments/reject/route.ts:6` — `requireStaffRole(["owner","super_manager","manager"])`.
- The UI grants more rights: `app/dashboard/owner/payment-approvals/page.tsx:26` includes `branch_director`; `:28-35` also grants `canApprove` to `payment_approvers` designees (managed in `owner/settings/SettingsClient.tsx`).

### Root cause
API role list is narrower than the UI's permission model.

### Fix plan
- Align the API with the UI: allow `owner, super_manager, manager, branch_director` **and** designated `payment_approvers` (look up `payment_approvers` by `staff_id` in the handler), or hide the UI buttons for roles the API rejects.

### Verification
- Branch director approves → 200; designated approver → 200; a plain teacher → 403.

### Risk
Low–medium: get the `payment_approvers` lookup right so unauthorized staff cannot approve.

---

## B-21 — MED: Notice save/delete 403 for branch directors

**Area:** Notices / RBAC
**Status:** OPEN

### Symptom
A branch director composing a branch notice gets 403 on Save (and cannot delete).

### Evidence
- `app/api/notices/save/route.ts:80` and `app/api/notices/delete/route.ts:8` — `["owner","super_manager","manager"]` (no `branch_director`), while the notices UI grants branch directors branch-scoped management.

### Fix plan
- Add `branch_director` to both role lists **and** enforce branch scoping in the query (a branch director should only write their own branch).

### Verification
- Branch director saves/deletes a branch notice → 200 and the notice appears.

### Risk
Low.

---

## B-22 — MED: Public QR verification page (`/verify`) requires login

**Area:** Public / QR
**Status:** OPEN

### Symptom
Scanning a student/ID QR that points at `/verify/student?qr=...` redirects anonymous users to `/login` instead of showing the verification result.

### Evidence
- `proxy.ts:24` — `publicRoutes` omits `/verify`, so the path falls through to `if (!user) redirect("/login")` (`:53-54`).
- The page itself is public-capable: `app/verify/student/page.tsx` looks the student up with the admin client and does not require auth. Links are generated by `getStudentVerificationUrl` (`lib/utils.ts:378-380`).

### Fix plan
- Add `"/verify"` to `publicRoutes` in `proxy.ts:24`.

### Verification
- Logged out, open `/verify/student?qr=<valid>` → result renders (no `/login` redirect).

### Risk
Low. Confirm the verify page only exposes intended, non-sensitive fields.

---

## B-23 — MED: Notification dropdown dead-links non-owner roles

**Area:** Navigation / notifications
**Status:** FIXED (65004bf) — 2026-10-19
**Impact (after fix):** Non-admin roles no longer receive owner-only payment/deletion items, notice and exam links point to their own dashboard, and admin-only footer actions are hidden.

### Symptom
Receptionist/teacher/accountant click a notification and are bounced back to their own dashboard (the click appears to do nothing).

### Evidence
- `components/layout/NotificationDropdown.tsx:341,351` — hardcoded `router.push("/dashboard/owner/notices")` (owner-only).
- `app/api/notifications/route.ts:19-28,106` — returns the same feed (including admin-only items) to all staff roles.
- The dropdown renders for every role (`components/layout/DashboardHeader.tsx`), and `proxy.ts:98-99` redirects non-owner roles away from `/dashboard/owner/*`.

### Fix plan
- Make notification `href`s role-aware (map owner routes to the viewer's dashboard root), or filter admin-only items out of the feed for non-owner roles.

### Verification
- As receptionist/teacher → click each notification → lands on a reachable page.

### Risk
Low.

---

## B-24 — MED: Teacher area leaks all-branch exams; Courses/Results are dead stubs

**Area:** Teacher portal / RBAC
**Status:** OPEN

### Symptom
Teachers see exams from **all** branches and can reach owner-level exam actions. Teacher → Courses and Teacher → Results are empty stubs.

### Evidence
- `app/dashboard/teacher/exams/page.tsx:1` — `export { default } from "../../owner/exams/page"` (re-exports the owner page).
- `app/dashboard/owner/exams/page.tsx:13-16` fetches **all** exams across branches with the admin client; `ExamsClient` has no role/branch filter.
- `app/dashboard/teacher/courses/page.tsx:2` — "Course creation interface coming soon."; `app/dashboard/teacher/results/page.tsx` — static placeholder, no data.

### Fix plan
1. Scope the exams list by role + the teacher's branch/batches (reuse `BranchContext` permissions), or ship a teacher-specific exams view.
2. Implement or remove the Courses/Results nav entries so they don't dead-end.

### Verification
- Teacher logs in → sees only their branch's/batches' exams and cannot reach owner-only actions.

### Risk
Medium — touches shared exams UI; coordinate with the RLS work (B-01).

---

## B-25 — MED: Enrollment ignores `discount_price` (overcharges); marketplace discount reversed

**Area:** Enrollment / billing
**Status:** OPEN

### Symptom
A course advertised at a discount is charged at the full price — students overpay. Public marketplace cards show the full price as the headline and the discounted price struck through (reversed).

### Evidence
- `app/enroll/page.tsx:552` — `const coursePrice = selectedCourse ? Number(selectedCourse.price || 0) : 0`; `:553` uses it for `totalAmount`; `:1556` renders `formatCurrency(selectedCourse.price)`. `discount_price` is selected (`:404`) but never applied.
- Admin treats `discount_price` as the effective price: `app/dashboard/owner/marketplace/MarketplaceClient.tsx:51` (`setPaidAmount(String(course.discount_price || course.price))`), `:189-192`.
- `app/marketplace/MarketplaceBrowseClient.tsx:598-605` renders `course.price` as the headline and `course.discount_price` as the `line-through` — backwards.

### Fix plan
1. Effective price = `Number(discount_price) > 0 ? discount_price : price`, applied wherever the student is charged/displayed (enroll `:552-553`, `:1556`).
2. Marketplace card: show the discounted price as the headline, the original struck through (only when `0 < discount_price < price`).

### Verification
- Course price ৳2000, discount_price ৳1500 → enroll total ৳1500; card shows ৳1500 with ৳2000 struck through.

### Risk
Medium — money path; verify against how `/api/enroll/submit` records dues/amounts.

---

## B-26 — MED: Silent "success" on failed writes

**Area:** UX correctness / data
**Status:** FIXED (d422e3b) — 2026-10-19
**Impact (after fix):** Student deletion, homepage feedback and profile save now fail loudly and keep the UI consistent with the database instead of claiming success.

### Symptom
Several actions report success even when the DB write failed, so UI and database disagree until reload.

### Evidence
- Permanent student delete: `app/dashboard/owner/students/StudentsClient.tsx:1178-1189` — `supabase.from(...).delete()` returns `{ error }` (does not throw), so the `try/catch` never fires; the row is removed from local state and a success path continues. Orphan `payments`/`attendance` are not deleted.
- Home feedback form: `app/page.tsx:639-646` — sets `fbDone`/success unconditionally; the second insert's error is never checked.
- Student profile save: `app/student/profile/page.tsx:306-320` — `update(...)` results are unchecked; a success toast + local state update always run (and the `students` update is skipped if `studentData?.id` is missing).

### Fix plan
- Check `{ error }` from each mutation; only show success when it is null; surface errors via toast. For profile save, require a real `id` before claiming success.

### Verification
- Force an RLS/FK failure (or invalid id) → UI shows an error, not success; state matches DB after reload.

### Risk
Low.

---

## B-27 — LOW: Parent portal exact-match lookup → false "Student not found"

**Area:** Parent portal
**Status:** OPEN

### Symptom
Parents with correct details get "Student not found. Check ID and phone number." because the lookup is exact and case/format-sensitive.

### Evidence
- `app/parent-portal/page.tsx:20` — `.eq("student_id", studentId).eq("guardian_phone", phone)`.
- `student_id` is case-sensitive (`MS-12345` vs `ms-12345`) and the phone must match exactly (spaces/dashes break it). Worsened because `guardian_phone` is sometimes auto-filled with the student's own phone or `"N/A"` (`app/api/enroll/submit/route.ts:40`, `app/api/auth/signup/route.ts:198`).
- Other code normalizes: `app/student/profile/page.tsx` uses `ilike`.

### Fix plan
- Normalize input: uppercase/normalize `student_id`, strip non-digits from the phone, and use `ilike`/a normalized comparison.

### Verification
- Enter `ms-12345` + `01700-000000` → resolves the same student as `MS-12345` + `01700000000`.

### Risk
Low. Handle a `NULL` guardian phone (now nullable — see FIXES LANDED).

---

## B-28 — LOW: Online-result "back to results" login param mismatch

**Area:** Auth / UX
**Status:** FIXED (65004bf) — 2026-10-19
**Impact (after fix):** The online-result login button now returns the user to the results page after authentication.

### Symptom
Signing in from the online-result page drops the user on their dashboard instead of returning to the result they were viewing.

### Evidence
- `app/online-result/page.tsx:1189` — link uses `href="/login?returnUrl=/online-result"`.
- `app/login/page.tsx:183-185` — only reads `searchParams.get("redirect")`; `returnUrl` is ignored. (The enroll page correctly uses `?redirect=`.)

### Fix plan
- Use one param name everywhere: change the online-result link to `?redirect=/online-result` (simplest) or teach login to also read `returnUrl`.

### Verification
- From `/online-result`, log in → returns to `/online-result`.

### Risk
Trivial.

---

## VERIFIED-OK: claims checked and NOT bugs (do not re-open without new evidence)

### V-01 — “Camera lockout on unmount / dual tabs” (claimed bug 1.2) — already mitigated
- `components/attendance/AttendanceCameraScannerModal.tsx` — the scanner effect cleanup calls `html5QrCodeRef.current.stop().catch()` on close/unmount, plus a dedicated `!isOpen` branch stops the stream. Dual-tab contention shows the built-in error overlay (“Could not start camera feed”) with a manual-code fallback form, not a black screen.
- Residual (cosmetic only): `stop()` errors are swallowed.

### V-02 — “Unentered marks grade as F / 0.0 GPA” (claimed bug 3.1) — guarded at call sites
- `lib/utils.ts:34` `getGrade(null)` → `"F"` is true in isolation, but every consumer guards first:
  - Leaderboard/toppers: `app/dashboard/owner/exams/[id]/page.tsx:3877` (`obt !== null ? getGrade(...) : "-"`) + filter `obtained_marks > 0`.
  - Rank sync: filtered `!isNaN(marks)` before `getGrade` (line ~2018).
  - Stats (pass rate, avg): computed from entered marks only (`enteredCount`), line ~3850.
- Before re-declaring this a bug, check any NEW view that calls `getGrade` without a guard.

### V-03 — “Bengali day-of-week timezone shift in BD” (claimed bug 3.2) — not reproducible for the target audience
- `lib/utils.ts:154` `getBengaliDayFromDate` does `new Date(dateStr)` on `YYYY-MM-DD` → parsed as **UTC midnight**. In Bangladesh (GMT+6) that is 06:00 local **same day** → correct weekday. Only negative-UTC timezones (the Americas) shift a day.
- Optional hardening (if staff ever use the app from abroad): parse as local midnight — `const [y, m, d] = dateStr.split("-").map(Number); const dt = new Date(y, m - 1, d)`.

### V-04 — “Missing 880 prefix in SMS rejected by gateway” (claimed bug 4.2) — handled in the live path
- `app/api/sms/send/route.ts:12` `normalizeBdPhone()` (`01x` → `8801x`, 13-digit pass-through) is applied to every dispatch (`const phoneToUse = normalizeBdPhone(task.phone)` before GET/POST_FORM/POST_JSON branches).
- `lib/sms/provider.ts` (MockSmsProvider / SslWirelessProvider / TwilioProvider sending raw `to`) is **dead code — imported nowhere**. Delete it (or normalize inside it).

---

## Appendix A — Quick evidence index (copy-paste greps)

```bash
# B-01: count permissive policies
grep -c 'CREATE POLICY "Public full access' supabase/COMPLETE_SETUP.sql   # 40
grep -c 'CREATE POLICY' supabase/COMPLETE_SETUP.sql                     # 40 → zero restrictive

# B-02: no auth in scan route
grep -cE 'requireAuth|getUser|requireStaffRole' app/api/attendance/scan/route.ts   # 0

# B-03: queue file never used
grep -rn 'queuePath' electron/    # only the definition in main.js

# B-04: no font embedding anywhere
grep -rn 'addFileToVFS\|addFont' app lib components   # 0

# B-05: no context close
grep -n 'close()' components/attendance/AttendanceCameraScannerModal.tsx   # 0

# B-06: no throttle markers
grep -inE 'rate|limit|captcha|throttl' app/api/enroll/submit/route.ts     # 0

# B-11: cron target behind staff auth
cat vercel.json                                            # cron → /api/billing/generate-monthly
grep -n 'requireStaffRole' app/api/billing/generate-monthly/route.ts   # both GET+POST guarded → cron 401s

# B-12: no CI files, no test script
ls .github 2>/dev/null                                     # (nothing)
grep '"test"' package.json                                   # (nothing)

# B-13: no supabase CLI / managed migrations
grep '"supabase"' package.json                               # (nothing in devDependencies)
ls supabase/config.toml 2>/dev/null                         # (nothing)

# B-14: no signing config in electron-builder block
grep -c 'certificateFile\|cscLink' package.json             # 0
grep -n 'DEFAULT_SERVER_URL' electron/main.js                # hardcoded prod domain

# B-15: no maxDuration on the billing route
grep -c 'maxDuration' app/api/billing/generate-monthly/route.ts   # 0

# B-16/B-17: student exam column + hooks order
grep -n 'eq("auth_id"' app/student/exam/\[id\]/page.tsx            # 1 → should be auth_user_id
grep -n 'if (loading)\|if (!exam)\|useMemo(' app/student/exam/\[id\]/results/page.tsx   # returns before useMemo
ls app/student/dashboard 2>/dev/null                              # (nothing) → redirect target 404s

# B-18: reception vs receptionist
grep -rn '"reception"' app/api                                   # routes that reject the real DB role
grep -n "role IN (" supabase/COMPLETE_SETUP.sql                  # ...'receptionist'...

# B-19: fee-dues SMS mock
grep -n 'SMS sent (mock)' app/dashboard/owner/fee-dues/FeeDuesClient.tsx

# B-20/B-21: payment & notice role gates
grep -n 'requireStaffRole' app/api/payments/approve/route.ts app/api/payments/reject/route.ts \
  app/api/notices/save/route.ts app/api/notices/delete/route.ts

# B-22: /verify public?
grep -n 'publicRoutes' proxy.ts                                  # /verify absent

# B-25: discount_price usage
grep -rn 'discount_price' app/enroll/page.tsx app/marketplace/MarketplaceBrowseClient.tsx
```

## Appendix B — Repo conventions (for AI agents working on these fixes)

- Next.js version here is **16** (not 14/15) — per `AGENTS.md`, read `node_modules/next/dist/docs/` before touching app-router conventions; note the repo's auth gate file is `proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`).
- Server writes should use `createAdminClient()` (`lib/supabase/admin.ts`) inside `app/api/*` route handlers; auth via `requireAuth` / `requireStaffRole` / `isAuthError` (`lib/api-auth.ts`).
- Role strings in use (canonical DB values, `supabase/COMPLETE_SETUP.sql:1128`): `owner`, `super_manager` (redirects to owner), `manager`, `branch_director`, `receptionist`, `teacher`, `course_teacher`, `accountant`. **Note:** several `requireStaffRole` call sites wrongly pass `"reception"` instead of `"receptionist"` (see B-18).
- Money = `NUMERIC(10,2)` in Postgres; round in JS only at display/response boundaries.
- Commit policy: **owner-only authorship, zero bot/AI co-author trailers.** If a `prepare-commit-msg` hook re-adds `Co-authored-by: ByNara`, delete the hook block first (it is NaraCLI-managed and may reappear).
- This report was first verified at `ab6d812` and re-verified at `854fe9a` (2026-10-19); if the code moves far ahead, re-run the Appendix A greps before trusting file:line refs.
