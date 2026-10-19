<div align="center">

<img src="public/medhashiree-logo.jpg" alt="MedhaShiree" width="120" />

# MedhaShiree

**Coaching Management System**

All-in-one platform to run a coaching center — students, batches, fees, exams, attendance, and communication — with multi-branch support, a student &amp; parent portal, bulk SMS, and a Windows desktop edition.

> **Proprietary &amp; Closed-Source Software.** © 2026 MedhaShiree. All rights reserved.

[![License: Proprietary](https://img.shields.io/badge/License-Proprietary-red.svg)](#-license)
[![Next.js](https://img.shields.io/badge/Next.js-16.3.3-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.2.8-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Electron](https://img.shields.io/badge/Electron-44.2.0-47848F?logo=electron&logoColor=white)](https://www.electronjs.org)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed-Vercel-000000?logo=vercel&logoColor=white)](https://medhashiree.vercel.app)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](#)
[![Status](https://img.shields.io/badge/status-active-brightgreen.svg)](#-project-status)

**[Live Demo](https://medhashiree.vercel.app)**

</div>

---

## Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Database & Migrations](#-database--migrations)
- [Scripts](#-scripts)
- [User Roles](#-user-roles)
- [SMS Providers](#-sms-providers)
- [Desktop Edition](#-desktop-edition)
- [Deployment](#-deployment)
- [Project Status](#-project-status)
- [Security](#-security)
- [Support & Contact](#-support--contact)
- [Acknowledgements](#-acknowledgements)
- [License](#-license)

---

## Features

<table>
<tr><td width="50%" valign="top">

**Students & Enrollment**
- Student registration &amp; profiles
- Single and bulk **CSV enrollment**
- Per-batch **roll-number management** (auto-assign, serial numbering, manual conflict resolution)
- Batch assignment &amp; referrals
- Student / enrollment **QR codes**

**Batches, Branches & Staff**
- Create batches &amp; assign teachers
- Track batch occupancy
- Multiple branches
- Staff accounts with granular permissions

**Attendance**
- Manual entry
- **QR scan** attendance
- **Biometric entry** with fee-alert alerts

</td><td width="50%" valign="top">

**Fees & Billing**
- Payments &amp; auto-generated receipts
- Fee dues tracking
- **Monthly dues auto-generation** (Vercel Cron)
- Payment approvals flow
- Expenses &amp; revenue analytics

**Exams & Results**
- Create exams &amp; enter marks
- Leaderboards &amp; weekly exams
- **Public result verification**

**Communication**
- **Bulk SMS** (mock / SSL Wireless / Twilio / custom gateway)
- Notices &amp; in-app notifications

**Public Pages &amp; Portals**
- Online enrollment
- Student portal &amp; parent portal
- Course marketplace
- Public results

**Site Management**
- Slider, site content &amp; branch configuration

</td></tr>
</table>

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router) · React 19 · TypeScript |
| **UI & Charts** | Tailwind CSS v4 · Radix UI · lucide-react · Recharts · sonner |
| **Forms** | react-hook-form + Zod |
| **Backend / DB** | Supabase (PostgreSQL, Auth, Storage) |
| **Documents & Data** | jsPDF + jsPDF-autotable · xlsx |
| **QR / Scanning** | html5-qrcode |
| **Desktop** | Electron 44 (electron-builder → Windows NSIS + portable) |
| **Hosting** | Vercel (serverless + scheduled cron) |

---

## Architecture

```mermaid
flowchart LR
    U["Staff<br/>(Owner · Reception · Teacher · Accountant)"] --> W
    P["Students &amp; Parents<br/>(portals · public pages)"] --> W

    W["Next.js 16 Web App<br/>proxy.ts session middleware"] --> A["API Routes<br/>(auth, payments, sms, ...)"]
    W --> DB[("Supabase Postgres<br/>Auth · Storage")]
    A --> DB
    A --> SMS["SMS Gateway<br/>SSL Wireless · Twilio · custom"]
    CRON["Vercel Cron<br/>monthly billing"] --> A
    D["Electron Desktop App"] --> W
```

---

## Project Structure

```text
.
├── app/                      # Next.js App Router
│   ├── dashboard/            # Role consoles: owner, reception, teacher, accountant
│   ├── student/              # Student portal
│   ├── api/                  # Server routes (auth, attendance, payments, sms, ...)
│   └── ...                   # Public pages: login, signup, enroll, marketplace, results
├── components/               # Shared UI components
├── lib/                      # Utilities, Supabase clients, SMS provider
├── electron/                 # Desktop shell (main.js, preload.js, offline fallback)
├── supabase/                 # COMPLETE_SETUP.sql + incremental migrations
├── proxy.ts                  # Auth / session middleware (Next.js 16)
├── vercel.json               # Cron schedule
└── package.json
```

---

## Getting Started

### Prerequisites

- **Node.js 20+** and npm
- A **Supabase** project ([supabase.com](https://supabase.com))

### Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure the database (see "Database & Migrations")
# 3. Add your keys to .env.local (see "Environment Variables")

# 4. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Create **`.env.local`** in the project root:

| Variable | Required | Description |
| :--- | :---: | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service-role key (server-side only) |
| `SMS_PROVIDER` | — | `mock` *(default)*, `ssl_wireless`, or `twilio` |
| `SSL_WIRELESS_API_KEY` / `SSL_WIRELESS_SID` | — | Required when `SMS_PROVIDER=ssl_wireless` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | — | Required when `SMS_PROVIDER=twilio` |
| `APP_SERVER_URL` | — | Server URL the desktop app loads (defaults to the hosted app) |
| `CRON_SECRET` | ✅ (prod) | Bearer secret Vercel Cron uses to call `/api/cron/billing`; the route returns `503` when unset |
| `VAULT_SYNC_TOKEN` | — | Shared secret for `POST /api/vault/sync`; required for the desktop offline queue (use the same value on Vercel and each PC) |

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SMS_PROVIDER=mock
CRON_SECRET=your-cron-secret
VAULT_SYNC_TOKEN=your-vault-sync-token
```

> **Deployment note:** the cron and desktop-sync secrets are currently **not
> set**. See [`docs/PENDING_SETUP.md`](docs/PENDING_SETUP.md) for exact steps,
> current behaviour and the deferred Cloudflare assessment.

---

## Database & Migrations

**Option A — Fresh or catch-up (recommended).** In the Supabase **SQL Editor**, run the entire
[`supabase/COMPLETE_SETUP.sql`](supabase/COMPLETE_SETUP.sql). It is idempotent and safe to re-run: it creates all
tables, policies, and triggers, and links an existing Auth user as the **Owner**.

**Option B — Incremental.** If your database is already provisioned, apply only the newer files in
[`supabase/migrations/`](supabase/migrations) **in order**, running each one in the SQL Editor. Migrations are
currently applied through `036_enrollment_roll_unique_per_batch.sql`.

### Create the Owner account

1. In Supabase, go to **Authentication → Users** and create a user (email/password).
2. Re-run `COMPLETE_SETUP.sql` — it automatically links the first Auth user as the **Owner**.
   (Or insert the `staff` row manually with `role = 'owner'`.)

> Migrations are applied **manually** in the Supabase SQL Editor.

---

## Scripts

| Script | Description |
| :--- | :--- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run electron:dev` | Run the desktop app against the dev server |
| `npm run electron:pack` | Package the desktop app (unpacked) |
| `npm run electron:build` | Build the Windows installer + portable `.exe` |

---

## User Roles

| Role | Access |
| :--- | :--- |
| **Owner** | Full access to all modules and branches |
| **Super Manager · Manager · Branch Director** | Management access; branch-scoped where applicable |
| **Receptionist** | Students, enrollment, payments, attendance, biometric entry |
| **Teacher · Course Teacher** | Own batches, attendance, exams, results, courses |
| **Accountant** | Payments, fee dues, expenses, reports |

---

## SMS Providers

| Provider | `SMS_PROVIDER` | Notes |
| :--- | :--- | :--- |
| Mock | `mock` *(default)* | Logs messages, no delivery — for development |
| SSL Wireless | `ssl_wireless` | Requires `SSL_WIRELESS_API_KEY` + `SSL_WIRELESS_SID` |
| Twilio | `twilio` | Requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |
| Custom gateway | — | Configured per branch (API key + URL template) |

---

## Desktop Edition

An Electron shell wraps the hosted web app for Windows:

```bash
npm run electron:dev     # develop against the running server
npm run electron:pack    # unpacked build for testing
npm run electron:build   # installer + portable .exe in dist/
```

Point the desktop app at any server with `APP_SERVER_URL`. An offline fallback page is included in `electron/offline/`.

---

## Deployment

1. Import this repository at [vercel.com](https://vercel.com).
2. Add the environment variables above in **Project Settings → Environment Variables**.
3. Deploy. [`vercel.json`](vercel.json) schedules `/api/billing/generate-monthly` to run monthly for automatic due generation.

---

## Project Status

This project is under active development. Known issues and the ongoing fix list are tracked in
[`BUG_REPORT.md`](BUG_REPORT.md).

This is a **private, proprietary repository**. Redistribution of the source code is not permitted — see [License](#-license).

---

## Security

- **Authentication** is handled by Supabase Auth, with sessions enforced through the app's auth middleware (`proxy.ts`).
- **Authorization** is role-based and enforced on every server route via `lib/api-auth.ts`.
- **Privileged operations** run server-side using the Supabase **service-role** key, which is never exposed to the browser.
- **Secrets** are provided exclusively through environment variables and must never be committed to the repository.
- Access-control hardening is ongoing; see [`BUG_REPORT.md`](BUG_REPORT.md) for the current status.

---

## Support & Contact

For support, deployment assistance, or licensing inquiries, please contact the MedhaShiree team.

- **Live application:** [medhashiree.vercel.app](https://medhashiree.vercel.app)

---

## Acknowledgements

This product is built on excellent open-source software:

- [Next.js](https://nextjs.org) · [React](https://react.dev) · [Tailwind CSS](https://tailwindcss.com)
- [Supabase](https://supabase.com) — database, auth & storage
- [Radix UI](https://www.radix-ui.com) · [Recharts](https://recharts.org) · [lucide](https://lucide.dev) · [Sonner](https://sonner.emilkowal.ski)
- [Electron](https://www.electronjs.org) & [electron-builder](https://www.electron.build)

---

## License

**Copyright © 2026 MedhaShiree. All Rights Reserved.**

This is **proprietary, closed-source software**. It is made available for use only under the terms granted by
MedhaShiree. No part of this software may be copied, modified, distributed, sublicensed, or published — in whole or
in part, in source or binary form — without prior written permission from the copyright holder. See [`LICENSE`](LICENSE)
for the full terms.

<div align="center">
<sub>Built with Next.js, Supabase &amp; Electron — for coaching centers that want to run smarter.</sub>
</div>
