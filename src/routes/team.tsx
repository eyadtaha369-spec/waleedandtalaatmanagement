import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DataTable, PageHeader, Panel, StatusPill } from "@/components/ui-kit";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fetchTeam, updateProfileRole, fetchMyProfile, type Profile } from "@/lib/queries";

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
          يمكنك عرض الفريق فقط — تعديل الصلاحيات متاح للمدير.
        </p>
      )}

      <Panel title="أعضاء الفريق">
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
    </AppShell>
  );
}
