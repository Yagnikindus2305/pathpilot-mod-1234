import { supabase } from '@/lib/supabase';

export type ExperienceLevel = 'Entry' | 'Mid' | 'Senior';

export interface SalaryLookupResult {
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
  rateLimited?: boolean;
}

function cacheKeyFor(company: string, role: string, location: string, level: ExperienceLevel): string {
  return `${company}|${role}|${location}|${level}`.toLowerCase();
}

const resultCache = new Map<string, SalaryLookupResult>();
const inflight = new Map<string, Promise<SalaryLookupResult | null>>();

export function getCachedSalary(company: string, role: string, location: string, level: ExperienceLevel): SalaryLookupResult | undefined {
  return resultCache.get(cacheKeyFor(company, role, location, level));
}

// Fetches (or force-refreshes) a live company+role+level salary range via the
// Worker's /api/salary/lookup, which itself caches in Supabase for 30 days --
// this in-memory map just avoids re-requesting within a single page session.
// Resolves to null on any failure (not configured, rate-limited with nothing
// cached yet, provider error) -- callers fall back to the existing static
// estimate rather than block or show an error.
export function fetchCompanySalary(
  company: string,
  role: string,
  location: string,
  level: ExperienceLevel = 'Entry',
  forceRefresh = false,
  experienceYears = 0
): Promise<SalaryLookupResult | null> {
  const key = cacheKeyFor(company, role, location, level);
  if (!forceRefresh) {
    const cached = resultCache.get(key);
    if (cached) return Promise.resolve(cached);
    const existing = inflight.get(key);
    if (existing) return existing;
  }

  const promise = (async (): Promise<SalaryLookupResult | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return null;
      const res = await fetch('/api/salary/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ company, role, location, level, forceRefresh, experienceYears }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as SalaryLookupResult;
      resultCache.set(key, data);
      return data;
    } catch {
      return null;
    }
  })();

  inflight.set(key, promise);
  promise.finally(() => inflight.delete(key));
  return promise;
}
