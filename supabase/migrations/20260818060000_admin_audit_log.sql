/*
# Admin audit log

1. Problem
The admin panel lets an admin view any user's data and delete accounts,
but there was no record of *who* did that, *when*, or from *where* — no
accountability trail for either action.

2. Fix
A new admin_audit_log table records every view of a user's detail page and
every account deletion: which admin, which target user, from what IP,
when. Rows are written only by the Cloudflare Worker (service_role, which
is the only place the real client IP is available and trustworthy) via
requireAdmin-gated endpoints — never directly from the browser, so a
student account can't forge entries. Admins can read the log so it's
visible in the panel; nobody can update or delete rows, keeping it a real
append-only trail.
*/

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  admin_email text not null,
  action text not null check (action in ('view_user', 'delete_user')),
  target_user_id uuid,
  target_email text,
  ip_address text,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

create policy "admin_select_audit_log" on admin_audit_log for select
  to authenticated using (public.is_admin());

create index if not exists admin_audit_log_created_at_idx on admin_audit_log (created_at desc);
