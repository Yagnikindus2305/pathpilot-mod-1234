import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ROLE_SKILLS } from '@/lib/roleSkills';
import { getRoleByTitle } from '@/lib/pathpilot';
import type { Question } from '@/lib/questions';

export interface AIRoadmapItem {
  skill: string;
  video: string;
  priority: 'Must Have' | 'Nice to Have' | 'Advanced';
}

export interface AIRoleData {
  role: string;
  must: string[];
  nice: string[];
  advanced: string[];
  salaryLPA: { min: number; max: number };
  roadmap: AIRoadmapItem[];
  technicalMcqs: Question[];
}

// A role is "known" once it's backed by either curated dataset (ROLE_SKILLS
// or pathpilot_roles_rich.json) — only roles that miss both (typed via
// "Other (type your role)") need the AI lookup at all.
export function isKnownRole(role?: string): boolean {
  if (!role) return true;
  return Boolean(ROLE_SKILLS[role] || getRoleByTitle(role));
}

const resultCache = new Map<string, AIRoleData>();
const inflight = new Map<string, Promise<AIRoleData | null>>();

export function getCachedAIRole(role: string): AIRoleData | undefined {
  return resultCache.get(role.trim().toLowerCase());
}

// Fetches AI-inferred skills/roadmap/quiz for a role not in our curated
// datasets, via the Worker's /api/roles/infer (which itself caches in
// Supabase, so this is a network call only the first time anyone, anywhere,
// asks about that exact role title). Resolves to null on any failure —
// callers fall back to the generic static role data rather than block.
export function fetchAIRole(role: string): Promise<AIRoleData | null> {
  const key = role.trim().toLowerCase();
  if (!key) return Promise.resolve(null);
  const cached = resultCache.get(key);
  if (cached) return Promise.resolve(cached);
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<AIRoleData | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return null;
      const res = await fetch('/api/roles/infer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ roleTitle: role }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as AIRoleData;
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

// Resolves a target role's AI-inferred data when it isn't one of the curated
// roles. Returns { data: null } for known roles, while loading, and on
// failure — in all three cases callers should keep using their existing
// static fallback rather than show nothing.
export function useAIRole(role?: string): { data: AIRoleData | null; loading: boolean } {
  const known = isKnownRole(role);
  const cached = role && !known ? getCachedAIRole(role) || null : null;
  const [data, setData] = useState<AIRoleData | null>(cached);
  const [loading, setLoading] = useState(Boolean(role) && !known && !cached);

  useEffect(() => {
    if (!role || isKnownRole(role)) {
      setData(null);
      setLoading(false);
      return;
    }
    const existing = getCachedAIRole(role);
    if (existing) {
      setData(existing);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchAIRole(role).then((result) => {
      if (cancelled) return;
      setData(result);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [role]);

  return { data, loading };
}
