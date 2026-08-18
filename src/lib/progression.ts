import type { AptitudeResult, Profile, ResumeAnalysis, ResumeComparison, RoadmapSkill } from './types';

export type ModuleId = 'profile' | 'resume' | 'roadmap' | 'aptitude' | 'compare' | 'dashboard' | 'admin';

export interface ProgressionState {
  profile: boolean;
  resume: boolean;
  roadmap: boolean;
  aptitude: boolean;
  compare: boolean;
}

export function computeProgression(
  profile: Profile | null,
  resume: ResumeAnalysis | null,
  roadmap: RoadmapSkill[],
  results: AptitudeResult[],
  comparisons: ResumeComparison[] = [],
): ProgressionState {
  const profileDone = Boolean(profile?.full_name && profile?.college && profile?.target_role);
  const resumeDone = Boolean(resume);
  const roadmapDone = roadmap.length > 0 && roadmap.every((s) => s.done);
  const aptitudeDone = results.some((r) => r.score / Math.max(r.total, 1) >= 0.7);
  const compareDone = comparisons.length > 0;
  return { profile: profileDone, resume: resumeDone, roadmap: roadmapDone, aptitude: aptitudeDone, compare: compareDone };
}

export function canAccess(
  module: ModuleId,
  state: ProgressionState,
): { allowed: boolean; reason?: string } {
  switch (module) {
    case 'profile':
      return { allowed: true };
    case 'resume':
      return state.profile
        ? { allowed: true }
        : { allowed: false, reason: 'Complete your profile first to unlock resume analysis.' };
    case 'roadmap':
      return state.resume
        ? { allowed: true }
        : { allowed: false, reason: 'Analyze your resume first to unlock your skill roadmap.' };
    case 'aptitude':
      return state.roadmap
        ? { allowed: true }
        : { allowed: false, reason: 'Complete your skill roadmap first to unlock aptitude tests.' };
    case 'compare':
      return state.aptitude
        ? { allowed: true }
        : { allowed: false, reason: 'Score 70%+ on an aptitude test to unlock resume comparison.' };
    case 'dashboard':
      return { allowed: true };
    case 'admin':
      return { allowed: true };
  }
}

export const MODULE_ORDER: ModuleId[] = ['profile', 'resume', 'roadmap', 'aptitude', 'compare', 'dashboard', 'admin'];
