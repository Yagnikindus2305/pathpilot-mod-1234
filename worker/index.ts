import { createClient } from '@supabase/supabase-js';

// Minimal shape of Cloudflare's Workers AI binding — kept local rather than
// pulling in @cloudflare/workers-types just for this one method, matching
// how this file already hand-types other Workers-only globals (e.g. `caches`
// below in searchJobs).
interface WorkersAIBinding {
  // `response` is typed unknown, not string — some models return an object
  // here directly (e.g. when they detect the prompt wants structured JSON)
  // instead of a text blob, so callers must handle both shapes.
  run(model: string, input: { messages: { role: string; content: string }[]; max_tokens?: number }): Promise<{ response?: unknown }>;
}

export interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  ADZUNA_APP_ID?: string;
  ADZUNA_APP_KEY?: string;
  AI?: WorkersAIBinding;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' },
  });
}

// Verifies the caller's Supabase access token and confirms profiles.is_admin
// is true for that user — mirrors server/routes/admin.js's requireAdmin.
// The service_role key only ever lives here (a Worker secret), never in the
// browser bundle; it's what makes auth.admin.deleteUser possible at all.
async function requireAdmin(request: Request, env: Env) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: json({ message: 'Admin actions are not configured (missing SUPABASE_SERVICE_ROLE_KEY secret).' }, 503) };
  }
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return { error: json({ message: 'Missing auth token' }, 401) };

  const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return { error: json({ message: 'Invalid or expired session' }, 401) };

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile?.is_admin) return { error: json({ message: 'Admin access required' }, 403) };

  return { supabaseAdmin, adminUserId: user.id, adminEmail: user.email || '' };
}

// Cloudflare's own header for the real client IP — the one header on this
// platform that can't be spoofed by the request itself, since Cloudflare's
// edge sets it, not the client.
function getClientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

// Best-effort audit trail for admin actions — logging failure never blocks
// the action itself (a lost log entry is far less bad than a broken delete).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logAdminAction(
  supabaseAdmin: any,
  action: 'view_user' | 'delete_user',
  adminId: string,
  adminEmail: string,
  targetUserId: string,
  targetEmail: string,
  ip: string,
): Promise<void> {
  const { error } = await supabaseAdmin.from('admin_audit_log').insert({
    admin_id: adminId,
    admin_email: adminEmail,
    action,
    target_user_id: targetUserId,
    target_email: targetEmail,
    ip_address: ip,
  });
  if (error) console.error('[admin] Failed to write audit log:', error.message);
}

// Deletes a user's auth account entirely — cascades (via each table's
// `user_id ... REFERENCES auth.users(id) ON DELETE CASCADE`) to remove their
// profile, resumes, roadmap, aptitude results, comparisons, and milestones.
// There is no undo.
async function deleteUser(request: Request, env: Env, targetId: string): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if ('error' in auth) return auth.error;
  const { supabaseAdmin, adminUserId, adminEmail } = auth;

  if (targetId === adminUserId) {
    return json({ message: "You can't delete your own account from here." }, 400);
  }

  const { data: targetProfile, error: targetError } = await supabaseAdmin
    .from('profiles')
    .select('is_admin, email')
    .eq('id', targetId)
    .maybeSingle();
  if (targetError) return json({ message: targetError.message }, 500);
  if (targetProfile?.is_admin) {
    return json({ message: 'Admin accounts cannot be deleted from the panel.' }, 403);
  }
  const targetEmail = targetProfile?.email || '';

  const { error } = await supabaseAdmin.auth.admin.deleteUser(targetId);
  if (error) {
    console.error('[admin] Failed to delete user:', error.message);
    return json({ message: error.message }, 500);
  }
  console.warn(`[admin] User ${targetId} deleted by admin ${adminUserId}`);
  await logAdminAction(supabaseAdmin, 'delete_user', adminUserId, adminEmail, targetId, targetEmail, getClientIp(request));
  return json({ ok: true });
}

// Records that an admin opened a user's detail drill-down — the view itself
// still happens via the browser's own Supabase session (same RLS-gated reads
// the admin table already uses), this just adds the accountability record,
// since the browser can't be trusted to self-report its own IP.
async function logUserView(request: Request, env: Env): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if ('error' in auth) return auth.error;
  const { supabaseAdmin, adminUserId, adminEmail } = auth;

  let body: { targetUserId?: unknown; targetEmail?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ message: 'Invalid request body' }, 400);
  }
  const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId : '';
  const targetEmail = typeof body.targetEmail === 'string' ? body.targetEmail : '';
  if (!targetUserId) return json({ message: 'targetUserId is required' }, 400);

  await logAdminAction(supabaseAdmin, 'view_user', adminUserId, adminEmail, targetUserId, targetEmail, getClientIp(request));
  return json({ ok: true });
}

const ACTIVITY_EVENTS = new Set([
  'login_success', 'login_failed', 'signup', 'logout',
  'resume_analyzed', 'resume_compared', 'aptitude_completed', 'application_submitted',
]);
const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Records every login/signup/logout attempt (success and failure) with the
// real client IP — deliberately public, not requireUser-gated, since a
// failed login has no session to authenticate against. Strict input
// validation is the abuse guard here rather than an auth check.
async function logActivity(request: Request, env: Env): Promise<Response> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ message: 'Not configured' }, 503);
  }
  let body: { email?: unknown; event?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ message: 'Invalid request body' }, 400);
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
  const event = typeof body.event === 'string' ? body.event : '';
  if (!email || !SIMPLE_EMAIL_PATTERN.test(email) || !ACTIVITY_EVENTS.has(event)) {
    return json({ message: 'Invalid email or event' }, 400);
  }

  const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // login_success/logout carry a live session — verify the bearer token
  // server-side to attach a trustworthy user_id rather than accepting one
  // from the request body. login_failed/signup have no session yet.
  let userId: string | null = null;
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (token) {
    const { data } = await supabaseAdmin.auth.getUser(token);
    userId = data?.user?.id || null;
  }

  const { error } = await supabaseAdmin.from('user_activity_log').insert({
    user_id: userId,
    email,
    event,
    ip_address: getClientIp(request),
    user_agent: (request.headers.get('User-Agent') || '').slice(0, 500),
  });
  if (error) console.error('[activity] Failed to log:', error.message);
  return json({ ok: true });
}

// Verifies the caller has a valid Supabase session, without requiring admin —
// gates /api/roles/infer so the paid AI call can't be hit by anonymous
// scripts, while staying open to any signed-in student.
async function requireUser(request: Request, env: Env) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: json({ message: 'This feature is not configured (missing SUPABASE_SERVICE_ROLE_KEY secret).' }, 503) };
  }
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return { error: json({ message: 'Missing auth token' }, 401) };

  const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return { error: json({ message: 'Invalid or expired session' }, 401) };

  return { supabaseAdmin, userId: user.id };
}

type RoadmapPriority = 'Must Have' | 'Nice to Have' | 'Advanced';

interface AIRoadmapItem {
  skill: string;
  video: string;
  priority: RoadmapPriority;
}

interface AIQuestion {
  q: string;
  options: string[];
  answer: number;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface AIRoleData {
  role: string;
  must: string[];
  nice: string[];
  advanced: string[];
  salaryLPA: { min: number; max: number };
  roadmap: AIRoadmapItem[];
  technicalMcqs: AIQuestion[];
}

function skillVideoLink(skill: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(skill + ' full course tutorial')}`;
}

const AI_ROLE_SYSTEM_PROMPT = `You are a career-data generator for a placement-prep platform used by Indian college students and job seekers. Given a single job/role title, you produce a strict JSON object describing the skills needed for that role, an entry-to-mid level India salary range in LPA (Lakhs Per Annum), and a technical multiple-choice quiz for the role.

Respond with ONLY a single valid JSON object - no markdown code fences, no commentary before or after. The JSON must match exactly this shape:

{
  "must": string[],
  "nice": string[],
  "advanced": string[],
  "salaryLPA": { "min": number, "max": number },
  "technicalMcqs": [
    { "q": string, "options": [string, string, string, string], "answer": number, "difficulty": "easy" | "medium" | "hard" }
  ]
}

Rules:
- "must" has 6-8 core/essential skills or knowledge areas for this role, most important first.
- "nice" has 4-6 skills that strengthen a candidate but aren't mandatory.
- "advanced" has 3-5 advanced/specialist skills for senior or standout candidates.
- Skills must be specific and resume-ready (e.g. "Financial Modeling" not "being good with numbers"), and must not repeat across must/nice/advanced.
- "salaryLPA" is a realistic India entry-to-mid salary range in Lakhs Per Annum, integers, min < max.
- "technicalMcqs" has exactly 8 questions testing practical/technical knowledge specific to this role. "answer" is the 0-based index of the correct option. Questions must be factually correct and unambiguous, with exactly one right answer. Mix difficulty: roughly 3 easy, 3 medium, 2 hard.
- If the given title is not a real job/role, still do your best to interpret it as one professionally.
- Do not include any text outside the JSON object.`;

function isNonEmptyStringArray(value: unknown, min: number, max: number): value is string[] {
  return Array.isArray(value) && value.length >= min && value.length <= max && value.every((v) => typeof v === 'string' && v.trim().length > 0);
}

function validateAIPayload(data: unknown): { must: string[]; nice: string[]; advanced: string[]; salaryLPA: { min: number; max: number }; technicalMcqs: AIQuestion[] } | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (!isNonEmptyStringArray(d.must, 3, 10)) return null;
  if (!isNonEmptyStringArray(d.nice, 2, 8)) return null;
  if (!isNonEmptyStringArray(d.advanced, 1, 8)) return null;
  const salary = d.salaryLPA as { min?: unknown; max?: unknown } | undefined;
  if (!salary || typeof salary.min !== 'number' || typeof salary.max !== 'number') return null;
  if (salary.min <= 0 || salary.max <= salary.min || salary.max > 300) return null;
  if (!Array.isArray(d.technicalMcqs) || d.technicalMcqs.length < 4 || d.technicalMcqs.length > 12) return null;
  const mcqs: AIQuestion[] = [];
  for (const raw of d.technicalMcqs) {
    const q = raw as Record<string, unknown>;
    if (typeof q.q !== 'string' || !q.q.trim()) return null;
    if (!Array.isArray(q.options) || q.options.length !== 4 || !q.options.every((o) => typeof o === 'string' && o.trim())) return null;
    if (typeof q.answer !== 'number' || q.answer < 0 || q.answer > 3 || !Number.isInteger(q.answer)) return null;
    if (q.difficulty !== 'easy' && q.difficulty !== 'medium' && q.difficulty !== 'hard') return null;
    mcqs.push({ q: q.q, options: q.options as string[], answer: q.answer, difficulty: q.difficulty });
  }
  return {
    must: d.must as string[],
    nice: d.nice as string[],
    advanced: d.advanced as string[],
    salaryLPA: { min: Math.round(salary.min), max: Math.round(salary.max) },
    technicalMcqs: mcqs,
  };
}

function buildRoadmap(must: string[], nice: string[], advanced: string[]): AIRoadmapItem[] {
  const withPriority = (skills: string[], priority: RoadmapPriority) =>
    skills.map((skill) => ({ skill, priority, video: skillVideoLink(skill) }));
  return [...withPriority(must, 'Must Have'), ...withPriority(nice, 'Nice to Have'), ...withPriority(advanced, 'Advanced')];
}

const ROLE_TITLE_PATTERN = /^[a-zA-Z0-9&/().,'\- ]{2,80}$/;

// Infers must/nice/advanced skills, a roadmap, a salary range, and a
// role-specific technical quiz for a target role the student typed that
// isn't in our curated datasets — persisted in ai_role_cache so any given
// role title is only ever sent to the AI provider once, ever.
async function inferRole(request: Request, env: Env): Promise<Response> {
  const auth = await requireUser(request, env);
  if ('error' in auth) return auth.error;
  const { supabaseAdmin } = auth;

  if (!env.AI) {
    return json({ message: 'AI role lookup is not configured (missing Workers AI binding).' }, 503);
  }
  const ai = env.AI;

  let body: { roleTitle?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ message: 'Invalid request body' }, 400);
  }
  const roleTitle = typeof body.roleTitle === 'string' ? body.roleTitle.trim() : '';
  if (!ROLE_TITLE_PATTERN.test(roleTitle)) {
    return json({ message: 'Role title must be 2-80 characters of letters, numbers, and basic punctuation.' }, 400);
  }
  const roleKey = roleTitle.toLowerCase();

  // Everything past this point touches the AI binding and its response
  // shape, which isn't fully within our control — caught broadly so a bad
  // model response or transient binding failure returns a clean error
  // instead of an opaque Cloudflare 1101 page.
  try {
    const { data: cached } = await supabaseAdmin
      .from('ai_role_cache')
      .select('role_title, must_skills, nice_skills, advanced_skills, salary_min, salary_max, roadmap, technical_mcqs')
      .eq('role_key', roleKey)
      .maybeSingle();

    if (cached) {
      const result: AIRoleData = {
        role: cached.role_title,
        must: cached.must_skills,
        nice: cached.nice_skills,
        advanced: cached.advanced_skills,
        salaryLPA: { min: cached.salary_min, max: cached.salary_max },
        roadmap: cached.roadmap,
        technicalMcqs: cached.technical_mcqs,
      };
      return json(result);
    }

    // Cloudflare Workers AI — free tier (10,000 requests/day on the account's
    // free allocation), no separate API key/billing needed since it runs on
    // the same Cloudflare account as this Worker.
    const WORKERS_AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
    const aiResult = await ai.run(WORKERS_AI_MODEL, {
      messages: [
        { role: 'system', content: AI_ROLE_SYSTEM_PROMPT },
        { role: 'user', content: `Job/role title: "${roleTitle}"` },
      ],
      max_tokens: 2500,
    });

    const rawResponse = aiResult.response;
    let parsed: unknown;
    if (typeof rawResponse === 'string') {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      try {
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawResponse);
      } catch {
        return json({ message: 'AI response could not be parsed.' }, 502);
      }
    } else if (rawResponse && typeof rawResponse === 'object') {
      // Some models return the structured object directly rather than a
      // JSON-encoded string when the prompt clearly asks for JSON.
      parsed = rawResponse;
    } else {
      return json({ message: 'AI returned an empty response.' }, 502);
    }

    const validated = validateAIPayload(parsed);
    if (!validated) {
      return json({ message: 'AI response was invalid.' }, 502);
    }

    const roadmap = buildRoadmap(validated.must, validated.nice, validated.advanced);
    const result: AIRoleData = {
      role: roleTitle,
      must: validated.must,
      nice: validated.nice,
      advanced: validated.advanced,
      salaryLPA: validated.salaryLPA,
      roadmap,
      technicalMcqs: validated.technicalMcqs,
    };

    const { error: insertError } = await supabaseAdmin.from('ai_role_cache').insert({
      role_key: roleKey,
      role_title: roleTitle,
      must_skills: validated.must,
      nice_skills: validated.nice,
      advanced_skills: validated.advanced,
      salary_min: validated.salaryLPA.min,
      salary_max: validated.salaryLPA.max,
      roadmap,
      technical_mcqs: validated.technicalMcqs,
    });
    if (insertError) console.error('[roles/infer] Failed to cache AI role data:', insertError.message);

    return json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[roles/infer] Unhandled error:', message);
    return json({ message: `AI role lookup failed: ${message}` }, 502);
  }
}

interface LiveJob {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  salaryMin: number | null;
  salaryMax: number | null;
  applyUrl: string;
  created: string;
}

interface AdzunaRawJob {
  id?: string | number;
  title?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
  description?: string;
  salary_min?: number;
  salary_max?: number;
  redirect_url?: string;
  created?: string;
}

const ADZUNA_BASE_URL = 'https://api.adzuna.com/v1/api/jobs';

// Proxies Adzuna's public job-search API (https://api.adzuna.com) so real,
// current job postings can be searched by role/location instead of relying
// on a hand-authored static role list. The app_key stays server-side here
// (a Worker secret), never shipped in the browser bundle. Responses are
// cached for 15 minutes via the Cache API to stay well within Adzuna's
// free-tier rate limit — no Redis needed at this scale.
async function searchJobs(request: Request, env: Env): Promise<Response> {
  if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) {
    return json({ message: 'Live job search is not configured (missing ADZUNA_APP_ID/ADZUNA_APP_KEY secrets).' }, 503);
  }

  const url = new URL(request.url);
  const what = url.searchParams.get('what') || '';
  const where = url.searchParams.get('where') || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const country = (url.searchParams.get('country') || 'in').toLowerCase();

  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(url.toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const qs = new URLSearchParams({
    app_id: env.ADZUNA_APP_ID,
    app_key: env.ADZUNA_APP_KEY,
    results_per_page: '15',
  });
  if (what) qs.set('what', what);
  if (where) qs.set('where', where);

  const adzunaUrl = `${ADZUNA_BASE_URL}/${country}/search/${page}?${qs.toString()}`;

  let upstream: Response;
  try {
    upstream = await fetch(adzunaUrl, { headers: { Accept: 'application/json' } });
  } catch {
    return json({ message: 'Failed to reach the job search provider.' }, 502);
  }
  if (!upstream.ok) {
    return json({ message: `Job search provider returned ${upstream.status}.` }, 502);
  }

  const data = (await upstream.json()) as { results?: AdzunaRawJob[] };
  const jobs: LiveJob[] = (data.results || []).map((r) => ({
    id: String(r.id ?? ''),
    title: r.title || 'Untitled role',
    company: r.company?.display_name || 'Unknown company',
    location: r.location?.display_name || '',
    description: (r.description || '').slice(0, 400),
    salaryMin: typeof r.salary_min === 'number' ? Math.round(r.salary_min) : null,
    salaryMax: typeof r.salary_max === 'number' ? Math.round(r.salary_max) : null,
    applyUrl: r.redirect_url || '',
    created: r.created || '',
  }));

  const response = json({ jobs });
  response.headers.set('Cache-Control', 'public, max-age=900');
  await cache.put(cacheKey, response.clone());
  return response;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    const deleteMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (deleteMatch && request.method === 'DELETE') {
      return deleteUser(request, env, deleteMatch[1]);
    }

    if (url.pathname === '/api/admin/log-view' && request.method === 'POST') {
      return logUserView(request, env);
    }

    if (url.pathname === '/api/activity/log' && request.method === 'POST') {
      return logActivity(request, env);
    }

    if (url.pathname === '/api/jobs/search' && request.method === 'GET') {
      return searchJobs(request, env);
    }

    if (url.pathname === '/api/roles/infer' && request.method === 'POST') {
      return inferRole(request, env);
    }

    // Everything else (the SPA, its assets, and the /api/data/* routes that
    // already have client-side fallbacks) is served exactly as before.
    return env.ASSETS.fetch(request);
  },
};
