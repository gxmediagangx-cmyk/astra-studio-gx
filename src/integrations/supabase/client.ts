import { createClient } from "@supabase/supabase-js";

// Publishable (anon) values — safe to ship to the browser.
// These are the project's URL + anon key; RLS gates access.
export const SUPABASE_URL = "https://amknhrdixutyivnvwjkq.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFta25ocmRpeHV0eWl2bnZ3amtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MjA3MDQsImV4cCI6MjA5NjA5NjcwNH0.bie9rzIohOYSrN8Fh7lJyr9OjHuVFAYrCqqe2MzFr2k";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    storageKey: "astra-studio-auth",
  },
});
