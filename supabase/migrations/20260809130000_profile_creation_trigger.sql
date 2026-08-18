/*
# Create profiles row on signup, regardless of email confirmation

1. Problem
Client-side code used to insert into `profiles` immediately after
`supabase.auth.signUp()`. When "Confirm email" is enabled in Supabase Auth
settings, signUp() returns a user but no session, so `auth.uid()` is null and
the RLS-protected insert silently fails. The profile row was then only ever
created later, if and when `loadProfile()` happened to run on a real session.

2. Fix
A trigger on `auth.users` creates the matching `profiles` row inside the same
transaction as user creation, using SECURITY DEFINER to bypass RLS. This runs
identically whether email confirmation is on or off, and for every signup
path (email/password and OAuth), since all of them insert into `auth.users`.

full_name / phone are read from `raw_user_meta_data`, which signUp()'s
`options.data` and OAuth providers both populate before any session exists.
*/

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
