/*
# Enable realtime on the admin/activity log tables

Lets the admin panel show new log rows live, without a manual refresh,
via Supabase Realtime's Postgres Changes (a subscription on INSERT).
Requires the tables to be added to the supabase_realtime publication —
not automatic just from RLS/policies existing.
*/

alter publication supabase_realtime add table public.admin_audit_log;
alter publication supabase_realtime add table public.user_activity_log;
