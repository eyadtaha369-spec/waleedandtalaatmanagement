import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCheck, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AccountPicker } from "@/components/account-picker";
import { DateRangeFilter } from "@/components/date-range-filter";
import { DataTable, PageHeader, Panel, StatCard, StatusPill, exportToExcel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Bus, Wallet, Receipt } from "lucide-react";
import { currency } from "@/lib/fleet-data";
import {
  addRentedOp,
  computeRentedLedger,
  deleteRentedOp,
  fetchClients,
  fetchRentedOps,
  inDateRange,
  periodLabel,
  rangeForPreset,
  settleRentedOps,
  updateRentedOp,
  type Client,
  type DateRange,
  type RentedOp,
} from "@/lib/queries";

export const Route = createFileRoute("/rented")({
  head: () => ({
    meta: [{ title: "السيارات المستأجرة والخارجية | وليد وطلعت" }],
  }),
  component: RentedPage,
});

const todayStr = () => new Date().toISOString().slice(0, 10);
const PENDING = "معلق / لم يتم السداد";
const PAID = "تم السداد";

const emptyForm = () => ({ id: "", wasPaid: false, paidAt: "", date: todayStr(), owner: "", bus: "", driver: "", clientId: "", destination: "", gasCost: "", fare: "", status: PENDING, notes: "" });

function RentedPage() {
  const [ops, setOps] = useState<RentedOp[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [range, setRange] = useState<DateRange>(rangeForPreset("current"));
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [ledgerOwner, setLedgerOwner] = useState("");
  const [ledgerBus, setLedgerBus] = useState("__all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmSettle, setConfirmSettle] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RentedOp | null>(null);
  const [working, setWorking] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, c] = await Promise.all([fetchRentedOps(), fetchClients()]);
      setOps(o);
      setClients(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    loadAll();
  }, []);

  const owners = useMemo(() => [...new Set(ops.map((o) => o.owner))].sort(), [ops]);
  const busesOfOwner = useMemo(() => [...new Set(ops.filter((o) => o.owner === ledgerOwner).map((o) => o.bus))].sort(), [ops, ledgerOwner]);

  useEffect(() => {
    if (!ledgerOwner && owners[0]) setLedgerOwner(owners[0]);
  }, [owners, ledgerOwner]);

  const logRows = ops.filter((o) => inDateRange(o.date, range));
  const ledger = useMemo(
    () => computeRentedLedger(ops, { owner: ledgerOwner, bus: ledgerBus === "__all" ? "" : ledgerBus, range }),
    [ops, ledgerOwner, ledgerBus, range],
  );

  const openAdd = () => {
    setForm({ ...emptyForm(), owner: ledgerOwner });
    setAdding(true);
  };
  const openEdit = (o: RentedOp) => {
    const client = clients.find((c) => c.id === o.clientId);
    setForm({ id: o.id, wasPaid: o.paid, paidAt: o.paidAt, date: o.date, owner: o.owner, bus: o.bus, driver: o.driver, clientId: o.clientId, destination: client?.name ?? o.destination, gasCost: String(o.gasCost), fare: String(o.fare), status: o.paid ? PAID : PENDING, notes: o.notes });
    setAdding(true);
  };
  const submit = async () => {
    if (!form.owner.trim() || !form.bus.trim()) return setError("أدخل اسم صاحب العربية ورقم / اسم العربية");
    setSaving(true);
    setError(null);
    try {
      const payload = { date: form.date, owner: form.owner, bus: form.bus, driver: form.driver, clientId: form.clientId, destination: form.destination, gasCost: Number(form.gasCost) || 0, fare: Number(form.fare) || 0, paid: form.status === PAID, notes: form.notes };
      if (form.id) await updateRentedOp(form.id, payload, form.wasPaid, form.paidAt);
      else await addRentedOp(payload);
      await loadAll();
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const toSettle = selected.size ? ledger.unpaidIds.filter((id) => selected.has(id)) : ledger.unpaidIds;
  const settleAmount = ledger.rows.filter((r) => toSettle.includes(r.id)).reduce((s, r) => s + r.fare, 0);
  const doSettle = async () => {
    setWorking(true);
    try {
      await settleRentedOps(toSettle);
      setSelected(new Set());
      await loadAll();
      setConfirmSettle(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "تعذر تسجيل السداد");
    } finally {
      setWorking(false);
    }
  };
  const doDelete = async () => {
    if (!deleteTarget) return;
    setWorking(true);
    try {
      await deleteRentedOp(deleteTarget.id);
      await loadAll();
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "تعذر الحذف");
    } finally {
      setWorking(false);
    }
  };

  const printLedger = () => {
    document.body.classList.add("print-statement");
    const cleanup = () => {
      document.body.classList.remove("print-statement");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => window.print(), 150);
  };

  const td = { border: "1px solid #000", padding: 6 } as const;

  return (
    <AppShell>
      <PageHeader title="السيارات المستأجرة والخارجية" subtitle="تسجيل حركة العربيات المستأجرة اليومية وكشف حساب كل مالك / مكتب تأجير" />

      {error && <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <Panel title="تحديد فترة الكشف" className="mb-4">
        <DateRangeFilter value={range} onChange={setRange} />
      </Panel>

      <Panel title="سجل حركة العربيات المستأجرة">
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          <Button variant="outline" className="border-border" onClick={() => exportToExcel("حركة العربيات المستأجرة", logRows.map((o) => ({ التاريخ: o.date, "صاحب العربية": o.owner, العربية: o.bus, السائق: o.driver, "الشركة / المكان": o.destination, "تكلفة السولار": o.gasCost, الإيجار: o.fare, الحالة: o.paid ? PAID : PENDING })))}>
            تصدير Excel
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAdd}>
            <Plus className="ml-2 h-4 w-4" /> تسجيل حركة عربية مستأجرة
          </Button>
        </div>
        <DataTable head={["التاريخ", "صاحب العربية / المكتب", "العربية", "السائق", "الشركة / المكان", "تكلفة السولار", "قيمة الإيجار", "الحالة", "الإجراءات"]}>
          {loading ? (
            <tr><td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td></tr>
          ) : logRows.length === 0 ? (
            <tr><td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">لا توجد حركات في هذه الفترة.</td></tr>
          ) : (
            logRows.map((o) => (
              <tr key={o.id} className="transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3">{o.date}</td>
                <td className="px-4 py-3 font-bold">{o.owner}</td>
                <td className="px-4 py-3">{o.bus}</td>
                <td className="px-4 py-3">{o.driver || "—"}</td>
                <td className="px-4 py-3">{clients.find((c) => c.id === o.clientId)?.name ?? (o.destination || "—")}</td>
                <td className="px-4 py-3">{currency(o.gasCost)}</td>
                <td className="px-4 py-3 font-bold text-warning">{currency(o.fare)}</td>
                <td className="px-4 py-3"><StatusPill label={o.paid ? PAID : "معلق"} tone={o.paid ? "good" : "warn"} /></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEdit(o)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(o)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </DataTable>
      </Panel>

      <Panel title="كشف حساب العربية المستأجرة" className="mt-4">
        <div className="no-print mb-4 grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">صاحب العربية / مكتب التأجير</Label>
            <Select value={ledgerOwner} onValueChange={(v) => { setLedgerOwner(v); setLedgerBus("__all"); setSelected(new Set()); }}>
              <SelectTrigger className="border-border bg-input/60"><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>{owners.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">العربية</Label>
            <Select value={ledgerBus} onValueChange={(v) => { setLedgerBus(v); setSelected(new Set()); }}>
              <SelectTrigger className="border-border bg-input/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">كل عربيات المالك</SelectItem>
                {busesOfOwner.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!ledgerOwner ? (
          <p className="py-4 text-center text-sm text-muted-foreground">سجّل أول حركة لعربية مستأجرة لعرض الكشف.</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="إجمالي المستحق" value={currency(ledger.totalDue)} icon={Receipt} />
              <StatCard label="إجمالي المسدد" value={currency(ledger.totalPaid)} icon={Wallet} />
              <StatCard label="المتبقي" value={currency(ledger.remaining)} icon={Bus} />
            </div>
            <div className="no-print mt-3 flex flex-wrap items-center gap-2">
              <Button className="bg-primary text-primary-foreground" disabled={toSettle.length === 0} onClick={() => setConfirmSettle(true)}>
                <CheckCheck className="ml-2 h-4 w-4" /> تم السداد / تصفير الحساب
              </Button>
              <Button variant="outline" className="border-border" disabled={ledger.rows.length === 0} onClick={printLedger}>
                <Printer className="ml-2 h-4 w-4" /> طباعة كشف العربية / PDF
              </Button>
              <span className="text-xs text-muted-foreground">
                {selected.size ? `سيتم سداد ${toSettle.length} رحلة محددة` : "بدون تحديد: يُسدَّد كل المعلق في الفترة"}
              </span>
            </div>
            <div className="mt-3">
              <DataTable head={["", "التاريخ", "العربية", "السائق", "الشركة / المكان", "تكلفة السولار", "الإيجار", "الحالة"]}>
                {ledger.rows.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-4 text-center text-muted-foreground">لا توجد رحلات لهذا المالك في الفترة المحددة.</td></tr>
                ) : (
                  ledger.rows.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-secondary/30">
                      <td className="px-4 py-3">
                        {!r.paid && (
                          <input
                            type="checkbox"
                            aria-label="تحديد"
                            checked={selected.has(r.id)}
                            onChange={(e) => {
                              const n = new Set(selected);
                              if (e.target.checked) n.add(r.id);
                              else n.delete(r.id);
                              setSelected(n);
                            }}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">{r.date}</td>
                      <td className="px-4 py-3">{r.bus}</td>
                      <td className="px-4 py-3">{r.driver || "—"}</td>
                      <td className="px-4 py-3">{clients.find((c) => c.id === r.clientId)?.name ?? (r.destination || "—")}</td>
                      <td className="px-4 py-3">{currency(r.gasCost)}</td>
                      <td className="px-4 py-3 font-bold">{currency(r.fare)}</td>
                      <td className="px-4 py-3"><StatusPill label={r.paid ? PAID : "معلق"} tone={r.paid ? "good" : "warn"} /></td>
                    </tr>
                  ))
                )}
              </DataTable>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">إجمالي تكلفة السولار في الفترة (للعلم، لا تدخل في المستحق): {currency(ledger.totalGas)}</p>
          </>
        )}
      </Panel>

      {ledgerOwner && ledger.rows.length > 0 && (
        <div className="print-only" dir="rtl">
          <h1 style={{ textAlign: "center", fontSize: 22, fontWeight: 800 }}>وليد وطلعت لخدمات النقل والرحلات</h1>
          <h2 style={{ textAlign: "center", fontSize: 18, margin: "8px 0 16px" }}>كشف حساب عربية مستأجرة</h2>
          <p style={{ marginBottom: 12 }}>
            <b>المالك / المكتب:</b> {ledgerOwner} &nbsp;&nbsp; <b>العربية:</b> {ledgerBus === "__all" ? "الكل" : ledgerBus} &nbsp;&nbsp; <b>الفترة:</b> {periodLabel(range)}
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>{["التاريخ", "العربية", "السائق", "الشركة / المكان", "تكلفة السولار", "الإيجار", "الحالة"].map((h) => <th key={h} style={{ ...td, background: "#eee" }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {ledger.rows.map((r) => (
                <tr key={r.id}>
                  <td style={td}>{r.date}</td><td style={td}>{r.bus}</td><td style={td}>{r.driver || "—"}</td>
                  <td style={td}>{clients.find((c) => c.id === r.clientId)?.name ?? (r.destination || "—")}</td>
                  <td style={td}>{currency(r.gasCost)}</td><td style={td}>{currency(r.fare)}</td><td style={td}>{r.paid ? PAID : "معلق"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 800 }}><td colSpan={4} style={td}>الإجماليات</td><td style={td}>{currency(ledger.totalGas)}</td><td style={td}>{currency(ledger.totalDue)}</td><td style={td}></td></tr>
            </tfoot>
          </table>
          <p style={{ marginTop: 14, fontWeight: 700 }}>
            إجمالي المستحق: {currency(ledger.totalDue)} &nbsp;|&nbsp; إجمالي المسدد: {currency(ledger.totalPaid)} &nbsp;|&nbsp; المتبقي: {currency(ledger.remaining)}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40 }}>
            <span>التاريخ: ____ / ____ / ________</span>
            <span>التوقيع: ______________________</span>
          </div>
        </div>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="glass max-h-[90vh] overflow-y-auto text-foreground sm:max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{form.id ? "تعديل حركة عربية مستأجرة" : "تسجيل حركة العربية المستأجرة"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">حركة يوم واحد لعربية مستأجرة من مالك أو مكتب تأجير</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">التاريخ</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">اسم صاحب العربية / مكتب التأجير</Label>
                <Input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} list="rented-owners" className="border-border bg-input/60" />
                <datalist id="rented-owners">{owners.map((o) => <option key={o} value={o} />)}</datalist>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">رقم / اسم العربية المستأجرة</Label>
                <Input value={form.bus} onChange={(e) => setForm({ ...form, bus: e.target.value })} className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">اسم السائق</Label>
                <Input value={form.driver} onChange={(e) => setForm({ ...form, driver: e.target.value })} className="border-border bg-input/60" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">الشركة / المكان المستهدف</Label>
              <AccountPicker value={form.destination} clients={clients} placeholder="ابحث عن شركة أو اكتب المكان..." onPick={(name, clientId) => setForm({ ...form, destination: name, clientId })} />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">تكلفة الوقود / السولار</Label>
                <Input type="number" min="0" step="any" value={form.gasCost} onChange={(e) => setForm({ ...form, gasCost: e.target.value })} className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">قيمة الإيجار المستحقة</Label>
                <Input type="number" min="0" step="any" value={form.fare} onChange={(e) => setForm({ ...form, fare: e.target.value })} className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">حالة الدفع</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="border-border bg-input/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PENDING}>{PENDING}</SelectItem>
                    <SelectItem value={PAID}>{PAID}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">ملاحظات</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="border-border bg-input/60" />
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submit} disabled={saving}>{saving ? "جارِ الحفظ..." : form.id ? "حفظ التعديلات" : "حفظ الحركة"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmSettle} onOpenChange={setConfirmSettle}>
        <AlertDialogContent className="glass text-foreground" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-primary">تأكيد السداد / تصفير الحساب</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              سيتم تحويل {toSettle.length} رحلة إلى «تم السداد» بقيمة {currency(settleAmount)}، ويصبح المتبقي على {ledgerOwner} صفرًا لهذه الفترة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">رجوع</AlertDialogCancel>
            <AlertDialogAction className="bg-primary text-primary-foreground" onClick={doSettle} disabled={working}>{working ? "جارِ التسجيل..." : "تأكيد السداد"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="glass text-foreground" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">سيتم حذف حركة {deleteTarget?.bus} بتاريخ {deleteTarget?.date} نهائيًا.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">إلغاء</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={doDelete} disabled={working}>{working ? "جارِ الحذف..." : "حذف"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
