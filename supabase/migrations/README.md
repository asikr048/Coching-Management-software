# Database migrations

These SQL files are the canonical, incremental history of the MedhaShiree
database. Apply them **in the order shown below** (numeric prefix, then
filename). The ordering matters because later migrations assume earlier
tables/columns exist.

## Applying

- New project: run `supabase/COMPLETE_SETUP.sql` once instead of replaying
  every migration. It is the consolidated snapshot.
- Existing project: apply only the migrations that have not been applied yet,
  in order, from the Supabase SQL Editor (or `supabase db push`).
- Never edit or rename a migration that has already been applied to a live
  project. Add a new numbered migration instead.

## Numbering note

Some numbers are intentionally shared by independent changes that landed on
different branches. They are safe to apply in the listed order:

| Number | Files |
| ------ | ----- |
| 002 | `002_add_referral_columns.sql`, then `002_batch_details.sql` |
| 007 | `007_batch_status_and_online_exams.sql`, then `007_notices_feedback_settings.sql` |
| 019 | `019_performance_indexes_for_scale.sql`, then `019_seed_default_notices.sql` |
| 024 | `024_add_branch_director_role.sql`, then `024_batch_roll_numbers.sql` |

Sort order is plain lexicographic, which matches the table above.

## Status

| Migration | Notes |
| --------- | ----- |
| `035_nullable_guardian_phone.sql` | Applied to production (2026-10-19) |
| `036_enrollment_roll_unique_per_batch.sql` | Applied to production (2026-10-19) |
| `037_restrictive_rls.sql` | Reserved for the RLS hardening work (B-01), not yet written |
