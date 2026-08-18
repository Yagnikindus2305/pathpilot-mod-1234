/*
# Multiple target roles (same domain)

1. Changes
- `profiles.target_roles` (text[], default '{}') — additional roles the student
  is also interested in, alongside the existing single `target_role` (which
  stays as the primary role driving the roadmap/ATS scoring). These are
  UI-constrained to the same category as the primary role (see
  pathpilot_all_job_titles.json), so a Cybersecurity primary role only offers
  other Cybersecurity roles here — enforced client-side, not by this column.
  Used to widen the "companies you can target" / "job offers" matching in
  Module 2 and Module 5 beyond a single role.

2. Notes
No RLS changes needed — profiles already has owner-scoped policies covering
all columns.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_roles text[] DEFAULT '{}';
