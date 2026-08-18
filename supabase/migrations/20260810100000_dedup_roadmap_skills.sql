/*
# Deduplicate roadmap_skills and enforce one row per (user_id, skill_name)

1. Problem
roadmap_skills had no unique constraint on (user_id, skill_name). Both the resume-sync
path and the roadmap "mark done" toggle used a check-then-act pattern (SELECT, then
UPDATE or INSERT) instead of an atomic upsert. If that check ever missed an existing
row, a duplicate got INSERTed instead of the original being UPDATEd. The roadmap page
only shows the latest fetch (looks 100% complete), but the aptitude-test gate requires
EVERY row for the user to have done = true — including any invisible stale duplicate
left at done = false. Net effect: roadmap shows 100% but the test never unlocks.

2. Fix
- Collapse duplicates: for each (user_id, skill_name), keep one row, preferring a
  done = true row if any duplicate has one, otherwise the most recently created.
- Add a UNIQUE constraint on (user_id, skill_name) so this can't recur, and so the
  app can now use a true atomic upsert instead of select-then-branch.
*/

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, skill_name
      ORDER BY done DESC, created_at DESC
    ) AS rn
  FROM roadmap_skills
)
DELETE FROM roadmap_skills
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

ALTER TABLE roadmap_skills
  ADD CONSTRAINT roadmap_skills_user_skill_unique UNIQUE (user_id, skill_name);
