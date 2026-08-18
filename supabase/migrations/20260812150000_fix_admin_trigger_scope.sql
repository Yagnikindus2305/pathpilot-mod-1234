/*
# Scope the is_admin anti-escalation trigger to app traffic only

1. Problem
The trigger added in 20260812130000_prevent_is_admin_self_escalation.sql
reverts any change to is_admin back to its prior value — but it doesn't
distinguish who is making the change. It fires on every UPDATE to
profiles regardless of role, which means it also silently reverts
legitimate admin grants run directly in the SQL Editor (or by any future
migration), with no error — the UPDATE appears to succeed but is_admin
never actually changes.

2. Fix
Supabase's PostgREST layer executes authenticated app requests as the
Postgres role literally named `authenticated` (shared by all logged-in
users; per-user identity comes from auth.uid() inside RLS, not from a
distinct Postgres role per user). The SQL Editor and migrations run as a
privileged role (postgres), never as `authenticated`. Scoping the guard to
current_user = 'authenticated' blocks exactly the path that mattered (the
app's own client, PostgREST calls from a signed-in user) while leaving
SQL Editor / migration-run grants (like re-promoting an account after
recreating it) working as expected.
*/

CREATE OR REPLACE FUNCTION public.prevent_is_admin_self_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin AND current_user = 'authenticated' THEN
    NEW.is_admin := OLD.is_admin;
  END IF;
  RETURN NEW;
END;
$$;
