import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "تسجيل الدخول | وليد وطلعت" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && session) {
      navigate({ to: "/" });
    }
  }, [authLoading, session, navigate]);

  const submit = async () => {
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        navigate({ to: "/" });
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (err) throw err;
        setInfo("إذا كان البريد الإلكتروني مسجلاً لدينا، سيصلك رابط لإعادة تعيين كلمة المرور.");
        setMode("signin");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ، حاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
        <h1 className="text-center text-xl font-extrabold text-primary">وليد وطلعت</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "تسجيل الدخول إلى لوحة الإدارة" : "استعادة كلمة المرور"}
        </p>

        {error && (
          <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        {info && (
          <p className="mt-4 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
            {info}
          </p>
        )}

        <div className="mt-4 grid gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">البريد الإلكتروني</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="border-border bg-input/60" />
          </div>
          {mode !== "forgot" && (
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">كلمة المرور</Label>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="border-border bg-input/60" />
            </div>
          )}
        </div>

        <Button className="mt-5 w-full bg-primary text-primary-foreground" onClick={submit} disabled={submitting}>
          {submitting ? "جارِ التنفيذ..." : mode === "signin" ? "تسجيل الدخول" : "إرسال رابط إعادة التعيين"}
        </Button>

        <button
          className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-primary"
          onClick={() => setMode(mode === "signin" ? "forgot" : "signin")}
        >
          {mode === "signin" ? "نسيت كلمة المرور؟" : "الرجوع لتسجيل الدخول"}
        </button>

        <p className="mt-4 text-center text-[11px] text-muted-foreground">
          الحسابات تُنشأ بواسطة المدير فقط — تواصل مع مديرك للحصول على حساب.
        </p>
      </div>
    </div>
  );
}
