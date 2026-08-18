import { supabase } from '@/lib/supabase';
import { logActivity } from '@/context/AuthContext';
import type { ApplicationStatus, JobApplication } from '@/lib/types';

export async function getApplications(userId: string): Promise<JobApplication[]> {
  const { data } = await supabase
    .from('job_applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data || []) as JobApplication[];
}

// onConflict on (user_id, company, role) means clicking Apply twice on the same
// role updates the existing row (e.g. bumps created_at) rather than duplicating it.
// email/accessToken are optional so existing callers don't break; passing them
// records the application in the forensic activity log too.
export async function recordApplication(userId: string, company: string, role: string, link: string, email?: string, accessToken?: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('job_applications')
    .upsert({ user_id: userId, company, role, link }, { onConflict: 'user_id,company,role', ignoreDuplicates: true });
  if (!error && email) await logActivity(email, 'application_submitted', accessToken);
  return { error: error?.message ?? null };
}

export async function updateApplicationStatus(id: string, status: ApplicationStatus): Promise<{ error: string | null }> {
  const { error } = await supabase.from('job_applications').update({ status }).eq('id', id);
  return { error: error?.message ?? null };
}

export function buildJobSearchUrl(company: string, role: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${company} ${role} jobs`)}`;
}
