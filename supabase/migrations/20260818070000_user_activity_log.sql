/*
# User activity log (login/signup/logout, every account)

1. Problem
admin_audit_log only covers admin actions (viewing/deleting a user). There
was no record of ordinary auth activity — who signed in, when, from what
IP, or whether a login attempt failed — for forensic/security reference
later, the way a real production platform keeps one.

2. Fix
A new user_activity_log table records login_success, login_failed, signup,
and logout events with IP address and browser user-agent, written only by
the Cloudflare Worker (service_role, the only place the real client IP is
available) via a public-but-strictly-validated endpoint — login_failed
events have no session to authenticate against, so this can't be gated
behind requireUser. Users can read their own rows; admins can read every
row, surfaced in the admin panel.
*/

create table if not exists public.user_activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text not null,
  event text not null check (event in ('login_success', 'login_failed', 'signup', 'logout')),
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.user_activity_log enable row level security;

create policy "select_own_activity" on user_activity_log for select
  to authenticated using (user_id = auth.uid());

create policy "admin_select_all_activity" on user_activity_log for select
  to authenticated using (public.is_admin());

create index if not exists user_activity_log_created_at_idx on user_activity_log (created_at desc);
create index if not exists user_activity_log_user_id_idx on user_activity_log (user_id);
