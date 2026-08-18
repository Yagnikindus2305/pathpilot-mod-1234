/*
# Target Job Description & Work Experience

1. New Tables
- `target_jobs`: one target-job description per user (job title, company,
  location, work type, expected salary range, required skills, description).
  Single row per user, keyed by user id like `profiles`.
  - user_id (uuid, PK, FK to auth.users)
  - job_title, company_name, location, work_type (text)
  - salary_min, salary_max (int)
  - required_skills (text[])
  - job_description (text)
  - updated_at (timestamptz)
- `work_experiences`: a user's work history (internships, jobs, freelance).
  Multiple rows per user.
  - id (uuid, PK)
  - user_id (uuid, FK to auth.users)
  - title, employment_type, company_name, location, description (text)
  - start_date, end_date (date)
  - created_at (timestamptz)

2. Security
RLS enabled on both, owner-scoped: user_id defaults to auth.uid(), policies
check auth.uid() = user_id (or = id for target_jobs' PK).
*/

CREATE TABLE IF NOT EXISTS target_jobs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  job_title text DEFAULT '',
  company_name text DEFAULT '',
  location text DEFAULT '',
  work_type text DEFAULT '',
  salary_min int,
  salary_max int,
  required_skills text[] DEFAULT '{}',
  job_description text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE target_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_target_job" ON target_jobs;
CREATE POLICY "select_own_target_job" ON target_jobs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_target_job" ON target_jobs;
CREATE POLICY "insert_own_target_job" ON target_jobs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_target_job" ON target_jobs;
CREATE POLICY "update_own_target_job" ON target_jobs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_target_job" ON target_jobs;
CREATE POLICY "delete_own_target_job" ON target_jobs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- WORK EXPERIENCES
CREATE TABLE IF NOT EXISTS work_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  employment_type text DEFAULT '',
  company_name text NOT NULL,
  location text DEFAULT '',
  description text DEFAULT '',
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE work_experiences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_experience" ON work_experiences;
CREATE POLICY "select_own_experience" ON work_experiences FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_experience" ON work_experiences;
CREATE POLICY "insert_own_experience" ON work_experiences FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_experience" ON work_experiences;
CREATE POLICY "update_own_experience" ON work_experiences FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_experience" ON work_experiences;
CREATE POLICY "delete_own_experience" ON work_experiences FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_work_experiences_user ON work_experiences(user_id);
