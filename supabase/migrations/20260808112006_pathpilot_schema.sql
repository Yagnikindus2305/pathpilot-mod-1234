/*
# PathPilot — Full Schema

1. Overview
PathPilot is an AI placement-prep platform. Each authenticated user owns their own
data across 6 modules: profile, resume analysis, skill roadmap, aptitude tests,
resume comparisons, and placement milestones.

2. New Tables
- `profiles`: extends auth.users with personal info and target job role.
  - id (uuid, PK, FK to auth.users)
  - full_name, email, college, year, city, phone (text)
  - target_role (text) — one of the 9 predefined roles
  - saved_skills (text[]) — skills extracted from resume analysis
  - created_at, updated_at (timestamptz)
- `resume_analyses`: results of resume analysis (Module 2).
  - id (uuid, PK)
  - user_id (uuid, FK to auth.users)
  - file_name (text)
  - ats_score (int 0-100)
  - skills (text[])
  - job_roles (jsonb) — array of { role, match, salary_min, salary_max, salary_avg }
  - raw_text (text)
  - created_at (timestamptz)
- `roadmap_skills`: missing skills the user needs to learn (Module 3).
  - id (uuid, PK)
  - user_id (uuid, FK to auth.users)
  - skill_name (text)
  - priority (text) — 'Must Have' | 'Nice to Have' | 'Advanced'
  - done (boolean, default false)
  - created_at (timestamptz)
- `aptitude_results`: scores per category per test attempt (Module 4).
  - id (uuid, PK)
  - user_id (uuid, FK to auth.users)
  - category (text) — 'Quantitative' | 'Logical Reasoning' | 'Verbal Ability' | 'Technical MCQs'
  - score (int)
  - total (int)
  - created_at (timestamptz)
- `resume_comparisons`: old vs new resume comparison results (Module 5).
  - id (uuid, PK)
  - user_id (uuid, FK to auth.users)
  - old_score (int)
  - new_score (int)
  - skills_gained (text[])
  - new_roles (text[])
  - created_at (timestamptz)
- `milestones`: placement milestone checklist (Module 6).
  - id (uuid, PK)
  - user_id (uuid, FK to auth.users)
  - key (text) — milestone identifier
  - label (text)
  - completed (boolean, default false)
  - created_at (timestamptz)

3. Security
- RLS enabled on every table.
- All tables are owner-scoped: user_id defaults to auth.uid(), policies check
  auth.uid() = user_id. SELECT/INSERT/UPDATE/DELETE each have their own policy.
- profiles table uses auth.uid() = id (the PK is the user id).
*/

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text DEFAULT '',
  email text DEFAULT '',
  college text DEFAULT '',
  year text DEFAULT '',
  city text DEFAULT '',
  phone text DEFAULT '',
  target_role text DEFAULT '',
  saved_skills text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- RESUME ANALYSES
CREATE TABLE IF NOT EXISTS resume_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text DEFAULT '',
  ats_score int DEFAULT 0,
  skills text[] DEFAULT '{}',
  job_roles jsonb DEFAULT '[]',
  raw_text text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE resume_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_resumes" ON resume_analyses;
CREATE POLICY "select_own_resumes" ON resume_analyses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_resumes" ON resume_analyses;
CREATE POLICY "insert_own_resumes" ON resume_analyses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_resumes" ON resume_analyses;
CREATE POLICY "update_own_resumes" ON resume_analyses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_resumes" ON resume_analyses;
CREATE POLICY "delete_own_resumes" ON resume_analyses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ROADMAP SKILLS
CREATE TABLE IF NOT EXISTS roadmap_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  priority text DEFAULT 'Must Have',
  done boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE roadmap_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_roadmap" ON roadmap_skills;
CREATE POLICY "select_own_roadmap" ON roadmap_skills FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_roadmap" ON roadmap_skills;
CREATE POLICY "insert_own_roadmap" ON roadmap_skills FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_roadmap" ON roadmap_skills;
CREATE POLICY "update_own_roadmap" ON roadmap_skills FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_roadmap" ON roadmap_skills;
CREATE POLICY "delete_own_roadmap" ON roadmap_skills FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- APTITUDE RESULTS
CREATE TABLE IF NOT EXISTS aptitude_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  score int DEFAULT 0,
  total int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE aptitude_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_aptitude" ON aptitude_results;
CREATE POLICY "select_own_aptitude" ON aptitude_results FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_aptitude" ON aptitude_results;
CREATE POLICY "insert_own_aptitude" ON aptitude_results FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_aptitude" ON aptitude_results;
CREATE POLICY "update_own_aptitude" ON aptitude_results FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_aptitude" ON aptitude_results;
CREATE POLICY "delete_own_aptitude" ON aptitude_results FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- RESUME COMPARISONS
CREATE TABLE IF NOT EXISTS resume_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  old_score int DEFAULT 0,
  new_score int DEFAULT 0,
  skills_gained text[] DEFAULT '{}',
  new_roles text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE resume_comparisons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_comparisons" ON resume_comparisons;
CREATE POLICY "select_own_comparisons" ON resume_comparisons FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_comparisons" ON resume_comparisons;
CREATE POLICY "insert_own_comparisons" ON resume_comparisons FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_comparisons" ON resume_comparisons;
CREATE POLICY "update_own_comparisons" ON resume_comparisons FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_comparisons" ON resume_comparisons;
CREATE POLICY "delete_own_comparisons" ON resume_comparisons FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- MILESTONES
CREATE TABLE IF NOT EXISTS milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_milestones" ON milestones;
CREATE POLICY "select_own_milestones" ON milestones FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_milestones" ON milestones;
CREATE POLICY "insert_own_milestones" ON milestones FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_milestones" ON milestones;
CREATE POLICY "update_own_milestones" ON milestones FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_milestones" ON milestones;
CREATE POLICY "delete_own_milestones" ON milestones FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_resume_analyses_user ON resume_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_skills_user ON roadmap_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_aptitude_results_user ON aptitude_results(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_comparisons_user ON resume_comparisons(user_id);
CREATE INDEX IF NOT EXISTS idx_milestones_user ON milestones(user_id);