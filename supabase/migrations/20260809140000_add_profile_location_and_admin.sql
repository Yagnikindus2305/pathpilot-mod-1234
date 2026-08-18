/*
# Add state/district to profiles, and an admin flag

1. Changes
- `profiles.state` (text, default '') — one of India's 28 states / 8 UTs.
- `profiles.district` (text, default '') — free text (India has ~766 districts;
  not enumerated as a dropdown to avoid an incomplete/stale hardcoded list).
- `profiles.is_admin` (text -> boolean, default false) — true for accounts allowed
  to view all users' data in the admin panel.

2. Admin bootstrap
Marks specific emails as admin by hardcoded allowlist, matched case-insensitively
against auth.users.email. Re-run this migration (or a new one with UPDATE) to add
more admins later.

3. Security
New RLS policies let admin accounts SELECT across all rows of profiles,
resume_analyses, roadmap_skills, and aptitude_results (read-only — admins do not
get INSERT/UPDATE/DELETE on other users' rows). Existing owner-scoped policies
are untouched, so normal users still only see their own data.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS state text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS district text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Bootstrap: mark these emails as admin. Add more later with a follow-up
-- `UPDATE profiles SET is_admin = true WHERE lower(email) IN (...);`
UPDATE profiles SET is_admin = true
WHERE lower(email) IN (
  'yagnikchandira.23.cse@iite.indusuni.ac.in'
);

-- Helper: is the current session an admin? SECURITY DEFINER so it can read
-- profiles.is_admin without recursing into the RLS policy that calls it.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$$;

DROP POLICY IF EXISTS "admin_select_all_profiles" ON profiles;
CREATE POLICY "admin_select_all_profiles" ON profiles FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "admin_select_all_resumes" ON resume_analyses;
CREATE POLICY "admin_select_all_resumes" ON resume_analyses FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "admin_select_all_roadmap" ON roadmap_skills;
CREATE POLICY "admin_select_all_roadmap" ON roadmap_skills FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "admin_select_all_aptitude" ON aptitude_results;
CREATE POLICY "admin_select_all_aptitude" ON aptitude_results FOR SELECT
  TO authenticated USING (public.is_admin());
