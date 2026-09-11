import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
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
import { currency, type MaintenanceOrder, type InventoryItem, type FuelLog } from "@/lib/fleet-data";
import {
  fetchMaintenanceOrders,
  fetchInventory,
  fetchFuelLogs,
  addMaintenanceOrder,
  updateMaintenanceStatus,
  addInventoryItem,
  addFuelLog,
} from "@/lib/queries";

export const Route = createFileRoute("/workshop")({
  head: () => ({
    meta: [
      { title: "الورشة والمخزون والسولار | وليد وطلعت" },
      { name: "description", content: "أوامر الصيانة ومخزون قطع الغيار وسجل استهلاك السولار للأسطول." },
      { property: "og:title", content: "الورشة والمخزون والسولار | وليد وطلعت" },
      { property: "og:description", content: "متابعة أوامر الإصلاح، الحد الأدنى للمخزون، وتكلفة الوقود." },
    ],
  }),
  component: WorkshopPage,
});

const columns: MaintenanceOrder["status"][] = ["بانتظار القطع", "قيد التنفيذ", "مكتمل"];

function WorkshopPage() {
  const [orders, setOrders] = useState<MaintenanceOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ bus: "", issue: "", parts: "", cost: "" });
  const [addingItem, setAddingItem] = useState(false);
  const [itemForm, setItemForm] = useState({ name: "", code: "", stock: "", minStock: "", unitPrice: "" });
  const [addingFuel, setAddingFuel] = useState(false);
  const [fuelForm, setFuelForm] = useState({ busCode: "", odoStart: "", odoEnd: "", liters: "", cost: "", station: "" });

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, i, f] = await Promise.all([fetchMaintenanceOrders(), fetchInventory(), fetchFuelLogs()]);
      setOrders(o);
      setInventory(i);
      setFuelLogs(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const addOrder = async () => {
    if (!form.bus.trim()) return;
    setSaving(true);
    try {
      await addMaintenanceOrder({
        busCode: form.bus,
        issue: form.issue,
        parts: form.parts,
        cost: Number(form.cost) || 0,
      });
      await loadAll();
      setForm({ bus: "", issue: "", parts: "", cost: "" });
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إضافة أمر الصيانة");
    } finally {
      setSaving(false);
    }
  };

  const move = async (id: string) => {
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    const next = columns[Math.min(columns.indexOf(order.status) + 1, columns.length - 1)] ?? order.status;
    try {
      await updateMaintenanceStatus(id, next);
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: next } : o)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحديث حالة الأمر");
    }
  };

  const addItem = async () => {
    if (!itemForm.name.trim()) return;
    setSaving(true);
    try {
      await addInventoryItem({
        name: itemForm.name,
        code: itemForm.code,
        stock: Number(itemForm.stock) || 0,
        minStock: Number(itemForm.minStock) || 0,
        unitPrice: Number(itemForm.unitPrice) || 0,
      });
      await loadAll();
      setItemForm({ name: "", code: "", stock: "", minStock: "", unitPrice: "" });
      setAddingItem(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إضافة الصنف");
    } finally {
      setSaving(false);
    }
  };

  const addFuel = async () => {
    if (!fuelForm.busCode.trim()) return;
    setSaving(true);
    try {
      await addFuelLog({
        busCode: fuelForm.busCode,
        odoStart: Number(fuelForm.odoStart) || 0,
        odoEnd: Number(fuelForm.odoEnd) || 0,
        liters: Number(fuelForm.liters) || 0,
        cost: Number(fuelForm.cost) || 0,
        station: fuelForm.station,
      });
      await loadAll();
      setFuelForm({ busCode: "", odoStart: "", odoEnd: "", liters: "", cost: "", station: "" });
      setAddingFuel(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إضافة سجل السولار");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <PageHeader title="الورشة والمخزون والسولار" subtitle="أوامر الصيانة، قطع الغيار، وسجل التزود بالوقود" />

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Tabs defaultValue="orders">
        <TabsList className="no-print mb-4 border border-border bg-secondary/50">
          <TabsTrigger value="orders">أوامر الصيانة</TabsTrigger>
          <TabsTrigger value="inventory">المخزن</TabsTrigger>
          <TabsTrigger value="fuel">سجل السولار</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Panel title="لوحة أوامر الصيانة">
            <Toolbar
              query={query}
              onQuery={setQuery}
              placeholder="ابحث برقم الأمر أو كود الأتوبيس..."
              onExport={() => exportToExcel("أوامر الصيانة", orders as unknown as Record<string, string | number>[])}
              extra={
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setAdding(true)}>
                  <Plus className="ml-2 h-4 w-4" /> أمر صيانة جديد
                </Button>
              }
            />
            {loading ? (
              <p className="py-6 text-center text-muted-foreground">جارِ التحميل...</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                {columns.map((col) => (
                  <div key={col} className="rounded-xl border border-border bg-secondary/20 p-3">
                    <h3 className="mb-3 flex items-center justify-between text-sm font-bold">
                      <span>{col}</span>
                      <StatusPill
                        label={String(orders.filter((o) => o.status === col).length)}
                        tone={col === "مكتمل" ? "good" : col === "قيد التنفيذ" ? "warn" : "muted"}
                      />
                    </h3>
                    <div className="space-y-3">
                      {orders
                        .filter((o) => o.status === col && (o.code + o.bus + o.issue).includes(query))
                        .map((o) => (
                          <div key={o.id} className="rounded-lg border border-border bg-card p-3">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-primary">{o.code}</span>
                              <span>{o.bus}</span>
                            </div>
                            <p className="mt-2 text-sm font-semibold">{o.issue}</p>
                            <p className="mt-1 text-xs text-muted-foreground">قطع الغيار: {o.parts}</p>
                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-sm font-bold text-warning">{currency(o.cost)}</span>
                              {o.status !== "مكتمل" && (
                                <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => move(o.id)}>
                                  نقل للمرحلة التالية
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="inventory">
          <Panel title="مخزن قطع الغيار">
            <Toolbar
              query={query}
              onQuery={setQuery}
              placeholder="ابحث باسم الصنف..."
              onExport={() => exportToExcel("المخزن", inventory as unknown as Record<string, string | number>[])}
              extra={
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setAddingItem(true)}>
                  <Plus className="ml-2 h-4 w-4" /> إضافة صنف
                </Button>
              }
            />
            <DataTable head={["الصنف", "الكود", "الرصيد الحالي", "الحد الأدنى", "سعر الوحدة", "الحالة"]}>
              {inventory
                .filter((i) => i.name.includes(query) || query === "")
                .map((i) => (
                  <tr key={i.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3 font-bold">{i.name}</td>
                    <td className="px-4 py-3">{i.code}</td>
                    <td className="px-4 py-3">{i.stock}</td>
                    <td className="px-4 py-3">{i.minStock}</td>
                    <td className="px-4 py-3">{currency(i.unitPrice)}</td>
                    <td className="px-4 py-3">
                      {i.stock < i.minStock ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/15 px-3 py-1 text-xs font-bold text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" /> تنبيه الحد الأدنى
                        </span>
                      ) : (
                        <StatusPill label="رصيد كافٍ" tone="good" />
                      )}
                    </td>
                  </tr>
                ))}
            </DataTable>
          </Panel>
        </TabsContent>

        <TabsContent value="fuel">
          <Panel title="سجل التزود بالسولار">
            <Toolbar
              query={query}
              onQuery={setQuery}
              placeholder="ابحث بكود الأتوبيس أو المحطة..."
              onExport={() => exportToExcel("سجل السولار", fuelLogs as unknown as Record<string, string | number>[])}
              extra={
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setAddingFuel(true)}>
                  <Plus className="ml-2 h-4 w-4" /> إضافة سجل
                </Button>
              }
            />
            <DataTable head={["التاريخ", "الأتوبيس", "عداد البداية", "عداد النهاية", "المسافة", "الكمية (لتر)", "التكلفة", "المحطة"]}>
              {fuelLogs
                .filter((f) => (f.bus + f.station).includes(query) || query === "")
                .map((f) => (
                  <tr key={f.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3">{f.date}</td>
                    <td className="px-4 py-3 font-bold text-primary">{f.bus}</td>
                    <td className="px-4 py-3">{f.odoStart.toLocaleString("ar-EG")}</td>
                    <td className="px-4 py-3">{f.odoEnd.toLocaleString("ar-EG")}</td>
                    <td className="px-4 py-3">{(f.odoEnd - f.odoStart).toLocaleString("ar-EG")} كم</td>
                    <td className="px-4 py-3">{f.liters}</td>
                    <td className="px-4 py-3 text-warning">{currency(f.cost)}</td>
                    <td className="px-4 py-3">{f.station}</td>
                  </tr>
                ))}
            </DataTable>
          </Panel>
        </TabsContent>
      </Tabs>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">أمر صيانة جديد</DialogTitle>
            <DialogDescription className="text-muted-foreground">سجل العطل وقطع الغيار المطلوبة</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {[
              ["bus", "كود الأتوبيس"],
              ["issue", "وصف العطل"],
              ["parts", "قطع الغيار"],
              ["cost", "التكلفة الإجمالية", "number"],
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
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={addOrder} disabled={saving}>
              {saving ? "جارِ الحفظ..." : "حفظ الأمر"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={addingItem} onOpenChange={setAddingItem}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">إضافة صنف للمخزن</DialogTitle>
            <DialogDescription className="text-muted-foreground">أدخل بيانات الصنف والحد الأدنى</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {[
              ["name", "اسم الصنف"],
              ["code", "الكود"],
              ["stock", "الرصيد الحالي", "number"],
              ["minStock", "الحد الأدنى", "number"],
              ["unitPrice", "سعر الوحدة", "number"],
            ].map(([key, label, type]) => (
              <div key={key} className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  value={itemForm[key as keyof typeof itemForm]}
                  onChange={(e) => setItemForm({ ...itemForm, [key]: e.target.value })}
                  type={type || "text"}
                  className="border-border bg-input/60"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={addItem} disabled={saving}>
              {saving ? "جارِ الحفظ..." : "حفظ الصنف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addingFuel} onOpenChange={setAddingFuel}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">إضافة سجل تزود بالسولار</DialogTitle>
            <DialogDescription className="text-muted-foreground">أدخل بيانات التزود بالوقود</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {[
              ["busCode", "كود الأتوبيس"],
              ["odoStart", "عداد البداية", "number"],
              ["odoEnd", "عداد النهاية", "number"],
              ["liters", "الكمية (لتر)", "number"],
              ["cost", "التكلفة", "number"],
              ["station", "المحطة"],
            ].map(([key, label, type]) => (
              <div key={key} className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  value={fuelForm[key as keyof typeof fuelForm]}
                  onChange={(e) => setFuelForm({ ...fuelForm, [key]: e.target.value })}
                  type={type || "text"}
                  className="border-border bg-input/60"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={addFuel} disabled={saving}>
              {saving ? "جارِ الحفظ..." : "حفظ السجل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
