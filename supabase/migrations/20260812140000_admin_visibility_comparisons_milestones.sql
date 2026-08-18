/*
# Extend admin read access to resume_comparisons and milestones

1. Problem
The admin panel's per-user table already aggregates profiles, resume
analyses, roadmap skills, and aptitude results — but the earlier admin
migration never added an admin_select_all policy for resume_comparisons or
milestones. Those two tables still only have owner-scoped SELECT, so an
admin querying them today gets back only their own rows (empty for
everyone else), not real platform-wide visibility.

2. Fix
Same pattern as the other tables: read-only SELECT for admins, using the
existing public.is_admin() helper. No INSERT/UPDATE/DELETE access — admins
can see cross-user data here, never modify another user's rows.
*/

DROP POLICY IF EXISTS "admin_select_all_comparisons" ON resume_comparisons;
CREATE POLICY "admin_select_all_comparisons" ON resume_comparisons FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "admin_select_all_milestones" ON milestones;
CREATE POLICY "admin_select_all_milestones" ON milestones FOR SELECT
  TO authenticated USING (public.is_admin());
