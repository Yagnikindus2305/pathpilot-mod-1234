/*
# Fix roadmap_skills upsert — missing unique constraint

1. Problem
Every call site that writes roadmap_skills (syncRoadmap after a resume
analysis or comparison, and the roadmap page's skill-toggle) upserts with
`onConflict: 'user_id,skill_name'`. Postgres requires an actual unique
constraint on exactly those columns for ON CONFLICT to work at all — this
table never had one, only a primary key on `id`. Every one of those
upserts has been failing outright (visible only in the browser console,
never surfaced to the user), and since syncRoadmap deletes the user's
existing rows *before* the now-failing insert, the net effect was a
roadmap that silently emptied out on every resume analysis. Confirmed via
direct query: only 11 roadmap_skills rows exist across the entire
database despite dozens of resume analyses logged.

2. Fix
Add the missing unique constraint so the upsert actually matches it. Safe
to add now — verified no existing (user_id, skill_name) duplicates.
*/

alter table public.roadmap_skills
  add constraint roadmap_skills_user_id_skill_name_key unique (user_id, skill_name);
