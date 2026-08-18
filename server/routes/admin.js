import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Only created if the service role key is actually configured — without it,
// every route here responds 503 instead of crashing the server at startup.
// The service_role key is a full-privilege secret (bypasses RLS entirely);
// it must only ever live here, server-side, never in the frontend bundle.
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

// Verifies the caller's Supabase access token (sent by the admin panel) and
// confirms profiles.is_admin is true for that user, before allowing anything
// in this router to run. Every route here is destructive, so this check is
// not optional and never trusts a client-supplied "am I admin" flag.
async function requireAdmin(req, res, next) {
  if (!supabaseAdmin) {
    return res.status(503).json({ message: 'Admin actions are not configured on this server (missing SUPABASE_SERVICE_ROLE_KEY).' });
  }
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Missing auth token' });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ message: 'Invalid or expired session' });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile?.is_admin) return res.status(403).json({ message: 'Admin access required' });

  req.adminUserId = user.id;
  next();
}

// Deletes a user's auth account entirely — this cascades (via each table's
// `user_id ... REFERENCES auth.users(id) ON DELETE CASCADE`) to remove their
// profile, resumes, roadmap, aptitude results, comparisons, and milestones
// in one step. There is no undo.
router.delete('/users/:id', requireAdmin, async (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.adminUserId) {
    return res.status(400).json({ message: "You can't delete your own account from here." });
  }

  // Admin status can only ever change via a direct SQL statement (see the
  // profiles.is_admin trigger) — this route mirrors that same rule so one
  // admin can never remove another through the app, accidentally or not.
  const { data: targetProfile, error: targetError } = await supabaseAdmin
    .from('profiles')
    .select('is_admin')
    .eq('id', targetId)
    .maybeSingle();
  if (targetError) return res.status(500).json({ message: targetError.message });
  if (targetProfile?.is_admin) {
    return res.status(403).json({ message: 'Admin accounts cannot be deleted from the panel.' });
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(targetId);
  if (error) {
    console.error('[admin] Failed to delete user:', error.message);
    return res.status(500).json({ message: error.message });
  }
  console.warn(`[admin] User ${targetId} deleted by admin ${req.adminUserId}`);
  res.json({ ok: true });
});

export default router;
