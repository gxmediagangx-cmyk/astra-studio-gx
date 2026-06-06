import { createClient } from "@supabase/supabase-js";

// Server-only admin client. Bypasses RLS. NEVER import from browser code.
const url = process.env.ASTRA_SUPABASE_URL!;
const serviceRoleKey = process.env.ASTRA_SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
