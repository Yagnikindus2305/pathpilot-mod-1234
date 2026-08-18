/*
# Add course/branch to profiles

1. Changes
- `profiles.course` (text, default '') — the user's course/branch (e.g. CSE, MBA),
  selected from the courses dropdown added in Module 1.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS course text DEFAULT '';
