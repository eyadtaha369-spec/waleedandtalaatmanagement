import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
import { fetchRoutes, fetchStudents, fetchPaymentHistory, addPayment } from "@/lib/queries";

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
    </AppShell>
  );
}
