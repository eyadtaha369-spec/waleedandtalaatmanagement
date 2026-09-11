import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Printer } from "lucide-react";
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
import { currency } from "@/lib/fleet-data";
import { fetchDrivers } from "@/lib/queries";
import { fetchDailyShifts, upsertDailyShift, fetchDriverPayroll, type DailyShift, type DriverPayrollRow } from "@/lib/queries";

export const Route = createFileRoute("/payroll")({
  head: () => ({
    meta: [{ title: "تسجيل التشغيل اليومي والمرتبات | وليد وطلعت" }],
  }),
  component: PayrollPage,
});

function PayrollPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [shifts, setShifts] = useState<DailyShift[]>([]);
  const [payroll, setPayroll] = useState<DriverPayrollRow[]>([]);
  const [driverNames, setDriverNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    driverName: "",
    date: new Date().toISOString().slice(0, 10),
    status: "حاضر",
    overtimeAllowance: "",
    dailyAdvance: "",
    penalty: "",
    notes: "",
  });

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p, drivers] = await Promise.all([fetchDailyShifts(month), fetchDriverPayroll(month), fetchDrivers()]);
      setShifts(s);
      setPayroll(p);
      setDriverNames(drivers.map((d) => d.name));
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

  const submit = async () => {
    if (!form.driverName.trim()) return;
    setSaving(true);
    try {
      await upsertDailyShift({
        driverName: form.driverName,
        date: form.date,
        status: form.status,
        overtimeAllowance: Number(form.overtimeAllowance) || 0,
        dailyAdvance: Number(form.dailyAdvance) || 0,
        penalty: Number(form.penalty) || 0,
        notes: form.notes,
      });
      await loadAll();
      setForm({ driverName: "", date: new Date().toISOString().slice(0, 10), status: "حاضر", overtimeAllowance: "", dailyAdvance: "", penalty: "", notes: "" });
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ التسجيل اليومي");
    } finally {
      setSaving(false);
    }
  };

  const filteredPayroll = payroll.filter((p) => p.driver.includes(query) || query === "");

  return (
    <AppShell>
      <PageHeader title="تسجيل التشغيل اليومي والمرتبات" subtitle="حضور السائقين اليومي، الإضافي، السُلف، والجزاءات" />

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Panel title="التسجيل اليومي">
        <div className="mb-4 flex justify-end">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setAdding(true)}>
            <Plus className="ml-2 h-4 w-4" /> تسجيل يوم عمل
          </Button>
        </div>
        <DataTable head={["السائق", "التاريخ", "الحالة", "الإضافي", "السُلفة", "الجزاء", "ملاحظات"]}>
          {loading ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td>
            </tr>
          ) : shifts.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">لا توجد تسجيلات لهذا الشهر بعد.</td>
            </tr>
          ) : (
            shifts.map((s) => (
              <tr key={s.id} className="transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3 font-bold">{s.driver}</td>
                <td className="px-4 py-3">{s.date}</td>
                <td className="px-4 py-3">{s.status}</td>
                <td className="px-4 py-3 text-success">{currency(s.overtimeAllowance)}</td>
                <td className="px-4 py-3 text-warning">{currency(s.dailyAdvance)}</td>
                <td className="px-4 py-3 text-destructive">{currency(s.penalty)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{s.notes || "—"}</td>
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
              <div className="grid gap-1.5">
                <Input
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  type="month"
                  className="h-9 w-40 border-border bg-input/60"
                />
              </div>
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
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">تسجيل يوم عمل</DialogTitle>
            <DialogDescription className="text-muted-foreground">حضور السائق وأي إضافي أو سُلفة أو جزاء لهذا اليوم</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
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
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">الحالة</Label>
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
            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">الإضافي/البدل</Label>
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
              {saving ? "جارِ الحفظ..." : "حفظ التسجيل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
