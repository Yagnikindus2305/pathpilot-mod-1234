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
  GEMINI_API_KEY?: string;
  AI?: WorkersAIBinding;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Content-Type-Options': 'nosniff' },
  });
}

// Model name is a plain constant (not env-configurable) so a bad override
// can't silently break every AI-backed feature at once -- change it here if
// the account's available Gemini models change.
const GEMINI_MODEL = 'gemini-2.5-pro';
const WORKERS_AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

// Every AI-backed endpoint in this file goes through here: Gemini first when
// GEMINI_API_KEY is configured (the account this runs under has Gemini Pro
// access), Cloudflare Workers AI as the fallback on any Gemini failure --
// missing key, network error, non-2xx, empty response -- so a Gemini outage
// or exhausted quota degrades gracefully instead of taking the feature down.
// Always returns a plain string (or null): Workers AI's object-shaped
// responses are JSON.stringify'd here so every caller has one parsing path.
async function generateText(env: Env, systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string | null> {
  if (env.GEMINI_API_KEY) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { maxOutputTokens: maxTokens, responseMimeType: 'application/json', temperature: 0.3 },
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as GeminiResponse;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
        console.error('[ai] Gemini returned no usable text, falling back to Workers AI.');
      } else {
        console.error('[ai] Gemini returned', res.status, '- falling back to Workers AI.');
      }
    } catch (err) {
      console.error('[ai] Gemini request failed, falling back to Workers AI:', err instanceof Error ? err.message : String(err));
    }
  }

  if (!env.AI) return null;
  try {
    const result = await env.AI.run(WORKERS_AI_MODEL, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
    });
    const response = result.response;
    if (typeof response === 'string') return response;
    if (response && typeof response === 'object') return JSON.stringify(response);
    return null;
  } catch (err) {
    console.error('[ai] Workers AI request failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

interface GeminiGroundingChunk {
  web?: { uri?: string; title?: string };
}
interface GeminiSearchCandidate {
  content?: { parts?: { text?: string }[] };
  groundingMetadata?: { groundingChunks?: GeminiGroundingChunk[] };
}
interface GeminiSearchResponse {
  candidates?: GeminiSearchCandidate[];
}

// Gemini's built-in Google Search grounding tool lets the model search the
// web and cite sources as part of one generateContent call -- no separate
// search API needed. Workers AI has no live-search capability at all, so
// there is no fallback provider for this specific path: without
// GEMINI_API_KEY, live salary lookup is simply unavailable (the client
// falls back to the static per-company estimate, same as any other failure).
async function generateWithSearch(env: Env, systemPrompt: string, userPrompt: string, maxTokens: number): Promise<{ text: string; sources: { uri: string; title: string }[] } | null> {
  if (!env.GEMINI_API_KEY) return null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 },
      }),
    });
    if (!res.ok) {
      console.error('[ai] Gemini search request returned', res.status);
      return null;
    }
    const data = (await res.json()) as GeminiSearchResponse;
    const candidate = data.candidates?.[0];
    const text = (candidate?.content?.parts || []).map((p) => p.text || '').join('');
    if (!text) return null;
    const chunks = candidate?.groundingMetadata?.groundingChunks || [];
    const sources = chunks
      .map((c) => ({ uri: c.web?.uri || '', title: c.web?.title || '' }))
      .filter((s) => s.uri);
    return { text, sources };
  } catch (err) {
    console.error('[ai] Gemini search request failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
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

  if (!env.AI && !env.GEMINI_API_KEY) {
    return json({ message: 'AI role lookup is not configured (missing GEMINI_API_KEY or a Workers AI binding).' }, 503);
  }

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

    const rawResponse = await generateText(env, AI_ROLE_SYSTEM_PROMPT, `Job/role title: "${roleTitle}"`, 2500);
    if (!rawResponse) {
      return json({ message: 'AI returned an empty response.' }, 502);
    }
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawResponse);
    } catch {
      return json({ message: 'AI response could not be parsed.' }, 502);
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

type ExperienceLevel = 'Entry' | 'Mid' | 'Senior';

interface SalaryResult {
  company: string;
  role: string;
  location: string;
  level: ExperienceLevel;
  minLpa: number | null;
  maxLpa: number | null;
  medianLpa: number | null;
  currency: string;
  sourceDomain: string | null;
  sourceUrl: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  live: boolean;
  fetchedAt: string;
}

interface SalaryCacheRow {
  cache_key: string;
  company: string;
  role: string;
  location: string;
  level: string;
  min_lpa: number | null;
  max_lpa: number | null;
  median_lpa: number | null;
  currency: string;
  source_domain: string | null;
  source_url: string | null;
  confidence: string | null;
  fetched_at: string;
}

function rowToSalaryResult(row: SalaryCacheRow, live: boolean): SalaryResult {
  return {
    company: row.company,
    role: row.role,
    location: row.location,
    level: (row.level as ExperienceLevel) || 'Entry',
    minLpa: row.min_lpa,
    maxLpa: row.max_lpa,
    medianLpa: row.median_lpa,
    currency: row.currency,
    sourceDomain: row.source_domain,
    sourceUrl: row.source_url,
    confidence: (row.confidence as SalaryResult['confidence']) || 'none',
    live,
    fetchedAt: row.fetched_at,
  };
}

const SALARY_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SALARY_REFRESH_COOLDOWN_MS = 24 * 60 * 60 * 1000;
// Company names and locations legitimately contain "&", ".", "()", "/" (e.g.
// "Tata Consultancy Services (TCS)") so this is deliberately more permissive
// than ROLE_TITLE_PATTERN above.
const FREEFORM_INPUT_PATTERN = /^[\w\s&.,'()/+-]{1,100}$/;

function normalizeSalaryKey(company: string, role: string, location: string, level: ExperienceLevel): string {
  return [company, role, location, level].map((s) => s.trim().toLowerCase().replace(/\s+/g, ' ')).join('|');
}

const LEVEL_LABEL: Record<ExperienceLevel, string> = {
  Entry: 'entry-level / fresher',
  Mid: 'mid-level (roughly 3-5 years experience)',
  Senior: 'senior (roughly 5+ years experience)',
};

interface SalaryExtraction {
  min_lpa: number | null;
  max_lpa: number | null;
  median_lpa: number | null;
  currency: string;
  source_domain: string | null;
  source_url: string | null;
  confidence: 'high' | 'medium' | 'low';
}

// Deliberately lenient: a model returning "nothing usable" (all three
// numbers null) is a valid, expected outcome — not a validation failure —
// since most companies won't have public data for an exact role match.
function validateSalaryExtraction(data: unknown): SalaryExtraction | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 500 ? Math.round(v * 10) / 10 : null);
  const min_lpa = numOrNull(d.min_lpa);
  const max_lpa = numOrNull(d.max_lpa);
  const median_lpa = numOrNull(d.median_lpa);
  if (min_lpa !== null && max_lpa !== null && max_lpa < min_lpa) return null;
  const currency = typeof d.currency === 'string' && d.currency.trim() ? d.currency.trim().toUpperCase().slice(0, 6) : 'INR';
  const source_domain = typeof d.source_domain === 'string' && d.source_domain.trim() ? d.source_domain.trim().slice(0, 100) : null;
  const source_url = typeof d.source_url === 'string' && /^https?:\/\//.test(d.source_url) ? d.source_url.slice(0, 500) : null;
  const confidence = d.confidence === 'high' || d.confidence === 'medium' ? d.confidence : 'low';
  return { min_lpa, max_lpa, median_lpa, currency, source_domain, source_url, confidence };
}

const SALARY_SEARCH_SYSTEM_PROMPT = `You are a salary research assistant for a career-prep platform used by Indian college students, with access to Google Search. Given a role, a company, a location, and an experience level, search the web (prioritize levels.fyi, glassdoor.com, ambitionbox.com, payscale.com, indeed.com) for a real, current salary figure for that exact company and role, then respond with ONLY a single valid JSON object, no markdown fences, no commentary:

{"min_lpa": number|null, "max_lpa": number|null, "median_lpa": number|null, "currency": "INR"|"USD"|string, "source_domain": string|null, "source_url": string|null, "confidence": "high"|"medium"|"low"}

Rules:
- Only extract a number if a source clearly ties it to this exact company AND this exact role (or a close synonym of the role). Do not use a number for a different company or an unrelated role at the same company.
- Match the requested experience level as closely as you can: if a source gives a range spanning multiple levels (e.g. a total range from entry through staff), narrow it toward the requested level rather than returning the full unfiltered span -- e.g. for "senior", prefer the upper part of a wide range; for "entry-level / fresher", prefer the lower part. If a source doesn't distinguish levels at all, use the number as-is but set confidence to "medium" or "low" rather than "high".
- If you cannot find a usable number for this exact company+role, return {"min_lpa": null, "max_lpa": null, "median_lpa": null, "currency": "INR", "source_domain": null, "source_url": null, "confidence": "low"}. This is a valid, expected answer — do not guess or estimate a number you didn't actually find.
- "currency" defaults to "INR" (values are assumed Lakhs Per Annum) unless the source clearly states another currency.
- "source_domain" and "source_url" must be the actual page you drew the number from (e.g. "levels.fyi", its exact URL).
- "confidence": "high" if the number is explicitly for this company+role+location+level; "medium" if company+role match but location/level is approximate or unstated; "low" if you are extrapolating from a nearby role/level.
- Do not include any text outside the JSON object.`;

// Live company+role salary lookup: web search (Brave) scoped to salary
// aggregator sites, then AI extraction of a range from the result snippets --
// never scrapes/republishes a site's structured data wholesale, and every
// result is cached in Supabase so the same company+role+location combo is
// only ever searched once per SALARY_CACHE_TTL_MS window, no matter how many
// users view that card.
async function lookupSalary(request: Request, env: Env): Promise<Response> {
  const auth = await requireUser(request, env);
  if ('error' in auth) return auth.error;
  const { supabaseAdmin, userId } = auth;

  let body: { company?: unknown; role?: unknown; location?: unknown; level?: unknown; forceRefresh?: unknown; experienceYears?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ message: 'Invalid request body' }, 400);
  }
  const company = typeof body.company === 'string' ? body.company.trim() : '';
  const role = typeof body.role === 'string' ? body.role.trim() : '';
  const location = typeof body.location === 'string' && body.location.trim() ? body.location.trim() : 'India';
  const level: ExperienceLevel = body.level === 'Mid' || body.level === 'Senior' ? body.level : 'Entry';
  const forceRefresh = body.forceRefresh === true;
  // Extra prompt-only context for a more precise grounded search on an
  // actual cache miss -- deliberately NOT part of the cache key (see
  // normalizeSalaryKey), so caching still amortizes across every user at
  // the same level bucket instead of being busted by everyone's exact years.
  const experienceYears = typeof body.experienceYears === 'number' && Number.isFinite(body.experienceYears) && body.experienceYears > 0 && body.experienceYears < 60
    ? Math.round(body.experienceYears * 10) / 10
    : null;
  if (!FREEFORM_INPUT_PATTERN.test(company) || !FREEFORM_INPUT_PATTERN.test(role) || !FREEFORM_INPUT_PATTERN.test(location)) {
    return json({ message: 'company, role, and location must be 1-100 characters of ordinary text.' }, 400);
  }

  const cacheKey = normalizeSalaryKey(company, role, location, level);

  try {
    const { data: cached } = await supabaseAdmin
      .from('company_salary_cache')
      .select('*')
      .eq('cache_key', cacheKey)
      .maybeSingle<SalaryCacheRow>();

    const cacheFresh = cached && Date.now() - new Date(cached.fetched_at).getTime() < SALARY_CACHE_TTL_MS;

    if (forceRefresh) {
      const { data: refreshLog } = await supabaseAdmin
        .from('company_salary_refresh_log')
        .select('refreshed_at')
        .eq('user_id', userId)
        .eq('cache_key', cacheKey)
        .maybeSingle<{ refreshed_at: string }>();
      const onCooldown = refreshLog && Date.now() - new Date(refreshLog.refreshed_at).getTime() < SALARY_REFRESH_COOLDOWN_MS;
      if (onCooldown) {
        if (cached) return json({ ...rowToSalaryResult(cached, cached.confidence !== 'none'), rateLimited: true });
        return json({ message: 'You can only refresh a company\'s salary data once per day.' }, 429);
      }
    } else if (cacheFresh) {
      return json(rowToSalaryResult(cached, cached.confidence !== 'none'));
    }

    if (!env.GEMINI_API_KEY) {
      return json({ message: 'Live salary lookup is not configured (missing GEMINI_API_KEY secret).' }, 503);
    }

    const searchResult = await generateWithSearch(
      env,
      SALARY_SEARCH_SYSTEM_PROMPT,
      `Role: "${role}"\nCompany: "${company}"\nLocation: "${location}"\nExperience level: ${LEVEL_LABEL[level]}${experienceYears !== null ? ` -- specifically ${experienceYears} years of professional experience` : ''}`,
      800
    );
    if (!searchResult) {
      return json({ message: 'Salary search provider returned an error.' }, 502);
    }
    const jsonMatch = searchResult.text.match(/\{[\s\S]*\}/);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : searchResult.text);
    } catch {
      return json({ message: 'AI response could not be parsed.' }, 502);
    }

    const validated = validateSalaryExtraction(parsed);
    if (!validated) {
      return json({ message: 'AI response was invalid.' }, 502);
    }
    // The model doesn't always echo the source URL into its own JSON output
    // even when it did ground its answer in a real search result -- the
    // grounding metadata is the actual source of truth for that, so it
    // backfills whenever the JSON came back without one.
    if (validated.min_lpa !== null && !validated.source_url && searchResult.sources[0]) {
      validated.source_url = searchResult.sources[0].uri;
      try {
        validated.source_domain = new URL(searchResult.sources[0].uri).hostname.replace(/^www\./, '');
      } catch {
        validated.source_domain = searchResult.sources[0].title || null;
      }
    }

    const row: SalaryCacheRow = {
      cache_key: cacheKey, company, role, location, level,
      min_lpa: validated.min_lpa, max_lpa: validated.max_lpa, median_lpa: validated.median_lpa,
      currency: validated.currency,
      source_domain: validated.source_domain, source_url: validated.source_url,
      confidence: validated.min_lpa === null ? 'none' : validated.confidence,
      fetched_at: new Date().toISOString(),
    };
    const { error: upsertError } = await supabaseAdmin.from('company_salary_cache').upsert(row, { onConflict: 'cache_key' });
    if (upsertError) console.error('[salary/lookup] Failed to cache salary data:', upsertError.message);

    if (forceRefresh) {
      const { error: logError } = await supabaseAdmin
        .from('company_salary_refresh_log')
        .upsert({ user_id: userId, cache_key: cacheKey, refreshed_at: row.fetched_at }, { onConflict: 'user_id,cache_key' });
      if (logError) console.error('[salary/lookup] Failed to log refresh:', logError.message);
    }

    return json(rowToSalaryResult(row, row.confidence !== 'none'));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[salary/lookup] Unhandled error:', message);
    return json({ message: `Salary lookup failed: ${message}` }, 502);
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

    if (url.pathname === '/api/salary/lookup' && request.method === 'POST') {
      return lookupSalary(request, env);
    }

    // Everything else (the SPA, its assets, and the /api/data/* routes that
    // already have client-side fallbacks) is served exactly as before.
    return env.ASSETS.fetch(request);
  },
};
