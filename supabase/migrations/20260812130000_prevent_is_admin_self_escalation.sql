/*
# Prevent self-escalation of profiles.is_admin

1. Problem
The existing "update_own_profile" RLS policy (FOR UPDATE, USING/WITH CHECK
auth.uid() = id) lets a user update ANY column on their own profile row,
including is_admin. Since is_admin is a plain boolean column with no
column-level restriction, any authenticated user could currently run, from
the browser itself:

  supabase.from('profiles').update({ is_admin: true }).eq('id', session.user.id)

...and it would succeed under RLS, granting themselves admin access — which
in turn unlocks the admin_select_all_* policies (read access to every other
user's profile, resumes, roadmap, aptitude results). This is a real,
directly exploitable privilege-escalation path from the client alone.

2. Fix
A BEFORE UPDATE trigger on profiles forces is_admin to keep its prior value
on every update that goes through the normal client path — regardless of
what RLS otherwise permits. is_admin can then only ever change via a
migration or a direct privileged (service-role/SQL-editor) statement, never
through the app. This is enforced at the trigger level rather than via a
WITH CHECK subquery, since triggers give an unambiguous OLD/NEW comparison
without RLS subquery/snapshot edge cases.
*/

CREATE OR REPLACE FUNCTION public.prevent_is_admin_self_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    NEW.is_admin := OLD.is_admin;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_is_admin_self_change ON profiles;
CREATE TRIGGER trg_prevent_is_admin_self_change
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_is_admin_self_change();
