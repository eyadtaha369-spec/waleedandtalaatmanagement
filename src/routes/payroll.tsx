import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pencil, Plus, Printer, Trash2 } from "lucide-react";
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

function PayrollPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [shifts, setShifts] = useState<DailyShift[]>([]);
  const [payroll, setPayroll] = useState<DriverPayrollRow[]>([]);
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

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p, drivers, buses, routes] = await Promise.all([
        fetchDailyShifts(month),
        fetchDriverPayroll(month),
        fetchDrivers(),
        fetchBuses(),
        fetchRoutes(),
      ]);
      setShifts(s);
      setPayroll(p);
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

  const filteredPayroll = payroll.filter((p) => p.driver.includes(query) || query === "");

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

      <Panel title="ملخص المرتبات الشهري" className="mt-4">
        <Toolbar
          query={query}
          onQuery={setQuery}
          placeholder="ابحث باسم السائق..."
          onExport={() => exportToExcel("ملخص المرتبات", filteredPayroll as unknown as Record<string, string | number>[])}
          extra={
            <>
              <Input value={month} onChange={(e) => setMonth(e.target.value)} type="month" className="h-9 w-40 border-border bg-input/60" />
              <Button variant="outline" className="border-border" onClick={() => window.print()}>
                <Printer className="ml-2 h-4 w-4" /> طباعة مفردات المرتب
              </Button>
            </>
          }
        />
        <DataTable head={["اسم السائق", "المرتب الأساسي", "إجمالي الإضافي/البدلات", "إجمالي السُلف", "إجمالي الجزاءات", "صافي المرتب المستحق"]}>
          {loading ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td>
            </tr>
          ) : filteredPayroll.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">لا يوجد سائقون بعد.</td>
            </tr>
          ) : (
            filteredPayroll.map((p) => (
              <tr key={p.driver} className="transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3 font-bold">{p.driver}</td>
                <td className="px-4 py-3">{currency(p.baseSalary)}</td>
                <td className="px-4 py-3 text-success">{currency(p.totalOvertime)}</td>
                <td className="px-4 py-3 text-warning">{currency(p.totalAdvances)}</td>
                <td className="px-4 py-3 text-destructive">{currency(p.totalPenalties)}</td>
                <td className="px-4 py-3 font-bold text-primary">{currency(p.netSalary)}</td>
              </tr>
            ))
          )}
        </DataTable>
      </Panel>

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
