import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Printer } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DataTable, PageHeader, Panel, StatusPill, Toolbar, exportToExcel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { currency } from "@/lib/fleet-data";
import {
  fetchClientLedger,
  fetchClientStatement,
  computeRunningBalance,
  addLedgerTransaction,
  type ClientLedgerRow,
  type LedgerEntry,
} from "@/lib/queries";

export const Route = createFileRoute("/ledger")({
  head: () => ({
    meta: [{ title: "كشف حساب المديونيات | وليد وطلعت" }],
  }),
  component: LedgerPage,
});

function LedgerPage() {
  const [rows, setRows] = useState<ClientLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ studentName: "", type: "مدين" as "مدين" | "دائن", amount: "", method: "نقدي", notes: "" });

  const [statementFor, setStatementFor] = useState<ClientLedgerRow | null>(null);
  const [statement, setStatement] = useState<(LedgerEntry & { runningBalance: number })[]>([]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchClientLedger());
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل بيانات المديونيات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const openStatement = async (row: ClientLedgerRow) => {
    setStatementFor(row);
    try {
      const entries = await fetchClientStatement(row.id);
      setStatement(computeRunningBalance(entries));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل كشف الحساب");
    }
  };

  const submit = async () => {
    if (!form.studentName.trim() || !form.amount.trim()) return;
    setSaving(true);
    try {
      await addLedgerTransaction({
        studentName: form.studentName,
        type: form.type,
        amount: Number(form.amount) || 0,
        method: form.method,
        notes: form.notes,
      });
      await loadAll();
      setForm({ studentName: "", type: "مدين", amount: "", method: "نقدي", notes: "" });
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تسجيل الحركة");
    } finally {
      setSaving(false);
    }
  };

  const filtered = rows.filter((r) => (r.name + r.phone).includes(query) || query === "");

  return (
    <AppShell>
      <PageHeader title="كشف حساب المديونيات للعملاء والطلاب" subtitle="حركات المدين والدائن اليومية ورصيد كل عميل" />

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Panel title="ملخص المديونيات">
        <Toolbar
          query={query}
          onQuery={setQuery}
          placeholder="ابحث بالاسم أو رقم الهاتف..."
          onExport={() => exportToExcel("تقرير المديونيات", filtered as unknown as Record<string, string | number>[])}
          extra={
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setAdding(true)}>
              <Plus className="ml-2 h-4 w-4" /> تسجيل حركة
            </Button>
          }
        />
        <DataTable head={["اسم العميل/الطالب", "رقم الهاتف", "إجمالي المستحق (مدين)", "إجمالي المدفوعات (دائن)", "المتبقي/المديونية", "حالة الحساب", ""]}>
          {loading ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td>
            </tr>
          ) : filtered.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">لا يوجد عملاء بعد.</td>
            </tr>
          ) : (
            filtered.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3 font-bold">{r.name}</td>
                <td className="px-4 py-3">{r.phone}</td>
                <td className="px-4 py-3">{currency(r.totalDebit)}</td>
                <td className="px-4 py-3 text-success">{currency(r.totalCredit)}</td>
                <td className={r.balance > 0 ? "px-4 py-3 text-destructive" : "px-4 py-3 text-success"}>
                  {currency(r.balance)}
                </td>
                <td className="px-4 py-3">
                  <StatusPill label={r.status} tone={r.status === "خالص" ? "good" : "bad"} />
                </td>
                <td className="px-4 py-3">
                  <Button variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openStatement(r)}>
                    كشف الحساب
                  </Button>
                </td>
              </tr>
            ))
          )}
        </DataTable>
      </Panel>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">تسجيل حركة يومية</DialogTitle>
            <DialogDescription className="text-muted-foreground">قيمة اشتراك/رحلة (مدين) أو تحصيل/دفعة (دائن)</DialogDescription>
          </DialogHeader>
          {rows.length === 0 && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              لا يوجد عملاء/طلاب مسجلون بعد — أضف طالبًا أولًا من صفحة "الخطوط والاشتراكات" قبل تسجيل أي حركة هنا.
            </p>
          )}
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">اسم العميل/الطالب</Label>
              <Select value={form.studentName} onValueChange={(v) => setForm({ ...form, studentName: v })}>
                <SelectTrigger className="border-border bg-input/60">
                  <SelectValue placeholder="اختر العميل" />
                </SelectTrigger>
                <SelectContent>
                  {rows.map((r) => (
                    <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">نوع الحركة</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "مدين" | "دائن" })}>
                <SelectTrigger className="border-border bg-input/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="مدين">مدين (قيمة اشتراك/رحلة)</SelectItem>
                  <SelectItem value="دائن">دائن (تحصيل/دفعة)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">المبلغ</Label>
              <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} type="number" className="border-border bg-input/60" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">طريقة الدفع</Label>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                <SelectTrigger className="border-border bg-input/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="نقدي">نقدي</SelectItem>
                  <SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem>
                  <SelectItem value="فودافون كاش">فودافون كاش</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">ملاحظات</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="border-border bg-input/60" />
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submit} disabled={saving}>
              {saving ? "جارِ الحفظ..." : "حفظ الحركة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!statementFor} onOpenChange={(o) => !o && setStatementFor(null)}>
        <DialogContent className="glass max-h-[85vh] max-w-2xl overflow-y-auto text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">كشف حساب: {statementFor?.name}</DialogTitle>
            <DialogDescription className="text-muted-foreground">جميع الحركات بالتسلسل الزمني مع الرصيد الجاري</DialogDescription>
          </DialogHeader>
          {statement.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">لا توجد حركات مسجلة لهذا العميل.</p>
          ) : (
            <DataTable head={["التاريخ", "النوع", "المبلغ", "طريقة الدفع", "الرصيد الجاري", "ملاحظات"]}>
              {statement.map((e) => (
                <tr key={e.id} className="transition-colors hover:bg-secondary/30">
                  <td className="px-4 py-3">{e.date}</td>
                  <td className="px-4 py-3">
                    <StatusPill label={e.type} tone={e.type === "مدين" ? "warn" : "good"} />
                  </td>
                  <td className="px-4 py-3">{currency(e.amount)}</td>
                  <td className="px-4 py-3">{e.method}</td>
                  <td className={e.runningBalance > 0 ? "px-4 py-3 font-bold text-destructive" : "px-4 py-3 font-bold text-success"}>
                    {currency(e.runningBalance)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{e.notes || "—"}</td>
                </tr>
              ))}
            </DataTable>
          )}
          <DialogFooter>
            <Button variant="outline" className="border-border" onClick={() => window.print()}>
              <Printer className="ml-2 h-4 w-4" /> طباعة كشف حساب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
