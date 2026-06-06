import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// PASSWORDLESS auth: users sign in with email + activation code only.
// A deterministic random password is stored server-side per user (the
// activation code itself is the user's "secret"). Login uses an admin-
// generated magic-link OTP hash that the browser then exchanges for a
// session via supabase.auth.verifyOtp — the password is never exposed.

const DISABLED_MSG_EN = "Your activation code is disabled. Contact the admin: 01095777037";
const DISABLED_MSG_AR = "كود التفعيل الخاص بك معطّل. تواصل مع المدير: 01095777037";

async function generateMagicTokenHash(email: string): Promise<
  { ok: true; tokenHash: string } | { ok: false; error: string }
> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data?.properties?.hashed_token) {
    return { ok: false, error: error?.message ?? "Failed to generate session" };
  }
  return { ok: true, tokenHash: data.properties.hashed_token };
}

// Register a new user with an unused activation code, then immediately
// return a one-time token the client can exchange for a session.
export const registerWithActivationCode = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email().max(255),
      activationCode: z.string().min(4).max(64),
      displayName: z.string().min(1).max(120).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const normalizedCode = data.activationCode.trim().toUpperCase();
    const email = data.email.trim().toLowerCase();

    const { data: codeRow, error: codeErr } = await supabaseAdmin
      .from("activation_codes")
      .select("id, status")
      .eq("code", normalizedCode)
      .maybeSingle();

    if (codeErr) return { ok: false as const, error: "Database error" };
    if (!codeRow) return { ok: false as const, error: "Invalid activation code" };
    if (codeRow.status !== "unused") {
      return { ok: false as const, error: "Activation code already used or revoked" };
    }

    // Random server-only password — the user never sees or types it.
    const randomPassword = crypto.randomUUID() + crypto.randomUUID();
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: randomPassword,
      email_confirm: true,
      user_metadata: { display_name: data.displayName ?? null },
    });

    if (createErr || !created.user) {
      return { ok: false as const, error: createErr?.message ?? "Failed to create user" };
    }

    const userId = created.user.id;

    const { error: profileErr } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      email,
      display_name: data.displayName ?? null,
      activation_code: normalizedCode,
      is_active: true,
    });
    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return { ok: false as const, error: "Failed to create profile" };
    }

    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "user" });

    const { error: codeUpdateErr } = await supabaseAdmin
      .from("activation_codes")
      .update({ status: "used", used_by: userId, used_at: new Date().toISOString() })
      .eq("id", codeRow.id)
      .eq("status", "unused");

    if (codeUpdateErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return { ok: false as const, error: "Activation code conflict, try again" };
    }

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "user_registered",
      target_type: "user",
      target_id: userId,
      metadata: { code: normalizedCode },
    });

    const tok = await generateMagicTokenHash(email);
    if (!tok.ok) return { ok: false as const, error: tok.error };
    return { ok: true as const, tokenHash: tok.tokenHash };
  });

// Sign in with just email + activation code. Verifies that the activation
// code is still active (not revoked by the admin) and matches the user.
export const loginWithActivationCode = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string().email().max(255),
      activationCode: z.string().min(4).max(64),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const normalizedCode = data.activationCode.trim().toUpperCase();

    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, activation_code, is_active")
      .eq("email", email)
      .maybeSingle();

    if (profErr) return { ok: false as const, error: "Database error" };
    if (!profile) return { ok: false as const, error: "No account found for this email" };
    if (profile.activation_code !== normalizedCode) {
      return { ok: false as const, error: "Email and activation code do not match" };
    }

    // Look up the code to honour the admin's revoked / unused state.
    const { data: codeRow } = await supabaseAdmin
      .from("activation_codes")
      .select("status")
      .eq("code", normalizedCode)
      .maybeSingle();

    const codeRevoked = !codeRow || codeRow.status === "revoked";
    if (!profile.is_active || codeRevoked) {
      return { ok: false as const, error: DISABLED_MSG_EN, errorAr: DISABLED_MSG_AR };
    }

    const tok = await generateMagicTokenHash(email);
    if (!tok.ok) return { ok: false as const, error: tok.error };
    return { ok: true as const, tokenHash: tok.tokenHash };
  });
