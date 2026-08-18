/*
# Resume file storage + broader activity logging

1. Problem
Resume analysis only ever stored the extracted TEXT, never the original
file — an admin looking at a student's resume history had no way to see
the actual PDF/DOCX, only the parsed skills. Separately, user_activity_log
only covered login/signup/logout, not "what they did" once signed in.

2. Fix
- A private "resumes" Storage bucket, one folder per user (auth.uid()),
  readable by its owner and by admins, writable only by its owner.
- resume_analyses.file_path points at the stored object so it can be
  opened via a signed URL.
- user_activity_log's event check is widened to cover the main actions
  a student takes (resume analyzed/compared, aptitude completed, job
  application submitted), reusing the exact same table/RLS/worker-logging
  pattern already in place for auth events.
*/

alter table public.resume_analyses add column if not exists file_path text;

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

create policy "own_folder_insert" on storage.objects for insert
  to authenticated with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own_folder_select" on storage.objects for select
  to authenticated using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "admin_select_all_resumes" on storage.objects for select
  to authenticated using (bucket_id = 'resumes' and public.is_admin());

alter table public.user_activity_log drop constraint if exists user_activity_log_event_check;
alter table public.user_activity_log add constraint user_activity_log_event_check
  check (event in (
    'login_success', 'login_failed', 'signup', 'logout',
    'resume_analyzed', 'resume_compared', 'aptitude_completed', 'application_submitted'
  ));
