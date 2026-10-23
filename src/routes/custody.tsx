import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Plus, Printer, Scale } from "lucide-react";
import { BusPicker } from "@/components/bus-picker";
import { PersonPicker, type PersonOption } from "@/components/person-picker";
import { AppShell } from "@/components/app-shell";
import { DataTable, PageHeader, Panel, StatCard } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { currency, type Bus, type MaintenanceOrder } from "@/lib/fleet-data";
import {
  CUSTODY_CATEGORIES,
  CUSTODY_MAINT_CATEGORY,
  CUSTODY_PAYROLL_CATEGORY,
  CUSTODY_SUPPLIERS_CATEGORY,
  fetchSuppliers,
  fetchBuses,
  fetchDrivers,
  fetchEmployees,
  fetchMaintenanceOrders,
  addCustodyEntry,
  computeCustody,
  custodyRange,
  deleteCustodyEntry,
  fetchCustody,
  updateCustodyEntry,
  type CustodyEntry,
  type CustodyPreset,
  type DateRange,
} from "@/lib/queries";

export const Route = createFileRoute("/custody")({
  head: () => ({ meta: [{ title: "عهدة الخزينة | وليد وطلعت" }] }),
  component: CustodyPage,
});

const todayStr = () => new Date().toISOString().slice(0, 10);
const emptyForm = (kind: "in" | "out") => ({ id: "", kind, date: todayStr(), amount: "", person: "", category: kind === "out" ? "نثرية" : "", description: "", notes: "", personKey: "", busCode: "", orderId: "", supplierId: "" });
const PRESETS: { key: CustodyPreset; label: string }[] = [
  { key: "day", label: "تقرير اليوم" },
  { key: "week", label: "تقرير الأسبوع الحالي" },
  { key: "month", label: "تقرير الشهر الحالي" },
  { key: "custom", label: "تحديد فترة مخصصة (من - إلى)" },
];

function CustodyPage() {
  const [entries, setEntries] = useState<CustodyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<CustodyPreset>("month");
  const [custom, setCustom] = useState<DateRange>({ from: todayStr(), to: todayStr() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm("in"));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [target, setTarget] = useState<CustodyEntry | null>(null);
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [supplierOpts, setSupplierOpts] = useState<PersonOption[]>([]);
  const [orders, setOrders] = useState<MaintenanceOrder[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await fetchCustody());
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل العهدة");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    (async () => {
      try {
        const [d, e, b, o, sp] = await Promise.all([fetchDrivers(), fetchEmployees(), fetchBuses(), fetchMaintenanceOrders(), fetchSuppliers()]);
        setSupplierOpts(sp.map((x) => ({ value: x.id, label: x.name, group: "مورد" })));
        setPeople([
          ...d.map((x) => ({ value: `driver:${x.id}`, label: x.name, group: "سائق" })),
          ...e.filter((x) => x.isActive).map((x) => ({ value: `employee:${x.id}`, label: x.name, group: "موظف" })),
        ]);
        setBuses(b);
        setOrders(o);
      } catch {
        /* the pickers stay empty; the rest of the page still works */
      }
    })();
  }, []);

  const range = preset === "custom" ? custom : custodyRange(preset);
  const view = useMemo(() => computeCustody(entries, range), [entries, range.from, range.to]);
  const periodText = preset === "day" ? `يوم ${range.from}` : `من ${range.from || "البداية"} إلى ${range.to || "اليوم"}`;
  const presetLabel = PRESETS.find((p) => p.key === preset)?.label ?? "";

  const openNew = (kind: "in" | "out") => {
    setForm(emptyForm(kind));
    setFormError("");
    setOpen(true);
  };
  const openEdit = (e: CustodyEntry) => {
    setForm({ id: e.id, kind: e.kind, date: e.date, amount: String(e.amount), person: e.person, category: e.category, description: e.description, notes: e.notes, personKey: e.subjectType && e.subjectId ? `${e.subjectType}:${e.subjectId}` : "", busCode: e.busCode, orderId: e.maintenanceOrderId, supplierId: e.supplierId });
    setFormError("");
    setOpen(true);
  };

  const submit = async () => {
    const amount = Number(form.amount);
    if (!(amount > 0)) return setFormError("أدخل مبلغًا أكبر من صفر");
    if (!form.date) return setFormError("اختر التاريخ");
    if (form.kind === "in" && !form.person.trim()) return setFormError("أدخل اسم المستلم / صاحب العهدة");
    const isPayroll = form.kind === "out" && form.category === CUSTODY_PAYROLL_CATEGORY;
    const isMaint = form.kind === "out" && form.category === CUSTODY_MAINT_CATEGORY;
    const picked = people.find((p) => p.value === form.personKey);
    if (isPayroll && !picked) return setFormError("اختر السائق أو الموظف");
    if (isMaint && !form.busCode) return setFormError("اختر العربية (رقم اللوحة)");
    const isSupplier = form.kind === "out" && form.category === CUSTODY_SUPPLIERS_CATEGORY;
    const pickedSupplier = supplierOpts.find((p) => p.value === form.supplierId);
    if (isSupplier && !pickedSupplier) return setFormError("اختر المورد");
    setSaving(true);
    setFormError("");
    try {
      const [subjectType, subjectId] = isPayroll ? (form.personKey.split(":") as ["driver" | "employee", string]) : (["", ""] as const);
      const input = {
        date: form.date,
        kind: form.kind,
        amount,
        person: isPayroll ? (picked?.label ?? "") : isSupplier ? (pickedSupplier?.label ?? "") : form.person,
        category: form.kind === "out" ? form.category : "",
        description: form.description || (isPayroll ? `${form.category} — ${picked?.label ?? ""}` : isSupplier ? `سداد للمورد ${pickedSupplier?.label ?? ""}` : ""),
        supplierId: isSupplier ? form.supplierId : "",
        notes: form.notes,
        subjectType,
        subjectId,
        busCode: isMaint ? form.busCode : "",
        maintenanceOrderId: isMaint && form.orderId ? form.orderId : "",
      };
      if (form.id) await updateCustodyEntry(form.id, input);
      else await addCustodyEntry(input);
      setOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!target) return;
    try {
      await deleteCustodyEntry(target.id);
      setTarget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الحذف");
      setTarget(null);
    }
  };

  const print = () => {
    document.body.classList.add("print-statement");
    const done = () => {
      document.body.classList.remove("print-statement");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  };

  const th: React.CSSProperties = { border: "1px solid #999", padding: "6px 8px", textAlign: "right" };

  return (
    <AppShell>
      <PageHeader title="عهدة الخزينة" subtitle="تغذية العهدة وصرف المصروفات منها مع الرصيد الحي" />
      <div className="no-print mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link to="/finance" className="text-primary hover:underline">← المالية والخزينة</Link>
      </div>

      {error && <p className="no-print mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Button className="bg-primary text-primary-foreground" onClick={() => openNew("in")}><Plus className="ml-1 h-4 w-4" />إضافة عهدة / تغذية خزينة (+)</Button>
        <Button variant="outline" className="border-destructive/50 text-destructive" onClick={() => openNew("out")}><Plus className="ml-1 h-4 w-4" />صرف من العهدة (-)</Button>
        <Button variant="outline" className="border-border" onClick={print}><Printer className="ml-1 h-4 w-4" />طباعة تقرير حركة العهدة 🖨️</Button>
      </div>

      <div className="no-print mb-4 flex flex-wrap items-end gap-2">
        {PRESETS.map((p) => (
          <Button key={p.key} type="button" size="sm" variant={preset === p.key ? "default" : "outline"} className={preset === p.key ? "bg-primary text-primary-foreground" : "border-border"} onClick={() => setPreset(p.key)}>
            {p.label}
          </Button>
        ))}
        {preset === "custom" && (
          <>
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">من</Label>
              <Input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="h-9 w-40 border-border bg-input/60" />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">إلى</Label>
              <Input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="h-9 w-40 border-border bg-input/60" />
            </div>
          </>
        )}
      </div>

      <div className="no-print grid gap-4 sm:grid-cols-3">
        <StatCard label="إجمالي العهدة المقبوضة (+)" value={currency(view.totalIn)} icon={ArrowDownCircle} />
        <StatCard label="إجمالي المنصرف (-)" value={currency(view.totalOut)} icon={ArrowUpCircle} />
        <StatCard label="الرصيد المتبقي في العهدة (=)" value={currency(view.balance)} hint={view.opening ? `الرصيد حتى نهاية الفترة (مع المرحّل): ${currency(view.closing)}` : periodText} icon={Scale} />
      </div>

      <Panel title={`حركات العهدة — ${presetLabel}`} className="no-print mt-5">
        <DataTable head={["التاريخ", "النوع", "المستلم / جهة الصرف", "البند", "البيان", "المبلغ", "ملاحظات", "الإجراءات"]}>
          {loading ? (
            <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td></tr>
          ) : view.rows.length === 0 ? (
            <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">لا توجد حركات في هذه الفترة.</td></tr>
          ) : (
            view.rows.map((r) => (
              <tr key={r.id} className="hover:bg-secondary/30">
                <td className="px-4 py-3">{r.date}</td>
                <td className={`px-4 py-3 font-bold ${r.kind === "in" ? "text-success" : "text-destructive"}`}>{r.kind === "in" ? "عهدة (+)" : "صرف (-)"}</td>
                <td className="px-4 py-3">{r.person || "—"}</td>
                <td className="px-4 py-3">{r.category || "—"}</td>
                <td className="px-4 py-3">{r.description || "—"}</td>
                <td className={`px-4 py-3 font-bold ${r.kind === "in" ? "text-success" : "text-destructive"}`}>{r.kind === "in" ? "+" : "-"}{currency(r.amount)}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.notes || "—"}</td>
                <td className="px-4 py-3">
                  {r.sourceId ? (
                    <span className="text-xs text-muted-foreground">مرتبط بمصروف — عدّله من شاشته</span>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="border-border" onClick={() => openEdit(r)}>تعديل ✏️</Button>
                      <Button size="sm" variant="outline" className="border-destructive/50 text-destructive" onClick={() => setTarget(r)}>حذف 🗑️</Button>
                    </div>
                  )}
                </td>
              </tr>
            ))
          )}
        </DataTable>
        {view.byCategory.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {view.byCategory.map((c) => (
              <span key={c.category} className="rounded-full border border-border bg-secondary/40 px-3 py-1">{c.category}: <b>{currency(c.total)}</b></span>
            ))}
          </div>
        )}
      </Panel>

      {/* printable voucher */}
      <div className="print-only" dir="rtl" style={{ fontFamily: "inherit" }}>
        <h1 style={{ textAlign: "center", fontSize: 22, fontWeight: 800 }}>شركة وليد وطلعت لخدمات النقل والرحلات</h1>
        <h2 style={{ textAlign: "center", fontSize: 18, margin: "6px 0" }}>تقرير حركة عهدة الخزينة — {presetLabel.replace("تحديد فترة مخصصة (من - إلى)", "فترة مخصصة")}</h2>
        <p style={{ textAlign: "center", marginBottom: 12 }}>{periodText} — طُبع بتاريخ {todayStr()}</p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
          <tbody>
            {view.opening !== 0 && <tr><td style={th}>رصيد مرحّل من قبل الفترة</td><td style={th}>{currency(view.opening)}</td></tr>}
            <tr><td style={th}>إجمالي العهدة المقبوضة</td><td style={th}>{currency(view.totalIn)}</td></tr>
            <tr><td style={th}>إجمالي المنصرف</td><td style={th}>{currency(view.totalOut)}</td></tr>
            <tr style={{ fontWeight: 800 }}><td style={th}>الرصيد المتبقي</td><td style={th}>{currency(view.closing)}</td></tr>
          </tbody>
        </table>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>{["التاريخ", "النوع", "المستلم / جهة الصرف", "البند", "البيان", "المبلغ"].map((h) => <th key={h} style={{ ...th, background: "#eee" }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {view.rows.map((r) => (
              <tr key={r.id}>
                <td style={th}>{r.date}</td><td style={th}>{r.kind === "in" ? "عهدة" : "صرف"}</td><td style={th}>{r.person || "—"}</td>
                <td style={th}>{r.category || "—"}</td><td style={th}>{r.description || "—"}</td><td style={th}>{r.kind === "in" ? "+" : "-"}{currency(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {view.byCategory.length > 0 && (
          <p style={{ marginTop: 10, fontSize: 12 }}>تفصيل المنصرف بالبند: {view.byCategory.map((c) => `${c.category} ${currency(c.total)}`).join(" — ")}</p>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 48, fontSize: 13 }}>
          <span>المحاسب: ____________</span><span>المدير: ____________</span>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{form.id ? "تعديل الحركة" : form.kind === "in" ? "إضافة عهدة / تغذية خزينة (+)" : "صرف من العهدة (-)"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {formError && <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{formError}</p>}
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">التاريخ</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">المبلغ (ج.م)</Label>
                <Input type="number" min="0" step="any" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="border-border bg-input/60" />
              </div>
            </div>
            {form.kind === "in" ? (
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">المستلم / صاحب العهدة</Label>
                <Input value={form.person} onChange={(e) => setForm({ ...form, person: e.target.value })} className="border-border bg-input/60" />
              </div>
            ) : (
              <>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">بند المصروف</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger className="border-border bg-input/60"><SelectValue /></SelectTrigger>
                    <SelectContent>{CUSTODY_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {form.category === CUSTODY_PAYROLL_CATEGORY && (
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">اختر السائق أو الموظف</Label>
                    <PersonPicker value={form.personKey} options={people} onChange={(v) => setForm({ ...form, personKey: v })} />
                    <p className="text-xs text-muted-foreground">يُخصم المبلغ تلقائيًا من مرتب الشخص في صفحة المرتبات والأجور (كسلفة/مدفوع مقدمًا).</p>
                  </div>
                )}
                {form.category === CUSTODY_SUPPLIERS_CATEGORY && (
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">اختيار المورد</Label>
                    <PersonPicker value={form.supplierId} options={supplierOpts} onChange={(v) => setForm({ ...form, supplierId: v })} placeholder="اختر المورد" />
                    <p className="text-xs text-muted-foreground">يُسجَّل المبلغ تلقائيًا كدفعة في كشف حساب المورد ويقلّل رصيده المستحق.</p>
                  </div>
                )}
                {form.category === CUSTODY_MAINT_CATEGORY && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">العربية (رقم اللوحة)</Label>
                      <BusPicker value={form.busCode} buses={buses} onChange={(v) => setForm({ ...form, busCode: v, orderId: "" })} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">أمر الصيانة (اختياري)</Label>
                      <Select value={form.orderId || "__none"} onValueChange={(v) => setForm({ ...form, orderId: v === "__none" ? "" : v })} disabled={!form.busCode}>
                        <SelectTrigger className="border-border bg-input/60"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">بدون أمر صيانة</SelectItem>
                          {orders.filter((o) => o.bus === form.busCode).map((o) => <SelectItem key={o.id} value={o.id}>{o.code} — {o.issue}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">{form.kind === "in" ? "البيان / مصدر العهدة" : "جهة الصرف / البيان"}</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="border-border bg-input/60" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">ملاحظات</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="border-border bg-input/60" />
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submit} disabled={saving}>{saving ? "جارِ الحفظ..." : "حفظ"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الحركة؟</AlertDialogTitle>
            <AlertDialogDescription>
              {target ? `سيتم حذف ${target.kind === "in" ? "عهدة" : "صرف"} بمبلغ ${currency(target.amount)} بتاريخ ${target.date} وتحديث الرصيد فورًا.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
