import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Printer, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DataTable, PageHeader, Panel, StatCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currency } from "@/lib/fleet-data";
import {
  fetchMonthlyReport,
  fetchSupplierMonthlyBreakdown,
  addSupplierPayment,
  type MonthlyReportBreakdown,
  type SupplierMonthlyRow,
} from "@/lib/queries";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [{ title: "التقرير المالي الشهري الشامل | وليد وطلعت" }],
  }),
  component: ReportPage,
});

function LineRow({ label, value, tone }: { label: string; value: number; tone: "good" | "bad" }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold ${tone === "good" ? "text-success" : "text-destructive"}`}>{currency(value)}</span>
    </div>
  );
}

function ReportPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState<MonthlyReportBreakdown | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierMonthlyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payAmounts, setPayAmounts] = useState<Record<string, string>>({});
  const [payingId, setPayingId] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, s] = await Promise.all([fetchMonthlyReport(month), fetchSupplierMonthlyBreakdown(month)]);
      setReport(r);
      setSuppliers(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل التقرير المالي");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const paySupplier = async (supplierId: string) => {
    const amount = Number(payAmounts[supplierId]) || 0;
    if (amount <= 0) return;
    setPayingId(supplierId);
    try {
      await addSupplierPayment({ supplierId, amount, method: "نقدي", notes: "سداد من التقرير المالي الشهري" });
      await loadAll();
      setPayAmounts({ ...payAmounts, [supplierId]: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تسجيل السداد");
    } finally {
      setPayingId(null);
    }
  };

  const totalSupplierDebt = suppliers.reduce((sum, s) => sum + s.balanceDue, 0);

  return (
    <AppShell>
      <PageHeader title="التقرير المالي الشهري الشامل" subtitle="إجمالي الأرباح والخسائر ومستحقات الموردين" />

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Input value={month} onChange={(e) => setMonth(e.target.value)} type="month" className="h-10 w-44 border-border bg-input/60" />
        <Button variant="outline" className="border-border" onClick={() => window.print()}>
          <Printer className="ml-2 h-4 w-4" /> طباعة التقرير الشهري / PDF
        </Button>
      </div>

      {loading || !report ? (
        <p className="py-10 text-center text-muted-foreground">جارِ التحميل...</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="إجمالي الإيرادات والتحصيلات" value={currency(report.totalRevenue)} icon={TrendingUp} />
            <StatCard label="إجمالي المصروفات" value={currency(report.totalExpenses)} icon={TrendingDown} />
            <div className="panel relative overflow-hidden p-5">
              <div className="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">صافي الربح / الخسارة الشهري</p>
                  <p className={`mt-2 text-2xl font-extrabold ${report.netProfit >= 0 ? "text-gold-gradient" : "text-destructive"}`}>
                    {currency(report.netProfit)}
                  </p>
                </div>
                <span className="rounded-xl border border-primary/40 bg-primary/10 p-2.5">
                  <Wallet className="h-5 w-5 text-primary" />
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Panel title="🟢 الإيرادات والتحصيلات">
              <LineRow label="تحصيلات اشتراكات الطلاب" value={report.subscriptionRevenue} tone="good" />
              <LineRow label="إيرادات الشركات (ورديات الحركة اليومية)" value={report.companyRevenue} tone="good" />
              <LineRow label="إيرادات الرحلات الخارجية والنقدي" value={report.tripRevenue} tone="good" />
              <div className="mt-2 flex items-center justify-between border-t border-primary/30 pt-2 text-sm font-bold">
                <span>إجمالي الإيرادات</span>
                <span className="text-success">{currency(report.totalRevenue)}</span>
              </div>
              {report.tripRevenue === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">* إيرادات الرحلات الخارجية ستظهر هنا بعد تفعيل وحدة إدارة الرحلات.</p>
              )}
            </Panel>

            <Panel title="🔴 المصروفات والتشغيل">
              <LineRow label="بند المرتبات والأجور (سائقين وموظفين)" value={report.payrollExpense} tone="bad" />
              <LineRow label="بند أجور الصيانة والورش الخارجية" value={report.maintenanceExpense} tone="bad" />
              <LineRow label="بند قطع الغيار المسحوبة من المخزن" value={report.partsExpense} tone="bad" />
              <LineRow label="بند السولار والوقود" value={report.fuelExpense} tone="bad" />
              <LineRow label="بند المصاريف الإدارية والنثريات" value={report.adminMiscExpense} tone="bad" />
              <div className="mt-2 flex items-center justify-between border-t border-destructive/30 pt-2 text-sm font-bold">
                <span>إجمالي المصروفات</span>
                <span className="text-destructive">{currency(report.totalExpenses)}</span>
              </div>
            </Panel>
          </div>

          <Panel title="مستحقات الموردين" className="mt-5">
            <DataTable head={["اسم المورد", "إجمالي المسحوبات هذا الشهر", "إجمالي المتبقي له (دائن)", "سداد دفعة"]}>
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">لا يوجد موردون مسجلون بعد.</td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3 font-bold">{s.name}</td>
                    <td className="px-4 py-3 text-warning">{currency(s.purchasedThisMonth)}</td>
                    <td className={s.balanceDue > 0 ? "px-4 py-3 font-bold text-destructive" : "px-4 py-3 font-bold text-success"}>
                      {currency(s.balanceDue)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Input
                          value={payAmounts[s.id] ?? ""}
                          onChange={(e) => setPayAmounts({ ...payAmounts, [s.id]: e.target.value })}
                          type="number"
                          placeholder="المبلغ"
                          className="h-9 w-28 border-border bg-input/60"
                        />
                        <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => paySupplier(s.id)} disabled={payingId === s.id}>
                          {payingId === s.id ? "جارِ..." : "سداد"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </DataTable>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
              <span className="text-sm font-bold">إجمالي ديون الموردين المترتبة على الشركة</span>
              <span className="text-lg font-extrabold text-destructive">{currency(totalSupplierDebt)}</span>
            </div>
          </Panel>
        </>
      )}
    </AppShell>
  );
}
