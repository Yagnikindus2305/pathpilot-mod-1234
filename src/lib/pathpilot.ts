import collegesData from '@/data/pathpilot_colleges.json';
import rolesData from '@/data/pathpilot_all_job_titles.json';
import richRolesData from '@/data/pathpilot_roles_rich.json';
import coursesData from '@/data/pathpilot_courses.json';
import { ROLE_SKILLS } from '@/lib/roleSkills';

export interface PathpilotRoadmapItem {
  skill: string;
  video: string;
}

export interface PathpilotRole {
  title: string;
  category: string;
  requiredSkills?: string[];
  tools?: string[];
  advancedSkills?: string[];
  salaryLPA?: { min: number; max: number };
  roadmap?: PathpilotRoadmapItem[];
  growthSkills?: PathpilotRoadmapItem[];
}

export interface PathpilotCollege {
  name: string;
  category: string;
}

export interface GroupedOptions {
  [category: string]: string[];
}

const collegeList = (collegesData as { colleges: PathpilotCollege[] }).colleges;
const roleList = (rolesData as { roles: { title: string; category: string }[] }).roles;
const richRoleList = (richRolesData as { roles: PathpilotRole[] }).roles;
const courseData = coursesData as { courses: { name: string; category: string }[]; yearsOfStudy: string[] };

export function getCollegeOptionsGrouped(): GroupedOptions {
  return collegeList.reduce<GroupedOptions>((acc, college) => {
    if (!acc[college.category]) acc[college.category] = [];
    acc[college.category].push(college.name);
    return acc;
  }, {});
}

export function getCourseOptionsGrouped(): GroupedOptions {
  return courseData.courses.reduce<GroupedOptions>((acc, course) => {
    if (!acc[course.category]) acc[course.category] = [];
    acc[course.category].push(course.name);
    return acc;
  }, {});
}

export function getCourseYears(): string[] {
  return courseData.yearsOfStudy;
}

export function getRoleOptionsGrouped(): GroupedOptions {
  return roleList.reduce<GroupedOptions>((acc, role) => {
    if (!acc[role.category]) acc[role.category] = [];
    acc[role.category].push(role.title);
    return acc;
  }, {});
}

// Powers the "also interested in" multi-select: options are constrained to the
// same category as the primary target role (e.g. Cybersecurity only offers
// other Cybersecurity roles, Engineering only other Engineering roles), so a
// student can't mix unrelated domains.
export function getCategoryForRole(title?: string): string | undefined {
  if (!title) return undefined;
  return roleList.find((r) => r.title.toLowerCase() === title.toLowerCase())?.category;
}

export function getRolesInCategory(category?: string): string[] {
  if (!category) return [];
  return roleList.filter((r) => r.category === category).map((r) => r.title);
}

export function getRoleByTitle(title?: string): PathpilotRole | undefined {
  if (!title) return undefined;
  return richRoleList.find((role) => role.title.toLowerCase() === title.toLowerCase());
}

// Always returns the role's FULL skill catalog — it used to drop any skill
// already present in knownSkills, which made the roadmap's own total shrink
// and reshuffle every time a new resume changed what counted as "known"
// (e.g. 23/23 complete one upload, then 14/21 the next). Completion is
// tracked separately (App.tsx checks each item against knownSkills/done),
// so the denominator here stays fixed per role and only the done-count
// moves — matching how a roadmap total is expected to behave.
export function getRoleRoadmap(roleTitle?: string): Array<PathpilotRoadmapItem & { priority?: 'Must Have' | 'Nice to Have' | 'Advanced' }> {
  const role = getRoleByTitle(roleTitle);

  if (role?.roadmap?.length) {
    // The rich roadmap JSON only stores {skill, video} — without this, every
    // item defaulted to 'Must Have' downstream (App.tsx's `priority: item.priority
    // || 'Must Have'`), so the Roadmap page's Nice to Have / Advanced sections
    // were always empty regardless of the role. Derived from ROLE_SKILLS'
    // must/nice/advanced tiers so the two data sources agree; tools that aren't
    // in ROLE_SKILLS at all (e.g. Wireshark, Postman) default to Nice to Have.
    const req = ROLE_SKILLS[roleTitle || ''];
    const priorityFor = (skillName: string): 'Must Have' | 'Nice to Have' | 'Advanced' => {
      const lower = skillName.toLowerCase();
      if (req?.must.some((s) => s.toLowerCase() === lower)) return 'Must Have';
      if (req?.advanced.some((s) => s.toLowerCase() === lower)) return 'Advanced';
      return 'Nice to Have';
    };
    return role.roadmap.map((item) => ({ ...item, priority: priorityFor(item.skill) }));
  }

  const fallback = ROLE_SKILLS[roleTitle || 'Full Stack Developer'] || ROLE_SKILLS['Full Stack Developer'];
  return [
    ...fallback.must.map((skill) => ({ skill, priority: 'Must Have' as const, video: '' })),
    ...fallback.nice.map((skill) => ({ skill, priority: 'Nice to Have' as const, video: '' })),
    ...fallback.advanced.map((skill) => ({ skill, priority: 'Advanced' as const, video: '' })),
  ];
}

// The full skill set a role expects — used to keep a user's roadmap_skills rows
// scoped to their current target role (pruning leftovers from a role they
// previously selected, which would otherwise block "roadmap complete" forever).
// Includes growthSkills so a growth-tier item the user has already marked done
// doesn't get pruned as "stale" the next time the roadmap loads.
// Must include role.roadmap's own skills too, not just requiredSkills/tools/
// advancedSkills -- the rich dataset's roadmap array can (and for several
// roles does) contain more items than those three fields combined (e.g.
// Cybersecurity Analyst's roadmap has 18 skills, requiredSkills+tools+
// advancedSkills totals only 11), and this list is what decides what's safe
// to prune. Missing a roadmap-only skill here meant pruneStaleRoadmapSkills
// silently deleted a user's real, already-completed roadmap rows the next
// time they synced -- a genuine data-loss bug, not just a display glitch.
export function getRoleRequiredSkills(roleTitle?: string): string[] {
  const role = getRoleByTitle(roleTitle);
  if (role) {
    return Array.from(new Set([
      ...(role.requiredSkills || []),
      ...(role.tools || []),
      ...(role.advancedSkills || []),
      ...(role.roadmap || []).map((r) => r.skill),
      ...(role.growthSkills || []).map((g) => g.skill),
    ]));
  }
  const fallback = roleTitle ? ROLE_SKILLS[roleTitle] : undefined;
  return fallback ? [...fallback.must, ...fallback.nice, ...fallback.advanced] : [];
}

// The next tier of skills to unlock once every current roadmap item is marked
// done — this is what makes "Grow further" actually surface something new for
// a role whose base roadmap has been fully completed, instead of the roadmap
// staying capped at the original list forever.
export function getRoleGrowthSkills(roleTitle?: string): PathpilotRoadmapItem[] {
  const role = getRoleByTitle(roleTitle);
  return role?.growthSkills?.length ? role.growthSkills : [];
}

export function getToolCheck(roleTitle: string, resumeText: string) {
  const role = getRoleByTitle(roleTitle);
  const tools = role?.tools || [];
  const text = resumeText.toLowerCase();
  return tools.map((tool) => ({
    tool,
    present: text.includes(tool.toLowerCase()),
  }));
}
