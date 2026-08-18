/*
# Configurable internship stipend ranges

1. Problem
The Internships feature computes a stipend range per company tier
(Mass recruiter / Mid-tier / Tier-1 / Dream), but that range was a hardcoded
string in the frontend — changing it meant a code deploy.

2. Fix
A small reference table, `stipend_tiers`, holding a min/max stipend per tier
key. The app reads it at runtime (with a hardcoded fallback if the table is
ever empty or unreachable) and formats the display band from it, so the
numbers can be adjusted directly in Supabase's table editor with no deploy.

Readable by any authenticated user (it's just reference config, not
sensitive). Writable only by admins, via the existing public.is_admin()
helper — same pattern as the rest of the admin-managed data in this schema.
*/

CREATE TABLE IF NOT EXISTS stipend_tiers (
  tier_key text PRIMARY KEY,
  label text NOT NULL,
  min_stipend integer NOT NULL CHECK (min_stipend >= 0),
  max_stipend integer NOT NULL CHECK (max_stipend >= min_stipend),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE stipend_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_stipend_tiers" ON stipend_tiers;
CREATE POLICY "authenticated_read_stipend_tiers" ON stipend_tiers FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_write_stipend_tiers" ON stipend_tiers;
CREATE POLICY "admin_write_stipend_tiers" ON stipend_tiers FOR ALL
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO stipend_tiers (tier_key, label, min_stipend, max_stipend) VALUES
  ('mass_recruiter', 'Mass recruiter', 6000, 8000),
  ('mid_tier', 'Mid-tier', 8000, 15000),
  ('tier_1', 'Tier-1', 15000, 25000),
  ('dream', 'Dream', 25000, 50000)
ON CONFLICT (tier_key) DO NOTHING;
