import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "إعادة تعيين كلمة المرور | وليد وطلعت" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    setError(null);
    if (password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    setSubmitting(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      navigate({ to: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحديث كلمة المرور");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
        <h1 className="text-center text-xl font-extrabold text-primary">تعيين كلمة مرور جديدة</h1>

        {!ready ? (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            هذا الرابط غير صالح أو منتهي الصلاحية. اطلب رابطًا جديدًا من صفحة تسجيل الدخول.
          </p>
        ) : (
          <>
            {error && (
              <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="mt-4 grid gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">كلمة المرور الجديدة</Label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">تأكيد كلمة المرور</Label>
                <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" className="border-border bg-input/60" />
              </div>
            </div>
            <Button className="mt-5 w-full bg-primary text-primary-foreground" onClick={submit} disabled={submitting}>
              {submitting ? "جارِ الحفظ..." : "حفظ كلمة المرور"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
