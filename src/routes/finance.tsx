import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DataTable, PageHeader, Panel, StatusPill, Toolbar, exportToExcel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { currency, type TreasuryEntry, type Expense, type Loan, type Payslip } from "@/lib/fleet-data";
import {
  fetchTreasury,
  fetchExpenses,
  fetchLoans,
  fetchPayroll,
  addTreasuryEntry,
  addExpense,
  addLoan,
  addPayslip,
} from "@/lib/queries";

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
  const [saving, setSaving] = useState(false);

  const [addingTreasury, setAddingTreasury] = useState(false);
  const [treasuryForm, setTreasuryForm] = useState({ account: "", opening: "", deposits: "", withdrawals: "" });
  const [addingExpense, setAddingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ category: "", supplier: "", amount: "", supplierBalance: "" });
  const [addingLoan, setAddingLoan] = useState(false);
  const [loanForm, setLoanForm] = useState({ lender: "", total: "", paid: "", installment: "", nextDue: "" });
  const [addingPayslip, setAddingPayslip] = useState(false);
  const [payslipForm, setPayslipForm] = useState({ employeeName: "", role: "", baseSalary: "", overtime: "", advances: "", penalties: "" });

  const loadAll = async () => {
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
  };

  useEffect(() => {
    loadAll();
  }, []);

  const submitTreasury = async () => {
    if (!treasuryForm.account.trim()) return;
    setSaving(true);
    try {
      await addTreasuryEntry({
        account: treasuryForm.account,
        opening: Number(treasuryForm.opening) || 0,
        deposits: Number(treasuryForm.deposits) || 0,
        withdrawals: Number(treasuryForm.withdrawals) || 0,
      });
      await loadAll();
      setTreasuryForm({ account: "", opening: "", deposits: "", withdrawals: "" });
      setAddingTreasury(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إضافة الرصيد");
    } finally {
      setSaving(false);
    }
  };

  const submitExpense = async () => {
    if (!expenseForm.category.trim()) return;
    setSaving(true);
    try {
      await addExpense({
        category: expenseForm.category,
        supplier: expenseForm.supplier,
        amount: Number(expenseForm.amount) || 0,
        supplierBalance: Number(expenseForm.supplierBalance) || 0,
      });
      await loadAll();
      setExpenseForm({ category: "", supplier: "", amount: "", supplierBalance: "" });
      setAddingExpense(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إضافة المصروف");
    } finally {
      setSaving(false);
    }
  };

  const submitLoan = async () => {
    if (!loanForm.lender.trim()) return;
    setSaving(true);
    try {
      await addLoan({
        lender: loanForm.lender,
        total: Number(loanForm.total) || 0,
        paid: Number(loanForm.paid) || 0,
        installment: Number(loanForm.installment) || 0,
        nextDue: loanForm.nextDue,
      });
      await loadAll();
      setLoanForm({ lender: "", total: "", paid: "", installment: "", nextDue: "" });
      setAddingLoan(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إضافة القرض");
    } finally {
      setSaving(false);
    }
  };

  const submitPayslip = async () => {
    if (!payslipForm.employeeName.trim()) return;
    setSaving(true);
    try {
      await addPayslip({
        employeeName: payslipForm.employeeName,
        role: payslipForm.role,
        baseSalary: Number(payslipForm.baseSalary) || 0,
        overtime: Number(payslipForm.overtime) || 0,
        advances: Number(payslipForm.advances) || 0,
        penalties: Number(payslipForm.penalties) || 0,
      });
      await loadAll();
      setPayslipForm({ employeeName: "", role: "", baseSalary: "", overtime: "", advances: "", penalties: "" });
      setAddingPayslip(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إضافة كشف المرتب");
    } finally {
      setSaving(false);
    }
  };

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
              extra={
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setAddingTreasury(true)}>
                  <Plus className="ml-2 h-4 w-4" /> إضافة رصيد
                </Button>
              }
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
              extra={
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setAddingExpense(true)}>
                  <Plus className="ml-2 h-4 w-4" /> إضافة مصروف
                </Button>
              }
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
              extra={
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setAddingLoan(true)}>
                  <Plus className="ml-2 h-4 w-4" /> إضافة قرض
                </Button>
              }
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
              extra={
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setAddingPayslip(true)}>
                  <Plus className="ml-2 h-4 w-4" /> إضافة كشف مرتب
                </Button>
              }
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

      <Dialog open={addingTreasury} onOpenChange={setAddingTreasury}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">إضافة رصيد يومي</DialogTitle>
            <DialogDescription className="text-muted-foreground">أدخل بيانات الحساب لليوم</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {[
              ["account", "اسم الحساب"],
              ["opening", "رصيد أول المدة"],
              ["deposits", "إيداعات"],
              ["withdrawals", "مسحوبات"],
            ].map(([key, label]) => (
              <div key={key} className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  value={treasuryForm[key as keyof typeof treasuryForm]}
                  onChange={(e) => setTreasuryForm({ ...treasuryForm, [key]: e.target.value })}
                  className="border-border bg-input/60"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitTreasury} disabled={saving}>
              {saving ? "جارِ الحفظ..." : "حفظ الرصيد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addingExpense} onOpenChange={setAddingExpense}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">إضافة مصروف</DialogTitle>
            <DialogDescription className="text-muted-foreground">أدخل بيانات المصروف والمورد</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {[
              ["category", "البند (مثال: قطع غيار)"],
              ["supplier", "المورد"],
              ["amount", "المبلغ"],
              ["supplierBalance", "رصيد المورد بعد الدفع"],
            ].map(([key, label]) => (
              <div key={key} className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  value={expenseForm[key as keyof typeof expenseForm]}
                  onChange={(e) => setExpenseForm({ ...expenseForm, [key]: e.target.value })}
                  className="border-border bg-input/60"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitExpense} disabled={saving}>
              {saving ? "جارِ الحفظ..." : "حفظ المصروف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addingLoan} onOpenChange={setAddingLoan}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">إضافة قرض</DialogTitle>
            <DialogDescription className="text-muted-foreground">أدخل بيانات القرض والجهة المقرضة</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {[
              ["lender", "الجهة المقرضة"],
              ["total", "إجمالي القرض"],
              ["paid", "المسدد حتى الآن"],
              ["installment", "القسط الشهري"],
              ["nextDue", "تاريخ الاستحقاق القادم (YYYY-MM-DD)"],
            ].map(([key, label]) => (
              <div key={key} className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  value={loanForm[key as keyof typeof loanForm]}
                  onChange={(e) => setLoanForm({ ...loanForm, [key]: e.target.value })}
                  className="border-border bg-input/60"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitLoan} disabled={saving}>
              {saving ? "جارِ الحفظ..." : "حفظ القرض"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addingPayslip} onOpenChange={setAddingPayslip}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">إضافة كشف مرتب</DialogTitle>
            <DialogDescription className="text-muted-foreground">أدخل بيانات الموظف والمرتب لهذا الشهر</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {[
              ["employeeName", "اسم الموظف"],
              ["role", "الوظيفة"],
              ["baseSalary", "الأساسي"],
              ["overtime", "الإضافي"],
              ["advances", "السُلف"],
              ["penalties", "الجزاءات"],
            ].map(([key, label]) => (
              <div key={key} className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  value={payslipForm[key as keyof typeof payslipForm]}
                  onChange={(e) => setPayslipForm({ ...payslipForm, [key]: e.target.value })}
                  className="border-border bg-input/60"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitPayslip} disabled={saving}>
              {saving ? "جارِ الحفظ..." : "حفظ الكشف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
