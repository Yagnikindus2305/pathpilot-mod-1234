import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');

function loadJson(filename, fallback) {
  const filePath = path.join(dataDir, filename);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.warn(`[pathpilot] ${filename} not found in server/data/ yet — serving empty data until it's added. (${err.code || err.message})`);
    return fallback;
  }
}

const colleges = loadJson('pathpilot_colleges.json', { colleges: [] });
const courses = loadJson('pathpilot_courses.json', { courses: [], yearsOfStudy: [] });
const titles = loadJson('pathpilot_all_job_titles.json', { roles: [] });
const rich = loadJson('pathpilot_roles_rich.json', { roles: [] });
const companies = loadJson('pathpilot_companies.json', { companies: [] });

const router = express.Router();

const group = (arr, key, val) =>
  arr.reduce((g, x) => {
    (g[x[key]] ||= []).push(x[val]);
    return g;
  }, {});

// Dropdowns for Module 1 (profile) + target role
router.get('/colleges', (_req, res) => {
  res.json({ grouped: group(colleges.colleges, 'category', 'name') });
});

router.get('/courses', (_req, res) => {
  res.json({ grouped: group(courses.courses, 'category', 'name'), years: courses.yearsOfStudy || [] });
});

router.get('/roles', (_req, res) => {
  res.json({ grouped: group(titles.roles, 'category', 'title') });
});

router.get('/role/:title', (req, res) => {
  const role = rich.roles.find((r) => r.title.toLowerCase() === req.params.title.toLowerCase());
  if (!role) return res.status(404).json({ message: 'Role not found' });
  res.json({ role });
});

// Module 3 — roadmap with only the selected role's videos, missing skills filtered out
router.get('/roadmap', (req, res) => {
  const role = rich.roles.find((r) => r.title === req.query.role);
  if (!role) return res.status(404).json({ message: 'Role not found' });
  const have = new Set(
    String(req.query.have || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
  const missing = (role.roadmap || []).filter((item) => !have.has(item.skill.toLowerCase()));
  res.json({ role: role.title, salaryLPA: role.salaryLPA, roadmap: missing });
});

// Module 2 — tool check against resume text
router.post('/tool-check', (req, res) => {
  const { role: roleName, resumeText = '' } = req.body || {};
  if (typeof roleName !== 'string' || typeof resumeText !== 'string') {
    return res.status(400).json({ message: 'role and resumeText must be strings' });
  }
  if (resumeText.length > 50000) return res.status(400).json({ message: 'resumeText too long' });
  const role = rich.roles.find((r) => r.title === roleName);
  if (!role) return res.status(404).json({ message: 'Role not found' });
  const text = resumeText.toLowerCase();
  const tools = (role.tools || []).map((t) => ({ tool: t, present: text.includes(t.toLowerCase()) }));
  res.json({ role: role.title, tools });
});

// Maps a target-role title to the company categories (see pathpilot_companies.json
// `categories`) that are actually relevant to it, so e.g. a Data Analyst doesn't see
// Cybersecurity roles surface just because a couple of generic skills (SQL, Python)
// happen to overlap. Falls back to the general dev/product hiring pool for anything
// that isn't a specialist track.
function inferCompanyCategories(roleTitle) {
  const t = (roleTitle || '').toLowerCase();
  const has = (...words) => words.some((w) => t.includes(w));
  const categories = [];

  if (has('security', 'vapt', 'penetration', 'soc analyst', 'cyber', 'threat')) categories.push('Cybersecurity');
  if (has('data analyst', 'data scientist', 'data engineer', 'machine learning', 'ml engineer', 'ai engineer', 'business intelligence', 'analytics', 'statistician')) categories.push('Analytics / Data');
  if (has('embedded', 'hardware', 'semiconductor', 'vlsi', 'chip')) categories.push('Semiconductor / Deep Tech');
  if (has('mechanical', 'civil engineer', 'electrical engineer', 'chemical engineer', 'biomedical', 'architect')) categories.push('Core Engineering');
  if (has('consult')) categories.push('Consulting / GCC');

  if (!categories.length) {
    // General software/product/QA-style roles: span the mainstream hiring pool.
    categories.push('Indian IT Services', 'Global Product / MNC', 'Indian Product / Startup');
  }
  return categories;
}

function salaryFloor(salaryBand) {
  const match = /([\d.]+)/.exec(salaryBand || '');
  return match ? parseFloat(match[1]) : Infinity;
}

// Company match — "with these skills, where can I go?" Scoped to the target role's
// relevant categories so results stay on-track (Module 3).
router.post('/company-match', (req, res) => {
  const rawSkills = req.body?.skills;
  const rawRole = req.body?.role;
  if (rawSkills !== undefined && !Array.isArray(rawSkills)) {
    return res.status(400).json({ message: 'skills must be an array' });
  }
  if (rawRole !== undefined && typeof rawRole !== 'string') {
    return res.status(400).json({ message: 'role must be a string' });
  }
  if (Array.isArray(rawSkills) && rawSkills.length > 200) {
    return res.status(400).json({ message: 'too many skills' });
  }
  const userSkills = (rawSkills || []).map((s) => String(s).toLowerCase());
  const roleTitle = rawRole || '';
  const relevantCategories = inferCompanyCategories(roleTitle);

  const results = [];
  for (const c of companies.companies || []) {
    if (!relevantCategories.includes(c.category)) continue;
    const roleMatches = [];
    for (const r of c.roles || []) {
      const have = r.skills.filter((s) => userSkills.includes(s.toLowerCase()));
      const missing = r.skills.filter((s) => !userSkills.includes(s.toLowerCase()));
      if (have.length) {
        roleMatches.push({ role: r.role, have, missing, matchPct: Math.round((have.length / r.skills.length) * 100) });
      }
    }
    if (roleMatches.length) {
      roleMatches.sort((a, b) => b.matchPct - a.matchPct);
      results.push({
        company: c.name,
        category: c.category,
        tier: c.tier,
        salaryBand: c.salaryBand,
        bestMatch: roleMatches[0],
        allRoles: roleMatches,
      });
    }
  }
  results.sort((a, b) => b.bestMatch.matchPct - a.bestMatch.matchPct);
  // Reserve room so the two guaranteed floor entries below never get sliced off.
  if (results.length > 18) results.length = 18;

  // Guarantee at least one easiest-entry option, even with zero skill overlap, so a
  // beginner never gets an empty list. Picks the lowest-salary "Mass recruiter" in the
  // relevant category pool if the skill-based results didn't already surface one.
  const hasMassRecruiter = results.some((r) => r.tier === 'Mass recruiter');
  if (!hasMassRecruiter) {
    const pool = (companies.companies || []).filter((c) => relevantCategories.includes(c.category) && c.tier === 'Mass recruiter');
    const fallbackCompany = pool.sort((a, b) => salaryFloor(a.salaryBand) - salaryFloor(b.salaryBand))[0];
    if (fallbackCompany && !results.some((r) => r.company === fallbackCompany.name)) {
      const role = fallbackCompany.roles[0];
      const have = role.skills.filter((s) => userSkills.includes(s.toLowerCase()));
      const missing = role.skills.filter((s) => !userSkills.includes(s.toLowerCase()));
      const entry = {
        company: fallbackCompany.name,
        category: fallbackCompany.category,
        tier: fallbackCompany.tier,
        salaryBand: fallbackCompany.salaryBand,
        bestMatch: { role: role.role, have, missing, matchPct: Math.round((have.length / role.skills.length) * 100) },
        allRoles: [{ role: role.role, have, missing, matchPct: Math.round((have.length / role.skills.length) * 100) }],
      };
      results.push(entry);
    }
  }

  // Absolute floor: a walk-in/campus-drive style trainee opening at 1-2 LPA, always
  // present regardless of skills or category, so there's never a dead end.
  results.push({
    company: 'Entry-Level / Walk-in & Campus Drives',
    category: 'Entry-Level',
    tier: 'Mass recruiter',
    salaryBand: '1-2 LPA',
    bestMatch: { role: 'Trainee / Associate', have: [], missing: ['Communication', 'MS Office', 'Basic Computer Skills'], matchPct: 40 },
    allRoles: [{ role: 'Trainee / Associate', have: [], missing: ['Communication', 'MS Office', 'Basic Computer Skills'], matchPct: 40 }],
  });

  res.json({ companies: results.slice(0, 20) });
});

export default router;
