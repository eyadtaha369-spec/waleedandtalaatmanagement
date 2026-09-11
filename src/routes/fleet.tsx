import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DataTable, PageHeader, Panel, StatusPill, Toolbar, exportToExcel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type Bus, type Driver, type Attendance } from "@/lib/fleet-data";
import { fetchBuses, fetchDrivers, fetchAttendance, addBus as addBusApi, addDriver as addDriverApi, checkInDriver, checkOutDriver, upsertAttendanceRecord, bulkInsertBuses, bulkInsertDrivers } from "@/lib/queries";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CsvImportDialog } from "@/components/csv-import-dialog";

export const Route = createFileRoute("/fleet")({
  head: () => ({
    meta: [
      { title: "إدارة الأسطول والسائقين | وليد وطلعت" },
      { name: "description", content: "متابعة الأتوبيسات والتراخيص والسائقين وسجل الحضور اليومي." },
      { property: "og:title", content: "إدارة الأسطول والسائقين | وليد وطلعت" },
      { property: "og:description", content: "بيانات الأتوبيسات والسائقين والورديات والحضور." },
    ],
  }),
  component: FleetPage,
});

const busTone = (s: Bus["status"]) => (s === "تعمل" ? "good" : s === "بالورشة" ? "warn" : "bad") as const;

function FleetPage() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Bus | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingDriver, setAddingDriver] = useState(false);
  const [importingBuses, setImportingBuses] = useState(false);
  const [importingDrivers, setImportingDrivers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: "", plate: "", model: "", capacity: "", odometer: "", status: "تعمل" });
  const [driverForm, setDriverForm] = useState({ name: "", phone: "", license: "", licenseExpiry: "" });
  const [attendanceBusy, setAttendanceBusy] = useState<string | null>(null);
  const [addingAttendance, setAddingAttendance] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [attendanceForm, setAttendanceForm] = useState({
    id: "",
    driverName: "",
    date: todayStr,
    checkIn: "",
    checkOut: "",
    status: "حاضر",
  });

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, d, a] = await Promise.all([fetchBuses(), fetchDrivers(), fetchAttendance()]);
      setBuses(b);
      setDrivers(d);
      setAttendanceRows(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filtered = useMemo(
    () =>
      buses.filter((b) =>
        [b.code, b.plate, b.model, b.driver].join(" ").toLowerCase().includes(query.toLowerCase()),
      ),
    [buses, query],
  );

  const addBus = async () => {
    if (!form.code.trim()) return;
    setSaving(true);
    try {
      await addBusApi({
        code: form.code,
        plate: form.plate,
        model: form.model,
        capacity: Number(form.capacity) || 0,
        odometer: Number(form.odometer) || 0,
        status: form.status,
      });
      await loadAll();
      setForm({ code: "", plate: "", model: "", capacity: "", odometer: "", status: "تعمل" });
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إضافة الأتوبيس");
    } finally {
      setSaving(false);
    }
  };

  const addDriver = async () => {
    if (!driverForm.name.trim()) return;
    setSaving(true);
    try {
      await addDriverApi(driverForm);
      await loadAll();
      setDriverForm({ name: "", phone: "", license: "", licenseExpiry: "" });
      setAddingDriver(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إضافة السائق");
    } finally {
      setSaving(false);
    }
  };

  const handleCheckIn = async (driverId: string) => {
    setAttendanceBusy(driverId);
    try {
      await checkInDriver(driverId);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تسجيل الحضور");
    } finally {
      setAttendanceBusy(null);
    }
  };

  const handleCheckOut = async (driverId: string) => {
    setAttendanceBusy(driverId);
    try {
      await checkOutDriver(driverId);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تسجيل الانصراف");
    } finally {
      setAttendanceBusy(null);
    }
  };

  const openAttendanceForm = (row?: Attendance) => {
    if (row) {
      setAttendanceForm({
        id: row.id,
        driverName: row.driver,
        date: row.date,
        checkIn: row.checkIn === "—" ? "" : row.checkIn,
        checkOut: row.checkOut === "—" ? "" : row.checkOut,
        status: row.status,
      });
    } else {
      setAttendanceForm({ id: "", driverName: "", date: todayStr, checkIn: "", checkOut: "", status: "حاضر" });
    }
    setAddingAttendance(true);
  };

  const submitAttendance = async () => {
    if (!attendanceForm.driverName.trim() || !attendanceForm.date.trim()) return;
    setSaving(true);
    try {
      await upsertAttendanceRecord({
        id: attendanceForm.id || undefined,
        driverName: attendanceForm.driverName,
        date: attendanceForm.date,
        checkIn: attendanceForm.checkIn,
        checkOut: attendanceForm.checkOut,
        status: attendanceForm.status,
      });
      await loadAll();
      setAddingAttendance(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ سجل الحضور");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <PageHeader title="إدارة الأسطول والسائقين" subtitle="الأتوبيسات، السائقون، وسجل الحضور اليومي" />

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Tabs defaultValue="buses">
        <TabsList className="no-print mb-4 border border-border bg-secondary/50">
          <TabsTrigger value="buses">الأتوبيسات</TabsTrigger>
          <TabsTrigger value="drivers">السائقون</TabsTrigger>
          <TabsTrigger value="attendance">حضور السائقين</TabsTrigger>
        </TabsList>

        <TabsContent value="buses">
          <Panel title="سجل الأتوبيسات">
            <Toolbar
              query={query}
              onQuery={setQuery}
              onExport={() => exportToExcel("الأتوبيسات", filtered as unknown as Record<string, string | number>[])}
              extra={
                <>
                  <Button variant="outline" className="border-border" onClick={() => setImportingBuses(true)}>
                    استيراد CSV
                  </Button>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setAdding(true)}>
                    <Plus className="ml-2 h-4 w-4" /> إضافة أتوبيس
                  </Button>
                </>
              }
            />
            <DataTable head={["الكود", "رقم اللوحة", "الموديل", "السعة", "قراءة العداد", "السائق", "الحالة", "تفاصيل"]}>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td>
                </tr>
              ) : (
                filtered.map((b) => (
                  <tr key={b.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3 font-bold text-primary">{b.code}</td>
                    <td className="px-4 py-3">{b.plate}</td>
                    <td className="px-4 py-3">{b.model}</td>
                    <td className="px-4 py-3">{b.capacity} راكب</td>
                    <td className="px-4 py-3">{b.odometer.toLocaleString("ar-EG")} كم</td>
                    <td className="px-4 py-3">{b.driver}</td>
                    <td className="px-4 py-3">
                      <StatusPill label={b.status} tone={busTone(b.status)} />
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => setSelected(b)}>
                        عرض
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </DataTable>
          </Panel>
        </TabsContent>

        <TabsContent value="drivers">
          <Panel title="بيانات السائقين">
            <Toolbar
              query={query}
              onQuery={setQuery}
              placeholder="ابحث باسم السائق..."
              onExport={() => exportToExcel("السائقون", drivers as unknown as Record<string, string | number>[])}
              extra={
                <>
                  <Button variant="outline" className="border-border" onClick={() => setImportingDrivers(true)}>
                    استيراد CSV
                  </Button>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setAddingDriver(true)}>
                    <Plus className="ml-2 h-4 w-4" /> إضافة سائق
                  </Button>
                </>
              }
            />
            <DataTable head={["الاسم", "الهاتف", "نوع الرخصة", "انتهاء الرخصة", "الأتوبيس الأساسي", "الاحتياطي", "الوردية"]}>
              {drivers
                .filter((d) => d.name.includes(query) || query === "")
                .map((d) => (
                  <tr key={d.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3 font-bold">{d.name}</td>
                    <td className="px-4 py-3">{d.phone}</td>
                    <td className="px-4 py-3">{d.license}</td>
                    <td className="px-4 py-3">{d.licenseExpiry}</td>
                    <td className="px-4 py-3 text-primary">{d.primaryBus}</td>
                    <td className="px-4 py-3">{d.backupBus}</td>
                    <td className="px-4 py-3">
                      <StatusPill label={d.shift} tone={d.shift === "راحة" ? "muted" : "info"} />
                    </td>
                  </tr>
                ))}
            </DataTable>
          </Panel>
        </TabsContent>

        <TabsContent value="attendance">
          <Panel title="تسجيل حضور اليوم">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {drivers.map((d) => {
                const todayRow = attendanceRows.find((a) => a.driver === d.name && a.date === todayStr);
                const busy = attendanceBusy === d.id;
                return (
                  <div key={d.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-secondary/25 p-3">
                    <div>
                      <p className="text-sm font-bold">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {todayRow ? `حضور: ${todayRow.checkIn} • انصراف: ${todayRow.checkOut}` : "لم يسجل بعد اليوم"}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                        disabled={busy || (!!todayRow && todayRow.checkIn !== "—")}
                        onClick={() => handleCheckIn(d.id)}
                      >
                        حضور
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-border"
                        disabled={busy || !todayRow || todayRow.checkIn === "—" || todayRow.checkOut !== "—"}
                        onClick={() => handleCheckOut(d.id)}
                      >
                        انصراف
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="سجل الحضور والانصراف" className="mt-4">
            <Toolbar
              query={query}
              onQuery={setQuery}
              placeholder="ابحث باسم السائق..."
              onExport={() => exportToExcel("الحضور", attendanceRows as unknown as Record<string, string | number>[])}
              extra={
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => openAttendanceForm()}>
                  <Plus className="ml-2 h-4 w-4" /> سجل يدوي / تصحيح
                </Button>
              }
            />
            <DataTable head={["السائق", "التاريخ", "الحضور", "الانصراف", "الحالة", ""]}>
              {attendanceRows
                .filter((a) => a.driver.includes(query) || query === "")
                .map((a) => (
                  <tr key={a.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3 font-bold">{a.driver}</td>
                    <td className="px-4 py-3">{a.date}</td>
                    <td className="px-4 py-3">{a.checkIn}</td>
                    <td className="px-4 py-3">{a.checkOut}</td>
                    <td className="px-4 py-3">
                      <StatusPill
                        label={a.status}
                        tone={a.status === "حاضر" ? "good" : a.status === "متأخر" ? "warn" : "bad"}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openAttendanceForm(a)}>
                        تعديل
                      </Button>
                    </td>
                  </tr>
                ))}
            </DataTable>
          </Panel>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">تفاصيل الأتوبيس {selected?.code}</DialogTitle>
            <DialogDescription className="text-muted-foreground">بيانات التشغيل والتراخيص والصيانة</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["رقم اللوحة", selected.plate],
                ["الموديل", selected.model],
                ["السعة", `${selected.capacity} راكب`],
                ["قراءة العداد", `${selected.odometer.toLocaleString("ar-EG")} كم`],
                ["انتهاء الترخيص", selected.licenseExpiry],
                ["انتهاء التأمين", selected.insuranceExpiry],
                ["أحدث صيانة", selected.lastMaintenance],
                ["السائق", selected.driver],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-border bg-secondary/30 p-3">
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className="mt-1 font-bold">{v}</p>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={() => setSelected(null)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">إضافة أتوبيس جديد</DialogTitle>
            <DialogDescription className="text-muted-foreground">أدخل بيانات الأتوبيس الأساسية</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {[
              ["code", "كود الأتوبيس (WV-007)"],
              ["plate", "رقم اللوحة"],
              ["model", "الموديل"],
              ["capacity", "السعة", "number"],
              ["odometer", "قراءة العداد", "number"],
            ].map(([key, label, type]) => (
              <div key={key} className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  type={type || "text"}
                  className="border-border bg-input/60"
                />
              </div>
            ))}
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">الحالة</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="border-border bg-input/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="تعمل">تعمل</SelectItem>
                  <SelectItem value="بالورشة">بالورشة</SelectItem>
                  <SelectItem value="متوقفة">متوقفة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={addBus} disabled={saving}>
              {saving ? "جارِ الحفظ..." : "حفظ الأتوبيس"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={addingDriver} onOpenChange={setAddingDriver}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">إضافة سائق جديد</DialogTitle>
            <DialogDescription className="text-muted-foreground">أدخل بيانات السائق الأساسية</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {[
              ["name", "الاسم"],
              ["phone", "الهاتف", "tel"],
              ["license", "نوع الرخصة"],
              ["licenseExpiry", "تاريخ انتهاء الرخصة (YYYY-MM-DD)", "date"],
            ].map(([key, label, type]) => (
              <div key={key} className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  value={driverForm[key as keyof typeof driverForm]}
                  onChange={(e) => setDriverForm({ ...driverForm, [key]: e.target.value })}
                  type={type || "text"}
                  className="border-border bg-input/60"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={addDriver} disabled={saving}>
              {saving ? "جارِ الحفظ..." : "حفظ السائق"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={addingAttendance} onOpenChange={setAddingAttendance}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{attendanceForm.id ? "تعديل سجل حضور" : "سجل حضور يدوي"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">لتسجيل حضور بتاريخ سابق أو تصحيح سجل قائم</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">اسم السائق</Label>
              <Input
                value={attendanceForm.driverName}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, driverName: e.target.value })}
                className="border-border bg-input/60"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">التاريخ (YYYY-MM-DD)</Label>
              <Input
                value={attendanceForm.date}
                onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })}
                className="border-border bg-input/60"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">وقت الحضور (HH:MM)</Label>
                <Input
                  value={attendanceForm.checkIn}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, checkIn: e.target.value })}
                  className="border-border bg-input/60"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">وقت الانصراف (HH:MM)</Label>
                <Input
                  value={attendanceForm.checkOut}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, checkOut: e.target.value })}
                  className="border-border bg-input/60"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">الحالة</Label>
              <Select value={attendanceForm.status} onValueChange={(v) => setAttendanceForm({ ...attendanceForm, status: v })}>
                <SelectTrigger className="border-border bg-input/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="حاضر">حاضر</SelectItem>
                  <SelectItem value="متأخر">متأخر</SelectItem>
                  <SelectItem value="غائب">غائب</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitAttendance} disabled={saving}>
              {saving ? "جارِ الحفظ..." : "حفظ السجل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CsvImportDialog
        open={importingBuses}
        onOpenChange={setImportingBuses}
        title="استيراد الأتوبيسات من CSV"
        columns={[
          { key: "bus_code", label: "الكود" },
          { key: "plate_number", label: "رقم اللوحة" },
          { key: "model", label: "الموديل" },
          { key: "capacity", label: "السعة" },
          { key: "odometer", label: "العداد" },
          { key: "status", label: "الحالة" },
        ]}
        onImport={bulkInsertBuses}
        onDone={loadAll}
      />
      <CsvImportDialog
        open={importingDrivers}
        onOpenChange={setImportingDrivers}
        title="استيراد السائقين من CSV"
        columns={[
          { key: "name", label: "الاسم" },
          { key: "phone", label: "الهاتف" },
          { key: "license_type", label: "نوع الرخصة" },
          { key: "license_expiry", label: "انتهاء الرخصة" },
        ]}
        onImport={bulkInsertDrivers}
        onDone={loadAll}
      />
    </AppShell>
  );
}
