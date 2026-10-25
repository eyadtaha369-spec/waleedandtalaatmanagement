import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Lock, Pencil, Plus, Printer, Trash2, Unlock } from "lucide-react";
import { DateRangeFilter } from "@/components/date-range-filter";
import { BusPicker } from "@/components/bus-picker";
import { PaymentSourceSelect } from "@/components/payment-source-select";
import { AppShell } from "@/components/app-shell";
import { DataTable, PageHeader, Panel, Toolbar, exportToExcel } from "@/components/ui-kit";
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
import { currency, type Bus } from "@/lib/fleet-data";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fetchDrivers, fetchBuses, fetchRoutes } from "@/lib/queries";
import {
  fetchDailyShifts,
  periodLabel,
  fetchPayrollTrips,
  fetchEmployeeAttendanceInPeriod,
  type PayrollTripRow,
  type EmployeeAttendanceRow,
  rangeForPreset,
  type DateRange,
  upsertDailyShift,
  deleteDailyShift,
  fetchDriverPayroll,
  fetchEmployeePayroll,
  fetchEmployees,
  fetchDispatchShifts,
  fetchPayrollAdjustments,
  savePayrollAdjustment,
  computeFinalPayroll,
  adjustmentKey,
  EMPTY_ADJUSTMENT,
  type PayrollAdjustment,
  type PayrollSubjectType,
  type DispatchShift,
  type EmployeePayrollRow,
  type DailyShift,
  type DriverPayrollRow,
  sameDriver,
} from "@/lib/queries";

export const Route = createFileRoute("/payroll")({
  head: () => ({
    meta: [{ title: "تسجيل التشغيل اليومي والمرتبات | وليد وطلعت" }],
  }),
  component: PayrollPage,
});

const emptyForm = {
  id: "",
  driverName: "",
  busCode: "",
  routeName: "",
  shiftFrom: "",
  shiftTo: "",
  date: new Date().toISOString().slice(0, 10),
  status: "حاضر",
  overtimeAllowance: "",
  dailyAdvance: "",
  penalty: "",
  tollFee: "",
  notes: "",
};

interface PersonRow {
  key: string;
  type: PayrollSubjectType;
  id: string;
  name: string;
  role: string;
  baseSalary: number;
  shiftAllowances: number;
  tripFees: number;
  dailyAdvances: number;
  dailyPenalties: number;
  dailyTolls: number;
}

const monthRange = (m: string): DateRange => {
  const [y, mo] = m.split("-").map(Number);
  const last = new Date(Date.UTC(y ?? 2000, mo ?? 1, 0)).toISOString().slice(0, 10);
  return { from: `${m}-01`, to: last };
};

function PayrollPage() {
  const [range, setRange] = useState<DateRange>(rangeForPreset("current"));
  const month = range.from.slice(0, 7);
  const canEdit = range.from.slice(0, 7) === range.to.slice(0, 7);
  const [shifts, setShifts] = useState<DailyShift[]>([]);
  const [payroll, setPayroll] = useState<DriverPayrollRow[]>([]);
  const [employeePayroll, setEmployeePayroll] = useState<EmployeePayrollRow[]>([]);
  const [driverNames, setDriverNames] = useState<string[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [routeNames, setRouteNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<DailyShift | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [driverIds, setDriverIds] = useState<Map<string, string>>(new Map());
  const [employeeIds, setEmployeeIds] = useState<Map<string, string>>(new Map());
  const [adjustments, setAdjustments] = useState<Map<string, PayrollAdjustment>>(new Map());
  const [dispatchShifts, setDispatchShifts] = useState<DispatchShift[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [adjFor, setAdjFor] = useState<PersonRow | null>(null);
  const [adjForm, setAdjForm] = useState({ bonus: "", advances: "", penalties: "", tolls: "", notes: "", paySource: "" });
  const [payTrips, setPayTrips] = useState<PayrollTripRow[]>([]);
  const [empRows, setEmpRows] = useState<EmployeeAttendanceRow[]>([]);
  const [detailFor, setDetailFor] = useState<PersonRow | null>(null);
  const [printing, setPrinting] = useState<PersonRow | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p, ep, drivers, buses, routes, employees, adj, ds, pt, er] = await Promise.all([
        fetchDailyShifts(range),
        fetchDriverPayroll(range),
        fetchEmployeePayroll(range),
        fetchDrivers(),
        fetchBuses(),
        fetchRoutes(),
        fetchEmployees(),
        fetchPayrollAdjustments(range),
        fetchDispatchShifts(range),
        fetchPayrollTrips(range),
        fetchEmployeeAttendanceInPeriod(range),
      ]);
      setPayTrips(pt);
      setEmpRows(er);
      setDriverIds(new Map(drivers.map((d) => [d.name, d.id])));
      setEmployeeIds(new Map(employees.map((e) => [e.name, e.id])));
      setAdjustments(adj);
      setDispatchShifts(ds);
      setShifts(s);
      setPayroll(p);
      setEmployeePayroll(ep);
      setDriverNames(drivers.map((d) => d.name));
      setBuses(buses);
      setRouteNames(routes.map((r) => r.name));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const openAdd = () => {
    setForm(emptyForm);
    setAdding(true);
  };

  const openEdit = (s: DailyShift) => {
    setForm({
      id: s.id,
      driverName: s.driver,
      busCode: s.bus === "—" ? "" : s.bus,
      routeName: s.route === "—" ? "" : s.route,
      shiftFrom: s.shiftFrom,
      shiftTo: s.shiftTo,
      date: s.date,
      status: s.status,
      overtimeAllowance: s.overtimeAllowance ? String(s.overtimeAllowance) : "",
      dailyAdvance: s.dailyAdvance ? String(s.dailyAdvance) : "",
      penalty: s.penalty ? String(s.penalty) : "",
      tollFee: s.tollFee ? String(s.tollFee) : "",
      notes: s.notes,
    });
    setAdding(true);
  };

  const submit = async () => {
    if (!form.driverName.trim()) return;
    setSaving(true);
    try {
      await upsertDailyShift({
        id: form.id || undefined,
        driverName: form.driverName,
        busCode: form.busCode,
        routeName: form.routeName,
        shiftFrom: form.shiftFrom,
        shiftTo: form.shiftTo,
        date: form.date,
        status: form.status,
        overtimeAllowance: Number(form.overtimeAllowance) || 0,
        dailyAdvance: Number(form.dailyAdvance) || 0,
        penalty: Number(form.penalty) || 0,
        tollFee: Number(form.tollFee) || 0,
        notes: form.notes,
      });
      await loadAll();
      setForm(emptyForm);
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ التسجيل اليومي");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDailyShift(deleteTarget.id);
      await loadAll();
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حذف التسجيل");
    } finally {
      setDeleting(false);
    }
  };

  const people: PersonRow[] = useMemo(() => {
    const drivers: PersonRow[] = payroll.map((p) => ({
      key: adjustmentKey("driver", driverIds.get(p.driver) ?? p.driver),
      type: "driver",
      id: driverIds.get(p.driver) ?? "",
      name: p.driver,
      role: "سائق",
      baseSalary: p.baseSalary,
      shiftAllowances: p.totalOvertime + p.shiftEarnings,
      tripFees: p.tripFees,
      dailyAdvances: p.totalAdvances,
      dailyPenalties: p.totalPenalties,
      dailyTolls: p.totalTolls,
    }));
    const employees: PersonRow[] = employeePayroll.map((p) => ({
      key: adjustmentKey("employee", employeeIds.get(p.employee) ?? p.employee),
      type: "employee",
      id: employeeIds.get(p.employee) ?? "",
      name: p.employee,
      role: p.jobTitle || "موظف",
      baseSalary: p.baseSalary,
      shiftAllowances: p.totalAllowances,
      tripFees: 0,
      dailyAdvances: p.totalAdvances,
      dailyPenalties: p.totalPenalties,
      dailyTolls: 0,
    }));
    return [...drivers, ...employees].filter((p) => p.name.includes(query) || p.role.includes(query) || query === "");
  }, [payroll, employeePayroll, driverIds, employeeIds, query]);

  const adjOf = (p: PersonRow): PayrollAdjustment => adjustments.get(p.key) ?? EMPTY_ADJUSTMENT;
  const finalOf = (p: PersonRow) =>
    computeFinalPayroll({ baseSalary: p.baseSalary, shiftAllowances: p.shiftAllowances, tripFees: p.tripFees, advances: p.dailyAdvances, penalties: p.dailyPenalties, tolls: p.dailyTolls }, adjOf(p));
  const grandTotal = people.reduce((a, p) => a + finalOf(p).net, 0);

  const openAdjust = (p: PersonRow) => {
    const a = adjOf(p);
    setAdjForm({ bonus: a.bonus ? String(a.bonus) : "", advances: a.advances ? String(a.advances) : "", penalties: a.penalties ? String(a.penalties) : "", tolls: a.tolls ? String(a.tolls) : "", notes: a.notes, paySource: a.paySource ?? "" });
    setAdjFor(p);
  };
  const submitAdjust = async () => {
    if (!adjFor || !adjFor.id) return setError("تعذر تحديد الشخص");
    if (!canEdit) return setError("التعديل متاح عند اختيار فترة داخل شهر واحد");
    if ((Number(adjForm.advances) || 0) + (Number(adjForm.tolls) || 0) > 0 && !adjForm.paySource) return setError("اختر طريقة الدفع / مصدر التمويل للسلف والكرتات");
    setSaving(true);
    try {
      await savePayrollAdjustment(adjFor.type, adjFor.id, month, {
        bonus: Number(adjForm.bonus) || 0,
        advances: Number(adjForm.advances) || 0,
        penalties: Number(adjForm.penalties) || 0,
        tolls: Number(adjForm.tolls) || 0,
        notes: adjForm.notes,
        paySource: adjForm.paySource,
        locked: adjOf(adjFor).locked,
      });
      await loadAll();
      setAdjFor(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "تعذر حفظ التعديل");
    } finally {
      setSaving(false);
    }
  };
  const toggleLock = async (p: PersonRow) => {
    if (!p.id) return;
    if (!canEdit) return setError("القفل متاح عند اختيار فترة داخل شهر واحد");
    try {
      await savePayrollAdjustment(p.type, p.id, month, { ...adjOf(p), locked: !adjOf(p).locked });
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "تعذر تغيير القفل");
    }
  };
  const printStatement = (p: PersonRow) => {
    setPrinting(p);
    document.body.classList.add("print-statement");
    const cleanup = () => {
      document.body.classList.remove("print-statement");
      window.removeEventListener("afterprint", cleanup);
      setPrinting(null);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => window.print(), 150);
  };

  return (
    <AppShell>
      <PageHeader title="صفحة المرتبات والأجور" subtitle="التشغيل اليومي وكشوف المرتبات الحية للسائقين والموظفين — اضغط على أي اسم لعرض كارت التفاصيل الشامل" />

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Panel title="جدول التشغيل والورديات اليومي">
        <div className="mb-4 flex justify-end">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAdd}>
            <Plus className="ml-2 h-4 w-4" /> تسجيل وردية
          </Button>
        </div>
        <DataTable head={["التاريخ", "اسم السائق", "الأتوبيس", "الوردية (من ⬅ إلى)", "الحالة", "إضافي", "السُلفة", "الجزاءات", "الكرتة", "الملاحظات", "الإجراءات"]}>
          {loading ? (
            <tr>
              <td colSpan={11} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td>
            </tr>
          ) : shifts.length === 0 ? (
            <tr>
              <td colSpan={11} className="px-4 py-6 text-center text-muted-foreground">لا توجد تسجيلات لهذا الشهر بعد.</td>
            </tr>
          ) : (
            shifts.map((s) => (
              <tr key={s.id} className="transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3">{s.date}</td>
                <td className="px-4 py-3 font-bold">{s.driver}</td>
                <td className="px-4 py-3">{s.busPlate}</td>
                <td className="px-4 py-3 text-xs">
                  {s.shiftFrom || s.shiftTo ? `${s.shiftFrom || "—"} ⬅ ${s.shiftTo || "—"}` : "—"}
                </td>
                <td className="px-4 py-3">{s.status}</td>
                <td className="px-4 py-3 text-success">{currency(s.overtimeAllowance)}</td>
                <td className="px-4 py-3 text-warning">{currency(s.dailyAdvance)}</td>
                <td className="px-4 py-3 text-destructive">{currency(s.penalty)}</td>
                <td className="px-4 py-3 text-destructive">{currency(s.tollFee)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{s.notes || "—"}</td>
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

      <Panel title={`كشوف المرتبات — ${periodLabel(range)}`} className="mt-4">
        <Toolbar
          query={query}
          onQuery={setQuery}
          placeholder="ابحث باسم السائق أو الموظف..."
          onExport={() => exportToExcel("ملخص المرتبات", people.map((p) => { const f = finalOf(p); return { الفئة: p.type === "driver" ? "سائق" : "موظف", الاسم: p.name, الوظيفة: p.role, "المرتب الأساسي": f.baseSalary, "إضافي الورديات": f.shiftAllowances, "أجر الرحلات": f.tripFees, مكافآت: f.bonus, السُلف: f.advances, الجزاءات: f.penalties, الكرتات: f.tolls, الصافي: f.net, مقفل: adjOf(p).locked ? "نعم" : "لا" }; }) as Record<string, string | number>[])}
          extra={
            <div className="flex flex-wrap items-end gap-2">
              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">الشهر / السنة</Label>
                <Input type="month" value={canEdit ? month : ""} onChange={(e) => e.target.value && setRange(monthRange(e.target.value))} className="h-9 w-40 border-border bg-input/60" />
              </div>
              <DateRangeFilter value={range} onChange={setRange} />
            </div>
          }
        />
        <p className="mb-3 rounded-lg border border-border bg-secondary/30 p-2 text-xs text-muted-foreground">
          كل القيم تُحسب آليًا من التشغيل اليومي والرحلات والمأموريات. الصافي = (المرتب الأساسي + الورديات + أجور الرحلات والمأموريات) − (السُلف + الجزاءات + الكرتات)
        </p>
        <DataTable head={["اسم السائق / الموظف", "الوظيفة", "المرتب الأساسي", "إجمالي الورديات", "بدل الرحلات", "السُلف", "الجزاءات", "الكرتات", "صافي المرتب المستحق", "الإجراءات"]}>
          {loading ? (
            <tr><td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td></tr>
          ) : people.length === 0 ? (
            <tr><td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">لا يوجد سائقون أو موظفون نشطون بعد.</td></tr>
          ) : (
            people.map((p) => {
              const f = finalOf(p);
              const adj = adjOf(p);
              return (
                <tr key={p.key} className="cursor-pointer transition-colors hover:bg-secondary/30" onClick={() => setDetailFor(p)}>
                  <td className="px-4 py-3 font-bold">
                    {p.name}
                    {adj.locked && <Lock className="mr-1 inline h-3 w-3 text-primary" aria-label="مقفل" />}
                  </td>
                  <td className="px-4 py-3 text-xs">{p.role}</td>
                  <td className="px-4 py-3">{currency(f.baseSalary)}</td>
                  <td className="px-4 py-3 text-success">{currency(f.shiftAllowances + f.bonus)}</td>
                  <td className="px-4 py-3 text-success">{currency(f.tripFees)}</td>
                  <td className="px-4 py-3 text-warning">{currency(f.advances)}</td>
                  <td className="px-4 py-3 text-destructive">{currency(f.penalties)}</td>
                  <td className="px-4 py-3 text-destructive">{currency(f.tolls)}</td>
                  <td className="px-4 py-3 text-base font-extrabold text-primary">{currency(f.net)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => printStatement(p)} title="طباعة كشف حساب فردي">
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" disabled={adj.locked || !canEdit} onClick={() => openAdjust(p)} title="تسوية: مكافآت / جزاءات / سُلف / كرتات إضافية">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="hover:bg-primary/10" disabled={!canEdit} onClick={() => toggleLock(p)} title={adj.locked ? "فتح القفل" : "قفل نهائي"}>
                        {adj.locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </DataTable>
        <p className="mt-3 text-sm font-bold text-primary">إجمالي المرتبات الشهرية (سائقين + موظفين): {currency(grandTotal)}</p>
      </Panel>

      <Dialog open={!!adjFor} onOpenChange={(o) => !o && setAdjFor(null)}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">تعديل مرتب {adjFor?.name}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              تُضاف هذه القيم إلى ما سُجِّل يوميًا، لشهر {periodLabel(range)}. يمكن القفل النهائي بعد المراجعة.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {[
              ["bonus", "مكافآت / إضافي"],
              ["advances", "سُلف إضافية"],
              ["penalties", "جزاءات إضافية"],
              ["tolls", "كرتات"],
            ].map(([key, label]) => (
              <div key={key} className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input value={adjForm[key as keyof typeof adjForm]} onChange={(e) => setAdjForm({ ...adjForm, [key]: e.target.value })} type="number" min="0" step="any" className="border-border bg-input/60" />
              </div>
            ))}
            <PaymentSourceSelect value={adjForm.paySource} onChange={(v) => setAdjForm({ ...adjForm, paySource: v })} label="طريقة الدفع / مصدر التمويل (للسلف والكرتات)" />
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">ملاحظات</Label>
              <Input value={adjForm.notes} onChange={(e) => setAdjForm({ ...adjForm, notes: e.target.value })} className="border-border bg-input/60" />
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitAdjust} disabled={saving}>
              {saving ? "جارِ الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {printing && (() => {
        const f = finalOf(printing);
        const myShifts = shifts.filter((x) => sameDriver(x.driver, printing.name));
        const myDispatch = dispatchShifts.filter((x) => sameDriver(x.driver, printing.name));
        const td = { border: "1px solid #000", padding: 6 } as const;
        return (
          <div className="print-only" dir="rtl">
            <h1 style={{ textAlign: "center", fontSize: 22, fontWeight: 800 }}>وليد وطلعت لخدمات النقل والرحلات</h1>
            <h2 style={{ textAlign: "center", fontSize: 18, margin: "8px 0 16px" }}>كشف حساب {printing.type === "driver" ? "سائق" : "موظف"}</h2>
            <p style={{ marginBottom: 12 }}>
              <b>الاسم:</b> {printing.name} &nbsp;&nbsp; <b>الشهر:</b> {periodLabel(range)} &nbsp;&nbsp; <b>تاريخ الطباعة:</b> {new Date().toISOString().slice(0, 10)}
            </p>
            {printing.type === "driver" ? (() => {
              const rows = [
                ...myDispatch.map((x) => ({ k: `d${x.id}`, date: x.date, route: [x.route || x.client, x.missionId ? "(مأمورية)" : ""].filter(Boolean).join(" "), status: x.attendanceStatus || "حاضر", base: x.driverValue, ot: x.overtime, ded: x.advance + x.penalty + x.karta })),
                ...myShifts.map((x) => ({ k: `s${x.id}`, date: x.date, route: x.route || (x.shiftFrom || x.shiftTo ? `${x.shiftFrom || "—"} ⬅ ${x.shiftTo || "—"}` : "—"), status: x.status || "—", base: 0, ot: x.overtimeAllowance, ded: x.dailyAdvance + x.penalty + x.tollFee })),
              ].sort((m, n) => m.date.localeCompare(n.date));
              const otTotal = rows.reduce((t, r) => t + r.ot, 0);
              const rowsDed = rows.reduce((t, r) => t + r.ded, 0);
              const extraDed = Math.max(0, f.deductions - rowsDed);
              const allowTotal = f.baseSalary + (f.shiftAllowances - otTotal) + f.tripFees + f.bonus;
              const th = { ...td, background: "#eee", textAlign: "center" } as const;
              const sum = [
                ["إجمالي بدلات الورديات والرواتب", allowTotal],
                ["إجمالي الإضافي", otTotal],
                ["إجمالي السُلف والخصومات", f.deductions],
              ] as const;
              return (
                <>
                  <h3 style={{ fontWeight: 700, margin: "8px 0" }}>كشف مرتب مفصل — الورديات والمشاوير</h3>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 12 }}>
                    <thead>
                      <tr>{["تاريخ الوردية", "خط السير / المشوار", "حالة الحضور", "المبلغ الأساسي للوردية", "الإضافي المسجل", "السُلف والجزاءات والكرتات"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "center" }}>لا توجد ورديات مسجلة</td></tr>}
                      {rows.map((r) => (
                        <tr key={r.k}><td style={td}>{r.date}</td><td style={td}>{r.route}</td><td style={td}>{r.status}</td><td style={td}>{currency(r.base)}</td><td style={td}>{currency(r.ot)}</td><td style={td}>{currency(r.ded)}</td></tr>
                      ))}
                      {extraDed > 0 && <tr><td colSpan={5} style={td}>سُلف وخصومات أخرى (عهدة الخزينة / تسويات الشهر)</td><td style={td}>{currency(extraDed)}</td></tr>}
                      <tr style={{ fontWeight: 800, background: "#f6f6f6" }}><td colSpan={3} style={td}>الإجمالي</td><td style={td}>{currency(rows.reduce((t, r) => t + r.base, 0))}</td><td style={td}>{currency(otTotal)}</td><td style={td}>{currency(rowsDed + extraDed)}</td></tr>
                    </tbody>
                  </table>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <tbody>
                      <tr><td style={td}>المرتب الأساسي</td><td style={td}>{currency(f.baseSalary)}</td></tr>
                      {sum.map(([l, v]) => <tr key={l}><td style={td}>{l}</td><td style={td}>{currency(v)}</td></tr>)}
                      <tr style={{ fontWeight: 800, background: "#eee", fontSize: 16 }}><td style={td}>صافي المرتب النهائي المستحق للدفع</td><td style={td}>{currency(f.net)}</td></tr>
                    </tbody>
                  </table>
                </>
              );
            })() : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <tbody>
                  {[
                    ["المرتب الأساسي", f.baseSalary],
                    ["إضافي الورديات", f.shiftAllowances],
                    ["أجر الرحلات", f.tripFees],
                    ["مكافآت", f.bonus],
                    ["السُلف", f.advances],
                    ["الخصومات (الجزاءات)", f.penalties],
                    ["الكرتات", f.tolls],
                  ].map(([label, value]) => (
                    <tr key={label as string}><td style={td}>{label}</td><td style={td}>{currency(value as number)}</td></tr>
                  ))}
                  <tr style={{ fontWeight: 800 }}><td style={td}>الإجمالي النهائي (الصافي المستحق)</td><td style={td}>{currency(f.net)}</td></tr>
                </tbody>
              </table>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 48 }}>
              <span>التاريخ: ____ / ____ / ________</span>
              <span>توقيع المستلم: ______________________</span>
            </div>
          </div>
        );
      })()}


      <Sheet open={!!detailFor} onOpenChange={(o) => !o && setDetailFor(null)}>
        <SheetContent side="left" className="glass w-full overflow-y-auto text-foreground sm:max-w-2xl" dir="rtl">
          {detailFor && (() => {
            const f = finalOf(detailFor);
            const adj = adjOf(detailFor);
            const isDriver = detailFor.type === "driver";
            const myShifts = shifts.filter((x) => x.driver === detailFor.name);
            const myDuty = dispatchShifts.filter((x) => x.driver === detailFor.name && !x.missionId);
            const myMissions = dispatchShifts.filter((x) => x.driver === detailFor.name && x.missionId);
            const myTrips = payTrips.filter((x) => x.driver === detailFor.name);
            const myEmp = empRows.filter((x) => x.employee === detailFor.name);
            const cell = "px-3 py-2 text-sm";
            const empty = (n: number) => <tr><td colSpan={n} className="px-3 py-3 text-center text-xs text-muted-foreground">لا توجد بيانات</td></tr>;
            const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
              <section className="mt-5">
                <h3 className="mb-2 text-sm font-extrabold text-primary">{title}</h3>
                {children}
              </section>
            );
            return (
              <>
                <SheetHeader className="text-right">
                  <SheetTitle className="text-primary">تفاصيل كشف الحساب والشيفتات</SheetTitle>
                  <SheetDescription className="text-muted-foreground">
                    {detailFor.name} — {detailFor.role} — {periodLabel(range)}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["المرتب الأساسي", f.baseSalary, ""],
                    ["إجمالي الإضافات", f.additions, "text-success"],
                    ["إجمالي الخصومات", f.deductions, "text-destructive"],
                    ["صافي المرتب", f.net, "text-primary"],
                  ].map(([l, v, t]) => (
                    <div key={l as string} className="rounded-lg border border-border bg-secondary/20 p-2">
                      <p className="text-xs text-muted-foreground">{l}</p>
                      <p className={`font-extrabold ${t}`}>{currency(v as number)}</p>
                    </div>
                  ))}
                </div>

                <Section title="المرتب الأساسي">
                  <p className="text-sm">المرتب الشهري المسجَّل: <b>{currency(detailFor.baseSalary)}</b></p>
                </Section>

                {isDriver ? (
                  <>
                    <Section title="سجل الورديات والمشاوير">
                      <DataTable head={["التاريخ", "الأتوبيس", "الخط / الوردية", "إضافي / قيمة السواقة"]}>
                        {myShifts.length + myDuty.length === 0 ? empty(4) : (
                          <>
                            {myDuty.map((x) => (
                              <tr key={`d${x.id}`}><td className={cell}>{x.date}</td><td className={cell}>{x.busPlate}</td><td className={cell}>{x.route || x.client}</td><td className={`${cell} text-success`}>{currency(x.driverValue)}</td></tr>
                            ))}
                            {myShifts.map((x) => (
                              <tr key={`s${x.id}`}><td className={cell}>{x.date}</td><td className={cell}>{x.busPlate}</td><td className={cell}>{x.shiftFrom || x.shiftTo ? `${x.shiftFrom || "—"} ⬅ ${x.shiftTo || "—"}` : x.route}</td><td className={`${cell} text-success`}>{currency(x.overtimeAllowance)}</td></tr>
                            ))}
                          </>
                        )}
                      </DataTable>
                    </Section>
                    <Section title="سجل الرحلات والمأموريات">
                      <DataTable head={["التاريخ", "النوع", "الوجهة / المشوار", "أجر / بونص الرحلة"]}>
                        {myTrips.length + myMissions.length === 0 ? empty(4) : (
                          <>
                            {myTrips.map((x) => (
                              <tr key={`t${x.id}`}><td className={cell}>{x.date}</td><td className={cell}>رحلة</td><td className={cell}>{x.destination || x.client || "—"}</td><td className={`${cell} text-success`}>{currency(x.fee)}</td></tr>
                            ))}
                            {myMissions.map((x) => (
                              <tr key={`m${x.id}`}><td className={cell}>{x.date}</td><td className={cell}>مأمورية</td><td className={cell}>{x.route}</td><td className={`${cell} text-success`}>{currency(x.driverValue)}</td></tr>
                            ))}
                          </>
                        )}
                      </DataTable>
                    </Section>
                    <Section title="السُلف والجزاءات والكرتات (بالتاريخ)">
                      <DataTable head={["التاريخ", "السُلفة", "الجزاء", "الكرتة"]}>
                        {myShifts.filter((x) => x.dailyAdvance || x.penalty || x.tollFee).length === 0 ? empty(4) : myShifts.filter((x) => x.dailyAdvance || x.penalty || x.tollFee).map((x) => (
                          <tr key={`k${x.id}`}><td className={cell}>{x.date}</td><td className={`${cell} text-warning`}>{currency(x.dailyAdvance)}</td><td className={`${cell} text-destructive`}>{currency(x.penalty)}</td><td className={`${cell} text-destructive`}>{currency(x.tollFee)}</td></tr>
                        ))}
                      </DataTable>
                    </Section>
                  </>
                ) : (
                  <Section title="سجل الحضور والبدلات والسُلف والجزاءات">
                    <DataTable head={["التاريخ", "الحالة", "البدل", "السُلفة", "الجزاء"]}>
                      {myEmp.length === 0 ? empty(5) : myEmp.map((x) => (
                        <tr key={x.id}><td className={cell}>{x.date}</td><td className={cell}>{x.status || "—"}</td><td className={`${cell} text-success`}>{currency(x.allowance)}</td><td className={`${cell} text-warning`}>{currency(x.advance)}</td><td className={`${cell} text-destructive`}>{currency(x.penalty)}</td></tr>
                      ))}
                    </DataTable>
                  </Section>
                )}

                <Section title="ملخص الحساب">
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    {[
                      ["المرتب الأساسي", f.baseSalary],
                      ["إجمالي الورديات (إضافي وقيمة السواقة)", f.shiftAllowances],
                      ["أجور الرحلات والمأموريات", f.tripFees],
                      ["مكافآت (تسوية)", f.bonus],
                      ["السُلف", f.advances],
                      ["الجزاءات والخصومات", f.penalties],
                      ["الكرتات", f.tolls],
                    ].map(([l, v]) => (
                      <div key={l as string} className="flex justify-between rounded-lg border border-border bg-secondary/20 px-3 py-2"><dt className="text-muted-foreground">{l}</dt><dd className="font-bold">{currency(v as number)}</dd></div>
                    ))}
                    <div className="col-span-2 flex justify-between rounded-lg border border-primary/50 bg-primary/10 px-3 py-2 text-base font-extrabold"><dt>صافي المرتب المستحق</dt><dd>{currency(f.net)}</dd></div>
                  </dl>
                  {adj.notes && <p className="mt-2 text-xs text-muted-foreground">ملاحظات التسوية: {adj.notes}</p>}
                </Section>

                <div className="mt-5 flex gap-2">
                  <Button className="bg-primary text-primary-foreground" onClick={() => { const p = detailFor; setDetailFor(null); setTimeout(() => printStatement(p), 250); }}>
                    <Printer className="ml-2 h-4 w-4" /> طباعة كشف حساب فردي
                  </Button>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="glass max-h-[85vh] overflow-y-auto text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{form.id ? "تعديل وردية وتشغيل يومي" : "تسجيل وردية وتشغيل يومي"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">حضور السائق، الوردية، وأي إضافي أو سُلفة أو جزاء لهذا اليوم</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">السائق</Label>
                <Select value={form.driverName} onValueChange={(v) => setForm({ ...form, driverName: v })}>
                  <SelectTrigger className="border-border bg-input/60">
                    <SelectValue placeholder="اختر السائق" />
                  </SelectTrigger>
                  <SelectContent>
                    {driverNames.map((n) => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">التاريخ</Label>
                <Input value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} type="date" className="border-border bg-input/60" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">الأتوبيس (اختياري)</Label>
                <BusPicker value={form.busCode} buses={buses} allowNone placeholder="بدون تحديد" onChange={(v) => setForm({ ...form, busCode: v })} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">الخط (اختياري)</Label>
                <Select value={form.routeName} onValueChange={(v) => setForm({ ...form, routeName: v })}>
                  <SelectTrigger className="border-border bg-input/60">
                    <SelectValue placeholder="بدون تحديد" />
                  </SelectTrigger>
                  <SelectContent>
                    {routeNames.map((n) => (
                      <SelectItem key={n} value={n}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">من (نقطة الانطلاق)</Label>
                <Input value={form.shiftFrom} onChange={(e) => setForm({ ...form, shiftFrom: e.target.value })} className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">إلى (نقطة الوصول)</Label>
                <Input value={form.shiftTo} onChange={(e) => setForm({ ...form, shiftTo: e.target.value })} className="border-border bg-input/60" />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">حالة الحضور</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="border-border bg-input/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="حاضر">حاضر</SelectItem>
                  <SelectItem value="غائب">غائب</SelectItem>
                  <SelectItem value="إجازة">إجازة</SelectItem>
                  <SelectItem value="بدل">بدل</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">إضافي</Label>
                <Input value={form.overtimeAllowance} onChange={(e) => setForm({ ...form, overtimeAllowance: e.target.value })} type="number" className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">السُلفة</Label>
                <Input value={form.dailyAdvance} onChange={(e) => setForm({ ...form, dailyAdvance: e.target.value })} type="number" className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">الجزاء</Label>
                <Input value={form.penalty} onChange={(e) => setForm({ ...form, penalty: e.target.value })} type="number" className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">الكرتة / مصاريف الطريق</Label>
                <Input value={form.tollFee} onChange={(e) => setForm({ ...form, tollFee: e.target.value })} type="number" className="border-border bg-input/60" />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">ملاحظات</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="border-border bg-input/60" />
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submit} disabled={saving}>
              {saving ? "جارِ الحفظ..." : form.id ? "حفظ التعديلات" : "حفظ التسجيل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="glass text-foreground" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">حذف التسجيل؟</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              سيتم حذف وردية {deleteTarget?.driver} بتاريخ {deleteTarget?.date} نهائيًا. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "جارِ الحذف..." : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
