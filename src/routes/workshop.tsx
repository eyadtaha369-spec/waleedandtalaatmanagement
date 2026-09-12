import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
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
import { currency, type MaintenanceOrder, type InventoryItem, type FuelLog } from "@/lib/fleet-data";
import {
  fetchMaintenanceOrders,
  fetchInventory,
  fetchFuelLogs,
  addMaintenanceOrder,
  updateMaintenanceOrder,
  deleteMaintenanceOrder,
  updateMaintenanceStatus,
  updateInventoryItem,
  deleteInventoryItem,
  addFuelLog,
  updateFuelLog,
  deleteFuelLog,
  bulkInsertInventory,
  receiveInventoryStock,
  fetchSuppliers,
  type Supplier,
} from "@/lib/queries";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CsvImportDialog } from "@/components/csv-import-dialog";

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

type DeleteTarget = { kind: "order" | "item" | "fuel"; id: string; label: string } | null;

function WorkshopPage() {
  const [orders, setOrders] = useState<MaintenanceOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ id: "", bus: "", issue: "", parts: "", cost: "", inventoryItemName: "", quantityUsed: "" });
  const [addingItem, setAddingItem] = useState(false);
  const [importingInventory, setImportingInventory] = useState(false);
  const [itemForm, setItemForm] = useState({ id: "", name: "", code: "", stock: "", minStock: "", unitPrice: "" });
  const [receiving, setReceiving] = useState(false);
  const [receiveForm, setReceiveForm] = useState({ itemName: "", itemCode: "", supplierName: "", quantity: "", unitPrice: "" });
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [addingFuel, setAddingFuel] = useState(false);
  const [fuelForm, setFuelForm] = useState({ id: "", busCode: "", odoStart: "", odoEnd: "", liters: "", cost: "", station: "" });
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, i, f, s] = await Promise.all([fetchMaintenanceOrders(), fetchInventory(), fetchFuelLogs(), fetchSuppliers()]);
      setOrders(o);
      setInventory(i);
      setFuelLogs(f);
      setSuppliers(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const openAddOrder = () => {
    setForm({ id: "", bus: "", issue: "", parts: "", cost: "", inventoryItemName: "", quantityUsed: "" });
    setAdding(true);
  };

  const openEditOrder = (o: MaintenanceOrder) => {
    setForm({
      id: o.id,
      bus: o.bus === "—" ? "" : o.bus,
      issue: o.issue === "—" ? "" : o.issue,
      parts: o.parts === "—" ? "" : o.parts,
      cost: String(o.cost),
      inventoryItemName: o.inventoryItem || "",
      quantityUsed: o.quantityUsed ? String(o.quantityUsed) : "",
    });
    setAdding(true);
  };

  const submitOrder = async () => {
    if (!form.bus.trim()) return;
    setSaving(true);
    try {
      const payload = {
        busCode: form.bus,
        issue: form.issue,
        parts: form.parts,
        cost: Number(form.cost) || 0,
        inventoryItemName: form.inventoryItemName,
        quantityUsed: Number(form.quantityUsed) || 0,
      };
      if (form.id) {
        const order = orders.find((o) => o.id === form.id);
        await updateMaintenanceOrder(form.id, { ...payload, status: order?.status ?? "بانتظار القطع" });
      } else {
        await addMaintenanceOrder(payload);
      }
      await loadAll();
      setForm({ id: "", bus: "", issue: "", parts: "", cost: "", inventoryItemName: "", quantityUsed: "" });
      setAdding(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ أمر الصيانة");
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

  const openReceiveStock = () => {
    setReceiveForm({ itemName: "", itemCode: "", supplierName: "", quantity: "", unitPrice: "" });
    setReceiving(true);
  };

  const submitReceiveStock = async () => {
    if (!receiveForm.itemName.trim() || !receiveForm.quantity.trim()) return;
    setSaving(true);
    try {
      await receiveInventoryStock({
        itemName: receiveForm.itemName,
        itemCode: receiveForm.itemCode,
        supplierName: receiveForm.supplierName,
        quantity: Number(receiveForm.quantity) || 0,
        unitPrice: Number(receiveForm.unitPrice) || 0,
      });
      await loadAll();
      setReceiveForm({ itemName: "", itemCode: "", supplierName: "", quantity: "", unitPrice: "" });
      setReceiving(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تسجيل التوريد");
    } finally {
      setSaving(false);
    }
  };

  const openEditItem = (i: InventoryItem) => {
    setItemForm({ id: i.id, name: i.name, code: i.code, stock: String(i.stock), minStock: String(i.minStock), unitPrice: String(i.unitPrice) });
    setAddingItem(true);
  };

  const submitItem = async () => {
    if (!itemForm.name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: itemForm.name, code: itemForm.code, stock: Number(itemForm.stock) || 0, minStock: Number(itemForm.minStock) || 0, unitPrice: Number(itemForm.unitPrice) || 0 };
      await updateInventoryItem(itemForm.id, payload);
      await loadAll();
      setItemForm({ id: "", name: "", code: "", stock: "", minStock: "", unitPrice: "" });
      setAddingItem(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ الصنف");
    } finally {
      setSaving(false);
    }
  };

  const openAddFuel = () => {
    setFuelForm({ id: "", busCode: "", odoStart: "", odoEnd: "", liters: "", cost: "", station: "" });
    setAddingFuel(true);
  };

  const openEditFuel = (f: FuelLog) => {
    setFuelForm({ id: f.id, busCode: f.bus === "—" ? "" : f.bus, odoStart: String(f.odoStart), odoEnd: String(f.odoEnd), liters: String(f.liters), cost: String(f.cost), station: f.station === "—" ? "" : f.station });
    setAddingFuel(true);
  };

  const submitFuel = async () => {
    if (!fuelForm.busCode.trim()) return;
    setSaving(true);
    try {
      const payload = { busCode: fuelForm.busCode, odoStart: Number(fuelForm.odoStart) || 0, odoEnd: Number(fuelForm.odoEnd) || 0, liters: Number(fuelForm.liters) || 0, cost: Number(fuelForm.cost) || 0, station: fuelForm.station };
      if (fuelForm.id) {
        await updateFuelLog(fuelForm.id, payload);
      } else {
        await addFuelLog(payload);
      }
      await loadAll();
      setFuelForm({ id: "", busCode: "", odoStart: "", odoEnd: "", liters: "", cost: "", station: "" });
      setAddingFuel(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ سجل السولار");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === "order") await deleteMaintenanceOrder(deleteTarget.id);
      else if (deleteTarget.kind === "item") await deleteInventoryItem(deleteTarget.id);
      else await deleteFuelLog(deleteTarget.id);
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
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAddOrder}>
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
                            {o.inventoryItem && (
                              <p className="mt-1 text-xs text-primary">مخصوم من المخزن: {o.inventoryItem} × {o.quantityUsed}</p>
                            )}
                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-sm font-bold text-warning">{currency(o.cost)}</span>
                              <div className="flex items-center gap-1">
                                {o.status !== "مكتمل" && (
                                  <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => move(o.id)}>
                                    نقل للمرحلة التالية
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" className="h-11 w-11 p-0 text-primary sm:h-7 sm:w-7 hover:bg-primary/10" onClick={() => openEditOrder(o)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-11 w-11 p-0 text-destructive sm:h-7 sm:w-7 hover:bg-destructive/10"
                                  onClick={() => setDeleteTarget({ kind: "order", id: o.id, label: `أمر الصيانة ${o.code}` })}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
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
                <>
                  <Button variant="outline" className="border-border" onClick={() => setImportingInventory(true)}>
                    استيراد CSV
                  </Button>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openReceiveStock}>
                    <Plus className="ml-2 h-4 w-4" /> استلام مخزون / توريد جديد
                  </Button>
                </>
              }
            />
            <DataTable head={["الصنف", "الكود", "الرصيد الحالي", "الحد الأدنى", "سعر الوحدة", "الحالة", "الإجراءات"]}>
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
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEditItem(i)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget({ kind: "item", id: i.id, label: `الصنف ${i.name}` })}
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

        <TabsContent value="fuel">
          <Panel title="سجل التزود بالسولار">
            <Toolbar
              query={query}
              onQuery={setQuery}
              placeholder="ابحث بكود الأتوبيس أو المحطة..."
              onExport={() => exportToExcel("سجل السولار", fuelLogs as unknown as Record<string, string | number>[])}
              extra={
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAddFuel}>
                  <Plus className="ml-2 h-4 w-4" /> إضافة سجل
                </Button>
              }
            />
            <DataTable head={["التاريخ", "الأتوبيس", "عداد البداية", "عداد النهاية", "المسافة", "الكمية (لتر)", "التكلفة", "المحطة", "الإجراءات"]}>
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
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEditFuel(f)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget({ kind: "fuel", id: f.id, label: `سجل سولار ${f.bus} بتاريخ ${f.date}` })}
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

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{form.id ? "تعديل أمر الصيانة" : "أمر صيانة جديد"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">سجل العطل وقطع الغيار المطلوبة</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {[
              ["bus", "كود الأتوبيس"],
              ["issue", "وصف العطل"],
              ["parts", "قطع الغيار (وصف نصي)"],
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
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="mb-2 text-xs font-bold text-primary">خصم قطعة من المخزن تلقائيًا (اختياري)</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">الصنف</Label>
                  <Select value={form.inventoryItemName} onValueChange={(v) => setForm({ ...form, inventoryItemName: v })}>
                    <SelectTrigger className="border-border bg-input/60">
                      <SelectValue placeholder="بدون خصم" />
                    </SelectTrigger>
                    <SelectContent>
                      {inventory.map((i) => (
                        <SelectItem key={i.id} value={i.name}>{i.name} (متاح: {i.stock})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">الكمية المستخدمة</Label>
                  <Input value={form.quantityUsed} onChange={(e) => setForm({ ...form, quantityUsed: e.target.value })} type="number" className="border-border bg-input/60" />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitOrder} disabled={saving}>
              {saving ? "جارِ الحفظ..." : form.id ? "حفظ التعديلات" : "حفظ الأمر"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={addingItem} onOpenChange={setAddingItem}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">تعديل بيانات الصنف</DialogTitle>
            <DialogDescription className="text-muted-foreground">تصحيح بيانات صنف موجود (لإضافة كمية جديدة استخدم "استلام مخزون")</DialogDescription>
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
            <Button className="bg-primary text-primary-foreground" onClick={submitItem} disabled={saving}>
              {saving ? "جارِ الحفظ..." : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={receiving} onOpenChange={setReceiving}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">استلام مخزون / توريد جديد</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              يزيد الرصيد فورًا، ويُضاف الإجمالي إلى رصيد المورد تلقائيًا في "حسابات الموردين"
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">اسم الصنف</Label>
              <Input value={receiveForm.itemName} onChange={(e) => setReceiveForm({ ...receiveForm, itemName: e.target.value })} className="border-border bg-input/60" list="inventory-item-names" />
              <datalist id="inventory-item-names">
                {inventory.map((i) => (
                  <option key={i.id} value={i.name} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">كود الصنف (إن كان جديدًا)</Label>
              <Input value={receiveForm.itemCode} onChange={(e) => setReceiveForm({ ...receiveForm, itemCode: e.target.value })} className="border-border bg-input/60" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">المورد</Label>
              <Input value={receiveForm.supplierName} onChange={(e) => setReceiveForm({ ...receiveForm, supplierName: e.target.value })} className="border-border bg-input/60" list="supplier-names" />
              <datalist id="supplier-names">
                {suppliers.map((s) => (
                  <option key={s.id} value={s.name} />
                ))}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">الكمية</Label>
                <Input value={receiveForm.quantity} onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })} type="number" className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">سعر الوحدة</Label>
                <Input value={receiveForm.unitPrice} onChange={(e) => setReceiveForm({ ...receiveForm, unitPrice: e.target.value })} type="number" className="border-border bg-input/60" />
              </div>
            </div>
            {receiveForm.quantity && receiveForm.unitPrice && (
              <p className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
                الإجمالي: <b className="text-primary">{(Number(receiveForm.quantity) * Number(receiveForm.unitPrice)).toLocaleString("ar-EG")} ج.م</b>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitReceiveStock} disabled={saving}>
              {saving ? "جارِ الحفظ..." : "تسجيل التوريد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addingFuel} onOpenChange={setAddingFuel}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{fuelForm.id ? "تعديل سجل السولار" : "إضافة سجل تزود بالسولار"}</DialogTitle>
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
            <Button className="bg-primary text-primary-foreground" onClick={submitFuel} disabled={saving}>
              {saving ? "جارِ الحفظ..." : fuelForm.id ? "حفظ التعديلات" : "حفظ السجل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CsvImportDialog
        open={importingInventory}
        onOpenChange={setImportingInventory}
        title="استيراد المخزون من CSV"
        columns={[
          { key: "name", label: "اسم الصنف" },
          { key: "code", label: "الكود" },
          { key: "stock", label: "الرصيد" },
          { key: "min_stock", label: "الحد الأدنى" },
          { key: "unit_price", label: "سعر الوحدة" },
        ]}
        onImport={bulkInsertInventory}
        onDone={loadAll}
      />

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
