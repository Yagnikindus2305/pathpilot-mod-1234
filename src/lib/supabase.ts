import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // sessionStorage (not the default localStorage) so a login only survives
    // page reloads/navigation within that same browser tab — closing the tab
    // or browser ends the session. Without this, opening the site fresh on a
    // shared/public device could silently sign back in as whoever last used
    // it and forgot to click "Log out".
    storage: window.sessionStorage,
  },
});
