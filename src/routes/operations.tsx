import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DataTable, PageHeader, Panel, StatusPill, Toolbar, exportToExcel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { busRoutes, currency, paymentHistory, students as studentSeed, type Student } from "@/lib/fleet-data";

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
  const [query, setQuery] = useState("");
  const [student, setStudent] = useState<Student | null>(null);

  const filteredStudents = useMemo(
    () => studentSeed.filter((s) => (s.name + s.route).includes(query) || query === ""),
    [query],
  );

  return (
    <AppShell>
      <PageHeader title="الخطوط والاشتراكات" subtitle="خطوط السير ونقاط التجمع واشتراكات الطلاب" />

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
              onExport={() => exportToExcel("الخطوط", busRoutes as unknown as Record<string, string | number>[])}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              {busRoutes
                .filter((r) => r.name.includes(query) || query === "")
                .map((r) => {
                  const pct = Math.round((r.booked / r.seats) * 100);
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
              {filteredStudents.map((s) => (
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
              ))}
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
            {(paymentHistory[student?.id ?? ""] ?? []).length === 0 ? (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                لا توجد مدفوعات مسجلة لهذا الشهر.
              </p>
            ) : (
              paymentHistory[student!.id].map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3 text-sm">
                  <span>{p.date}</span>
                  <span className="font-bold text-primary">{currency(p.amount)}</span>
                  <span className="text-muted-foreground">{p.method}</span>
                </div>
              ))
            )}
          </div>
          <Button className="bg-primary text-primary-foreground">تسجيل دفع قسط جديد</Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
