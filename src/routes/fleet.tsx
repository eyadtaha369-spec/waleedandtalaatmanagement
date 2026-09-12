import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
import { type Bus, type Driver, type Attendance } from "@/lib/fleet-data";
import {
  fetchBuses,
  fetchDrivers,
  fetchAttendance,
  addBus as addBusApi,
  updateBus,
  deleteBus,
  addDriver as addDriverApi,
  updateDriver,
  deleteDriver,
  checkInDriver,
  checkOutDriver,
  upsertAttendanceRecord,
  deleteDailyShift,
  bulkInsertBuses,
  bulkInsertDrivers,
  fetchEmployees,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  fetchEmployeeAttendance,
  upsertEmployeeAttendance,
  deleteEmployeeAttendance,
  type Employee,
  type EmployeeAttendanceRow,
} from "@/lib/queries";
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
const busTypes = ["أتوبيس 50", "أتوبيس 33", "هاي إي اس (فان)", "ملاكي"];

type DeleteTarget = { kind: "bus" | "driver" | "attendance" | "employee" | "employeeAttendance"; id: string; label: string } | null;

function FleetPage() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeAttendanceRows, setEmployeeAttendanceRows] = useState<EmployeeAttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Bus | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingDriver, setAddingDriver] = useState(false);
  const [addingEmployee, setAddingEmployee] = useState(false);
  const [importingBuses, setImportingBuses] = useState(false);
  const [importingDrivers, setImportingDrivers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ id: "", code: "", plate: "", model: "", busType: "أتوبيس 50", capacity: "", odometer: "", status: "تعمل" });
  const [driverForm, setDriverForm] = useState({ id: "", name: "", phone: "", license: "", licenseExpiry: "" });
  const [employeeForm, setEmployeeForm] = useState({ id: "", name: "", phone: "", jobTitle: "ميكانيكي", baseSalary: "" });
  const [attendanceBusy, setAttendanceBusy] = useState<string | null>(null);
  const [addingAttendance, setAddingAttendance] = useState(false);
  const [addingEmployeeAttendance, setAddingEmployeeAttendance] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);
  const [attendanceForm, setAttendanceForm] = useState({
    id: "",
    driverName: "",
    date: todayStr,
    checkIn: "",
    checkOut: "",
    status: "حاضر",
  });
  const [employeeAttendanceForm, setEmployeeAttendanceForm] = useState({ id: "", employeeName: "", date: todayStr, status: "حاضر", notes: "" });
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, d, a, emp, empAtt] = await Promise.all([fetchBuses(), fetchDrivers(), fetchAttendance(), fetchEmployees(), fetchEmployeeAttendance()]);
      setBuses(b);
      setDrivers(d);
      setAttendanceRows(a);
      setEmployees(emp);
      setEmployeeAttendanceRows(empAtt);
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

  const openAddBus = () => {
    setForm({ id: "", code: "", plate: "", model: "", busType: "أتوبيس 50", capacity: "", odometer: "", status: "تعمل" });
    setAdding(true);
  };

  const openEditBus = (b: Bus) => {
    setForm({ id: b.id, code: b.code, plate: b.plate, model: b.model, busType: b.busType || "أتوبيس 50", capacity: String(b.capacity), odometer: String(b.odometer), status: b.status });
    setAdding(true);
  };

  const submitBus = async () => {
    if (!form.code.trim()) return;
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        plate: form.plate,
        model: form.model,
        busType: form.busType,
        capacity: Number(form.capacity) || 0,
        odometer: Number(form.odometer) || 0,
        status: form.status,
      };
      if (form.id) {
        await updateBus(form.id, payload);
      } else {
        await addBusApi(payload);
      }
      await loadAll();
      setForm({ id: "", code: "", plate: "", model: "", busType: "أتوبيس 50", capacity: "", odometer: "", status: "تعمل" });
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ الأتوبيس");
    } finally {
      setSaving(false);
    }
  };

  const openAddEmployee = () => {
    setEmployeeForm({ id: "", name: "", phone: "", jobTitle: "ميكانيكي", baseSalary: "" });
    setAddingEmployee(true);
  };
  const openEditEmployee = (e: Employee) => {
    setEmployeeForm({ id: e.id, name: e.name, phone: e.phone, jobTitle: e.jobTitle || "ميكانيكي", baseSalary: String(e.baseSalary) });
    setAddingEmployee(true);
  };
  const submitEmployee = async () => {
    if (!employeeForm.name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: employeeForm.name, phone: employeeForm.phone, jobTitle: employeeForm.jobTitle, baseSalary: Number(employeeForm.baseSalary) || 0 };
      if (employeeForm.id) await updateEmployee(employeeForm.id, payload);
      else await addEmployee(payload);
      await loadAll();
      setEmployeeForm({ id: "", name: "", phone: "", jobTitle: "ميكانيكي", baseSalary: "" });
      setAddingEmployee(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ بيانات الموظف");
    } finally {
      setSaving(false);
    }
  };

  const openEmployeeAttendanceForm = (row?: EmployeeAttendanceRow) => {
    if (row) {
      setEmployeeAttendanceForm({ id: row.id, employeeName: row.employee, date: row.date, status: row.status, notes: row.notes });
    } else {
      setEmployeeAttendanceForm({ id: "", employeeName: "", date: todayStr, status: "حاضر", notes: "" });
    }
    setAddingEmployeeAttendance(true);
  };
  const submitEmployeeAttendance = async () => {
    if (!employeeAttendanceForm.employeeName.trim()) return;
    setSaving(true);
    try {
      await upsertEmployeeAttendance({
        id: employeeAttendanceForm.id || undefined,
        employeeName: employeeAttendanceForm.employeeName,
        date: employeeAttendanceForm.date,
        status: employeeAttendanceForm.status,
        notes: employeeAttendanceForm.notes,
      });
      await loadAll();
      setAddingEmployeeAttendance(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ سجل حضور الموظف");
    } finally {
      setSaving(false);
    }
  };

  const openAddDriver = () => {
    setDriverForm({ id: "", name: "", phone: "", license: "", licenseExpiry: "" });
    setAddingDriver(true);
  };

  const openEditDriver = (d: Driver) => {
    setDriverForm({ id: d.id, name: d.name, phone: d.phone, license: d.license, licenseExpiry: d.licenseExpiry === "—" ? "" : d.licenseExpiry });
    setAddingDriver(true);
  };

  const submitDriver = async () => {
    if (!driverForm.name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: driverForm.name, phone: driverForm.phone, license: driverForm.license, licenseExpiry: driverForm.licenseExpiry };
      if (driverForm.id) {
        await updateDriver(driverForm.id, payload);
      } else {
        await addDriverApi(payload);
      }
      await loadAll();
      setDriverForm({ id: "", name: "", phone: "", license: "", licenseExpiry: "" });
      setAddingDriver(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ السائق");
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

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === "bus") await deleteBus(deleteTarget.id);
      else if (deleteTarget.kind === "driver") await deleteDriver(deleteTarget.id);
      else if (deleteTarget.kind === "employee") await deleteEmployee(deleteTarget.id);
      else if (deleteTarget.kind === "employeeAttendance") await deleteEmployeeAttendance(deleteTarget.id);
      else await deleteDailyShift(deleteTarget.id);
      await loadAll();
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الحذف");
    } finally {
      setDeleting(false);
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
        <TabsList className="no-print mb-4 flex-wrap border border-border bg-secondary/50">
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
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAddBus}>
                    <Plus className="ml-2 h-4 w-4" /> إضافة أتوبيس
                  </Button>
                </>
              }
            />
            <DataTable head={["الكود", "رقم اللوحة", "الموديل", "نوع السيارة", "السعة", "قراءة العداد", "السائق", "الحالة", "الإجراءات"]}>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td>
                </tr>
              ) : (
                filtered.map((b) => (
                  <tr key={b.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3 font-bold text-primary">{b.code}</td>
                    <td className="px-4 py-3">{b.plate}</td>
                    <td className="px-4 py-3">{b.model}</td>
                    <td className="px-4 py-3 text-xs">{b.busType}</td>
                    <td className="px-4 py-3">{b.capacity} راكب</td>
                    <td className="px-4 py-3">{b.odometer.toLocaleString("ar-EG")} كم</td>
                    <td className="px-4 py-3">{b.driver}</td>
                    <td className="px-4 py-3">
                      <StatusPill label={b.status} tone={busTone(b.status)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => setSelected(b)}>
                          عرض
                        </Button>
                        <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEditBus(b)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget({ kind: "bus", id: b.id, label: `الأتوبيس ${b.code}` })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAddDriver}>
                    <Plus className="ml-2 h-4 w-4" /> إضافة سائق
                  </Button>
                </>
              }
            />
            <DataTable head={["الاسم", "الهاتف", "نوع الرخصة", "انتهاء الرخصة", "الأتوبيس الأساسي", "الاحتياطي", "الوردية", "الإجراءات"]}>
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
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEditDriver(d)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget({ kind: "driver", id: d.id, label: `السائق ${d.name}` })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
            <DataTable head={["السائق", "التاريخ", "الحضور", "الانصراف", "الحالة", "الإجراءات"]}>
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
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openAttendanceForm(a)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget({ kind: "attendance", id: a.id, label: `حضور ${a.driver} بتاريخ ${a.date}` })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </DataTable>
          </Panel>
        </TabsContent>
      </Tabs>

      <Tabs defaultValue="employees" className="mt-6">
        <TabsList className="no-print mb-4 border border-border bg-secondary/50">
          <TabsTrigger value="employees">إدارة الموظفين</TabsTrigger>
          <TabsTrigger value="employeeAttendance">حضور الموظفين</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Panel title="الموظفون (ورشة، مخزن، إداريون)">
            <Toolbar
              query={query}
              onQuery={setQuery}
              placeholder="ابحث باسم الموظف..."
              onExport={() => exportToExcel("الموظفون", employees as unknown as Record<string, string | number>[])}
              extra={
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAddEmployee}>
                  <Plus className="ml-2 h-4 w-4" /> إضافة موظف
                </Button>
              }
            />
            <DataTable head={["الاسم", "الهاتف", "الوظيفة", "المرتب الأساسي", "الإجراءات"]}>
              {employees
                .filter((e) => e.name.includes(query) || query === "")
                .map((e) => (
                  <tr key={e.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3 font-bold">{e.name}</td>
                    <td className="px-4 py-3">{e.phone || "—"}</td>
                    <td className="px-4 py-3">
                      <StatusPill label={e.jobTitle || "—"} tone="info" />
                    </td>
                    <td className="px-4 py-3">{e.baseSalary.toLocaleString("ar-EG")} ج.م</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEditEmployee(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget({ kind: "employee", id: e.id, label: `الموظف ${e.name}` })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </DataTable>
          </Panel>
        </TabsContent>

        <TabsContent value="employeeAttendance">
          <Panel title="سجل حضور الموظفين">
            <Toolbar
              query={query}
              onQuery={setQuery}
              placeholder="ابحث باسم الموظف..."
              onExport={() => exportToExcel("حضور الموظفين", employeeAttendanceRows as unknown as Record<string, string | number>[])}
              extra={
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => openEmployeeAttendanceForm()}>
                  <Plus className="ml-2 h-4 w-4" /> تسجيل حضور
                </Button>
              }
            />
            <DataTable head={["الموظف", "التاريخ", "الحالة", "ملاحظات", "الإجراءات"]}>
              {employeeAttendanceRows
                .filter((a) => a.employee.includes(query) || query === "")
                .map((a) => (
                  <tr key={a.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3 font-bold">{a.employee}</td>
                    <td className="px-4 py-3">{a.date}</td>
                    <td className="px-4 py-3">
                      <StatusPill label={a.status} tone={a.status === "حاضر" ? "good" : a.status === "بدل" ? "info" : a.status === "إجازة" ? "warn" : "bad"} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{a.notes || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEmployeeAttendanceForm(a)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget({ kind: "employeeAttendance", id: a.id, label: `حضور ${a.employee} بتاريخ ${a.date}` })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
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
            <DialogTitle className="text-primary">{form.id ? "تعديل بيانات الأتوبيس" : "إضافة أتوبيس جديد"}</DialogTitle>
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
              <Label className="text-xs text-muted-foreground">نوع السيارة</Label>
              <Select value={form.busType} onValueChange={(v) => setForm({ ...form, busType: v })}>
                <SelectTrigger className="border-border bg-input/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {busTypes.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            <Button className="bg-primary text-primary-foreground" onClick={submitBus} disabled={saving}>
              {saving ? "جارِ الحفظ..." : form.id ? "حفظ التعديلات" : "حفظ الأتوبيس"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={addingDriver} onOpenChange={setAddingDriver}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{driverForm.id ? "تعديل بيانات السائق" : "إضافة سائق جديد"}</DialogTitle>
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
            <Button className="bg-primary text-primary-foreground" onClick={submitDriver} disabled={saving}>
              {saving ? "جارِ الحفظ..." : driverForm.id ? "حفظ التعديلات" : "حفظ السائق"}
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

      <Dialog open={addingEmployee} onOpenChange={setAddingEmployee}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{employeeForm.id ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">بيانات موظف بدون رخصة قيادة (ورشة / مخزن / إداري)</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">الاسم</Label>
              <Input value={employeeForm.name} onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })} className="border-border bg-input/60" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">الهاتف</Label>
              <Input value={employeeForm.phone} onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })} type="tel" className="border-border bg-input/60" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">الوظيفة</Label>
              <Select value={employeeForm.jobTitle} onValueChange={(v) => setEmployeeForm({ ...employeeForm, jobTitle: v })}>
                <SelectTrigger className="border-border bg-input/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ميكانيكي">ميكانيكي</SelectItem>
                  <SelectItem value="مسؤول مخزن">مسؤول مخزن</SelectItem>
                  <SelectItem value="إداري">إداري</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">المرتب الأساسي</Label>
              <Input value={employeeForm.baseSalary} onChange={(e) => setEmployeeForm({ ...employeeForm, baseSalary: e.target.value })} type="number" className="border-border bg-input/60" />
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitEmployee} disabled={saving}>
              {saving ? "جارِ الحفظ..." : employeeForm.id ? "حفظ التعديلات" : "حفظ الموظف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addingEmployeeAttendance} onOpenChange={setAddingEmployeeAttendance}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{employeeAttendanceForm.id ? "تعديل سجل حضور" : "تسجيل حضور موظف"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">سجل حضور يومي لموظفي الورشة والمخزن والإدارة</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">الموظف</Label>
              <Select value={employeeAttendanceForm.employeeName} onValueChange={(v) => setEmployeeAttendanceForm({ ...employeeAttendanceForm, employeeName: v })}>
                <SelectTrigger className="border-border bg-input/60">
                  <SelectValue placeholder="اختر الموظف" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">التاريخ</Label>
              <Input value={employeeAttendanceForm.date} onChange={(e) => setEmployeeAttendanceForm({ ...employeeAttendanceForm, date: e.target.value })} type="date" className="border-border bg-input/60" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">الحالة</Label>
              <Select value={employeeAttendanceForm.status} onValueChange={(v) => setEmployeeAttendanceForm({ ...employeeAttendanceForm, status: v })}>
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
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">ملاحظات</Label>
              <Input value={employeeAttendanceForm.notes} onChange={(e) => setEmployeeAttendanceForm({ ...employeeAttendanceForm, notes: e.target.value })} className="border-border bg-input/60" />
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitEmployeeAttendance} disabled={saving}>
              {saving ? "جارِ الحفظ..." : "حفظ السجل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="glass text-foreground" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              سيتم حذف {deleteTarget?.label} نهائيًا. لا يمكن التراجع عن هذا الإجراء.
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
