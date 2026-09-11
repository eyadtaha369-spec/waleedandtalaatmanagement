import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DataTable, PageHeader, Panel, StatusPill } from "@/components/ui-kit";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { fetchTeam, updateProfileRole, fetchMyProfile, type Profile } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import { createStaffAccount } from "@/lib/team-actions";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [{ title: "الفريق والصلاحيات | وليد وطلعت" }],
  }),
  component: TeamPage,
});

const roleLabels: Record<Profile["role"], string> = {
  pending: "بانتظار الموافقة",
  admin: "مدير (صلاحيات كاملة)",
  accountant: "محاسب (مالية وتشغيل)",
  dispatcher: "منسق تشغيل (بدون مالية)",
  staff: "موظف (عرض فقط)",
};

function TeamPage() {
  const [team, setTeam] = useState<Profile[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newAccount, setNewAccount] = useState<{ email: string; password: string; role: Profile["role"] }>({
    email: "",
    password: "",
    role: "staff",
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, m] = await Promise.all([fetchTeam(), fetchMyProfile()]);
      setTeam([...t].sort((a, b) => (a.role === "pending" ? -1 : b.role === "pending" ? 1 : 0)));
      setMe(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل بيانات الفريق");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const changeRole = async (id: string, role: Profile["role"]) => {
    setError(null);
    try {
      await updateProfileRole(id, role);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحديث الصلاحية — يلزم أن تكون مديرًا");
    }
  };

  const submitNewAccount = async () => {
    setError(null);
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session.session?.access_token;
      if (!accessToken) throw new Error("جلسة غير صالحة");
      await createStaffAccount({
        data: { accessToken, email: newAccount.email, password: newAccount.password, role: newAccount.role as any },
      });
      await load();
      setNewAccount({ email: "", password: "", role: "staff" });
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إنشاء الحساب");
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = me?.role === "admin";

  return (
    <AppShell>
      <PageHeader title="الفريق والصلاحيات" subtitle="إدارة صلاحيات الوصول لكل عضو في الفريق" />

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!isAdmin && !loading && (
        <p className="mb-4 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm text-primary">
          يمكنك عرض الفريق فقط — تعديل الصلاحيات وإضافة حسابات متاح للمدير.
        </p>
      )}

      <Panel title="أعضاء الفريق">
        {isAdmin && (
          <div className="mb-4 flex justify-end">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setAdding(true)}>
              <Plus className="ml-2 h-4 w-4" /> إضافة حساب
            </Button>
          </div>
        )}
        <DataTable head={["البريد الإلكتروني", "الصلاحية"]}>
          {loading ? (
            <tr>
              <td colSpan={2} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td>
            </tr>
          ) : (
            team.map((p) => (
              <tr key={p.id} className={cn("transition-colors hover:bg-secondary/30", p.role === "pending" && "bg-destructive/5")}>
                <td className="px-4 py-3 font-bold">{p.email}</td>
                <td className="px-4 py-3">
                  {isAdmin ? (
                    <Select value={p.role} onValueChange={(v) => changeRole(p.id, v as Profile["role"])}>
                      <SelectTrigger className="w-64 border-border bg-input/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(roleLabels) as Profile["role"][]).map((r) => (
                          <SelectItem key={r} value={r}>
                            {roleLabels[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <StatusPill label={roleLabels[p.role]} tone={p.role === "pending" ? "bad" : "info"} />
                  )}
                </td>
              </tr>
            ))
          )}
        </DataTable>
      </Panel>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">إضافة حساب جديد</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              التسجيل الذاتي معطّل — الحسابات تُنشأ من هنا فقط
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">البريد الإلكتروني</Label>
              <Input
                value={newAccount.email}
                onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                type="email"
                className="border-border bg-input/60"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">كلمة المرور المبدئية</Label>
              <Input
                value={newAccount.password}
                onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                type="password"
                className="border-border bg-input/60"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">الصلاحية</Label>
              <Select value={newAccount.role} onValueChange={(v) => setNewAccount({ ...newAccount, role: v as Profile["role"] })}>
                <SelectTrigger className="border-border bg-input/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(roleLabels) as Profile["role"][])
                    .filter((r) => r !== "pending")
                    .map((r) => (
                      <SelectItem key={r} value={r}>
                        {roleLabels[r]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitNewAccount} disabled={saving}>
              {saving ? "جارِ الإنشاء..." : "إنشاء الحساب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
