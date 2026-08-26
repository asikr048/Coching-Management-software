# EduManage BD - Coaching Management System

A full-featured coaching center management solution built with Next.js 14 and Supabase, deployable on Vercel.

## Features

- **Student Management** - Registration, enrollment, batch assignment, referral system
- **Batch & Class Management** - Create batches, assign teachers, track occupancy
- **Fee & Payment** - Record payments, auto-receipt generation, due tracking
- **Biometric Entry** - Fingerprint scan simulation with RED/GREEN siren for fee alerts
- **Exam & Results** - Create exams, enter marks, leaderboard
- **Study Materials** - Inventory management for books, notes, worksheets
- **Referral System** - Student referral codes with commission tracking
- **Bulk SMS** - Send SMS to guardians (mock, SSL Wireless, or Twilio)
- **Course Marketplace** - Teacher course uploads, admin approval, public browsing
- **Multi-role Dashboard** - Owner, Receptionist, Teacher, Accountant
- **Public Pages** - Online enrollment, parent portal, course marketplace
- **Analytics** - Revenue, expenses, profit tracking with charts

## Tech Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Radix UI, Recharts
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Forms**: react-hook-form + Zod
- **PDF**: jsPDF + jsPDF-autotable
- **Hosting**: Vercel (free tier)

## Setup

### 1. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor, run `supabase/migrations/001_schema.sql`
3. Copy your project URL and keys

### 2. Environment Variables

Copy `.env.local` and fill in your Supabase keys:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Create Owner Account

In Supabase Dashboard:
1. Go to Authentication > Users, create a user (email/password)
2. Go to SQL Editor, run:

```sql
INSERT INTO branches (name) VALUES ('Main Branch');

INSERT INTO staff (auth_user_id, name, email, role, branch_id)
VALUES (
  'paste-auth-user-uuid-here',
  'Admin',
  'admin@example.com',
  'owner',
  (SELECT id FROM branches LIMIT 1)
);
```

### 4. Local Development

```bash
npm install
npm run dev
```

Visit http://localhost:3000

### 5. Deploy to Vercel

```bash
npx vercel
```

Or connect your GitHub repo at [vercel.com](https://vercel.com) and set environment variables in the Vercel dashboard.

## User Roles

| Role | Access |
|------|--------|
| **Owner** | Full access to all modules |
| **Receptionist** | Students, payments, attendance, biometric entry |
| **Teacher** | Own batches, attendance, exams, courses |
| **Accountant** | Payments, fee dues, expenses, reports |

## License

MIT
