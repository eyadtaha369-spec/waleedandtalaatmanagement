import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DataTable, PageHeader, Panel, StatusPill, Toolbar, exportToExcel } from "@/components/ui-kit";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { currency, type TreasuryEntry, type Expense, type Loan, type Payslip } from "@/lib/fleet-data";
import { fetchTreasury, fetchExpenses, fetchLoans, fetchPayroll } from "@/lib/queries";

export const Route = createFileRoute("/finance")({
  head: () => ({
    meta: [
      { title: "المالية والخزينة | وليد وطلعت" },
      { name: "description", content: "الخزينة والحسابات البنكية والمصروفات والموردين والقروض والمرتبات." },
      { property: "og:title", content: "المالية والخزينة | وليد وطلعت" },
      { property: "og:description", content: "متابعة الأرصدة اليومية والمصروفات والأقساط وكشوف المرتبات." },
    ],
  }),
  component: FinancePage,
});

function FinancePage() {
  const [treasury, setTreasury] = useState<TreasuryEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payroll, setPayroll] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [t, e, l, p] = await Promise.all([fetchTreasury(), fetchExpenses(), fetchLoans(), fetchPayroll()]);
        setTreasury(t);
        setExpenses(e);
        setLoans(l);
        setPayroll(p);
      } catch (err) {
        setError(err instanceof Error ? err.message : "تعذر تحميل البيانات");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AppShell>
      <PageHeader title="المالية والخزينة" subtitle="الخزينة، المصروفات والموردون، القروض، والمرتبات" />

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Tabs defaultValue="treasury">
        <TabsList className="no-print mb-4 flex-wrap border border-border bg-secondary/50">
          <TabsTrigger value="treasury">الخزينة والحسابات البنكية</TabsTrigger>
          <TabsTrigger value="expenses">المصروفات والموردون</TabsTrigger>
          <TabsTrigger value="loans">القروض والالتزامات</TabsTrigger>
          <TabsTrigger value="payroll">المرتبات</TabsTrigger>
        </TabsList>

        <TabsContent value="treasury">
          <Panel title="الأرصدة اليومية">
            <Toolbar
              query={query}
              onQuery={setQuery}
              placeholder="ابحث باسم الحساب..."
              onExport={() => exportToExcel("الخزينة", treasury as unknown as Record<string, string | number>[])}
            />
            <DataTable head={["التاريخ", "الحساب", "رصيد أول المدة", "إيداعات", "مسحوبات", "رصيد آخر المدة"]}>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td>
                </tr>
              ) : (
                treasury
                  .filter((t) => t.account.includes(query) || query === "")
                  .map((t) => (
                    <tr key={t.id} className="transition-colors hover:bg-secondary/30">
                      <td className="px-4 py-3">{t.date}</td>
                      <td className="px-4 py-3 font-bold">{t.account}</td>
                      <td className="px-4 py-3">{currency(t.opening)}</td>
                      <td className="px-4 py-3 text-success">{currency(t.deposits)}</td>
                      <td className="px-4 py-3 text-destructive">{currency(t.withdrawals)}</td>
                      <td className="px-4 py-3 font-bold text-primary">
                        {currency(t.opening + t.deposits - t.withdrawals)}
                      </td>
                    </tr>
                  ))
              )}
            </DataTable>
          </Panel>
        </TabsContent>

        <TabsContent value="expenses">
          <Panel title="المصروفات وأرصدة الموردين">
            <Toolbar
              query={query}
              onQuery={setQuery}
              placeholder="ابحث باسم المورد أو البند..."
              onExport={() => exportToExcel("المصروفات", expenses as unknown as Record<string, string | number>[])}
            />
            <DataTable head={["التاريخ", "البند", "المورد", "المبلغ", "رصيد المورد"]}>
              {expenses
                .filter((e) => (e.supplier + e.category).includes(query) || query === "")
                .map((e) => (
                  <tr key={e.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3">{e.date}</td>
                    <td className="px-4 py-3">
                      <StatusPill label={e.category} tone="info" />
                    </td>
                    <td className="px-4 py-3 font-bold">{e.supplier}</td>
                    <td className="px-4 py-3 text-destructive">{currency(e.amount)}</td>
                    <td className="px-4 py-3 text-warning">{currency(e.supplierBalance)}</td>
                  </tr>
                ))}
            </DataTable>
          </Panel>
        </TabsContent>

        <TabsContent value="loans">
          <Panel title="جدول سداد القروض">
            <Toolbar
              query={query}
              onQuery={setQuery}
              placeholder="ابحث باسم الجهة المقرضة..."
              onExport={() => exportToExcel("القروض", loans as unknown as Record<string, string | number>[])}
            />
            <div className="grid gap-4 lg:grid-cols-3">
              {loans
                .filter((l) => l.lender.includes(query) || query === "")
                .map((l) => {
                  const pct = l.total > 0 ? Math.round((l.paid / l.total) * 100) : 0;
                  return (
                    <div key={l.id} className="rounded-xl border border-border bg-secondary/25 p-4">
                      <h3 className="font-bold">{l.lender}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">إجمالي القرض: {currency(l.total)}</p>
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-success">المسدد {currency(l.paid)}</span>
                          <span className="text-warning">المتبقي {currency(l.total - l.paid)}</span>
                        </div>
                        <Progress value={pct} className="h-2 bg-muted" />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span>القسط الشهري: <b className="text-primary">{currency(l.installment)}</b></span>
                        <StatusPill label={`الاستحقاق ${l.nextDue}`} tone="warn" />
                      </div>
                    </div>
                  );
                })}
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="payroll">
          <Panel title="كشف المرتبات الشهري">
            <Toolbar
              query={query}
              onQuery={setQuery}
              placeholder="ابحث باسم الموظف..."
              onExport={() => exportToExcel("المرتبات", payroll as unknown as Record<string, string | number>[])}
            />
            <DataTable head={["الموظف", "الوظيفة", "الأساسي", "الإضافي", "السُلف", "الجزاءات", "الصافي"]}>
              {payroll
                .filter((p) => p.employee.includes(query) || query === "")
                .map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3 font-bold">{p.employee}</td>
                    <td className="px-4 py-3">{p.role}</td>
                    <td className="px-4 py-3">{currency(p.base)}</td>
                    <td className="px-4 py-3 text-success">{currency(p.overtime)}</td>
                    <td className="px-4 py-3 text-warning">{currency(p.advances)}</td>
                    <td className="px-4 py-3 text-destructive">{currency(p.penalties)}</td>
                    <td className="px-4 py-3 font-bold text-primary">
                      {currency(p.base + p.overtime - p.advances - p.penalties)}
                    </td>
                  </tr>
                ))}
            </DataTable>
          </Panel>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
