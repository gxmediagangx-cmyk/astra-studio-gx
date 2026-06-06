import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function requireOwner(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const auth = getRequestHeader("authorization");
  if (!auth) return { ok: false, error: "Unauthorized" };
  const token = auth.replace(/^Bearer\s+/i, "");
  const { data: u, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !u.user) return { ok: false, error: "Unauthorized" };

  const ownerEmail = process.env.OWNER_ADMIN_EMAIL?.toLowerCase();
  const isOwnerByEmail = ownerEmail && u.user.email?.toLowerCase() === ownerEmail;

  const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", u.user.id);
  const isOwnerByRole = roles?.some((r) => r.role === "owner" || r.role === "admin");

  if (!isOwnerByEmail && !isOwnerByRole) return { ok: false, error: "Forbidden" };
  return { ok: true, userId: u.user.id };
}

export const ownerListUsers = createServerFn({ method: "POST" }).handler(async () => {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profiles } = await supabaseAdmin
    .from("profiles").select("id,email,display_name,is_active,activation_code,created_at")
    .order("created_at", { ascending: false }).limit(500);

  // Decorate each user with their code's current status so the UI knows
  // whether the code is disabled (revoked) and the user is blocked.
  const codes = profiles?.map((p: any) => p.activation_code).filter(Boolean) ?? [];
  let codeMap = new Map<string, string>();
  if (codes.length) {
    const { data: codeRows } = await supabaseAdmin
      .from("activation_codes").select("code,status").in("code", codes);
    codeMap = new Map((codeRows ?? []).map((c: any) => [c.code, c.status]));
  }
  const users = (profiles ?? []).map((p: any) => ({
    ...p,
    code_status: p.activation_code ? (codeMap.get(p.activation_code) ?? "unknown") : null,
  }));
  return { ok: true as const, users };
});

export const ownerToggleUser = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string().uuid(), isActive: z.boolean() }))
  .handler(async ({ data }) => {
    const gate = await requireOwner();
    if (!gate.ok) return { ok: false as const, error: gate.error };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({ is_active: data.isActive }).eq("id", data.userId);
    if (error) return { ok: false as const, error: error.message };
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: gate.userId, action: data.isActive ? "user_enabled" : "user_disabled",
      target_type: "user", target_id: data.userId,
    });
    return { ok: true as const };
  });

export const ownerDeleteUser = createServerFn({ method: "POST" })
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const gate = await requireOwner();
    if (!gate.ok) return { ok: false as const, error: gate.error };
    if (data.userId === gate.userId) {
      return { ok: false as const, error: "You cannot delete your own account here" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) return { ok: false as const, error: error.message };
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: gate.userId, action: "user_deleted",
      target_type: "user", target_id: data.userId,
    });
    return { ok: true as const };
  });

export const ownerListCodes = createServerFn({ method: "POST" }).handler(async () => {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("activation_codes")
    .select("id,code,status,notes,used_by,used_at,created_at")
    .order("created_at", { ascending: false }).limit(500);
  return { ok: true as const, codes: data ?? [] };
});

export const ownerCreateCodes = createServerFn({ method: "POST" })
  .inputValidator(z.object({ count: z.number().int().min(1).max(100), notes: z.string().max(200).optional() }))
  .handler(async ({ data }) => {
    const gate = await requireOwner();
    if (!gate.ok) return { ok: false as const, error: gate.error };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const codes = Array.from({ length: data.count }, () => ({
      code: makeCode(), status: "unused", notes: data.notes ?? null, created_by: gate.userId,
    }));
    const { data: inserted, error } = await supabaseAdmin.from("activation_codes").insert(codes).select("code");
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, codes: inserted?.map((c) => c.code) ?? [] };
  });

export const ownerRevokeCode = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const gate = await requireOwner();
    if (!gate.ok) return { ok: false as const, error: gate.error };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("activation_codes").update({ status: "revoked" }).eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: gate.userId, action: "code_disabled",
      target_type: "activation_code", target_id: data.id,
    });
    return { ok: true as const };
  });

export const ownerReactivateCode = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const gate = await requireOwner();
    if (!gate.ok) return { ok: false as const, error: gate.error };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Re-enable: if a user is bound to the code, restore "used"; else "unused".
    const { data: row } = await supabaseAdmin
      .from("activation_codes").select("used_by").eq("id", data.id).maybeSingle();
    const nextStatus = row?.used_by ? "used" : "unused";
    const { error } = await supabaseAdmin
      .from("activation_codes").update({ status: nextStatus }).eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: gate.userId, action: "code_reactivated",
      target_type: "activation_code", target_id: data.id,
    });
    return { ok: true as const };
  });

export const ownerDeleteCode = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const gate = await requireOwner();
    if (!gate.ok) return { ok: false as const, error: gate.error };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("activation_codes").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: gate.userId, action: "code_deleted",
      target_type: "activation_code", target_id: data.id,
    });
    return { ok: true as const };
  });

export const ownerAuditLogs = createServerFn({ method: "POST" }).handler(async () => {
  const gate = await requireOwner();
  if (!gate.ok) return { ok: false as const, error: gate.error };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("audit_logs")
    .select("id,actor_id,action,target_type,target_id,metadata,created_at")
    .order("created_at", { ascending: false }).limit(200);
  const logs = data ?? [];

  // Collect every user id we need to resolve (actor + user-typed targets).
  const ids = new Set<string>();
  for (const l of logs) {
    if (l.actor_id) ids.add(l.actor_id);
    if (l.target_type === "user" && l.target_id) ids.add(l.target_id);
  }

  let userMap = new Map<string, { email: string; display_name: string | null }>();
  if (ids.size) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id,email,display_name").in("id", Array.from(ids));
    userMap = new Map(
      (profiles ?? []).map((p: any) => [p.id, { email: p.email, display_name: p.display_name }]),
    );
  }

  const fmt = (id: string | null | undefined) => {
    if (!id) return null;
    const u = userMap.get(id);
    if (!u) return { id, label: "Deleted User", sublabel: null as string | null, missing: true };
    const name = u.display_name?.trim();
    return {
      id,
      label: name && name.length > 0 ? name : u.email,
      sublabel: name && name.length > 0 ? u.email : null,
      missing: false,
    };
  };

  const enriched = logs.map((l: any) => ({
    ...l,
    actor: fmt(l.actor_id),
    target_user: l.target_type === "user" ? fmt(l.target_id) : null,
  }));
  return { ok: true as const, logs: enriched };
});

function makeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = (n: number) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `ASTRA-${seg(4)}-${seg(4)}`;
}
