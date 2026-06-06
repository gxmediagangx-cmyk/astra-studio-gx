import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function currentUserId(): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const auth = getRequestHeader("authorization");
  if (!auth) return null;
  const token = auth.replace(/^Bearer\s+/i, "");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

export const getMyMemory = createServerFn({ method: "POST" }).handler(async () => {
  const uid = await currentUserId();
  if (!uid) return { ok: false as const, error: "Unauthorized" };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_memory").select("content").eq("user_id", uid).maybeSingle();
  return { ok: true as const, content: data?.content ?? "" };
});

export const saveMyMemory = createServerFn({ method: "POST" })
  .inputValidator(z.object({ content: z.string().max(20000) }))
  .handler(async ({ data }) => {
    const uid = await currentUserId();
    if (!uid) return { ok: false as const, error: "Unauthorized" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_memory")
      .upsert({ user_id: uid, content: data.content, updated_at: new Date().toISOString() });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });