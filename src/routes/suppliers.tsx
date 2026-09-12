import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DataTable, PageHeader, Panel, StatCard, Toolbar, exportToExcel } from "@/components/ui-kit";
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
import { currency } from "@/lib/fleet-data";
import {
  fetchSuppliers,
  addSupplier,
  updateSupplier,
  deleteSupplier,
  addSupplierPayment,
  fetchSupplierLedger,
  type Supplier,
  type SupplierLedgerEntry,
} from "@/lib/queries";

export const Route = createFileRoute("/suppliers")({
  head: () => ({
    meta: [{ title: "حسابات الموردين | وليد وطلعت" }],
  }),
  component: SuppliersPage,
});

function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", phone: "" });
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [ledgerFor, setLedgerFor] = useState<Supplier | null>(null);
  const [ledger, setLedger] = useState<SupplierLedgerEntry[]>([]);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("نقدي");
  const [payNotes, setPayNotes] = useState("");
  const [payingSaving, setPayingSaving] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      setSuppliers(await fetchSuppliers());
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل بيانات الموردين");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const openAdd = () => {
    setForm({ id: "", name: "", phone: "" });
    setAdding(true);
  };
  const openEdit = (s: Supplier) => {
    setForm({ id: s.id, name: s.name, phone: s.phone });
    setAdding(true);
  };
  const submit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: form.name, phone: form.phone };
      if (form.id) await updateSupplier(form.id, payload);
      else await addSupplier(payload);
      await loadAll();
      setForm({ id: "", name: "", phone: "" });
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ بيانات المورد");
    } finally {
      setSaving(false);
    }
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSupplier(deleteTarget.id);
      await loadAll();
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حذف المورد");
    } finally {
      setDeleting(false);
    }
  };

  const openLedger = async (s: Supplier) => {
    setLedgerFor(s);
    setPayAmount("");
    setPayNotes("");
    try {
      setLedger(await fetchSupplierLedger(s.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل حساب المورد");
    }
  };

  const submitPayment = async () => {
    if (!ledgerFor || !payAmount.trim()) return;
    setPayingSaving(true);
    try {
      await addSupplierPayment({ supplierId: ledgerFor.id, amount: Number(payAmount) || 0, method: payMethod, notes: payNotes });
      const [refreshedLedger, refreshedSuppliers] = await Promise.all([fetchSupplierLedger(ledgerFor.id), fetchSuppliers()]);
      setLedger(refreshedLedger);
      setSuppliers(refreshedSuppliers);
      setLedgerFor(refreshedSuppliers.find((s) => s.id === ledgerFor.id) ?? ledgerFor);
      setPayAmount("");
      setPayNotes("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تسجيل سداد الدفعة");
    } finally {
      setPayingSaving(false);
    }
  };

  const filtered = suppliers.filter((s) => (s.name + s.phone).includes(query) || query === "");
  const totalOutstanding = suppliers.reduce((sum, s) => sum + s.balanceDue, 0);

  return (
    <AppShell>
      <PageHeader title="حسابات الموردين" subtitle="أرصدة الموردين، سجل المشتريات، وسداد الدفعات" />

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mb-4">
        <StatCard label="إجمالي ديون الموردين المترتبة على الشركة" value={currency(totalOutstanding)} icon={Wallet} />
      </div>

      <Panel title="الموردون">
        <Toolbar
          query={query}
          onQuery={setQuery}
          placeholder="ابحث باسم المورد أو الهاتف..."
          onExport={() => exportToExcel("الموردون", filtered as unknown as Record<string, string | number>[])}
          extra={
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAdd}>
              <Plus className="ml-2 h-4 w-4" /> إضافة مورد
            </Button>
          }
        />
        <DataTable head={["اسم المورد", "الهاتف", "الرصيد المستحق (دائن)", "الإجراءات", ""]}>
          {loading ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td>
            </tr>
          ) : filtered.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">لا يوجد موردون مسجلون بعد.</td>
            </tr>
          ) : (
            filtered.map((s) => (
              <tr key={s.id} className="transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3 font-bold">{s.name}</td>
                <td className="px-4 py-3">{s.phone || "—"}</td>
                <td className={s.balanceDue > 0 ? "px-4 py-3 font-bold text-destructive" : "px-4 py-3 font-bold text-success"}>
                  {currency(s.balanceDue)}
                </td>
                <td className="px-4 py-3">
                  <Button variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openLedger(s)}>
                    كشف الحساب / سداد
                  </Button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEdit(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(s)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </DataTable>
      </Panel>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{form.id ? "تعديل بيانات المورد" : "إضافة مورد جديد"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">اسم المورد</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="border-border bg-input/60" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">الهاتف</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} type="tel" className="border-border bg-input/60" />
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submit} disabled={saving}>
              {saving ? "جارِ الحفظ..." : form.id ? "حفظ التعديلات" : "حفظ المورد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!ledgerFor} onOpenChange={(o) => !o && setLedgerFor(null)}>
        <DialogContent className="glass max-h-[85vh] max-w-2xl overflow-y-auto text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">كشف حساب: {ledgerFor?.name}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              الرصيد المستحق حاليًا: <b className="text-destructive">{currency(ledgerFor?.balanceDue ?? 0)}</b>
            </DialogDescription>
          </DialogHeader>
          {ledger.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">لا توجد حركات مسجلة لهذا المورد.</p>
          ) : (
            <DataTable head={["التاريخ", "النوع", "البيان", "المبلغ"]}>
              {ledger.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-secondary/30">
                  <td className="px-4 py-3">{l.date}</td>
                  <td className="px-4 py-3">
                    <span className={l.kind === "شراء" ? "text-warning" : "text-success"}>{l.kind}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">{l.description}</td>
                  <td className={l.amount >= 0 ? "px-4 py-3 font-bold text-warning" : "px-4 py-3 font-bold text-success"}>
                    {currency(Math.abs(l.amount))}
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
          <div className="grid grid-cols-1 gap-2 border-t border-border pt-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">مبلغ السداد</Label>
              <Input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} type="number" className="border-border bg-input/60" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">طريقة الدفع</Label>
              <Input value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="border-border bg-input/60" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">ملاحظات</Label>
              <Input value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className="border-border bg-input/60" />
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitPayment} disabled={payingSaving}>
              {payingSaving ? "جارِ التسجيل..." : "سداد دفعة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="glass text-foreground" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              سيتم حذف مورد {deleteTarget?.name} نهائيًا.
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
