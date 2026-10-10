import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Lock, Pencil, Plus, Printer, Trash2, Unlock } from "lucide-react";
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
import { currency } from "@/lib/fleet-data";
import { fetchDrivers, fetchBuses, fetchRoutes } from "@/lib/queries";
import {
  fetchDailyShifts,
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
}

const monthLabel = (m: string) => {
  const [y, mo] = m.split("-");
  const names = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  return `${names[Number(mo) - 1] ?? mo} ${y}`;
};

function PayrollPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [shifts, setShifts] = useState<DailyShift[]>([]);
  const [payroll, setPayroll] = useState<DriverPayrollRow[]>([]);
  const [employeePayroll, setEmployeePayroll] = useState<EmployeePayrollRow[]>([]);
  const [driverNames, setDriverNames] = useState<string[]>([]);
  const [busCodes, setBusCodes] = useState<string[]>([]);
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
  const [adjForm, setAdjForm] = useState({ bonus: "", advances: "", penalties: "", tolls: "", notes: "" });
  const [printing, setPrinting] = useState<PersonRow | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p, ep, drivers, buses, routes, employees, adj, ds] = await Promise.all([
        fetchDailyShifts(month),
        fetchDriverPayroll(month),
        fetchEmployeePayroll(month),
        fetchDrivers(),
        fetchBuses(),
        fetchRoutes(),
        fetchEmployees(),
        fetchPayrollAdjustments(month),
        fetchDispatchShifts(month),
      ]);
      setDriverIds(new Map(drivers.map((d) => [d.name, d.id])));
      setEmployeeIds(new Map(employees.map((e) => [e.name, e.id])));
      setAdjustments(adj);
      setDispatchShifts(ds);
      setShifts(s);
      setPayroll(p);
      setEmployeePayroll(ep);
      setDriverNames(drivers.map((d) => d.name));
      setBusCodes(buses.map((b) => b.code));
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
  }, [month]);

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
    }));
    return [...drivers, ...employees].filter((p) => p.name.includes(query) || p.role.includes(query) || query === "");
  }, [payroll, employeePayroll, driverIds, employeeIds, query]);

  const adjOf = (p: PersonRow): PayrollAdjustment => adjustments.get(p.key) ?? EMPTY_ADJUSTMENT;
  const finalOf = (p: PersonRow) =>
    computeFinalPayroll({ baseSalary: p.baseSalary, shiftAllowances: p.shiftAllowances, tripFees: p.tripFees, advances: p.dailyAdvances, penalties: p.dailyPenalties }, adjOf(p));
  const grandTotal = people.reduce((a, p) => a + finalOf(p).net, 0);

  const openAdjust = (p: PersonRow) => {
    const a = adjOf(p);
    setAdjForm({ bonus: a.bonus ? String(a.bonus) : "", advances: a.advances ? String(a.advances) : "", penalties: a.penalties ? String(a.penalties) : "", tolls: a.tolls ? String(a.tolls) : "", notes: a.notes });
    setAdjFor(p);
  };
  const submitAdjust = async () => {
    if (!adjFor || !adjFor.id) return setError("تعذر تحديد الشخص");
    setSaving(true);
    try {
      await savePayrollAdjustment(adjFor.type, adjFor.id, month, {
        bonus: Number(adjForm.bonus) || 0,
        advances: Number(adjForm.advances) || 0,
        penalties: Number(adjForm.penalties) || 0,
        tolls: Number(adjForm.tolls) || 0,
        notes: adjForm.notes,
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
      <PageHeader title="تسجيل التشغيل اليومي والمرتبات" subtitle="حضور السائقين اليومي، الورديات، الإضافي، السُلف، والجزاءات" />

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
        <DataTable head={["التاريخ", "اسم السائق", "الأتوبيس", "الوردية (من ⬅ إلى)", "الحالة", "إضافي", "السُلفة", "الجزاءات", "الملاحظات", "الإجراءات"]}>
          {loading ? (
            <tr>
              <td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td>
            </tr>
          ) : shifts.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-6 text-center text-muted-foreground">لا توجد تسجيلات لهذا الشهر بعد.</td>
            </tr>
          ) : (
            shifts.map((s) => (
              <tr key={s.id} className="transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3">{s.date}</td>
                <td className="px-4 py-3 font-bold">{s.driver}</td>
                <td className="px-4 py-3">{s.bus}</td>
                <td className="px-4 py-3 text-xs">
                  {s.shiftFrom || s.shiftTo ? `${s.shiftFrom || "—"} ⬅ ${s.shiftTo || "—"}` : "—"}
                </td>
                <td className="px-4 py-3">{s.status}</td>
                <td className="px-4 py-3 text-success">{currency(s.overtimeAllowance)}</td>
                <td className="px-4 py-3 text-warning">{currency(s.dailyAdvance)}</td>
                <td className="px-4 py-3 text-destructive">{currency(s.penalty)}</td>
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

      <Panel title={`كشوف المرتبات — ${monthLabel(month)}`} className="mt-4">
        <Toolbar
          query={query}
          onQuery={setQuery}
          placeholder="ابحث باسم السائق أو الموظف..."
          onExport={() => exportToExcel("ملخص المرتبات", people.map((p) => { const f = finalOf(p); return { الفئة: p.type === "driver" ? "سائق" : "موظف", الاسم: p.name, الوظيفة: p.role, "المرتب الأساسي": f.baseSalary, "إضافي الورديات": f.shiftAllowances, "أجر الرحلات": f.tripFees, مكافآت: f.bonus, السُلف: f.advances, الجزاءات: f.penalties, الكرتات: f.tolls, الصافي: f.net, مقفل: adjOf(p).locked ? "نعم" : "لا" }; }) as Record<string, string | number>[])}
          extra={<Input value={month} onChange={(e) => setMonth(e.target.value)} type="month" className="h-9 w-40 border-border bg-input/60" />}
        />
        <p className="mb-3 rounded-lg border border-border bg-secondary/30 p-2 text-xs text-muted-foreground">
          الصافي = المرتب الأساسي + إضافي الورديات + أجر الرحلات (+ مكافآت) − (السُلف + الجزاءات + الكرتات)
        </p>
        <div className="space-y-3">
          {loading ? (
            <p className="py-6 text-center text-muted-foreground">جارِ التحميل...</p>
          ) : people.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">لا يوجد سائقون أو موظفون نشطون بعد.</p>
          ) : (
            people.map((p) => {
              const f = finalOf(p);
              const adj = adjOf(p);
              const open = expandedKey === p.key;
              return (
                <div key={p.key} className={`panel overflow-hidden transition-colors ${open ? "border-primary/60" : ""}`}>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={open}
                    onClick={() => setExpandedKey(open ? null : p.key)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setExpandedKey(open ? null : p.key))}
                    className="flex cursor-pointer flex-wrap items-center gap-x-6 gap-y-3 p-4 hover:bg-secondary/20"
                  >
                    <div className="min-w-[10rem] flex-1">
                      <p className="text-lg font-extrabold">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.role}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">المرتب الأساسي</p>
                      <p className="font-bold">{currency(f.baseSalary)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">إجمالي الإضافات</p>
                      <p className="font-bold text-success">{currency(f.additions)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">إجمالي الخصومات</p>
                      <p className="font-bold text-destructive">{currency(f.deductions)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">صافي المرتب</p>
                      <p className="text-lg font-extrabold text-primary">{currency(f.net)}</p>
                    </div>
                    {adj.locked && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary">
                        <Lock className="h-3 w-3" /> مقفل
                      </span>
                    )}
                    <ChevronDown className={`h-5 w-5 text-primary transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
                  </div>

                  <div className={`grid transition-all duration-300 ease-in-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                    <div className="overflow-hidden">
                      <div className="border-t border-border p-4">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <Button size="sm" variant="outline" className="border-border" disabled={adj.locked} onClick={() => openAdjust(p)}>
                            <Pencil className="ml-1 h-4 w-4" /> تعديل (مكافآت / جزاءات / سُلف / كرتات)
                          </Button>
                          <Button size="sm" variant="outline" className="border-border" onClick={() => toggleLock(p)}>
                            {adj.locked ? <Unlock className="ml-1 h-4 w-4" /> : <Lock className="ml-1 h-4 w-4" />}
                            {adj.locked ? "فتح القفل" : "قفل نهائي"}
                          </Button>
                          <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => printStatement(p)}>
                            <Printer className="ml-1 h-4 w-4" /> طباعة كشف حساب {p.type === "driver" ? "سائق" : "موظف"}
                          </Button>
                        </div>
                        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                          {[
                            ["المرتب الأساسي", f.baseSalary, ""],
                            ["إضافي الورديات", f.shiftAllowances, "text-success"],
                            ["أجر الرحلات", f.tripFees, "text-success"],
                            ["مكافآت", f.bonus, "text-success"],
                            ["السُلف", f.advances, "text-warning"],
                            ["الجزاءات", f.penalties, "text-destructive"],
                            ["الكرتات", f.tolls, "text-destructive"],
                            ["الصافي النهائي", f.net, "text-primary"],
                          ].map(([label, value, tone]) => (
                            <div key={label as string} className="rounded-lg border border-border bg-secondary/20 p-2">
                              <dt className="text-xs text-muted-foreground">{label}</dt>
                              <dd className={`font-bold ${tone}`}>{currency(value as number)}</dd>
                            </div>
                          ))}
                        </dl>
                        {adj.notes && <p className="mt-2 text-xs text-muted-foreground">ملاحظات: {adj.notes}</p>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <p className="mt-3 text-sm font-bold text-primary">إجمالي المرتبات الشهرية (سائقين + موظفين): {currency(grandTotal)}</p>
      </Panel>

      <Dialog open={!!adjFor} onOpenChange={(o) => !o && setAdjFor(null)}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">تعديل مرتب {adjFor?.name}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              تُضاف هذه القيم إلى ما سُجِّل يوميًا، لشهر {monthLabel(month)}. يمكن القفل النهائي بعد المراجعة.
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
        const myShifts = shifts.filter((x) => x.driver === printing.name);
        const myDispatch = dispatchShifts.filter((x) => x.driver === printing.name);
        const td = { border: "1px solid #000", padding: 6 } as const;
        return (
          <div className="print-only" dir="rtl">
            <h1 style={{ textAlign: "center", fontSize: 22, fontWeight: 800 }}>وليد وطلعت لخدمات النقل والرحلات</h1>
            <h2 style={{ textAlign: "center", fontSize: 18, margin: "8px 0 16px" }}>كشف حساب {printing.type === "driver" ? "سائق" : "موظف"}</h2>
            <p style={{ marginBottom: 12 }}>
              <b>الاسم:</b> {printing.name} &nbsp;&nbsp; <b>الشهر:</b> {monthLabel(month)} &nbsp;&nbsp; <b>تاريخ الطباعة:</b> {new Date().toISOString().slice(0, 10)}
            </p>
            {printing.type === "driver" && (
              <>
                <h3 style={{ fontWeight: 700, margin: "8px 0" }}>بيان الورديات</h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
                  <thead>
                    <tr>{["التاريخ", "الأتوبيس", "الخط / الوردية", "إضافي / قيمة السواقة"].map((h) => <th key={h} style={{ ...td, background: "#eee" }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {myShifts.length + myDispatch.length === 0 && <tr><td colSpan={4} style={td}>لا توجد ورديات مسجلة</td></tr>}
                    {myDispatch.map((x) => (
                      <tr key={`d${x.id}`}><td style={td}>{x.date}</td><td style={td}>{x.bus}</td><td style={td}>{x.route || x.client}</td><td style={td}>{currency(x.driverValue)}</td></tr>
                    ))}
                    {myShifts.map((x) => (
                      <tr key={`s${x.id}`}><td style={td}>{x.date}</td><td style={td}>{x.bus}</td><td style={td}>{x.shiftFrom || x.shiftTo ? `${x.shiftFrom || "—"} ⬅ ${x.shiftTo || "—"}` : x.route}</td><td style={td}>{currency(x.overtimeAllowance)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
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
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 48 }}>
              <span>التاريخ: ____ / ____ / ________</span>
              <span>توقيع المستلم: ______________________</span>
            </div>
          </div>
        );
      })()}

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
                <Select value={form.busCode} onValueChange={(v) => setForm({ ...form, busCode: v })}>
                  <SelectTrigger className="border-border bg-input/60">
                    <SelectValue placeholder="بدون تحديد" />
                  </SelectTrigger>
                  <SelectContent>
                    {busCodes.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
