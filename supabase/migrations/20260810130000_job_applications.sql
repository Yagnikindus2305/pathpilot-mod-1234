/*
# Job Applications

1. New Table
- `job_applications`: tracks each job the user has applied to, replacing the
  earlier localStorage-only "applied" tracking with real, cross-device data.
  - id (uuid, PK)
  - user_id (uuid, FK to auth.users)
  - company, role (text)
  - status (text, default 'Applied') — 'Applied' | 'Interviewing' | 'Offer' | 'Rejected'
  - link (text) — the job search URL opened when the user clicked Apply
  - created_at (timestamptz)
- A unique (user_id, company, role) constraint so clicking Apply twice on the
  same role updates the existing row instead of creating a duplicate.

2. Security
RLS enabled, owner-scoped: user_id defaults to auth.uid(), policies check
auth.uid() = user_id, matching every other table in this schema.
*/

CREATE TABLE IF NOT EXISTS job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  company text NOT NULL,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'Applied',
  link text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, company, role)
);

ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_applications" ON job_applications;
CREATE POLICY "select_own_applications" ON job_applications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_applications" ON job_applications;
CREATE POLICY "insert_own_applications" ON job_applications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_applications" ON job_applications;
CREATE POLICY "update_own_applications" ON job_applications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_applications" ON job_applications;
CREATE POLICY "delete_own_applications" ON job_applications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_job_applications_user ON job_applications(user_id);
