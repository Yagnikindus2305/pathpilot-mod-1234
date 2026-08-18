/*
# Email Activity Log

1. New Table
- `email_log`: records every time the app triggers an auth email (signup
  confirmation, password reset, OTP code). Supabase's backend does the actual
  sending (via the configured SMTP provider), so this table is our own record
  that the request was made and whether the API call itself succeeded — it's
  visibility for the admin, not proof of inbox delivery.
  - id (uuid, PK)
  - email (text) — recipient; these calls happen pre-auth (signup, password
    reset, OTP for a signed-out user) so there's no reliable user_id yet
  - type (text) — 'signup' | 'password_reset' | 'otp_code'
  - success (boolean) — whether Supabase accepted the request
  - created_at (timestamptz)

2. Security
RLS enabled. Only admins (public.is_admin(), defined in an earlier migration)
can read it. Insert is open to anon+authenticated since signup/reset/OTP all
happen before or without a session — this table has no sensitive fields and
no downstream effect beyond an admin-visible log, so a permissive insert
policy is an acceptable tradeoff for a pre-auth logging table.
*/

CREATE TABLE IF NOT EXISTS email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  type text NOT NULL,
  success boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_email_log" ON email_log;
CREATE POLICY "admin_select_email_log" ON email_log FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "anyone_insert_email_log" ON email_log;
CREATE POLICY "anyone_insert_email_log" ON email_log FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_email_log_created_at ON email_log(created_at DESC);
