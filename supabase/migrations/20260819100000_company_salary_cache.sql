-- Caches live salary lookups (web search + AI extraction) for a given
-- company+role+location, so the same combination is only ever searched once
-- within the freshness window (enforced in the Worker, not here) no matter
-- how many users view that company card. min_lpa/max_lpa/median_lpa are left
-- null when the search+extraction pipeline found nothing usable for that
-- exact combination -- callers fall back to the existing static estimate.
create table if not exists public.company_salary_cache (
  cache_key text primary key,
  company text not null,
  role text not null,
  location text not null,
  -- 'Entry' | 'Mid' | 'Senior' -- part of cache_key, so each level gets its
  -- own row/search rather than one range blended across all levels.
  level text not null default 'Entry',
  min_lpa numeric,
  max_lpa numeric,
  median_lpa numeric,
  currency text not null default 'INR',
  source_domain text,
  source_url text,
  confidence text,
  fetched_at timestamptz not null default now()
);

alter table public.company_salary_cache enable row level security;

-- No public policies: this table is only ever read/written by the Cloudflare
-- Worker's /api/salary/lookup endpoint via the service_role key (which
-- bypasses RLS), never directly from the browser -- same pattern as
-- ai_role_cache.

-- One row per (user, cache_key) tracks the last time that user forced a
-- refresh, so the "Refresh salary data" button can be rate-limited to once
-- per user per company+role+location per day without touching the shared
-- cache row's own fetched_at (which drives the normal 30-day staleness check).
create table if not exists public.company_salary_refresh_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  cache_key text not null,
  refreshed_at timestamptz not null default now(),
  primary key (user_id, cache_key)
);

alter table public.company_salary_refresh_log enable row level security;
