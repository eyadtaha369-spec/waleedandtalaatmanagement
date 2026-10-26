import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, X, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { PaymentSourceSelect } from "@/components/payment-source-select";
import { AppShell } from "@/components/app-shell";
import { DataTable, PageHeader, Panel, StatCard, StatusPill, Toolbar, exportToExcel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountPicker } from "@/components/account-picker";
import { PersonPicker, type PersonOption } from "@/components/person-picker";
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
import { currency, type TreasuryEntry, type Expense, type Loan } from "@/lib/fleet-data";
import {
  fetchTreasury,
  fetchTreasurySummary,
  type TreasurySummary,
  fetchExpenses,
  fetchLoans,
  addTreasuryEntry,
  updateTreasuryEntry,
  deleteTreasuryEntry,
  addExpense,
  updateExpense,
  deleteExpense,
  addLoan,
  updateLoan,
  deleteLoan,
  fetchClients,
  fetchSuppliers,
  fetchDrivers,
  fetchEmployees,
  fetchRentedOps,
  fetchRentedAdvances,
  listRentedVehicles,
  rentedVehicleKey,
  RENTED_EXPENSE_CATEGORY,
  PAY_FROM_OPTIONS,
  type Client,
  type Supplier,
} from "@/lib/queries";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/finance")({
  head: () => ({
    meta: [
      { title: "المالية والخزينة | وليد وطلعت" },
      { name: "description", content: "الخزينة والحسابات البنكية والمصروفات والموردين والقروض." },
      { property: "og:title", content: "المالية والخزينة | وليد وطلعت" },
      { property: "og:description", content: "متابعة الأرصدة اليومية والمصروفات والأقساط." },
    ],
  }),
  component: FinancePage,
});

const todayStr = () => new Date().toISOString().slice(0, 10);

type DeleteTarget = { kind: "treasury" | "expense" | "loan"; id: string; label: string } | null;

function FinancePage() {
  const [treasury, setTreasury] = useState<TreasuryEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const [addingTreasury, setAddingTreasury] = useState(false);
  const emptyTreasury = () => ({ id: "", date: todayStr(), account: "", clientId: "", opening: "", deposits: "", withdrawals: "", notes: "" });
  const [treasuryForm, setTreasuryForm] = useState(emptyTreasury);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [peopleOpts, setPeopleOpts] = useState<PersonOption[]>([]);
  const [rentedOpts, setRentedOpts] = useState<PersonOption[]>([]);
  const [rentedByExpense, setRentedByExpense] = useState<Record<string, string>>({});
  const [addingExpense, setAddingExpense] = useState(false);
  const emptyExpense = () => ({ id: "", date: todayStr(), category: "", supplierId: "", description: "", notes: "", payFrom: "", amount: "", rentedVehicle: "", subjectKey: "" });
  const [expenseForm, setExpenseForm] = useState(emptyExpense);
  const [addingLoan, setAddingLoan] = useState(false);
  const emptyLoan = () => ({ id: "", lender: "", total: "", installments: [{ amount: "", dueDate: "" }] as { amount: string; dueDate: string }[] });
  const [loanForm, setLoanForm] = useState(emptyLoan);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState(false);

  const [summary, setSummary] = useState<TreasurySummary | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, e, l, c, sp, sum] = await Promise.all([fetchTreasury(), fetchExpenses(), fetchLoans(), fetchClients(), fetchSuppliers(), fetchTreasurySummary({ from: "2000-01-01", to: "2100-01-01" })]);
      try {
        const [d, em] = await Promise.all([fetchDrivers(), fetchEmployees()]);
        setPeopleOpts([...d.map((x) => ({ value: `driver:${x.id}`, label: x.name, group: "سائق" })), ...em.filter((x) => x.isActive).map((x) => ({ value: `employee:${x.id}`, label: x.name, group: "موظف" }))]);
      } catch {
        /* the people picker stays empty */
      }
      try {
        const [rops, radv] = await Promise.all([fetchRentedOps(), fetchRentedAdvances()]);
        setRentedOpts(listRentedVehicles(rops, radv).map((v) => ({ value: v.value, label: v.label, group: v.group })));
        setRentedByExpense(Object.fromEntries(radv.filter((a) => a.sourceTable === "expenses").map((a) => [a.sourceId, rentedVehicleKey(a.owner, a.bus)])));
      } catch {
        /* the vehicle picker stays empty; the rest of the page still works */
      }
      setSummary(sum);
      setClients(c);
      setSuppliers(sp);
      setTreasury(t);
      setExpenses(e);
      setLoans(l);
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
    setTreasuryForm(emptyTreasury());
    setAddingTreasury(true);
  };
  const openEditTreasury = (t: TreasuryEntry) => {
    setTreasuryForm({ id: t.id, date: t.date, account: t.account, clientId: t.clientId, opening: String(t.opening), deposits: String(t.deposits), withdrawals: String(t.withdrawals), notes: t.notes });
    setAddingTreasury(true);
  };
  const submitTreasury = async () => {
    if (!treasuryForm.account.trim()) return setError("اختر اسم الحساب / الشركة");
    setSaving(true);
    setError(null);
    try {
      const payload = {
        date: treasuryForm.date,
        account: treasuryForm.account.trim(),
        clientId: treasuryForm.clientId,
        opening: Number(treasuryForm.opening) || 0,
        deposits: Number(treasuryForm.deposits) || 0,
        withdrawals: Number(treasuryForm.withdrawals) || 0,
        notes: treasuryForm.notes,
      };
      if (treasuryForm.id) await updateTreasuryEntry(treasuryForm.id, payload);
      else await addTreasuryEntry(payload);
      await loadAll();
      setAddingTreasury(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "تعذر حفظ الرصيد");
    } finally {
      setSaving(false);
    }
  };

  const openAddExpense = () => {
    setExpenseForm(emptyExpense());
    setAddingExpense(true);
  };
  const openEditExpense = (e: Expense) => {
    setExpenseForm({ id: e.id, date: e.date, category: e.category, supplierId: e.supplierId, description: e.description, notes: e.notes, payFrom: e.payFrom, amount: String(e.amount), rentedVehicle: rentedByExpense[e.id] ?? "", subjectKey: e.subjectKey ?? "" });
    setAddingExpense(true);
  };
  const submitExpense = async () => {
    if (!expenseForm.category.trim()) return setError("اختر البند");
    if (expenseForm.category === RENTED_EXPENSE_CATEGORY && !expenseForm.rentedVehicle) return setError("اختر السيارة المستأجرة");
    if (expenseForm.category === "مرتبات" && !expenseForm.subjectKey) return setError("اختر السائق أو الموظف صاحب السلفة / المرتب");
    if (!(Number(expenseForm.amount) > 0)) return setError("أدخل مبلغ المصروف");
    if (!expenseForm.payFrom) return setError("اختر طريقة الصرف / صُرفت من");
    setSaving(true);
    setError(null);
    try {
      const payload = {
        date: expenseForm.date,
        category: expenseForm.category,
        supplierId: expenseForm.supplierId === "__none" ? "" : expenseForm.supplierId,
        description: expenseForm.description,
        notes: expenseForm.notes,
        payFrom: expenseForm.payFrom,
        amount: Number(expenseForm.amount) || 0,
        rentedVehicle: expenseForm.category === RENTED_EXPENSE_CATEGORY ? expenseForm.rentedVehicle : "",
        subjectKey: expenseForm.category === "مرتبات" ? expenseForm.subjectKey : "",
      };
      if (expenseForm.id) await updateExpense(expenseForm.id, payload);
      else await addExpense(payload);
      await loadAll();
      setAddingExpense(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "تعذر حفظ المصروف");
    } finally {
      setSaving(false);
    }
  };

  const openAddLoan = () => {
    setLoanForm(emptyLoan());
    setAddingLoan(true);
  };
  const openEditLoan = (l: Loan) => {
    setLoanForm({
      id: l.id,
      lender: l.lender,
      total: String(l.total),
      installments: l.installments.length ? l.installments.map((i) => ({ amount: String(i.amount), dueDate: i.dueDate })) : [{ amount: "", dueDate: "" }],
    });
    setAddingLoan(true);
  };
  const submitLoan = async () => {
    if (!loanForm.lender.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        lender: loanForm.lender,
        total: Number(loanForm.total) || 0,
        installments: loanForm.installments.map((i) => ({ amount: Number(i.amount) || 0, dueDate: i.dueDate })),
      };
      if (loanForm.id) await updateLoan(loanForm.id, payload);
      else await addLoan(payload);
      await loadAll();
      setAddingLoan(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "تعذر حفظ القرض");
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
      else await deleteLoan(deleteTarget.id);
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
      <PageHeader title="المالية والخزينة" subtitle="الخزينة، المصروفات والموردون، والقروض" />
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
        <span>الإغلاق المالي الشهري صار لكل قسم على حدة: شركات، مرتبات، موردين، ورشة، سولار، وخزينة وعهدة.</span>
        <Link to="/closing" className="rounded-lg bg-primary px-3 py-1.5 font-bold text-primary-foreground">فتح لوحة الإغلاق المالي الشهري 🔒</Link>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="no-print mb-4 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
        <span>المرتبات والأجور (سائقين وموظفين) في صفحة واحدة موحَّدة.</span>
        <Link to="/payroll" className="rounded-lg bg-primary px-3 py-1.5 font-bold text-primary-foreground">فتح صفحة المرتبات والأجور ←</Link>
      </div>
      <div className="no-print mb-4 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
        <span>عهدة الخزينة: تغذية العهدة وصرف المصروفات منها مع تقارير يومية وأسبوعية وشهرية.</span>
        <Link to="/custody" className="rounded-lg bg-primary px-3 py-1.5 font-bold text-primary-foreground">فتح عهدة الخزينة ←</Link>
      </div>

      <Tabs defaultValue="treasury">
        <TabsList className="no-print mb-4 flex-wrap border border-border bg-secondary/50">
          <TabsTrigger value="treasury">الخزينة والحسابات البنكية</TabsTrigger>
          <TabsTrigger value="expenses">المصروفات والموردون</TabsTrigger>
          <TabsTrigger value="loans">أقساط والتزامات وقروض</TabsTrigger>
        </TabsList>

        <TabsContent value="treasury">
          {summary && (
            <Panel title="ملخص الخزينة المجمّع (كل الفترات)" className="mb-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="إجمالي الإيرادات والتحصيلات" value={currency(summary.totalRevenue)} icon={TrendingUp} />
                <StatCard label="(-) إجمالي المصروفات والتشغيل" value={currency(summary.totalExpenses)} hint="شامل المرتبات والصيانة والنثريات وقطع الغيار" icon={TrendingDown} />
                <StatCard label="(-) إجمالي حساب السولار" value={currency(summary.fuelExpense)} hint="مستقل" icon={TrendingDown} />
                <StatCard label="(=) الصافي الفعلي المتبقي" value={currency(summary.netProfit)} hint="الإيرادات − المصروفات − السولار" icon={Wallet} />
              </div>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                {([
                  ["تحصيل اشتراكات الطلاب", summary.subscriptionRevenue, "good"],
                  ["إيرادات الشركات (ورديات الحركة)", summary.companyRevenue, "good"],
                  ["إيرادات الرحلات الخارجية", summary.tripRevenue, "good"],
                  ["المرتبات والأجور", summary.payrollExpense, "bad"],
                  ["الصيانة والورش الخارجية", summary.maintenanceExpense, "bad"],
                  ["قطع الغيار من المخزن", summary.partsExpense, "bad"],
                  ["المصاريف الإدارية والنثريات", summary.adminMiscExpense, "bad"],
                  ["مصروفات الاشتراكات والخطوط", summary.subscriptionExpense, "bad"],
                  ["تكلفة تأجير السيارات المستأجرة", summary.rentedExpense, "bad"],
                  ["إجمالي حساب السولار والوقود", summary.fuelExpense, "bad"],
                ] as const).map(([label, value, tone]) => (
                  <div key={label} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={tone === "good" ? "font-bold text-emerald-500" : "font-bold text-destructive"}>{currency(value)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">محسوبة مباشرة من سجلات الطلاب والمدفوعات والورديات والرحلات والمصروفات، وتتحدث تلقائيًا مع كل عملية.</p>
            </Panel>
          )}
          <Panel title="الأرصدة اليومية">
            <Toolbar
              query={query}
              onQuery={setQuery}
              placeholder="ابحث باسم الحساب أو الشركة..."
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
                      <td className="px-4 py-3 font-bold">
                        {t.account}
                        {t.isRollover && <span className="mr-2 text-xs font-normal text-primary">(ترحيل أول الشهر)</span>}
                        {t.notes && !t.isRollover && <span className="block text-xs font-normal text-muted-foreground">{t.notes}</span>}
                      </td>
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
            <DataTable head={["التاريخ", "البند", "البيان", "المورد", "صُرفت من", "المبلغ", "رصيد المورد الحالي", "الإجراءات"]}>
              {expenses
                .filter((e) => (e.supplier + e.category + e.description).includes(query) || query === "")
                .map((e) => (
                  <tr key={e.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3">{e.date}</td>
                    <td className="px-4 py-3">
                      <StatusPill label={e.category} tone="info" />
                    </td>
                    <td className="px-4 py-3">
                      {e.description || "—"}
                      {e.notes && <span className="block text-xs text-muted-foreground">{e.notes}</span>}
                    </td>
                    <td className="px-4 py-3 font-bold">{e.supplier}</td>
                    <td className="px-4 py-3 text-xs">{e.payFrom || "—"}</td>
                    <td className="px-4 py-3 text-destructive">{currency(e.amount)}</td>
                    <td className="px-4 py-3 text-warning">{e.supplierId ? currency(e.supplierBalance) : "—"}</td>
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
          <Panel title="أقساط والتزامات وقروض">
            <Toolbar
              query={query}
              onQuery={setQuery}
              placeholder="ابحث باسم الجهة المقرضة..."
              onExport={() => exportToExcel("القروض", loans as unknown as Record<string, string | number>[])}
              extra={
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAddLoan}>
                  <Plus className="ml-2 h-4 w-4" /> إضافة قسط / قرض
                </Button>
              }
            />
            <div className="grid gap-4 lg:grid-cols-3">
              {loans
                .filter((l) => l.lender.includes(query) || query === "")
                .map((l) => (
                  <div key={l.id} className="rounded-xl border border-border bg-secondary/25 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold">{l.lender}</h3>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-11 w-11 p-0 text-primary sm:h-7 sm:w-7 hover:bg-primary/10" onClick={() => openEditLoan(l)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-11 w-11 p-0 text-destructive sm:h-7 sm:w-7 hover:bg-destructive/10"
                          onClick={() => setDeleteTarget({ kind: "loan", id: l.id, label: `التزام ${l.lender}` })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">الإجمالي: {currency(l.total)}</p>
                    <ul className="mt-3 space-y-1 text-sm">
                      {l.installments.length === 0 && <li className="text-muted-foreground">لم تُسجَّل أقساط بعد.</li>}
                      {l.installments.map((i) => (
                        <li key={i.id} className="flex items-center justify-between rounded-md border border-border bg-card/60 px-2 py-1">
                          <span>{i.dueDate}</span>
                          <b className="text-primary">{currency(i.amount)}</b>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span>القسط القادم: <b className="text-primary">{currency(l.installment)}</b></span>
                      <StatusPill label={`الاستحقاق ${l.nextDue}`} tone="warn" />
                    </div>
                  </div>
                ))}
            </div>
          </Panel>
        </TabsContent>
      </Tabs>

      <Dialog open={addingTreasury} onOpenChange={setAddingTreasury}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{treasuryForm.id ? "تعديل رصيد" : "إضافة رصيد"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              عند اختيار شركة، يُرحَّل الإيداع تلقائيًا إلى كشف حسابها بعنوان «تم الاستحقاق ش [التاريخ]». الأرصدة المتبقية تُرحَّل تلقائيًا أول كل شهر.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">اسم الحساب / الشركة</Label>
              <AccountPicker value={treasuryForm.account} clients={clients} onPick={(name, clientId) => setTreasuryForm({ ...treasuryForm, account: name, clientId })} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">تاريخ إضافة الرصيد</Label>
              <Input value={treasuryForm.date} onChange={(e) => setTreasuryForm({ ...treasuryForm, date: e.target.value })} type="date" className="border-border bg-input/60" />
            </div>
            {[
              ["opening", "رصيد أول المدة (للحساب الجديد فقط — يُحسب تلقائيًا بعد أول سجل)", "number"],
              ["deposits", "إيداعات", "number"],
              ["withdrawals", "مسحوبات", "number"],
              ["notes", "ملاحظات"],
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
        <DialogContent className="glass max-h-[90vh] overflow-y-auto text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{expenseForm.id ? "تعديل المصروف" : "إضافة مصروف"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              يُخصم المبلغ تلقائيًا من الحساب المختار، وعند اختيار مورد يُسجَّل كدفعة ويقل رصيده المستحق.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">التاريخ</Label>
                <Input value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} type="date" className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">البند</Label>
                <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm({ ...expenseForm, category: v })}>
                  <SelectTrigger className="border-border bg-input/60"><SelectValue placeholder="اختر البند" /></SelectTrigger>
                  <SelectContent>
                    {["غاز", "قطع غيار", "موردين", "مرتبات", "إداريات", RENTED_EXPENSE_CATEGORY, "مصاريف خارجية"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {expenseForm.category === "مرتبات" && (
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">السائق / الموظف</Label>
                <PersonPicker value={expenseForm.subjectKey} options={peopleOpts} onChange={(v) => setExpenseForm({ ...expenseForm, subjectKey: v })} placeholder="ابحث عن سائق أو موظف" />
                <p className="text-xs text-muted-foreground">يُخصم المبلغ من مصدر الصرف المختار ويُسجَّل تلقائيًا كسلفة في مرتب الشخص بصفحة المرتبات.</p>
              </div>
            )}
            {expenseForm.category === RENTED_EXPENSE_CATEGORY && (
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">اختيار السيارة المستأجرة</Label>
                <PersonPicker value={expenseForm.rentedVehicle} options={rentedOpts} onChange={(v) => setExpenseForm({ ...expenseForm, rentedVehicle: v })} placeholder="ابحث عن سيارة مستأجرة أو مالك" />
                <p className="text-xs text-muted-foreground">يُرحَّل المبلغ تلقائيًا كدفعة تحت الحساب في كشف حساب هذه السيارة.</p>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">البيان</Label>
              <Input value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} className="border-border bg-input/60" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">ملاحظات</Label>
              <Input value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} className="border-border bg-input/60" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">المورد (اختياري)</Label>
                <Select value={expenseForm.supplierId || "__none"} onValueChange={(v) => setExpenseForm({ ...expenseForm, supplierId: v === "__none" ? "" : v })}>
                  <SelectTrigger className="border-border bg-input/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">بدون مورد</SelectItem>
                    {suppliers.map((sp) => <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <PaymentSourceSelect value={expenseForm.payFrom} onChange={(v) => setExpenseForm({ ...expenseForm, payFrom: v })} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">المبلغ</Label>
              <Input value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} type="number" min="0" step="any" className="border-border bg-input/60" />
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitExpense} disabled={saving}>
              {saving ? "جارِ الحفظ..." : expenseForm.id ? "حفظ التعديلات" : "حفظ المصروف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addingLoan} onOpenChange={setAddingLoan}>
        <DialogContent className="glass max-h-[90vh] overflow-y-auto text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{loanForm.id ? "تعديل الالتزام" : "إضافة قسط / التزام / قرض"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              أضف كل قسط بمبلغه وتاريخه. يصلك تنبيه آخر كل شهر بأقساط الشهر التالي.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">الجهة المقرضة / الالتزام</Label>
              <Input value={loanForm.lender} onChange={(e) => setLoanForm({ ...loanForm, lender: e.target.value })} className="border-border bg-input/60" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">الإجمالي</Label>
              <Input value={loanForm.total} onChange={(e) => setLoanForm({ ...loanForm, total: e.target.value })} type="number" min="0" step="any" className="border-border bg-input/60" />
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="mb-2 text-xs font-bold text-primary">الأقساط</p>
              <div className="space-y-2">
                {loanForm.installments.map((inst, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                    <div className="grid gap-1">
                      <Label className="text-xs text-muted-foreground">مبلغ القسط</Label>
                      <Input
                        value={inst.amount}
                        onChange={(e) => setLoanForm({ ...loanForm, installments: loanForm.installments.map((x, i) => (i === idx ? { ...x, amount: e.target.value } : x)) })}
                        type="number" min="0" step="any" className="border-border bg-input/60"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-xs text-muted-foreground">تاريخ القسط</Label>
                      <Input
                        value={inst.dueDate}
                        onChange={(e) => setLoanForm({ ...loanForm, installments: loanForm.installments.map((x, i) => (i === idx ? { ...x, dueDate: e.target.value } : x)) })}
                        type="date" className="border-border bg-input/60"
                      />
                    </div>
                    <Button type="button" size="sm" variant="ghost" className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => setLoanForm({ ...loanForm, installments: loanForm.installments.length > 1 ? loanForm.installments.filter((_, i) => i !== idx) : [{ amount: "", dueDate: "" }] })}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <button type="button" className="mt-2 text-sm text-primary hover:underline" onClick={() => setLoanForm({ ...loanForm, installments: [...loanForm.installments, { amount: "", dueDate: "" }] })}>
                + إضافة قسط
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitLoan} disabled={saving}>
              {saving ? "جارِ الحفظ..." : loanForm.id ? "حفظ التعديلات" : "حفظ"}
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
