# MedhaShiree — Coaching Management System

A full-featured coaching center management platform for running branches, batches, students, fees, exams, and communication — built with **Next.js 16 (App Router) + React 19 + Supabase**, deployable on **Vercel** and shippable as a **Windows desktop app (Electron)**.

## Features

- **Students & Enrollment** — registration, single and **bulk CSV enrollment**, batch assignment, per-batch **roll-number management** (auto-assign, serial numbering, and manual conflict resolution), student/enrollment **QR codes**, and referrals.
- **Batches & Staff** — create batches, assign teachers, track occupancy, manage **multiple branches** and staff roles/permissions.
- **Attendance** — manual entry, **QR scan**, and **biometric entry** with fee-alert alerts.
- **Fees & Billing** — record payments, auto-receipt generation, due tracking, **monthly dues auto-generation** (Vercel cron), payment approvals, expenses, and revenue/analytics dashboards.
- **Exams & Results** — create exams, enter marks, leaderboards, weekly exams, and **public result verification**.
- **Study Materials** — inventory management with issue tracking.
- **Communication** — **bulk SMS** (mock / SSL Wireless / Twilio / per-branch custom gateway), notices, and notifications.
- **Public Pages & Portals** — online enrollment, parent portal, student portal, course marketplace, and public results.
- **Site Management** — slider, site content, and branch configuration.
- **Desktop Edition** — Electron app (offline fallback page) that loads the hosted web app.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS v4, Radix UI, lucide-react, Recharts, sonner |
| Forms & Validation | react-hook-form + Zod |
| Backend / DB | Supabase (PostgreSQL, Auth, Storage) |
| Documents | jsPDF + jsPDF-autotable, xlsx |
| QR / Scanning | html5-qrcode |
| Desktop | Electron 44 (electron-builder: Windows NSIS + portable) |
| Hosting | Vercel |

## Project Structure

```
app/                  Next.js App Router (pages + API routes)
  dashboard/owner     Owner console (students, batches, fees, exams, ...)
  dashboard/reception Receptionist console
  dashboard/teacher   Teacher console
  dashboard/accountant Accountant console
  student/            Student portal
  api/                Server routes (auth, attendance, payments, sms, ...)
components/           Shared UI components
lib/                  Utilities, Supabase clients, SMS provider
electron/             Desktop shell (main.js, preload.js, offline page)
supabase/             COMPLETE_SETUP.sql + incremental migrations
proxy.ts              Auth/session middleware (Next.js 16)
vercel.json           Cron schedule
```

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project ([supabase.com](https://supabase.com))

### 1. Set up the database

- **New / any project (recommended):** open the Supabase **SQL Editor** and run the entire [`supabase/COMPLETE_SETUP.sql`](supabase/COMPLETE_SETUP.sql). It is idempotent and safe to re-run; it creates all tables, policies, triggers, and links an existing Auth user as the Owner.
- **Already provisioned:** apply only the newer files in [`supabase/migrations/`](supabase/migrations) in order (currently through `036_enrollment_roll_unique_per_batch.sql`) by running each one in the SQL Editor. Do not apply files you have already run.

> Migrations are applied manually in the Supabase SQL Editor.

### 2. Environment variables

Create **`.env.local`** in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Optional — SMS delivery and the desktop app:

```env
# SMS: mock (default) | ssl_wireless | twilio
SMS_PROVIDER=mock
SSL_WIRELESS_API_KEY=
SSL_WIRELESS_SID=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# Desktop shell: server URL to load
APP_SERVER_URL=https://medhashiree.vercel.app
```

### 3. Create the owner account

1. In the Supabase dashboard, go to **Authentication → Users** and create a user (email/password).
2. Re-run `COMPLETE_SETUP.sql` — it automatically links the first existing Auth user as the **Owner** staff member. Alternatively, insert the `staff` row manually:

```sql
INSERT INTO branches (name) VALUES ('Main Branch');

INSERT INTO staff (auth_user_id, name, email, role, branch_id, is_active)
VALUES (
  'paste-auth-user-uuid-here',
  'Admin',
  'admin@example.com',
  'owner',
  (SELECT id FROM branches LIMIT 1),
  TRUE
);
```

### 4. Run locally

```bash
npm install
npm run dev
```

Visit http://localhost:3000

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run electron:dev` | Run the desktop app against the dev server |
| `npm run electron:pack` | Package the desktop app (unpacked) |
| `npm run electron:build` | Build the Windows installer + portable `.exe` |

## User Roles

| Role | Access |
|------|--------|
| **Owner** | Full access to all modules and branches |
| **Super Manager / Manager / Branch Director** | Management access; branch-scoped where applicable |
| **Receptionist** | Students, enrollment, payments, attendance, biometric entry |
| **Teacher / Course Teacher** | Own batches, attendance, exams, results, courses |
| **Accountant** | Payments, fee dues, expenses, reports |

## Deployment (Vercel)

1. Import this repository at [vercel.com](https://vercel.com).
2. Add the environment variables from step 2 in the Vercel project settings.
3. Deploy. `vercel.json` schedules `/api/billing/generate-monthly` to run monthly for automatic dues generation.

## SMS Providers

| Provider | `SMS_PROVIDER` | Notes |
|----------|----------------|-------|
| Mock | `mock` (default) | Logs messages, no delivery — for development |
| SSL Wireless | `ssl_wireless` | Requires `SSL_WIRELESS_API_KEY` + `SSL_WIRELESS_SID` |
| Twilio | `twilio` | Requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |
| Custom gateway | — | Configured per branch (API key + URL template) |

## License

MIT
