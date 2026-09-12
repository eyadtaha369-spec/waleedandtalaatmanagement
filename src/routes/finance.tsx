import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { currency, type TreasuryEntry, type Expense, type Loan, type Payslip } from "@/lib/fleet-data";
import {
  fetchTreasury,
  fetchExpenses,
  fetchLoans,
  fetchPayroll,
  addTreasuryEntry,
  updateTreasuryEntry,
  deleteTreasuryEntry,
  addExpense,
  updateExpense,
  deleteExpense,
  addLoan,
  updateLoan,
  deleteLoan,
  addPayslip,
  updatePayslip,
  deletePayslip,
  fetchAttendanceSummary,
} from "@/lib/queries";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

type DeleteTarget = { kind: "treasury" | "expense" | "loan" | "payslip"; id: string; label: string } | null;

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
  const [treasuryForm, setTreasuryForm] = useState({ id: "", account: "", opening: "", deposits: "", withdrawals: "" });
  const [addingExpense, setAddingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ id: "", category: "", supplier: "", amount: "", supplierBalance: "" });
  const [addingLoan, setAddingLoan] = useState(false);
  const [loanForm, setLoanForm] = useState({ id: "", lender: "", total: "", paid: "", installment: "", nextDue: "" });
  const [addingPayslip, setAddingPayslip] = useState(false);
  const [payslipForm, setPayslipForm] = useState({ id: "", employeeName: "", role: "", baseSalary: "", overtime: "", advances: "", penalties: "" });
  const [payslipMonth, setPayslipMonth] = useState(new Date().toISOString().slice(0, 7));
  const [attendanceSummary, setAttendanceSummary] = useState<{ present: number; late: number; absent: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState(false);

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

  const openAddTreasury = () => {
    setTreasuryForm({ id: "", account: "", opening: "", deposits: "", withdrawals: "" });
    setAddingTreasury(true);
  };
  const openEditTreasury = (t: TreasuryEntry) => {
    setTreasuryForm({ id: t.id, account: t.account, opening: String(t.opening), deposits: String(t.deposits), withdrawals: String(t.withdrawals) });
    setAddingTreasury(true);
  };
  const submitTreasury = async () => {
    if (!treasuryForm.account.trim()) return;
    setSaving(true);
    try {
      const payload = { account: treasuryForm.account, opening: Number(treasuryForm.opening) || 0, deposits: Number(treasuryForm.deposits) || 0, withdrawals: Number(treasuryForm.withdrawals) || 0 };
      if (treasuryForm.id) await updateTreasuryEntry(treasuryForm.id, payload);
      else await addTreasuryEntry(payload);
      await loadAll();
      setTreasuryForm({ id: "", account: "", opening: "", deposits: "", withdrawals: "" });
      setAddingTreasury(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ الرصيد");
    } finally {
      setSaving(false);
    }
  };

  const openAddExpense = () => {
    setExpenseForm({ id: "", category: "", supplier: "", amount: "", supplierBalance: "" });
    setAddingExpense(true);
  };
  const openEditExpense = (e: Expense) => {
    setExpenseForm({ id: e.id, category: e.category, supplier: e.supplier === "—" ? "" : e.supplier, amount: String(e.amount), supplierBalance: String(e.supplierBalance) });
    setAddingExpense(true);
  };
  const submitExpense = async () => {
    if (!expenseForm.category.trim()) return;
    setSaving(true);
    try {
      const payload = { category: expenseForm.category, supplier: expenseForm.supplier, amount: Number(expenseForm.amount) || 0, supplierBalance: Number(expenseForm.supplierBalance) || 0 };
      if (expenseForm.id) await updateExpense(expenseForm.id, payload);
      else await addExpense(payload);
      await loadAll();
      setExpenseForm({ id: "", category: "", supplier: "", amount: "", supplierBalance: "" });
      setAddingExpense(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ المصروف");
    } finally {
      setSaving(false);
    }
  };

  const openAddLoan = () => {
    setLoanForm({ id: "", lender: "", total: "", paid: "", installment: "", nextDue: "" });
    setAddingLoan(true);
  };
  const openEditLoan = (l: Loan) => {
    setLoanForm({ id: l.id, lender: l.lender, total: String(l.total), paid: String(l.paid), installment: String(l.installment), nextDue: l.nextDue === "—" ? "" : l.nextDue });
    setAddingLoan(true);
  };
  const submitLoan = async () => {
    if (!loanForm.lender.trim()) return;
    setSaving(true);
    try {
      const payload = { lender: loanForm.lender, total: Number(loanForm.total) || 0, paid: Number(loanForm.paid) || 0, installment: Number(loanForm.installment) || 0, nextDue: loanForm.nextDue };
      if (loanForm.id) await updateLoan(loanForm.id, payload);
      else await addLoan(payload);
      await loadAll();
      setLoanForm({ id: "", lender: "", total: "", paid: "", installment: "", nextDue: "" });
      setAddingLoan(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ القرض");
    } finally {
      setSaving(false);
    }
  };

  const loadAttendanceSummary = async () => {
    if (!payslipForm.employeeName.trim()) return;
    try {
      setAttendanceSummary(await fetchAttendanceSummary(payslipForm.employeeName, payslipMonth));
    } catch {
      setAttendanceSummary(null);
    }
  };

  const openAddPayslip = () => {
    setPayslipForm({ id: "", employeeName: "", role: "", baseSalary: "", overtime: "", advances: "", penalties: "" });
    setAttendanceSummary(null);
    setAddingPayslip(true);
  };
  const openEditPayslip = (p: Payslip) => {
    setPayslipForm({ id: p.id, employeeName: p.employee, role: p.role === "—" ? "" : p.role, baseSalary: String(p.base), overtime: String(p.overtime), advances: String(p.advances), penalties: String(p.penalties) });
    setAttendanceSummary(null);
    setAddingPayslip(true);
  };
  const submitPayslip = async () => {
    if (!payslipForm.employeeName.trim()) return;
    setSaving(true);
    try {
      const payload = { employeeName: payslipForm.employeeName, role: payslipForm.role, baseSalary: Number(payslipForm.baseSalary) || 0, overtime: Number(payslipForm.overtime) || 0, advances: Number(payslipForm.advances) || 0, penalties: Number(payslipForm.penalties) || 0 };
      if (payslipForm.id) await updatePayslip(payslipForm.id, payload);
      else await addPayslip(payload);
      await loadAll();
      setPayslipForm({ id: "", employeeName: "", role: "", baseSalary: "", overtime: "", advances: "", penalties: "" });
      setAttendanceSummary(null);
      setAddingPayslip(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ كشف المرتب");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === "treasury") await deleteTreasuryEntry(deleteTarget.id);
      else if (deleteTarget.kind === "expense") await deleteExpense(deleteTarget.id);
      else if (deleteTarget.kind === "loan") await deleteLoan(deleteTarget.id);
      else await deletePayslip(deleteTarget.id);
      await loadAll();
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الحذف");
    } finally {
      setDeleting(false);
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
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAddTreasury}>
                  <Plus className="ml-2 h-4 w-4" /> إضافة رصيد
                </Button>
              }
            />
            <DataTable head={["التاريخ", "الحساب", "رصيد أول المدة", "إيداعات", "مسحوبات", "رصيد آخر المدة", "الإجراءات"]}>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td>
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
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEditTreasury(t)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget({ kind: "treasury", id: t.id, label: `رصيد ${t.account} بتاريخ ${t.date}` })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAddExpense}>
                  <Plus className="ml-2 h-4 w-4" /> إضافة مصروف
                </Button>
              }
            />
            <DataTable head={["التاريخ", "البند", "المورد", "المبلغ", "رصيد المورد", "الإجراءات"]}>
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
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEditExpense(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget({ kind: "expense", id: e.id, label: `مصروف ${e.category}` })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
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
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAddLoan}>
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
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold">{l.lender}</h3>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-primary hover:bg-primary/10" onClick={() => openEditLoan(l)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget({ kind: "loan", id: l.id, label: `قرض ${l.lender}` })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
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
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAddPayslip}>
                  <Plus className="ml-2 h-4 w-4" /> إضافة كشف مرتب
                </Button>
              }
            />
            <DataTable head={["الموظف", "الوظيفة", "الأساسي", "الإضافي", "السُلف", "الجزاءات", "الصافي", "الإجراءات"]}>
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
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEditPayslip(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget({ kind: "payslip", id: p.id, label: `كشف مرتب ${p.employee}` })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
            <DialogTitle className="text-primary">{treasuryForm.id ? "تعديل رصيد يومي" : "إضافة رصيد يومي"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">أدخل بيانات الحساب لليوم</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {[
              ["account", "اسم الحساب"],
              ["opening", "رصيد أول المدة (للحساب الجديد فقط — يُحسب تلقائيًا بعد أول سجل)", "number"],
              ["deposits", "إيداعات", "number"],
              ["withdrawals", "مسحوبات", "number"],
            ].map(([key, label, type]) => (
              <div key={key} className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  value={treasuryForm[key as keyof typeof treasuryForm]}
                  onChange={(e) => setTreasuryForm({ ...treasuryForm, [key]: e.target.value })}
                  type={type || "text"}
                  className="border-border bg-input/60"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitTreasury} disabled={saving}>
              {saving ? "جارِ الحفظ..." : treasuryForm.id ? "حفظ التعديلات" : "حفظ الرصيد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addingExpense} onOpenChange={setAddingExpense}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{expenseForm.id ? "تعديل المصروف" : "إضافة مصروف"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">أدخل بيانات المصروف والمورد</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">البند</Label>
              <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm({ ...expenseForm, category: v })}>
                <SelectTrigger className="border-border bg-input/60">
                  <SelectValue placeholder="اختر البند" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="غاز">غاز</SelectItem>
                  <SelectItem value="قطع غيار">قطع غيار</SelectItem>
                  <SelectItem value="موردين">موردين</SelectItem>
                  <SelectItem value="مرتبات">مرتبات</SelectItem>
                  <SelectItem value="إداريات">إداريات</SelectItem>
                  <SelectItem value="مصاريف خارجية">مصاريف خارجية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {[
              ["supplier", "المورد"],
              ["amount", "المبلغ", "number"],
              ["supplierBalance", "رصيد المورد بعد الدفع", "number"],
            ].map(([key, label, type]) => (
              <div key={key} className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  value={expenseForm[key as keyof typeof expenseForm]}
                  onChange={(e) => setExpenseForm({ ...expenseForm, [key]: e.target.value })}
                  type={type || "text"}
                  className="border-border bg-input/60"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitExpense} disabled={saving}>
              {saving ? "جارِ الحفظ..." : expenseForm.id ? "حفظ التعديلات" : "حفظ المصروف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addingLoan} onOpenChange={setAddingLoan}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{loanForm.id ? "تعديل القرض" : "إضافة قرض"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">أدخل بيانات القرض والجهة المقرضة</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {[
              ["lender", "الجهة المقرضة"],
              ["total", "إجمالي القرض", "number"],
              ["paid", "المسدد حتى الآن", "number"],
              ["installment", "القسط الشهري", "number"],
              ["nextDue", "تاريخ الاستحقاق القادم (YYYY-MM-DD)", "date"],
            ].map(([key, label, type]) => (
              <div key={key} className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  value={loanForm[key as keyof typeof loanForm]}
                  onChange={(e) => setLoanForm({ ...loanForm, [key]: e.target.value })}
                  type={type || "text"}
                  className="border-border bg-input/60"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitLoan} disabled={saving}>
              {saving ? "جارِ الحفظ..." : loanForm.id ? "حفظ التعديلات" : "حفظ القرض"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addingPayslip} onOpenChange={setAddingPayslip}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{payslipForm.id ? "تعديل كشف المرتب" : "إضافة كشف مرتب"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">أدخل بيانات الموظف والمرتب لهذا الشهر</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {[
              ["employeeName", "اسم الموظف"],
              ["role", "الوظيفة"],
            ].map(([key, label, type]) => (
              <div key={key} className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  value={payslipForm[key as keyof typeof payslipForm]}
                  onChange={(e) => setPayslipForm({ ...payslipForm, [key]: e.target.value })}
                  type={type || "text"}
                  className="border-border bg-input/60"
                />
              </div>
            ))}
            <div className="grid grid-cols-[1fr_auto] items-end gap-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">شهر الحضور (YYYY-MM)</Label>
                <Input value={payslipMonth} onChange={(e) => setPayslipMonth(e.target.value)} className="border-border bg-input/60" />
              </div>
              <Button type="button" variant="outline" className="border-border" onClick={loadAttendanceSummary}>
                عرض الحضور
              </Button>
            </div>
            {attendanceSummary && (
              <p className="rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
                حاضر: <b className="text-success">{attendanceSummary.present}</b> يوم • متأخر:{" "}
                <b className="text-warning">{attendanceSummary.late}</b> يوم • غائب:{" "}
                <b className="text-destructive">{attendanceSummary.absent}</b> يوم — استخدم هذه البيانات لتحديد الجزاءات
              </p>
            )}
            {[
              ["baseSalary", "الأساسي", "number"],
              ["overtime", "الإضافي", "number"],
              ["advances", "السُلف", "number"],
              ["penalties", "الجزاءات", "number"],
            ].map(([key, label, type]) => (
              <div key={key} className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  value={payslipForm[key as keyof typeof payslipForm]}
                  onChange={(e) => setPayslipForm({ ...payslipForm, [key]: e.target.value })}
                  type={type || "text"}
                  className="border-border bg-input/60"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitPayslip} disabled={saving}>
              {saving ? "جارِ الحفظ..." : payslipForm.id ? "حفظ التعديلات" : "حفظ الكشف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="glass text-foreground" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              سيتم حذف {deleteTarget?.label} نهائيًا. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "جارِ الحذف..." : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
