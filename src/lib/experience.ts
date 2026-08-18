import { supabase } from '@/lib/supabase';
import type { WorkExperience } from '@/lib/types';

// Folds a user's Work Experience entries into resume analysis text, so skills
// and impact described there (but maybe not restated in the uploaded resume
// file) count toward ATS scoring and job matching in Module 2 and Module 5.
export async function fetchExperienceText(userId: string): Promise<string> {
  const { data } = await supabase.from('work_experiences').select('*').eq('user_id', userId);
  const experiences = (data || []) as WorkExperience[];
  return experiences.map((e) => `${e.title} at ${e.company_name}. ${e.description}`).join('\n');
}
