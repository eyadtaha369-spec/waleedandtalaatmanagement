import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Ban, Check, ChevronsUpDown, FileText, Pencil, Plus, Printer, Trash2, X } from "lucide-react";
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
import { currency, UNIT_TYPES, type MaintenanceOrder, type MaintenanceStatus, type InventoryItem, type FuelLog, type UnitType } from "@/lib/fleet-data";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  fetchMaintenanceOrders,
  fetchInventory,
  fetchFuelLogs,
  saveMaintenanceOrder,
  computeOrderTotals,
  computeFuelByBus,
  computeBusLedger,
  addInventoryItem,
  fetchBuses,
  fetchDrivers,
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

const columns: MaintenanceStatus[] = ["بانتظار القطع", "قيد التنفيذ", "مكتمل", "ملغي"];
const flow: MaintenanceStatus[] = ["بانتظار القطع", "قيد التنفيذ", "مكتمل"];
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtQty = (n: number) => n.toLocaleString("ar-EG", { maximumFractionDigits: 3 });
const unitShort: Record<string, string> = { بالقطعة: "قطعة", بالكيلو: "كجم", باللتر: "لتر" };

type DeleteTarget = { kind: "order" | "item" | "fuel"; id: string; label: string } | null;

interface PartRow {
  key: number;
  inventoryId: string;
  quantity: string;
  unitPrice: string;
}
let partKey = 0;
const newPart = (): PartRow => ({ key: ++partKey, inventoryId: "", quantity: "1", unitPrice: "" });

const emptyOrderForm = { id: "", bus: "", date: todayStr(), issue: "", laborCost: "", status: "بانتظار القطع" as MaintenanceStatus };
const emptyItemForm = { id: "", name: "", code: "", stock: "", minStock: "", unitPrice: "", unitType: "بالقطعة" as UnitType };
const emptyFuelForm = { id: "", busCode: "", driverName: "", odoStart: "", odoEnd: "", liters: "", cost: "", station: "" };

/** Searchable dropdown over the inventory (only items currently in stock, plus ones already on this order). */
function PartPicker({
  value,
  items,
  onChange,
}: {
  value: string;
  items: InventoryItem[];
  onChange: (item: InventoryItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between border-border bg-input/60 font-normal">
          <span className="truncate">{selected ? selected.name : "ابحث واختر قطعة..."}</span>
          <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[16rem] p-0" dir="rtl" align="start">
        <Command>
          <CommandInput placeholder="ابحث باسم القطعة أو الكود..." />
          <CommandList>
            <CommandEmpty>لا توجد قطعة متاحة بهذا الاسم.</CommandEmpty>
            <CommandGroup>
              {items.map((i) => (
                <CommandItem
                  key={i.id}
                  value={`${i.name} ${i.code}`}
                  onSelect={() => {
                    onChange(i);
                    setOpen(false);
                  }}
                >
                  <Check className={`ml-2 h-4 w-4 ${value === i.id ? "opacity-100" : "opacity-0"}`} />
                  <span className="flex-1">{i.name}</span>
                  <span className="text-xs text-muted-foreground">
                    متاح: {fmtQty(i.stock)} {unitShort[i.unitType]} · {currency(i.unitPrice)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function WorkshopPage() {
  const [orders, setOrders] = useState<MaintenanceOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [busCodes, setBusCodes] = useState<string[]>([]);
  const [driverNames, setDriverNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  // orders
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyOrderForm);
  const [parts, setParts] = useState<PartRow[]>([newPart()]);
  const [cancelTarget, setCancelTarget] = useState<MaintenanceOrder | null>(null);

  // inventory
  const [addingItem, setAddingItem] = useState(false);
  const [importingInventory, setImportingInventory] = useState(false);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [receiving, setReceiving] = useState(false);
  const [receiveForm, setReceiveForm] = useState({ itemName: "", itemCode: "", supplierName: "", quantity: "", unitPrice: "" });
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // fuel
  const [addingFuel, setAddingFuel] = useState(false);
  const [fuelForm, setFuelForm] = useState(emptyFuelForm);

  // bus maintenance ledger
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerBus, setLedgerBus] = useState("");
  const [ledgerFrom, setLedgerFrom] = useState(`${todayStr().slice(0, 8)}01`);
  const [ledgerTo, setLedgerTo] = useState(todayStr());

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, i, f, s, buses, drivers] = await Promise.all([
        fetchMaintenanceOrders(),
        fetchInventory(),
        fetchFuelLogs(),
        fetchSuppliers(),
        fetchBuses(),
        fetchDrivers(),
      ]);
      setOrders(o);
      setInventory(i);
      setFuelLogs(f);
      setSuppliers(s);
      setBusCodes(buses.map((b) => b.code));
      setDriverNames(drivers.map((d) => d.name));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // ---------- maintenance orders ----------
  const openAddOrder = () => {
    setForm({ ...emptyOrderForm, date: todayStr() });
    setParts([newPart()]);
    setAdding(true);
  };

  const openEditOrder = (o: MaintenanceOrder) => {
    setForm({
      id: o.id,
      bus: o.bus === "—" ? "" : o.bus,
      date: o.date,
      issue: o.issue === "—" ? "" : o.issue,
      laborCost: o.laborCost ? String(o.laborCost) : "",
      status: o.status,
    });
    setParts(o.items.length ? o.items.map((i) => ({ key: ++partKey, inventoryId: i.inventoryId, quantity: String(i.quantity), unitPrice: String(i.unitPrice) })) : [newPart()]);
    setAdding(true);
  };

  // items you can pick: in stock now, or already used by the order being edited
  const selectableItems = useMemo(() => {
    const onThisOrder = new Set(orders.find((o) => o.id === form.id)?.items.map((i) => i.inventoryId) ?? []);
    return inventory.filter((i) => i.stock > 0 || onThisOrder.has(i.id));
  }, [inventory, orders, form.id]);

  const updatePart = (key: number, patch: Partial<PartRow>) => setParts((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const pickPart = (key: number, item: InventoryItem) => updatePart(key, { inventoryId: item.id, unitPrice: String(item.unitPrice) });

  const filledParts = parts.filter((p) => p.inventoryId);
  const totals = computeOrderTotals(
    filledParts.map((p) => ({ quantity: Number(p.quantity) || 0, unitPrice: Number(p.unitPrice) || 0 })),
    Number(form.laborCost) || 0,
  );

  const submitOrder = async () => {
    if (!form.bus.trim()) {
      setError("اختر رقم العربية");
      return;
    }
    if (filledParts.some((p) => !(Number(p.quantity) > 0))) {
      setError("أدخل كمية صحيحة لكل قطعة");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveMaintenanceOrder(form.id || null, {
        busCode: form.bus,
        issue: form.issue,
        status: form.status,
        laborCost: Number(form.laborCost) || 0,
        orderDate: form.date,
        items: filledParts.map((p) => ({ inventoryId: p.inventoryId, quantity: Number(p.quantity), unitPrice: Number(p.unitPrice) || 0 })),
      });
      await loadAll();
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
    const next = flow[Math.min(flow.indexOf(order.status) + 1, flow.length - 1)] ?? order.status;
    try {
      await updateMaintenanceStatus(id, next);
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: next } : o)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحديث حالة الأمر");
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setDeleting(true);
    try {
      await updateMaintenanceStatus(cancelTarget.id, "ملغي"); // database returns the parts to stock
      await loadAll();
      setCancelTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إلغاء الأمر");
    } finally {
      setDeleting(false);
    }
  };

  // ---------- inventory ----------
  const openAddItem = () => {
    setItemForm(emptyItemForm);
    setAddingItem(true);
  };
  const openEditItem = (i: InventoryItem) => {
    setItemForm({ id: i.id, name: i.name, code: i.code, stock: String(i.stock), minStock: String(i.minStock), unitPrice: String(i.unitPrice), unitType: i.unitType });
    setAddingItem(true);
  };
  const submitItem = async () => {
    if (!itemForm.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: itemForm.name,
        code: itemForm.code,
        stock: Number(itemForm.stock) || 0,
        minStock: Number(itemForm.minStock) || 0,
        unitPrice: Number(itemForm.unitPrice) || 0,
        unitType: itemForm.unitType,
      };
      if (itemForm.id) await updateInventoryItem(itemForm.id, payload);
      else await addInventoryItem(payload);
      await loadAll();
      setAddingItem(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ الصنف");
    } finally {
      setSaving(false);
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
      setReceiving(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تسجيل التوريد");
    } finally {
      setSaving(false);
    }
  };

  // ---------- fuel ----------
  const openAddFuel = () => {
    setFuelForm(emptyFuelForm);
    setAddingFuel(true);
  };
  const openEditFuel = (f: FuelLog) => {
    setFuelForm({
      id: f.id,
      busCode: f.bus === "—" ? "" : f.bus,
      driverName: f.driver === "—" ? "" : f.driver,
      odoStart: String(f.odoStart),
      odoEnd: String(f.odoEnd),
      liters: String(f.liters),
      cost: String(f.cost),
      station: f.station === "—" ? "" : f.station,
    });
    setAddingFuel(true);
  };
  const submitFuel = async () => {
    if (!fuelForm.busCode.trim() || !fuelForm.driverName.trim()) {
      setError("اختر رقم العربية واسم السائق");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        busCode: fuelForm.busCode,
        driverName: fuelForm.driverName,
        odoStart: Number(fuelForm.odoStart) || 0,
        odoEnd: Number(fuelForm.odoEnd) || 0,
        liters: Number(fuelForm.liters) || 0,
        cost: Number(fuelForm.cost) || 0,
        station: fuelForm.station,
      };
      if (fuelForm.id) await updateFuelLog(fuelForm.id, payload);
      else await addFuelLog(payload);
      await loadAll();
      setAddingFuel(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ سجل السولار");
    } finally {
      setSaving(false);
    }
  };

  const fuelByBus = useMemo(() => computeFuelByBus(fuelLogs), [fuelLogs]);

  // ---------- delete ----------
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

  // ---------- bus maintenance ledger ----------
  const ledger = useMemo(() => {
    const busByOrder = new Map(orders.map((o) => [o.id, o.bus]));
    return computeBusLedger(orders, ledgerBus, ledgerFrom, ledgerTo, busByOrder);
  }, [orders, ledgerBus, ledgerFrom, ledgerTo]);

  const printLedger = () => {
    document.body.classList.add("print-statement");
    const cleanup = () => {
      document.body.classList.remove("print-statement");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => window.print(), 150);
  };

  const statusTone = (st: MaintenanceStatus) => (st === "مكتمل" ? "good" : st === "قيد التنفيذ" ? "warn" : st === "ملغي" ? "bad" : "muted");

  return (
    <AppShell>
      <PageHeader title="الورشة والمخزون والسولار" subtitle="أوامر الصيانة، قطع الغيار، وسجل التزود بالوقود" />

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
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
              onExport={() =>
                exportToExcel(
                  "أوامر الصيانة",
                  orders.map((o) => ({ الأمر: o.code, العربية: o.bus, التاريخ: o.date, العطل: o.issue, "قطع الغيار": o.parts, المصنعية: o.laborCost, الإجمالي: o.cost, الحالة: o.status })),
                )
              }
              extra={
                <>
                  <Button variant="outline" className="border-border" onClick={() => { setLedgerBus(busCodes[0] ?? ""); setLedgerOpen(true); }}>
                    <FileText className="ml-2 h-4 w-4" /> كشف صيانة السيارة
                  </Button>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAddOrder}>
                    <Plus className="ml-2 h-4 w-4" /> أمر صيانة جديد
                  </Button>
                </>
              }
            />
            {loading ? (
              <p className="py-6 text-center text-muted-foreground">جارِ التحميل...</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-4">
                {columns.map((col) => (
                  <div key={col} className="rounded-xl border border-border bg-secondary/20 p-3">
                    <h3 className="mb-3 flex items-center justify-between text-sm font-bold">
                      <span>{col}</span>
                      <StatusPill label={String(orders.filter((o) => o.status === col).length)} tone={statusTone(col)} />
                    </h3>
                    <div className="space-y-3">
                      {orders
                        .filter((o) => o.status === col && (o.code + o.bus + o.issue).includes(query))
                        .map((o) => (
                          <div key={o.id} className={`rounded-lg border border-border bg-card p-3 ${col === "ملغي" ? "opacity-70" : ""}`}>
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-primary">{o.code}</span>
                              <span>{o.bus} · {o.date}</span>
                            </div>
                            <p className="mt-2 text-sm font-semibold">{o.issue}</p>
                            {o.items.length > 0 && (
                              <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                                {o.items.map((i) => (
                                  <li key={i.id}>
                                    {i.name} × {fmtQty(i.quantity)} {unitShort[i.unitType]} — {currency(i.quantity * i.unitPrice)}
                                  </li>
                                ))}
                              </ul>
                            )}
                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-sm font-bold text-warning">{currency(o.cost)}</span>
                              <div className="flex items-center gap-1">
                                {flow.includes(o.status) && o.status !== "مكتمل" && (
                                  <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => move(o.id)}>
                                    التالي
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" className="h-11 w-11 p-0 text-primary hover:bg-primary/10 sm:h-7 sm:w-7" onClick={() => openEditOrder(o)} title="تعديل">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                {o.status !== "ملغي" && (
                                  <Button size="sm" variant="ghost" className="h-11 w-11 p-0 text-warning hover:bg-warning/10 sm:h-7 sm:w-7" onClick={() => setCancelTarget(o)} title="إلغاء الأمر">
                                    <Ban className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-11 w-11 p-0 text-destructive hover:bg-destructive/10 sm:h-7 sm:w-7"
                                  onClick={() => setDeleteTarget({ kind: "order", id: o.id, label: `أمر الصيانة ${o.code}` })}
                                  title="حذف"
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
              onExport={() => exportToExcel("المخزن", inventory.map((i) => ({ الصنف: i.name, الكود: i.code, الوحدة: i.unitType, الرصيد: i.stock, "الحد الأدنى": i.minStock, "سعر الوحدة": i.unitPrice })))}
              extra={
                <>
                  <Button variant="outline" className="border-border" onClick={() => setImportingInventory(true)}>
                    استيراد CSV
                  </Button>
                  <Button variant="outline" className="border-border" onClick={openAddItem}>
                    <Plus className="ml-2 h-4 w-4" /> إضافة صنف يدوي
                  </Button>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openReceiveStock}>
                    <Plus className="ml-2 h-4 w-4" /> استلام مخزون / توريد جديد
                  </Button>
                </>
              }
            />
            <DataTable head={["الصنف", "الكود", "الوحدة", "الرصيد الحالي", "الحد الأدنى", "تكلفة الوحدة", "الحالة", "الإجراءات"]}>
              {inventory
                .filter((i) => i.name.includes(query) || query === "")
                .map((i) => (
                  <tr key={i.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3 font-bold">{i.name}</td>
                    <td className="px-4 py-3">{i.code}</td>
                    <td className="px-4 py-3 text-xs">{i.unitType}</td>
                    <td className="px-4 py-3">{fmtQty(i.stock)} {unitShort[i.unitType]}</td>
                    <td className="px-4 py-3">{fmtQty(i.minStock)}</td>
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
                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget({ kind: "item", id: i.id, label: `الصنف ${i.name}` })}>
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
          <Panel title="استهلاك السولار لكل سيارة">
            <DataTable head={["رقم العربية", "عدد مرات التزود", "إجمالي اللترات", "إجمالي التكلفة", "المسافة (كم)", "كم / لتر", "تكلفة الكم"]}>
              {fuelByBus.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-4 text-center text-muted-foreground">لا توجد سجلات بعد.</td></tr>
              ) : (
                fuelByBus.map((b) => (
                  <tr key={b.bus} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3 font-bold text-primary">{b.bus}</td>
                    <td className="px-4 py-3">{b.fills}</td>
                    <td className="px-4 py-3">{fmtQty(b.liters)}</td>
                    <td className="px-4 py-3 text-warning">{currency(b.cost)}</td>
                    <td className="px-4 py-3">{fmtQty(b.km)}</td>
                    <td className="px-4 py-3">{b.kmPerLiter || "—"}</td>
                    <td className="px-4 py-3">{b.costPerKm ? currency(b.costPerKm) : "—"}</td>
                  </tr>
                ))
              )}
            </DataTable>
          </Panel>
          <Panel title="سجل التزود بالسولار" className="mt-4">
            <Toolbar
              query={query}
              onQuery={setQuery}
              placeholder="ابحث برقم العربية أو السائق أو المحطة..."
              onExport={() => exportToExcel("سجل السولار", fuelLogs.map((f) => ({ التاريخ: f.date, "رقم العربية": f.bus, السائق: f.driver, اللترات: f.liters, التكلفة: f.cost, المحطة: f.station })))}
              extra={
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAddFuel}>
                  <Plus className="ml-2 h-4 w-4" /> إضافة سجل
                </Button>
              }
            />
            <DataTable head={["التاريخ", "رقم العربية", "اسم السائق", "عداد البداية", "عداد النهاية", "المسافة", "الكمية (لتر)", "التكلفة", "المحطة", "الإجراءات"]}>
              {fuelLogs
                .filter((f) => (f.bus + f.driver + f.station).includes(query) || query === "")
                .map((f) => (
                  <tr key={f.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3">{f.date}</td>
                    <td className="px-4 py-3 font-bold text-primary">{f.bus}</td>
                    <td className="px-4 py-3">{f.driver}</td>
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
                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget({ kind: "fuel", id: f.id, label: `سجل سولار ${f.bus} بتاريخ ${f.date}` })}>
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

      {/* ---- maintenance order dialog ---- */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="glass max-h-[90vh] overflow-y-auto text-foreground sm:max-w-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{form.id ? "تعديل أمر الصيانة" : "إضافة أمر صيانة"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              القطع المختارة تُخصم من المخزن تلقائيًا. عند التعديل تُرجَع القطع السابقة ثم تُخصم الجديدة، وعند الإلغاء أو الحذف تُرجَع كلها.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">رقم العربية</Label>
                <Select value={form.bus} onValueChange={(v) => setForm({ ...form, bus: v })}>
                  <SelectTrigger className="border-border bg-input/60"><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>{busCodes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">تاريخ الأمر</Label>
                <Input value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} type="date" className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">الحالة</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as MaintenanceStatus })}>
                  <SelectTrigger className="border-border bg-input/60"><SelectValue /></SelectTrigger>
                  <SelectContent>{columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">وصف العطل / الخدمة</Label>
              <Input value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })} className="border-border bg-input/60" />
            </div>

            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="mb-2 text-xs font-bold text-primary">قطع الغيار المستخدمة (من المخزن)</p>
              <div className="space-y-2">
                {parts.map((p) => {
                  const inv = inventory.find((i) => i.id === p.inventoryId);
                  const lineTotal = (Number(p.quantity) || 0) * (Number(p.unitPrice) || 0);
                  return (
                    <div key={p.key} className="grid grid-cols-2 items-end gap-2 rounded-md border border-border bg-secondary/20 p-2 sm:grid-cols-[2fr_1fr_1fr_auto_auto]">
                      <div className="col-span-2 grid gap-1 sm:col-span-1">
                        <Label className="text-xs text-muted-foreground">القطعة</Label>
                        <PartPicker value={p.inventoryId} items={selectableItems} onChange={(item) => pickPart(p.key, item)} />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs text-muted-foreground">الكمية{inv ? ` (${unitShort[inv.unitType]})` : ""}</Label>
                        <Input value={p.quantity} onChange={(e) => updatePart(p.key, { quantity: e.target.value })} type="number" min="0" step="any" className="border-border bg-input/60" />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs text-muted-foreground">سعر الوحدة</Label>
                        <Input value={p.unitPrice} onChange={(e) => updatePart(p.key, { unitPrice: e.target.value })} type="number" min="0" step="any" className="border-border bg-input/60" />
                      </div>
                      <div className="text-sm font-bold text-warning">{currency(lineTotal)}</div>
                      <Button type="button" size="sm" variant="ghost" className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10" onClick={() => setParts((ps) => (ps.length > 1 ? ps.filter((x) => x.key !== p.key) : [newPart()]))}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <button type="button" className="mt-2 text-sm text-primary hover:underline" onClick={() => setParts((ps) => [...ps, newPart()])}>
                + إضافة قطعة أخرى
              </button>
            </div>

            <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_2fr]">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">تكلفة المصنعية (اختياري)</Label>
                <Input value={form.laborCost} onChange={(e) => setForm({ ...form, laborCost: e.target.value })} type="number" min="0" className="border-border bg-input/60" />
              </div>
              <p className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
                قطع الغيار: <b className="text-warning">{currency(totals.partsTotal)}</b> &nbsp;|&nbsp; الإجمالي: <b className="text-primary">{currency(totals.total)}</b>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitOrder} disabled={saving}>
              {saving ? "جارِ الحفظ..." : form.id ? "حفظ التعديلات" : "حفظ الأمر"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- bus maintenance ledger ---- */}
      <Dialog open={ledgerOpen} onOpenChange={setLedgerOpen}>
        <DialogContent className="glass max-h-[90vh] overflow-y-auto text-foreground sm:max-w-4xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">كشف صيانة السيارة</DialogTitle>
            <DialogDescription className="text-muted-foreground">كل أوامر الصيانة المنفذة على السيارة في الفترة المحددة (دون الأوامر الملغاة).</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">رقم العربية</Label>
              <Select value={ledgerBus} onValueChange={setLedgerBus}>
                <SelectTrigger className="border-border bg-input/60"><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>{busCodes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">من تاريخ</Label>
              <Input value={ledgerFrom} onChange={(e) => setLedgerFrom(e.target.value)} type="date" className="border-border bg-input/60" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">إلى تاريخ</Label>
              <Input value={ledgerTo} onChange={(e) => setLedgerTo(e.target.value)} type="date" className="border-border bg-input/60" />
            </div>
          </div>

          {!ledgerBus ? (
            <p className="py-4 text-center text-sm text-muted-foreground">اختر السيارة لعرض الكشف.</p>
          ) : ledger.rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">لا توجد أوامر صيانة لهذه السيارة في الفترة المحددة.</p>
          ) : (
            <div className="space-y-3">
              {ledger.rows.map((r) => (
                <div key={r.id} className="rounded-lg border border-border bg-secondary/20 p-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="font-bold text-primary">{r.code}</span>
                    <span className="text-xs text-muted-foreground">{r.date}</span>
                    <span className="font-semibold">{r.issue}</span>
                    <span className="mr-auto font-bold text-warning">{currency(r.total)}</span>
                  </div>
                  {r.items.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      {r.items.map((i) => (
                        <li key={i.id}>
                          {i.name} — {fmtQty(i.quantity)} {unitShort[i.unitType]} × {currency(i.unitPrice)} = <b>{currency(i.quantity * i.unitPrice)}</b>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-1 text-xs">قطع الغيار: {currency(r.partsTotal)} · المصنعية: {currency(r.laborCost)}</p>
                </div>
              ))}
              <p className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm font-bold">
                إجمالي قطع الغيار: {currency(ledger.totalParts)} &nbsp;|&nbsp; إجمالي المصنعية: {currency(ledger.totalLabor)} &nbsp;|&nbsp; الإجمالي الكلي: <span className="text-primary">{currency(ledger.grandTotal)}</span>
              </p>
            </div>
          )}
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={printLedger} disabled={!ledgerBus || ledger.rows.length === 0}>
              <Printer className="ml-2 h-4 w-4" /> طباعة كشف صيانة العربية / PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* printable maintenance ledger (only visible when printing) */}
      {ledgerOpen && ledgerBus && ledger.rows.length > 0 && (
        <div className="print-only" dir="rtl">
          <h1 style={{ textAlign: "center", fontSize: 22, fontWeight: 800 }}>وليد وطلعت لخدمات النقل والرحلات</h1>
          <h2 style={{ textAlign: "center", fontSize: 18, margin: "8px 0 16px" }}>كشف صيانة العربية</h2>
          <p style={{ marginBottom: 12 }}>
            <b>رقم العربية:</b> {ledgerBus} &nbsp;&nbsp; <b>الفترة:</b> {ledgerFrom || "—"} إلى {ledgerTo || "—"} &nbsp;&nbsp; <b>تاريخ الطباعة:</b> {todayStr()}
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["التاريخ", "أمر الصيانة", "العطل / الخدمة", "قطع الغيار والتكلفة", "المصنعية", "الإجمالي"].map((h) => (
                  <th key={h} style={{ border: "1px solid #000", padding: 6, background: "#eee" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ border: "1px solid #000", padding: 6, verticalAlign: "top" }}>{r.date}</td>
                  <td style={{ border: "1px solid #000", padding: 6, verticalAlign: "top" }}>{r.code}</td>
                  <td style={{ border: "1px solid #000", padding: 6, verticalAlign: "top" }}>{r.issue}</td>
                  <td style={{ border: "1px solid #000", padding: 6 }}>
                    {r.items.length === 0 ? "—" : r.items.map((i) => (
                      <div key={i.id}>{i.name} × {fmtQty(i.quantity)} {unitShort[i.unitType]} @ {currency(i.unitPrice)} = {currency(i.quantity * i.unitPrice)}</div>
                    ))}
                    {r.items.length > 0 && <div style={{ fontWeight: 700 }}>إجمالي القطع: {currency(r.partsTotal)}</div>}
                  </td>
                  <td style={{ border: "1px solid #000", padding: 6, verticalAlign: "top" }}>{currency(r.laborCost)}</td>
                  <td style={{ border: "1px solid #000", padding: 6, verticalAlign: "top", fontWeight: 700 }}>{currency(r.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 800 }}>
                <td colSpan={3} style={{ border: "1px solid #000", padding: 6 }}>الإجمالي الكلي</td>
                <td style={{ border: "1px solid #000", padding: 6 }}>{currency(ledger.totalParts)}</td>
                <td style={{ border: "1px solid #000", padding: 6 }}>{currency(ledger.totalLabor)}</td>
                <td style={{ border: "1px solid #000", padding: 6 }}>{currency(ledger.grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ---- inventory item dialog (manual add / edit) ---- */}
      <Dialog open={addingItem} onOpenChange={setAddingItem}>
        <DialogContent className="glass text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{itemForm.id ? "تعديل بيانات الصنف" : "إضافة صنف يدوي"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {itemForm.id ? 'تصحيح بيانات صنف موجود (لإضافة كمية جديدة من مورد استخدم "استلام مخزون")' : "أضف صنفًا جديدًا بكمية افتتاحية، بالقطعة أو بالكيلو أو باللتر."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">اسم الصنف</Label>
              <Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} className="border-border bg-input/60" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">نوع الوحدة</Label>
                <Select value={itemForm.unitType} onValueChange={(v) => setItemForm({ ...itemForm, unitType: v as UnitType })}>
                  <SelectTrigger className="border-border bg-input/60"><SelectValue /></SelectTrigger>
                  <SelectContent>{UNIT_TYPES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">الكود (اختياري)</Label>
                <Input value={itemForm.code} onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })} className="border-border bg-input/60" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">{itemForm.id ? "الرصيد الحالي" : "الكمية الافتتاحية"}</Label>
                <Input value={itemForm.stock} onChange={(e) => setItemForm({ ...itemForm, stock: e.target.value })} type="number" min="0" step="any" className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">الحد الأدنى للمخزون</Label>
                <Input value={itemForm.minStock} onChange={(e) => setItemForm({ ...itemForm, minStock: e.target.value })} type="number" min="0" step="any" className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">تكلفة الوحدة</Label>
                <Input value={itemForm.unitPrice} onChange={(e) => setItemForm({ ...itemForm, unitPrice: e.target.value })} type="number" min="0" step="any" className="border-border bg-input/60" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitItem} disabled={saving}>
              {saving ? "جارِ الحفظ..." : itemForm.id ? "حفظ التعديلات" : "حفظ الصنف"}
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
                <Input value={receiveForm.quantity} onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })} type="number" step="any" className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">سعر الوحدة</Label>
                <Input value={receiveForm.unitPrice} onChange={(e) => setReceiveForm({ ...receiveForm, unitPrice: e.target.value })} type="number" step="any" className="border-border bg-input/60" />
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

      {/* ---- fuel dialog ---- */}
      <Dialog open={addingFuel} onOpenChange={setAddingFuel}>
        <DialogContent className="glass max-h-[90vh] overflow-y-auto text-foreground" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{fuelForm.id ? "تعديل سجل السولار" : "إضافة سجل تزود بالسولار"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">كل سجل مرتبط بسيارة وسائق لحساب الاستهلاك لكل سيارة</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">رقم العربية</Label>
                <Select value={fuelForm.busCode} onValueChange={(v) => setFuelForm({ ...fuelForm, busCode: v })}>
                  <SelectTrigger className="border-border bg-input/60"><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>{busCodes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">اسم السائق</Label>
                <Select value={fuelForm.driverName} onValueChange={(v) => setFuelForm({ ...fuelForm, driverName: v })}>
                  <SelectTrigger className="border-border bg-input/60"><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>{driverNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {[
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
                  onChange={(e) => setFuelForm({ ...fuelForm, [key as string]: e.target.value })}
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
          { key: "unit_type", label: "الوحدة (بالقطعة / بالكيلو / باللتر)" },
          { key: "stock", label: "الرصيد" },
          { key: "min_stock", label: "الحد الأدنى" },
          { key: "unit_price", label: "سعر الوحدة" },
        ]}
        onImport={bulkInsertInventory}
        onDone={loadAll}
      />

      {/* ---- cancel / delete confirmations ---- */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent className="glass text-foreground" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-warning">تأكيد إلغاء الأمر</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              سيتم إلغاء أمر الصيانة {cancelTarget?.code} وإرجاع كل قطع الغيار المخصومة إلى المخزن. يمكنك إعادة تفعيله لاحقًا من التعديل.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">رجوع</AlertDialogCancel>
            <AlertDialogAction className="bg-warning text-warning-foreground hover:bg-warning/90" onClick={confirmCancel} disabled={deleting}>
              {deleting ? "جارِ الإلغاء..." : "إلغاء الأمر"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="glass text-foreground" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              سيتم حذف {deleteTarget?.label} نهائيًا{deleteTarget?.kind === "order" ? " وإرجاع قطع الغيار المخصومة إلى المخزن" : ""}. لا يمكن التراجع عن هذا الإجراء.
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
