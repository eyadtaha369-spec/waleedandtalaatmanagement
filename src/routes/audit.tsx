import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DataTable, PageHeader, Panel, StatusPill, Toolbar, exportToExcel } from "@/components/ui-kit";
import { fetchAuditLog, type AuditEntry } from "@/lib/queries";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [{ title: "سجل التعديلات | وليد وطلعت" }],
  }),
  component: AuditPage,
});

const tableLabels: Record<string, string> = {
  buses: "الأتوبيسات",
  drivers: "السائقون",
  routes: "الخطوط",
  students: "الطلاب",
  maintenance_orders: "أوامر الصيانة",
  attendance: "الحضور",
  payments: "المدفوعات",
  inventory: "المخزن",
  fuel_logs: "السولار",
  treasury: "الخزينة",
  expenses: "المصروفات",
  loans: "القروض",
  staff: "الموظفون",
  payslips: "كشوف المرتبات",
};

const actionTone = (a: string) => (a === "INSERT" ? "good" : a === "DELETE" ? "bad" : "warn") as const;
const actionLabel: Record<string, string> = { INSERT: "إضافة", UPDATE: "تعديل", DELETE: "حذف" };

function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setEntries(await fetchAuditLog(200));
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذر تحميل سجل التعديلات");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = entries.filter(
    (e) => (e.changedByEmail ?? "").includes(query) || (tableLabels[e.tableName] ?? e.tableName).includes(query) || query === "",
  );

  return (
    <AppShell>
      <PageHeader title="سجل التعديلات" subtitle="من قام بإضافة أو تعديل أو حذف أي بيانات، ومتى" />

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Panel title="آخر 200 عملية">
        <Toolbar
          query={query}
          onQuery={setQuery}
          placeholder="ابحث بالبريد الإلكتروني أو الجدول..."
          onExport={() => exportToExcel("سجل التعديلات", filtered as unknown as Record<string, string | number>[])}
        />
        <DataTable head={["الوقت", "الجدول", "العملية", "بواسطة"]}>
          {loading ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td>
            </tr>
          ) : filtered.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">لا توجد سجلات بعد.</td>
            </tr>
          ) : (
            filtered.map((e) => (
              <tr key={e.id} className="transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(e.changedAt).toLocaleString("ar-EG")}</td>
                <td className="px-4 py-3 font-bold">{tableLabels[e.tableName] ?? e.tableName}</td>
                <td className="px-4 py-3">
                  <StatusPill label={actionLabel[e.action] ?? e.action} tone={actionTone(e.action)} />
                </td>
                <td className="px-4 py-3">{e.changedByEmail ?? "—"}</td>
              </tr>
            ))
          )}
        </DataTable>
      </Panel>
    </AppShell>
  );
}
