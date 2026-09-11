import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { attendance as attendanceSeed, buses as busSeed, drivers, type Bus } from "@/lib/fleet-data";

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
  const [buses, setBuses] = useState(busSeed);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Bus | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ code: "", plate: "", model: "", capacity: "", odometer: "" });

  const filtered = useMemo(
    () =>
      buses.filter((b) =>
        [b.code, b.plate, b.model, b.driver].join(" ").toLowerCase().includes(query.toLowerCase()),
      ),
    [buses, query],
  );

  const addBus = () => {
    if (!form.code.trim()) return;
    setBuses((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        code: form.code,
        plate: form.plate || "—",
        model: form.model || "—",
        capacity: Number(form.capacity) || 0,
        odometer: Number(form.odometer) || 0,
        licenseExpiry: "2027-01-01",
        insuranceExpiry: "2027-01-01",
        lastMaintenance: "—",
        driver: "—",
        status: "تعمل",
      },
    ]);
    setForm({ code: "", plate: "", model: "", capacity: "", odometer: "" });
    setAdding(false);
  };

  return (
    <AppShell>
      <PageHeader title="إدارة الأسطول والسائقين" subtitle="الأتوبيسات، السائقون، وسجل الحضور اليومي" />

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
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setAdding(true)}>
                  <Plus className="ml-2 h-4 w-4" /> إضافة أتوبيس
                </Button>
              }
            />
            <DataTable head={["الكود", "رقم اللوحة", "الموديل", "السعة", "قراءة العداد", "السائق", "الحالة", "تفاصيل"]}>
              {filtered.map((b) => (
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
              ))}
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
          <Panel title="سجل الحضور والانصراف">
            <Toolbar
              query={query}
              onQuery={setQuery}
              placeholder="ابحث باسم السائق..."
              onExport={() => exportToExcel("الحضور", attendanceSeed as unknown as Record<string, string | number>[])}
            />
            <DataTable head={["السائق", "التاريخ", "الحضور", "الانصراف", "الحالة"]}>
              {attendanceSeed
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
              ["capacity", "السعة"],
              ["odometer", "قراءة العداد"],
            ].map(([key, label]) => (
              <div key={key} className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="border-border bg-input/60"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={addBus}>
              حفظ الأتوبيس
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
