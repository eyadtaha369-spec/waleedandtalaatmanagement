import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase-admin.server";

export const createStaffAccount = createServerFn({ method: "POST" })
  .validator((d: { accessToken: string; email: string; password: string; role: "admin" | "accountant" | "dispatcher" | "staff"; fullName: string }) => d)
  .handler(async ({ data }) => {
    const url = process.env['VITE_SUPABASE_URL'];
    const anonKey = process.env['VITE_SUPABASE_PUBLISHABLE_KEY'];
    if (!url || !anonKey) throw new Error("Server misconfigured");

    // Verify the caller is who they claim to be, using their own access token.
    const callerClient = createClient(url, anonKey);
    const { data: callerAuth, error: callerErr } = await callerClient.auth.getUser(data.accessToken);
    if (callerErr || !callerAuth.user) {
      throw new Error("جلسة غير صالحة");
    }

    const admin = createAdminClient();

    // Verify the caller is actually an admin (bypasses RLS via service role, so this check is authoritative).
    const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", callerAuth.user.id).maybeSingle();
    if (callerProfile?.role !== "admin") {
      throw new Error("هذا الإجراء متاح للمدير فقط");
    }

    if (!data.email.trim() || data.password.length < 6) {
      throw new Error("بريد إلكتروني أو كلمة مرور غير صالحة (٦ أحرف على الأقل)");
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "تعذر إنشاء الحساب");
    }

    // The handle_new_user trigger already inserted a profile row (role defaults
    // to 'pending' since this isn't the first user) — set it to the chosen role.
    const { error: roleErr } = await admin.from("profiles").update({ role: data.role, full_name: data.fullName }).eq("id", created.user.id);
    if (roleErr) throw new Error(roleErr.message);

    return { id: created.user.id, email: created.user.email };
  });
