import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Banknote, Bus, Pencil, Plus, Printer, Trash2, Users } from "lucide-react";
import { PaymentSourceSelect } from "@/components/payment-source-select";
import { BusPicker } from "@/components/bus-picker";
import type { Bus as BusRecord } from "@/lib/fleet-data";
import { AppShell } from "@/components/app-shell";
import { DataTable, PageHeader, Panel, StatCard, exportToExcel } from "@/components/ui-kit";
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
  fetchBuses,
  fetchDrivers,
  fetchClients,
  fetchDispatchShiftsByDate,
  addDispatchShifts,
  updateDispatchShift,
  deleteDispatchShift,
  computeDailyReport,
  type DispatchShift,
  ATTENDANCE_STATUSES,
  type DispatchShiftInput,
} from "@/lib/queries";

export const Route = createFileRoute("/dispatch")({
  head: () => ({
    meta: [{ title: "الحركة والورديات اليومية | وليد وطلعت" }],
  }),
  component: DispatchPage,
});

const today = () => new Date().toISOString().slice(0, 10);

interface ShiftRow {
  key: number;
  busCode: string;
  driverName: string;
  clientName: string;
  route: string;
  busValue: string;
  driverValue: string;
  paySource: string;
  attendanceStatus: string;
  overtime: string;
  advance: string;
  penalty: string;
  karta: string;
}

let rowKey = 0;
const newRow = (): ShiftRow => ({ key: ++rowKey, busCode: "", driverName: "", clientName: "", route: "", busValue: "", driverValue: "", paySource: "", attendanceStatus: "حاضر", overtime: "", advance: "", penalty: "", karta: "" });

function DispatchPage() {
  const [date, setDate] = useState(today());
  const [shifts, setShifts] = useState<DispatchShift[]>([]);
  const [buses, setBuses] = useState<BusRecord[]>([]);
  const [driverNames, setDriverNames] = useState<string[]>([]);
  const [clientNames, setClientNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<ShiftRow[]>([newRow()]);
  const [deleteTarget, setDeleteTarget] = useState<DispatchShift | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, buses, drivers, clients] = await Promise.all([
        fetchDispatchShiftsByDate(date),
        fetchBuses(),
        fetchDrivers(),
        fetchClients(),
      ]);
      setShifts(o);
      setBuses(buses);
      setDriverNames(drivers.map((d) => d.name));
      setClientNames(clients.map((c) => c.name));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const report = computeDailyReport(shifts);

  const openAdd = () => {
    setEditingId(null);
    setFormDate(date);
    setNotes("");
    setRows([newRow()]);
    setAdding(true);
  };

  const openEdit = (o: DispatchShift) => {
    setEditingId(o.id);
    setFormDate(o.date);
    setNotes(o.notes);
    setRows([
      {
        key: ++rowKey,
        busCode: o.bus === "—" ? "" : o.bus,
        driverName: o.driver === "—" ? "" : o.driver,
        clientName: o.client === "—" ? "" : o.client,
        route: o.route,
        busValue: String(o.busValue),
        driverValue: String(o.driverValue),
        paySource: o.paySource,
        attendanceStatus: o.attendanceStatus,
        overtime: o.overtime ? String(o.overtime) : "",
        advance: o.advance ? String(o.advance) : "",
        penalty: o.penalty ? String(o.penalty) : "",
        karta: o.karta ? String(o.karta) : "",
      },
    ]);
    setAdding(true);
  };

  const updateRow = (key: number, patch: Partial<ShiftRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const submit = async () => {
    const invalid = rows.some((r) => !r.busCode || !r.driverName || !r.clientName);
    if (invalid) {
      setError("اختر الأتوبيس والسائق والشركة لكل وردية");
      return;
    }
    if (rows.some((r) => (Number(r.advance) || 0) + (Number(r.karta) || 0) > 0 && !r.paySource)) {
      setError("اختر طريقة الدفع / مصدر التمويل للسلفة والكرتة");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const inputs: DispatchShiftInput[] = rows.map((r) => ({
        date: formDate,
        busCode: r.busCode,
        driverName: r.driverName,
        clientName: r.clientName,
        route: r.route,
        busValue: Number(r.busValue) || 0,
        driverValue: Number(r.driverValue) || 0,
        paySource: r.paySource,
        attendanceStatus: r.attendanceStatus,
        overtime: Number(r.overtime) || 0,
        advance: Number(r.advance) || 0,
        penalty: Number(r.penalty) || 0,
        karta: Number(r.karta) || 0,
        notes,
      }));
      const first = inputs[0];
      if (editingId && first) await updateDispatchShift(editingId, first);
      else await addDispatchShifts(inputs);
      setDate(formDate);
      await loadAll();
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ الحركة اليومية");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDispatchShift(deleteTarget.id);
      await loadAll();
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حذف الوردية");
    } finally {
      setDeleting(false);
    }
  };

  const dayName = new Date(date).toLocaleDateString("ar-EG", { weekday: "long" });

  return (
    <AppShell>
      <PageHeader title="الحركة والورديات اليومية" subtitle="تسجيل ورديات الأتوبيسات: قيمة الأتوبيس تُحتسب للشركة، وقيمة السواقة تُحتسب لمرتب السائق" />
      <div className="no-print mb-4 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
        <span>أجور السواقة المسجلة هنا تُرحَّل تلقائيًا إلى كشف المرتبات.</span>
        <Link to="/payroll" className="rounded-lg bg-primary px-3 py-1.5 font-bold text-primary-foreground">فتح صفحة المرتبات والأجور ←</Link>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Label className="text-sm text-muted-foreground">تاريخ اليوم</Label>
        <Input value={date} onChange={(e) => e.target.value && setDate(e.target.value)} type="date" className="h-10 w-44 border-border bg-input/60" />
        <span className="text-sm text-primary">{dayName}</span>
        <div className="mr-auto flex gap-2">
          <Button variant="outline" className="border-border" onClick={() => window.print()}>
            <Printer className="ml-2 h-4 w-4" /> طباعة التقرير اليومي
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAdd}>
            <Plus className="ml-2 h-4 w-4" /> تسجيل ورديات
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="عدد الورديات" value={String(report.shiftCount)} icon={Bus} />
        <StatCard label="إجمالي إيرادات الشركات" value={currency(report.totalCompanyRevenue)} icon={Banknote} />
        <StatCard label="إجمالي مستحقات السائقين" value={currency(report.totalDriverEarnings)} icon={Users} />
        <StatCard label="الصافي بعد السائقين" value={currency(report.netAfterDrivers)} icon={Banknote} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="إيرادات الشركات لهذا اليوم">
          <DataTable head={["الشركة", "عدد الورديات", "الإيراد (دائن)"]}>
            {report.byCompany.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-4 text-center text-muted-foreground">لا توجد ورديات</td></tr>
            ) : (
              report.byCompany.map((c) => (
                <tr key={c.client}>
                  <td className="px-4 py-3 font-bold">{c.client}</td>
                  <td className="px-4 py-3">{c.shifts}</td>
                  <td className="px-4 py-3 text-success">{currency(c.total)}</td>
                </tr>
              ))
            )}
          </DataTable>
        </Panel>
        <Panel title="مستحقات السائقين لهذا اليوم">
          <DataTable head={["السائق", "عدد الورديات", "المستحق"]}>
            {report.byDriver.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-4 text-center text-muted-foreground">لا توجد ورديات</td></tr>
            ) : (
              report.byDriver.map((d) => (
                <tr key={d.driver}>
                  <td className="px-4 py-3 font-bold">{d.driver}</td>
                  <td className="px-4 py-3">{d.shifts}</td>
                  <td className="px-4 py-3 text-primary">{currency(d.total)}</td>
                </tr>
              ))
            )}
          </DataTable>
        </Panel>
      </div>

      <Panel title={`ورديات ${dayName} ${date}`}>
        <div className="mb-3 flex justify-end">
          <Button
            variant="outline"
            className="border-border"
            onClick={() =>
              exportToExcel(
                `تقرير-${date}`,
                shifts.map((o) => ({ التاريخ: o.date, الأتوبيس: o.busPlate, السائق: o.driver, الشركة: o.client, الخط: o.route, "قيمة الأتوبيس": o.busValue, "قيمة السواقة": o.driverValue })),
              )
            }
          >
            تصدير إلى Excel
          </Button>
        </div>
        <DataTable head={["#", "الأتوبيس", "نوع السيارة", "السائق", "الشركة", "الخط", "قيمة الأتوبيس", "قيمة السواقة", "الإجراءات"]}>
          {loading ? (
            <tr><td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td></tr>
          ) : shifts.length === 0 ? (
            <tr><td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">لا توجد ورديات مسجلة في هذا اليوم.</td></tr>
          ) : (
            shifts.map((o, i) => (
              <tr key={o.id} className="transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3">{i + 1}</td>
                <td className="px-4 py-3 font-bold text-primary">{o.busPlate}</td>
                <td className="px-4 py-3 text-xs">{o.busType}</td>
                <td className="px-4 py-3">{o.driver}</td>
                <td className="px-4 py-3">{o.client}</td>
                <td className="px-4 py-3 text-xs">{o.route || "—"}</td>
                <td className="px-4 py-3 text-success">{currency(o.busValue)}</td>
                <td className="px-4 py-3 text-primary">{currency(o.driverValue)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEdit(o)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(o)}>
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
        <DialogContent className="glass max-h-[90vh] overflow-y-auto text-foreground sm:max-w-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{editingId ? "تعديل وردية" : "تسجيل حركة يومية"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              أضف أي عدد من الورديات. قيمة الأتوبيس تُسجَّل في حساب الشركة، وقيمة السواقة في حساب السائق.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5 sm:w-48">
              <Label className="text-xs text-muted-foreground">التاريخ</Label>
              <Input value={formDate} onChange={(e) => setFormDate(e.target.value)} type="date" className="border-border bg-input/60" />
            </div>

            {rows.map((r, idx) => (
              <div key={r.key} className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold text-primary">الوردية {idx + 1}</p>
                  {!editingId && rows.length > 1 && (
                    <button type="button" className="text-xs text-destructive hover:underline" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                      إزالة
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">الأتوبيس</Label>
                    <BusPicker value={r.busCode} buses={buses} onChange={(v) => updateRow(r.key, { busCode: v })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">السائق</Label>
                    <Select value={r.driverName} onValueChange={(v) => updateRow(r.key, { driverName: v })}>
                      <SelectTrigger className="border-border bg-input/60"><SelectValue placeholder="اختر" /></SelectTrigger>
                      <SelectContent>{driverNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">الشركة</Label>
                    <Select value={r.clientName} onValueChange={(v) => updateRow(r.key, { clientName: v })}>
                      <SelectTrigger className="border-border bg-input/60"><SelectValue placeholder="اختر" /></SelectTrigger>
                      <SelectContent>{clientNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">الخط (اختياري)</Label>
                    <Input value={r.route} onChange={(e) => updateRow(r.key, { route: e.target.value })} className="border-border bg-input/60" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">قيمة الأتوبيس (للشركة)</Label>
                    <Input value={r.busValue} onChange={(e) => updateRow(r.key, { busValue: e.target.value })} type="number" min="0" className="border-border bg-input/60" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">قيمة السواقة (للسائق)</Label>
                    <Input value={r.driverValue} onChange={(e) => updateRow(r.key, { driverValue: e.target.value })} type="number" min="0" className="border-border bg-input/60" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">حالة الحضور</Label>
                    <Select value={r.attendanceStatus} onValueChange={(v) => updateRow(r.key, { attendanceStatus: v })}>
                      <SelectTrigger className="border-border bg-input/60"><SelectValue /></SelectTrigger>
                      <SelectContent>{ATTENDANCE_STATUSES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">الإضافي (ج.م)</Label>
                    <Input value={r.overtime} onChange={(e) => updateRow(r.key, { overtime: e.target.value })} type="number" min="0" placeholder="0" className="border-border bg-input/60" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">السلفة (ج.م)</Label>
                    <Input value={r.advance} onChange={(e) => updateRow(r.key, { advance: e.target.value })} type="number" min="0" placeholder="0" className="border-border bg-input/60" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">الجزاء (ج.م)</Label>
                    <Input value={r.penalty} onChange={(e) => updateRow(r.key, { penalty: e.target.value })} type="number" min="0" placeholder="0" className="border-border bg-input/60" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">الكرتة / مصاريف الطريق (ج.م)</Label>
                    <Input value={r.karta} onChange={(e) => updateRow(r.key, { karta: e.target.value })} type="number" min="0" placeholder="0" className="border-border bg-input/60" />
                  </div>
                  <PaymentSourceSelect value={r.paySource} onChange={(v) => updateRow(r.key, { paySource: v })} label="طريقة الدفع / مصدر التمويل (للسلفة والكرتة)" />
                </div>
              </div>
            ))}

            {!editingId && (
              <button type="button" className="text-right text-sm text-primary hover:underline" onClick={() => setRows((rs) => [...rs, newRow()])}>
                + إضافة وردية أخرى
              </button>
            )}

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">ملاحظات</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="border-border bg-input/60" />
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submit} disabled={saving}>
              {saving ? "جارِ الحفظ..." : editingId ? "حفظ التعديلات" : `حفظ ${rows.length} وردية`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="glass text-foreground" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              سيتم حذف وردية {deleteTarget?.busPlate} ({deleteTarget?.client}) بتاريخ {deleteTarget?.date} نهائيًا، وسيتم خصم قيمتها من حساب الشركة ومرتب السائق.
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
