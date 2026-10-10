import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BellRing, ChevronDown, FileText, Paperclip, Pencil, Plus, Printer, Receipt, Trash2, Wallet } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageHeader, StatCard, exportToExcel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  fetchSupplierSummaries,
  addSupplier,
  updateSupplier,
  deleteSupplier,
  addSupplierPayment,
  deleteSupplierPayment,
  addSupplierInvoice,
  updateSupplierInvoice,
  deleteSupplierInvoice,
  getInvoiceAttachmentUrl,
  fetchSupplierLedger,
  computeSupplierStatement,
  defaultAlertDate,
  type SupplierSummary,
  type SupplierLedgerEntry,
} from "@/lib/queries";

export const Route = createFileRoute("/suppliers")({
  head: () => ({
    meta: [{ title: "حسابات الموردين | وليد وطلعت" }],
  }),
  component: SuppliersPage,
});

const todayStr = () => new Date().toISOString().slice(0, 10);
const emptySupplier = { id: "", name: "", phone: "", dueDate: "", alertDate: "" };
const emptyInvoice = { id: "", date: todayStr(), ref: "", total: "", items: "", previousPath: null as string | null };
const emptyPayment = { date: todayStr(), amount: "", method: "نقدي", notes: "" };

const kindTone: Record<string, string> = {
  شراء: "border-warning/40 bg-warning/15 text-warning",
  فاتورة: "border-primary/40 bg-primary/10 text-primary",
  سداد: "border-success/40 bg-success/15 text-success",
};

function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ledger, setLedger] = useState<SupplierLedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const [supplierDialog, setSupplierDialog] = useState(false);
  const [supplierForm, setSupplierForm] = useState(emptySupplier);
  const [alertEdited, setAlertEdited] = useState(false);
  const [saving, setSaving] = useState(false);

  const [invoiceFor, setInvoiceFor] = useState<SupplierSummary | null>(null);
  const [invoiceForm, setInvoiceForm] = useState(emptyInvoice);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  const [paymentFor, setPaymentFor] = useState<SupplierSummary | null>(null);
  const [paymentForm, setPaymentForm] = useState(emptyPayment);

  const [deleteSupplierTarget, setDeleteSupplierTarget] = useState<SupplierSummary | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<{ supplier: SupplierSummary; entry: SupplierLedgerEntry } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [printFor, setPrintFor] = useState<{ supplier: SupplierSummary; entries: SupplierLedgerEntry[] } | null>(null);

  const loadSuppliers = async () => {
    try {
      setSuppliers(await fetchSupplierSummaries());
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل بيانات الموردين");
    }
  };

  const loadLedger = async (id: string) => {
    setLedgerLoading(true);
    try {
      setLedger(await fetchSupplierLedger(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل حساب المورد");
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await loadSuppliers();
      setLoading(false);
    })();
  }, []);

  const refreshAfterChange = async (supplierId: string) => {
    await Promise.all([loadSuppliers(), loadLedger(supplierId)]);
  };

  const toggle = (s: SupplierSummary) => {
    if (expandedId === s.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(s.id);
    setLedger([]);
    loadLedger(s.id);
  };

  // ---- supplier add/edit ----
  const openAddSupplier = () => {
    setSupplierForm(emptySupplier);
    setAlertEdited(false);
    setSupplierDialog(true);
  };
  const openEditSupplier = (s: SupplierSummary) => {
    setSupplierForm({ id: s.id, name: s.name, phone: s.phone, dueDate: s.dueDate, alertDate: s.alertDate });
    setAlertEdited(!!s.alertDate && s.alertDate !== defaultAlertDate(s.dueDate));
    setSupplierDialog(true);
  };
  const onDueDateChange = (v: string) =>
    setSupplierForm((f) => ({ ...f, dueDate: v, alertDate: alertEdited ? f.alertDate : defaultAlertDate(v) }));

  const submitSupplier = async () => {
    if (!supplierForm.name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: supplierForm.name, phone: supplierForm.phone, dueDate: supplierForm.dueDate, alertDate: supplierForm.alertDate };
      if (supplierForm.id) await updateSupplier(supplierForm.id, payload);
      else await addSupplier(payload);
      await loadSuppliers();
      setSupplierDialog(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ بيانات المورد");
    } finally {
      setSaving(false);
    }
  };

  // ---- invoices ----
  const openAddInvoice = (s: SupplierSummary) => {
    setInvoiceFor(s);
    setInvoiceForm({ ...emptyInvoice, date: todayStr() });
    setInvoiceFile(null);
  };
  const openEditInvoice = (s: SupplierSummary, e: SupplierLedgerEntry) => {
    setInvoiceFor(s);
    setInvoiceForm({ id: e.id, date: e.date, ref: e.invoiceRef ?? "", total: String(e.withdrawals), items: e.itemsDetails ?? "", previousPath: e.attachmentPath });
    setInvoiceFile(null);
  };
  const submitInvoice = async () => {
    if (!invoiceFor || !invoiceForm.ref.trim() || !(Number(invoiceForm.total) >= 0) || !invoiceForm.total) {
      setError("أدخل رقم/اسم الفاتورة وإجمالي المبلغ");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = {
        supplierId: invoiceFor.id,
        invoiceDate: invoiceForm.date,
        invoiceRef: invoiceForm.ref,
        totalAmount: Number(invoiceForm.total),
        itemsDetails: invoiceForm.items,
        file: invoiceFile,
      };
      if (invoiceForm.id) await updateSupplierInvoice(invoiceForm.id, input, invoiceForm.previousPath);
      else await addSupplierInvoice(input);
      await refreshAfterChange(invoiceFor.id);
      setInvoiceFor(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ الفاتورة");
    } finally {
      setSaving(false);
    }
  };

  const openAttachment = async (path: string) => {
    try {
      window.open(await getInvoiceAttachmentUrl(path), "_blank", "noopener");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر فتح المرفق");
    }
  };

  // ---- payments ----
  const submitPayment = async () => {
    if (!paymentFor || !Number(paymentForm.amount)) return;
    setSaving(true);
    try {
      await addSupplierPayment({ supplierId: paymentFor.id, amount: Number(paymentForm.amount), method: paymentForm.method, notes: paymentForm.notes, date: paymentForm.date });
      await refreshAfterChange(paymentFor.id);
      setPaymentFor(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تسجيل سداد الدفعة");
    } finally {
      setSaving(false);
    }
  };

  // ---- deletes ----
  const confirmDeleteSupplier = async () => {
    if (!deleteSupplierTarget) return;
    setDeleting(true);
    try {
      await deleteSupplier(deleteSupplierTarget.id);
      setExpandedId(null);
      await loadSuppliers();
      setDeleteSupplierTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حذف المورد");
    } finally {
      setDeleting(false);
    }
  };
  const confirmDeleteEntry = async () => {
    if (!deleteEntry) return;
    setDeleting(true);
    try {
      const { supplier, entry } = deleteEntry;
      if (entry.source === "invoice") await deleteSupplierInvoice(entry.id, entry.attachmentPath);
      else if (entry.source === "payment") await deleteSupplierPayment(entry.id);
      await refreshAfterChange(supplier.id);
      setDeleteEntry(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الحذف");
    } finally {
      setDeleting(false);
    }
  };

  // ---- printing ----
  const printStatement = async (s: SupplierSummary) => {
    try {
      const entries = expandedId === s.id && ledger.length ? ledger : await fetchSupplierLedger(s.id);
      setPrintFor({ supplier: s, entries });
      document.body.classList.add("print-statement");
      const cleanup = () => {
        document.body.classList.remove("print-statement");
        window.removeEventListener("afterprint", cleanup);
      };
      window.addEventListener("afterprint", cleanup);
      setTimeout(() => window.print(), 150);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تجهيز كشف الحساب");
    }
  };

  const statement = useMemo(() => computeSupplierStatement(ledger), [ledger]);
  const printStatementData = useMemo(() => (printFor ? computeSupplierStatement(printFor.entries) : null), [printFor]);

  const filtered = suppliers.filter((s) => (s.name + s.phone).includes(query) || query === "");
  const totalOutstanding = suppliers.reduce((sum, s) => sum + s.balanceDue, 0);
  const totalPurchases = suppliers.reduce((sum, s) => sum + s.totalPurchases, 0);
  const totalPayments = suppliers.reduce((sum, s) => sum + s.totalPayments, 0);

  const isDue = (s: SupplierSummary) =>
    s.balanceDue > 0 && !!s.dueDate && !!s.alertDate && todayStr() >= s.alertDate;

  return (
    <AppShell>
      <PageHeader title="حسابات الموردين والمشتريات" subtitle="فواتير الموردين، الدفعات المسددة، ومواعيد الاستحقاق" />

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="إجمالي المسحوبات" value={currency(totalPurchases)} icon={Receipt} />
        <StatCard label="إجمالي الدفعات" value={currency(totalPayments)} icon={Wallet} />
        <StatCard label="إجمالي المتبقي المستحق للموردين" value={currency(totalOutstanding)} icon={Wallet} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث باسم المورد أو الهاتف..."
          className="h-10 max-w-sm border-border bg-input/60"
        />
        <div className="mr-auto flex gap-2">
          <Button
            variant="outline"
            className="border-border"
            onClick={() =>
              exportToExcel(
                "الموردون",
                filtered.map((s) => ({ المورد: s.name, الهاتف: s.phone, المسحوبات: s.totalPurchases, الدفعات: s.totalPayments, المتبقي: s.balanceDue, "تاريخ الاستحقاق": s.dueDate })),
              )
            }
          >
            تصدير إلى Excel
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAddSupplier}>
            <Plus className="ml-2 h-4 w-4" /> إضافة مورد
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="py-8 text-center text-muted-foreground">جارِ التحميل...</p>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">لا يوجد موردون مسجلون بعد.</p>
        ) : (
          filtered.map((s) => {
            const open = expandedId === s.id;
            const due = isDue(s);
            return (
              <div key={s.id} className={`panel overflow-hidden transition-colors ${open ? "border-primary/60" : ""}`}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  onClick={() => toggle(s)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle(s))}
                  className="flex cursor-pointer flex-wrap items-center gap-x-6 gap-y-3 p-4 hover:bg-secondary/20"
                >
                  <div className="min-w-[10rem] flex-1">
                    <p className="text-lg font-extrabold">{s.name}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr" style={{ textAlign: "right" }}>{s.phone || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">إجمالي المسحوبات</p>
                    <p className="font-bold">{currency(s.totalPurchases)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">إجمالي الدفعات</p>
                    <p className="font-bold text-success">{currency(s.totalPayments)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">المتبقي المستحق</p>
                    <p className={`text-lg font-extrabold ${s.balanceDue <= 0 ? "text-success" : due ? "text-destructive" : "text-primary"}`}>
                      {currency(s.balanceDue)}
                    </p>
                  </div>
                  {s.dueDate && s.balanceDue > 0 && (
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${due ? "pulse-badge border-destructive/40 bg-destructive/15 text-destructive" : "border-border bg-muted/40 text-muted-foreground"}`}>
                      <BellRing className="h-3 w-3" /> الاستحقاق: {s.dueDate}
                    </span>
                  )}
                  <ChevronDown className={`h-5 w-5 text-primary transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
                </div>

                <div className={`grid transition-all duration-300 ease-in-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                  <div className="overflow-hidden">
                    <div className="border-t border-border p-4">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => openAddInvoice(s)}>
                          <Plus className="ml-1 h-4 w-4" /> تسجيل فاتورة
                        </Button>
                        <Button size="sm" variant="outline" className="border-border" onClick={() => { setPaymentFor(s); setPaymentForm({ ...emptyPayment, date: todayStr() }); }}>
                          <Wallet className="ml-1 h-4 w-4" /> سداد دفعة
                        </Button>
                        <Button size="sm" variant="outline" className="border-border" onClick={() => printStatement(s)}>
                          <Printer className="ml-1 h-4 w-4" /> طباعة كشف حساب المورد
                        </Button>
                        <div className="mr-auto flex gap-1">
                          <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEditSupplier(s)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteSupplierTarget(s)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {ledgerLoading ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">جارِ التحميل...</p>
                      ) : statement.rows.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">لا توجد فواتير أو دفعات لهذا المورد بعد.</p>
                      ) : (
                        <ol className="relative space-y-3 border-r-2 border-primary/30 pr-4">
                          {[...statement.rows].reverse().map((r) => (
                            <li key={`${r.source}-${r.id}`} className="relative rounded-lg border border-border bg-secondary/20 p-3">
                              <span className="absolute -right-[1.45rem] top-4 h-3 w-3 rounded-full border-2 border-primary bg-background" />
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                <span className="text-xs text-muted-foreground">{r.date}</span>
                                <span className={`rounded-full border px-2 py-0.5 text-xs ${kindTone[r.kind]}`}>{r.kind}</span>
                                <span className="text-sm font-bold">{r.reference}</span>
                                <span className={`mr-auto font-bold ${r.payments > 0 ? "text-success" : "text-warning"}`}>
                                  {r.payments > 0 ? `− ${currency(r.payments)}` : `+ ${currency(r.withdrawals)}`}
                                </span>
                                <span className="text-xs text-muted-foreground">المتبقي: <b className="text-primary">{currency(r.balance)}</b></span>
                              </div>
                              {r.description && <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{r.description}</p>}
                              {(r.attachmentPath || r.source !== "inventory") && (
                                <div className="mt-2 flex gap-1">
                                  {r.attachmentPath && (
                                    <Button size="sm" variant="ghost" className="h-7 text-primary hover:bg-primary/10" onClick={() => openAttachment(r.attachmentPath!)}>
                                      <Paperclip className="ml-1 h-3.5 w-3.5" /> صورة الفاتورة
                                    </Button>
                                  )}
                                  {r.source === "invoice" && (
                                    <Button size="sm" variant="ghost" className="h-7 text-primary hover:bg-primary/10" onClick={() => openEditInvoice(s, r)}>
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  {r.source !== "inventory" && (
                                    <Button size="sm" variant="ghost" className="h-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteEntry({ supplier: s, entry: r })}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              )}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* supplier add / edit */}
      <Dialog open={supplierDialog} onOpenChange={setSupplierDialog}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{supplierForm.id ? "تعديل بيانات المورد" : "إضافة مورد جديد"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">اسم المورد</Label>
              <Input value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} className="border-border bg-input/60" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">رقم الهاتف</Label>
              <Input value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} type="tel" className="border-border bg-input/60" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">تاريخ استحقاق الدفعة</Label>
                <Input value={supplierForm.dueDate} onChange={(e) => onDueDateChange(e.target.value)} type="date" className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">تاريخ التنبيه المخصص</Label>
                <Input value={supplierForm.alertDate} onChange={(e) => { setAlertEdited(true); setSupplierForm({ ...supplierForm, alertDate: e.target.value }); }} type="date" className="border-border bg-input/60" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">التنبيه يظهر في لوحة التحكم من تاريخ التنبيه حتى تاريخ الاستحقاق، طالما للمورد رصيد مستحق. الافتراضي: قبل الاستحقاق بيومين.</p>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitSupplier} disabled={saving}>
              {saving ? "جارِ الحفظ..." : supplierForm.id ? "حفظ التعديلات" : "حفظ المورد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* invoice */}
      <Dialog open={!!invoiceFor} onOpenChange={(o) => !o && setInvoiceFor(null)}>
        <DialogContent className="glass max-h-[90vh] overflow-y-auto text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{invoiceForm.id ? "تعديل فاتورة" : "تسجيل فاتورة"} — {invoiceFor?.name}</DialogTitle>
            <DialogDescription className="text-muted-foreground">إجمالي الفاتورة يُضاف تلقائيًا إلى المتبقي المستحق للمورد.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">تاريخ الفاتورة</Label>
                <Input value={invoiceForm.date} onChange={(e) => setInvoiceForm({ ...invoiceForm, date: e.target.value })} type="date" className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">رقم / اسم الفاتورة</Label>
                <Input value={invoiceForm.ref} onChange={(e) => setInvoiceForm({ ...invoiceForm, ref: e.target.value })} className="border-border bg-input/60" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">إجمالي المبلغ</Label>
              <Input value={invoiceForm.total} onChange={(e) => setInvoiceForm({ ...invoiceForm, total: e.target.value })} type="number" min="0" className="border-border bg-input/60" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">تفاصيل الأصناف</Label>
              <Textarea value={invoiceForm.items} onChange={(e) => setInvoiceForm({ ...invoiceForm, items: e.target.value })} rows={3} className="border-border bg-input/60" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">مرفق صورة الفاتورة (صورة أو PDF، حتى 10 ميجا)</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.size > 10 * 1024 * 1024) {
                    setError("حجم الملف أكبر من 10 ميجا");
                    e.target.value = "";
                    return;
                  }
                  setInvoiceFile(f);
                }}
                className="border-border bg-input/60"
              />
              {invoiceForm.previousPath && !invoiceFile && <p className="text-xs text-muted-foreground">يوجد مرفق محفوظ. اختر ملفًا جديدًا لاستبداله.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitInvoice} disabled={saving}>
              {saving ? "جارِ الحفظ..." : invoiceForm.id ? "حفظ التعديلات" : "حفظ الفاتورة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* payment */}
      <Dialog open={!!paymentFor} onOpenChange={(o) => !o && setPaymentFor(null)}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">سداد دفعة — {paymentFor?.name}</DialogTitle>
            <DialogDescription className="text-muted-foreground">المتبقي حاليًا: <b className="text-primary">{currency(paymentFor?.balanceDue ?? 0)}</b></DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">تاريخ الدفع</Label>
                <Input value={paymentForm.date} onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })} type="date" className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">المبلغ</Label>
                <Input value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} type="number" min="0" className="border-border bg-input/60" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">طريقة الدفع</Label>
                <Input value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })} className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">ملاحظات</Label>
                <Input value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} className="border-border bg-input/60" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitPayment} disabled={saving}>
              {saving ? "جارِ التسجيل..." : "سداد دفعة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* deletes */}
      <AlertDialog open={!!deleteSupplierTarget} onOpenChange={(o) => !o && setDeleteSupplierTarget(null)}>
        <AlertDialogContent className="glass text-foreground" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              سيتم حذف المورد {deleteSupplierTarget?.name} وكل فواتيره ودفعاته نهائيًا.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDeleteSupplier} disabled={deleting}>
              {deleting ? "جارِ الحذف..." : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteEntry} onOpenChange={(o) => !o && setDeleteEntry(null)}>
        <AlertDialogContent className="glass text-foreground" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              سيتم حذف {deleteEntry?.entry.kind} ({deleteEntry?.entry.reference}) وتعديل رصيد المورد تلقائيًا.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDeleteEntry} disabled={deleting}>
              {deleting ? "جارِ الحذف..." : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* printable voucher (only visible when printing) */}
      {printFor && printStatementData && (
        <div className="print-only" dir="rtl">
          <h1 style={{ textAlign: "center", fontSize: 22, fontWeight: 800 }}>وليد وطلعت لخدمات النقل والرحلات</h1>
          <h2 style={{ textAlign: "center", fontSize: 18, margin: "8px 0 16px" }}>كشف حساب مورد</h2>
          <p style={{ marginBottom: 12 }}>
            <b>اسم المورد:</b> {printFor.supplier.name} &nbsp;&nbsp; <b>الهاتف:</b> {printFor.supplier.phone || "—"} &nbsp;&nbsp; <b>تاريخ الطباعة:</b> {todayStr()}
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["التاريخ", "البيان", "المسحوبات (الصادر)", "الدفعات المسددة", "المتبقي"].map((h) => (
                  <th key={h} style={{ border: "1px solid #000", padding: 6, background: "#eee" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {printStatementData.rows.map((r) => (
                <tr key={`${r.source}-${r.id}`}>
                  <td style={{ border: "1px solid #000", padding: 6 }}>{r.date}</td>
                  <td style={{ border: "1px solid #000", padding: 6 }}>{r.kind} — {r.reference}{r.description ? ` (${r.description.replace(/\n/g, "، ")})` : ""}</td>
                  <td style={{ border: "1px solid #000", padding: 6 }}>{r.withdrawals ? currency(r.withdrawals) : "—"}</td>
                  <td style={{ border: "1px solid #000", padding: 6 }}>{r.payments ? currency(r.payments) : "—"}</td>
                  <td style={{ border: "1px solid #000", padding: 6 }}>{currency(r.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 800 }}>
                <td colSpan={2} style={{ border: "1px solid #000", padding: 6 }}>الإجمالي</td>
                <td style={{ border: "1px solid #000", padding: 6 }}>{currency(printStatementData.totalWithdrawals)}</td>
                <td style={{ border: "1px solid #000", padding: 6 }}>{currency(printStatementData.totalPayments)}</td>
                <td style={{ border: "1px solid #000", padding: 6 }}>{currency(printStatementData.remaining)}</td>
              </tr>
            </tfoot>
          </table>
          <p style={{ marginTop: 16, fontSize: 16, fontWeight: 800 }}>المتبقي النهائي المستحق: {currency(printStatementData.remaining)}</p>
        </div>
      )}
    </AppShell>
  );
}
