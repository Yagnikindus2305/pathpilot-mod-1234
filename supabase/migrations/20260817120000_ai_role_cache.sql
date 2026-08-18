-- Caches AI-inferred skills/roadmap/quiz data for target roles a user typed
-- via "Other (type your role)" that aren't in the curated ROLE_SKILLS /
-- pathpilot_roles_rich.json datasets. Keyed by normalized role title so the
-- same free-text role (e.g. "Underwater Welder") is only ever sent to the AI
-- provider once, no matter how many users type it.
create table if not exists public.ai_role_cache (
  role_key text primary key,
  role_title text not null,
  must_skills text[] not null default '{}',
  nice_skills text[] not null default '{}',
  advanced_skills text[] not null default '{}',
  salary_min integer,
  salary_max integer,
  roadmap jsonb not null default '[]',
  technical_mcqs jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table public.ai_role_cache enable row level security;

-- No public policies: this table is only ever read/written by the Cloudflare
-- Worker's /api/roles/infer endpoint via the service_role key (which bypasses
-- RLS), never directly from the browser.
