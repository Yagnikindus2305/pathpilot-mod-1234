export type JobRole = string;

export const JOB_ROLES: string[] = [
  'Full Stack Developer',
  'Frontend Developer',
  'Backend Developer',
  'Mobile App Developer',
  'DevOps Engineer',
  'Cloud Engineer',
  'QA / Test Engineer',
  'Data Analyst',
  'Data Scientist',
  'Machine Learning Engineer',
  'AI Engineer',
  'Data Engineer',
  'Cybersecurity Analyst',
  'SOC Analyst',
  'Penetration Tester',
  'Product Manager',
  'Project Manager',
  'Scrum Master',
  'Business Analyst',
  'UI/UX Designer',
  'Product Designer',
  'Digital Marketer',
  'Content Writer',
  'Financial Analyst',
  'HR Specialist',
  'Operations Analyst',
  'Marketing Manager',
  'Database Administrator',
  'Software Architect',
  'Blockchain Developer',
  'Embedded Systems Engineer',
];

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  college: string;
  course: string;
  year: string;
  state: string;
  district: string;
  city: string;
  phone: string;
  target_role: string;
  target_roles: string[];
  saved_skills: string[];
  is_admin: boolean;
}

export interface JobRoleMatch {
  role: string;
  match: number;
  salary_min: number;
  salary_max: number;
  salary_avg: number;
}

export interface AtsCategory {
  key: string;
  label: string;
  earned: number;
  possible: number;
  detail: string;
}

export interface AtsBreakdown {
  categories: AtsCategory[];
  warnings: string[];
}

export interface ResumeAnalysis {
  id: string;
  file_name: string;
  ats_score: number;
  skills: string[];
  job_roles: JobRoleMatch[];
  raw_text: string;
  file_path: string | null;
  created_at: string;
}

export interface RoadmapSkill {
  id: string;
  skill_name: string;
  priority: 'Must Have' | 'Nice to Have' | 'Advanced';
  done: boolean;
}

export interface AptitudeResult {
  id: string;
  category: string;
  score: number;
  total: number;
  created_at: string;
}

export interface ResumeComparison {
  id: string;
  old_score: number;
  new_score: number;
  skills_gained: string[];
  new_roles: string[];
  created_at: string;
}

export interface Milestone {
  id: string;
  key: string;
  label: string;
  completed: boolean;
}

export interface TargetJob {
  user_id: string;
  job_title: string;
  company_name: string;
  location: string;
  work_type: 'Remote' | 'Hybrid' | 'On-Site' | '';
  salary_min: number | null;
  salary_max: number | null;
  required_skills: string[];
  job_description: string;
}

export interface WorkExperience {
  id: string;
  title: string;
  employment_type: string;
  company_name: string;
  location: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
}

export type ApplicationStatus = 'Applied' | 'Interviewing' | 'Offer' | 'Rejected';

export interface JobApplication {
  id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  link: string;
  created_at: string;
}
