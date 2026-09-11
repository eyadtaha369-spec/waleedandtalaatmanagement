import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DataTable, PageHeader, Panel, StatusPill, Toolbar, exportToExcel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { currency, type BusRoute, type Student } from "@/lib/fleet-data";
import {
  fetchRoutes,
  fetchStudents,
  fetchPaymentHistory,
  addPayment,
  addRoute as addRouteApi,
  addStudent as addStudentApi,
  bulkInsertRoutes,
  bulkInsertStudents,
} from "@/lib/queries";
import { CsvImportDialog } from "@/components/csv-import-dialog";

export const Route = createFileRoute("/operations")({
  head: () => ({
    meta: [
      { title: "الخطوط والاشتراكات | وليد وطلعت" },
      { name: "description", content: "إدارة خطوط السير ونقاط التجمع واشتراكات الطلاب وحالات السداد." },
      { property: "og:title", content: "الخطوط والاشتراكات | وليد وطلعت" },
      { property: "og:description", content: "خطوط السير، المواعيد، السعة، واشتراكات الطلاب." },
    ],
  }),
  component: OperationsPage,
});

function OperationsPage() {
  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [studentsList, setStudentsList] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [payments, setPayments] = useState<{ date: string; amount: number; method: string }[]>([]);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingRoute, setAddingRoute] = useState(false);
  const [routeForm, setRouteForm] = useState({ name: "", pickupPoints: "", departure: "", arrival: "", busCode: "", seats: "" });
  const [addingStudent, setAddingStudent] = useState(false);
  const [studentForm, setStudentForm] = useState({ name: "", guardianPhone: "", routeName: "", monthly: "" });
  const [importingRoutes, setImportingRoutes] = useState(false);
  const [importingStudents, setImportingStudents] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, s] = await Promise.all([fetchRoutes(), fetchStudents()]);
      setRoutes(r);
      setStudentsList(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (student) {
      fetchPaymentHistory(student.id).then(setPayments).catch(() => setPayments([]));
    }
  }, [student]);

  const filteredStudents = useMemo(
    () => studentsList.filter((s) => (s.name + s.route).includes(query) || query === ""),
    [studentsList, query],
  );

  const recordPayment = async () => {
    if (!student || !payAmount.trim()) return;
    setSaving(true);
    try {
      await addPayment(student.id, Number(payAmount) || 0, payMethod || "نقدي");
      const [refreshed, refreshedStudents] = await Promise.all([fetchPaymentHistory(student.id), fetchStudents()]);
      setPayments(refreshed);
      setStudentsList(refreshedStudents);
      setPayAmount("");
      setPayMethod("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تسجيل الدفعة");
    } finally {
      setSaving(false);
    }
  };

  const addRoute = async () => {
    if (!routeForm.name.trim()) return;
    setSaving(true);
    try {
      await addRouteApi({ ...routeForm, seats: Number(routeForm.seats) || 0 });
      await loadAll();
      setRouteForm({ name: "", pickupPoints: "", departure: "", arrival: "", busCode: "", seats: "" });
      setAddingRoute(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إضافة الخط");
    } finally {
      setSaving(false);
    }
  };

  const addStudent = async () => {
    if (!studentForm.name.trim()) return;
    setSaving(true);
    try {
      await addStudentApi({ ...studentForm, monthly: Number(studentForm.monthly) || 0 });
      await loadAll();
      setStudentForm({ name: "", guardianPhone: "", routeName: "", monthly: "" });
      setAddingStudent(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إضافة الطالب");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <PageHeader title="الخطوط والاشتراكات" subtitle="خطوط السير ونقاط التجمع واشتراكات الطلاب" />

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Tabs defaultValue="routes">
        <TabsList className="no-print mb-4 border border-border bg-secondary/50">
          <TabsTrigger value="routes">الخطوط</TabsTrigger>
          <TabsTrigger value="students">الطلاب والاشتراكات</TabsTrigger>
        </TabsList>

        <TabsContent value="routes">
          <Panel title="خطوط السير">
            <Toolbar
              query={query}
              onQuery={setQuery}
              placeholder="ابحث باسم الخط..."
              onExport={() => exportToExcel("الخطوط", routes as unknown as Record<string, string | number>[])}
              extra={
                <>
                  <Button variant="outline" className="border-border" onClick={() => setImportingRoutes(true)}>
                    استيراد CSV
                  </Button>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setAddingRoute(true)}>
                    <Plus className="ml-2 h-4 w-4" /> إضافة خط
                  </Button>
                </>
              }
            />
            {loading ? (
              <p className="py-6 text-center text-muted-foreground">جارِ التحميل...</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {routes
                  .filter((r) => r.name.includes(query) || query === "")
                  .map((r) => {
                    const pct = r.seats > 0 ? Math.round((r.booked / r.seats) * 100) : 0;
                    return (
                      <div key={r.id} className="rounded-xl border border-border bg-secondary/25 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-bold text-foreground">{r.name}</h3>
                          <StatusPill label={`الأتوبيس ${r.bus}`} tone="info" />
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">نقاط التجمع: {r.pickupPoints}</p>
                        <div className="mt-3 flex gap-4 text-sm">
                          <span>موعد التحرك: <b className="text-primary">{r.departure}</b></span>
                          <span>موعد الوصول: <b className="text-primary">{r.arrival}</b></span>
                        </div>
                        <div className="mt-3">
                          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                            <span>نسبة الإشغال</span>
                            <span>
                              {r.booked} / {r.seats} مقعد ({pct}%)
                            </span>
                          </div>
                          <Progress value={pct} className="h-2 bg-muted" />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="students">
          <Panel title="اشتراكات الطلاب">
            <Toolbar
              query={query}
              onQuery={setQuery}
              placeholder="ابحث باسم الطالب أو الخط..."
              onExport={() => exportToExcel("الاشتراكات", filteredStudents as unknown as Record<string, string | number>[])}
              extra={
                <>
                  <Button variant="outline" className="border-border" onClick={() => setImportingStudents(true)}>
                    استيراد CSV
                  </Button>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setAddingStudent(true)}>
                    <Plus className="ml-2 h-4 w-4" /> إضافة طالب
                  </Button>
                </>
              }
            />
            <DataTable head={["الطالب", "الخط", "هاتف ولي الأمر", "الاشتراك الشهري", "المسدد", "المتبقي", "الحالة", "السجل"]}>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">جارِ التحميل...</td>
                </tr>
              ) : (
                filteredStudents.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3 font-bold">{s.name}</td>
                    <td className="px-4 py-3">{s.route}</td>
                    <td className="px-4 py-3">{s.guardianPhone}</td>
                    <td className="px-4 py-3">{currency(s.monthly)}</td>
                    <td className="px-4 py-3">{currency(s.paid)}</td>
                    <td className="px-4 py-3 text-warning">{currency(s.monthly - s.paid)}</td>
                    <td className="px-4 py-3">
                      <StatusPill
                        label={s.status}
                        tone={s.status === "خالص" ? "good" : s.status === "أقساط" ? "warn" : "bad"}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => setStudent(s)}>
                        المدفوعات
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </DataTable>
          </Panel>
        </TabsContent>
      </Tabs>

      <Dialog open={!!student} onOpenChange={(o) => !o && setStudent(null)}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">سجل مدفوعات: {student?.name}</DialogTitle>
            <DialogDescription className="text-muted-foreground">تفاصيل الأقساط والمبالغ المسددة</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {payments.length === 0 ? (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                لا توجد مدفوعات مسجلة لهذا الشهر.
              </p>
            ) : (
              payments.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3 text-sm">
                  <span>{p.date}</span>
                  <span className="font-bold text-primary">{currency(p.amount)}</span>
                  <span className="text-muted-foreground">{p.method}</span>
                </div>
              ))
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">المبلغ</Label>
              <Input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="border-border bg-input/60" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">طريقة الدفع</Label>
              <Input value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="border-border bg-input/60" />
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={recordPayment} disabled={saving}>
              {saving ? "جارِ الحفظ..." : "تسجيل دفع قسط جديد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={addingRoute} onOpenChange={setAddingRoute}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">إضافة خط جديد</DialogTitle>
            <DialogDescription className="text-muted-foreground">أدخل بيانات خط السير</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {[
              ["name", "اسم الخط"],
              ["pickupPoints", "نقاط التجمع"],
              ["departure", "موعد التحرك (HH:MM)", "time"],
              ["arrival", "موعد الوصول (HH:MM)", "time"],
              ["busCode", "كود الأتوبيس"],
              ["seats", "عدد المقاعد", "number"],
            ].map(([key, label, type]) => (
              <div key={key} className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  value={routeForm[key as keyof typeof routeForm]}
                  onChange={(e) => setRouteForm({ ...routeForm, [key]: e.target.value })}
                  type={type || "text"}
                  className="border-border bg-input/60"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={addRoute} disabled={saving}>
              {saving ? "جارِ الحفظ..." : "حفظ الخط"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addingStudent} onOpenChange={setAddingStudent}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">إضافة طالب جديد</DialogTitle>
            <DialogDescription className="text-muted-foreground">أدخل بيانات الطالب والاشتراك</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {[
              ["name", "اسم الطالب"],
              ["guardianPhone", "هاتف ولي الأمر", "tel"],
              ["routeName", "اسم الخط"],
              ["monthly", "الاشتراك الشهري", "number"],
            ].map(([key, label, type]) => (
              <div key={key} className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  value={studentForm[key as keyof typeof studentForm]}
                  onChange={(e) => setStudentForm({ ...studentForm, [key]: e.target.value })}
                  type={type || "text"}
                  className="border-border bg-input/60"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={addStudent} disabled={saving}>
              {saving ? "جارِ الحفظ..." : "حفظ الطالب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CsvImportDialog
        open={importingRoutes}
        onOpenChange={setImportingRoutes}
        title="استيراد الخطوط من CSV"
        columns={[
          { key: "route_name", label: "اسم الخط" },
          { key: "pickup_points", label: "نقاط التجمع" },
          { key: "departure_time", label: "موعد التحرك" },
          { key: "return_time", label: "موعد الوصول" },
          { key: "bus_code", label: "كود الأتوبيس" },
          { key: "seats", label: "عدد المقاعد" },
        ]}
        onImport={bulkInsertRoutes}
        onDone={loadAll}
      />
      <CsvImportDialog
        open={importingStudents}
        onOpenChange={setImportingStudents}
        title="استيراد الطلاب من CSV"
        columns={[
          { key: "name", label: "الاسم" },
          { key: "parent_phone", label: "هاتف ولي الأمر" },
          { key: "route_name", label: "اسم الخط" },
          { key: "total_amount", label: "الاشتراك الشهري" },
          { key: "paid_amount", label: "المسدد" },
        ]}
        onImport={bulkInsertStudents}
        onDone={loadAll}
      />
    </AppShell>
  );
}
