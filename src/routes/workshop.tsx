import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Ban, Check, ChevronsUpDown, FileText, Pencil, Plus, Printer, Trash2, X } from "lucide-react";
import { DateRangeFilter } from "@/components/date-range-filter";
import { ReportPrint } from "@/components/report-print";
import { BusPicker } from "@/components/bus-picker";
import { ItemStatementSheet } from "@/components/item-statement";
import { PaymentSourceSelect } from "@/components/payment-source-select";
import { useMyRole, workshopRights } from "@/lib/permissions";
import { AppShell } from "@/components/app-shell";
import { DataTable, PageHeader, Panel, StatusPill, Toolbar, exportToExcel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersonPicker } from "@/components/person-picker";
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
import { currency, UNIT_TYPES, type MaintenanceOrder, type MaintenanceStatus, type InventoryItem, type FuelLog, type UnitType, type Bus } from "@/lib/fleet-data";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  fetchMaintenanceOrders,
  fetchInventory,
  fetchFuelLogs,
  saveMaintenanceOrder,
  computeFleetFuelRows,
  computeFuelAlerts,
  inDateRange,
  rangeForPreset,
  fetchInventoryMovements,
  periodLabel,
  type DateRange,
  type InventoryMovementRow,
  computeOrderTotals,
  computeFuelByBus,
  dbErrorMessage,
  computeFuelFills,
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
  updateInventoryPurchase,
  deleteInventoryPurchase,
  fetchInventoryPurchases,
  getInvoiceAttachmentUrl,
  purchaseTotal,
  type InventoryPurchase,
  type InventoryPurchaseInput,
  fetchSuppliers,
  addSupplier,
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

type DeleteTarget = { kind: "order" | "item" | "fuel" | "purchase"; id: string; label: string; path?: string | null } | null;

interface PartRow {
  key: number;
  inventoryId: string;
  quantity: string;
  unitPrice: string;
}
let partKey = 0;
const newPart = (): PartRow => ({ key: ++partKey, inventoryId: "", quantity: "1", unitPrice: "" });

const emptyOrderForm = { id: "", bus: "", date: todayStr(), issue: "", laborCost: "", paySource: "", status: "بانتظار القطع" as MaintenanceStatus, driverFault: false, faultDriverId: "", faultAmount: "", mileage: "" };
const emptyItemForm = { id: "", name: "", code: "", stock: "", minStock: "", unitPrice: "", unitType: "بالقطعة" as UnitType };
const NEW_STATION = "__new__";
const emptyFuelForm = { id: "", busCode: "", driverName: "", date: new Date().toISOString().slice(0, 10), currentOdometer: "", liters: "", cost: "", station: "", pricePerLiter: "", supplierId: "" };

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
  const [busList, setBusList] = useState<Bus[]>([]);
  const [driverNames, setDriverNames] = useState<string[]>([]);
  const [driverOpts, setDriverOpts] = useState<{ value: string; label: string; group: string }[]>([]);
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
  const emptyReceive = () => ({
    id: "",
    previousPath: null as string | null,
    supplierId: "",
    newSupplierName: "",
    itemId: "",
    newItemName: "",
    newItemCode: "",
    unitType: "بالقطعة" as UnitType,
    date: todayStr(),
    quantity: "",
    unitPrice: "",
    invoiceRef: "",
    paidAmount: "",
    paySource: "",
    file: null as File | null,
  });
  const [receiveForm, setReceiveForm] = useState(emptyReceive);
  const [purchases, setPurchases] = useState<InventoryPurchase[]>([]);
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
      const [o, i, f, s, buses, drivers, pu] = await Promise.all([
        fetchMaintenanceOrders(),
        fetchInventory(),
        fetchFuelLogs(),
        fetchSuppliers(),
        fetchBuses(),
        fetchDrivers(),
        fetchInventoryPurchases(),
      ]);
      setPurchases(pu);
      setOrders(o);
      setInventory(i);
      setFuelLogs(f);
      setSuppliers(s);
      setBusCodes(buses.map((b) => b.code));
      setBusList(buses);
      setDriverNames(drivers.map((d) => d.name));
      setDriverOpts(drivers.map((d) => ({ value: d.id, label: d.name, group: "سائق" })));
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
  const fuelAlerts = useMemo(() => {
    if (!busList.length) return [];
    const range = rangeForPreset("current");
    const rows = computeFleetFuelRows(busList.map((b) => ({ code: b.code, fuelTarget: b.fuelTarget, fuelBasis: b.fuelBasis })), computeFuelByBus(fuelLogs.filter((l) => inDateRange(l.date, range))));
    return computeFuelAlerts(rows);
  }, [busList, fuelLogs]);

  const openFuelInspection = (bus: string) => {
    setForm({ ...emptyOrderForm, date: todayStr(), bus, issue: "فحص موتور / رشاشات — استهلاك سولار عالي" });
    setParts([newPart()]);
    setAdding(true);
  };

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
      paySource: o.paySource ?? "",
      status: o.status,
      driverFault: !!o.driverFault,
      faultDriverId: o.faultDriverId ?? "",
      faultAmount: o.faultAmount ? String(o.faultAmount) : "",
      mileage: o.maintenanceMileage ? String(o.maintenanceMileage) : "",
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
    if (!(Number(form.mileage) > 0)) {
      setError("أدخل عداد الكيلومتر عند الصيانة");
      return;
    }
    if (form.driverFault && !form.faultDriverId) {
      setError("اختر السائق المسؤول عن الخطأ / الإهمال");
      return;
    }
    if ((Number(form.laborCost) || 0) > 0 && !form.paySource) {
      setError("اختر طريقة الدفع / مصدر التمويل للمصنعية");
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
        paySource: form.paySource,
        driverFault: form.driverFault,
        faultDriverId: form.faultDriverId,
        faultAmount: form.faultAmount ? Number(form.faultAmount) : null,
        maintenanceMileage: Number(form.mileage) > 0 ? Number(form.mileage) : null,
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
    setReceiveForm(emptyReceive());
    setReceiving(true);
  };
  const openEditPurchase = (p: InventoryPurchase) => {
    setReceiveForm({
      ...emptyReceive(),
      id: p.id,
      previousPath: p.attachmentPath,
      supplierId: p.supplierId,
      itemId: p.itemId,
      unitType: p.unitType,
      date: p.date,
      quantity: String(p.quantity),
      unitPrice: String(p.unitPrice),
      invoiceRef: p.invoiceRef,
      paidAmount: p.paidAmount ? String(p.paidAmount) : "",
      paySource: p.paySource,
    });
    setReceiving(true);
  };
  const submitReceiveStock = async () => {
    const f = receiveForm;
    const supplierNew = f.supplierId === "__new" || !f.supplierId;
    const itemNew = f.itemId === "__new" || !f.itemId;
    if (supplierNew && !f.newSupplierName.trim()) return setError("اختر المورد أو أدخل مورد جديد");
    if (itemNew && !f.newItemName.trim()) return setError("اختر الصنف أو أدخل صنف جديد");
    if (!(Number(f.quantity) > 0)) return setError("أدخل الكمية المشتراة");
    if ((Number(f.paidAmount) || 0) > 0 && !f.paySource) return setError("اختر طريقة الدفع / مصدر التمويل للمبلغ المدفوع");
    if ((Number(f.paidAmount) || 0) > (Number(f.quantity) * (Number(f.unitPrice) || 0))) return setError("المبلغ المدفوع أكبر من إجمالي التوريد");
    setSaving(true);
    setError(null);
    try {
      const input: InventoryPurchaseInput = {
        itemId: itemNew ? "" : f.itemId,
        newItemName: f.newItemName,
        newItemCode: f.newItemCode,
        unitType: f.unitType,
        supplierId: supplierNew ? "" : f.supplierId,
        newSupplierName: f.newSupplierName,
        date: f.date || todayStr(),
        quantity: Number(f.quantity),
        unitPrice: Number(f.unitPrice) || 0,
        invoiceRef: f.invoiceRef,
        paidAmount: Number(f.paidAmount) || 0,
        paySource: f.paySource,
        file: f.file,
      };
      if (f.id) await updateInventoryPurchase(f.id, input, f.previousPath);
      else await receiveInventoryStock(input);
      await loadAll();
      setReceiving(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : (e as { message?: string })?.message ?? "تعذر تسجيل التوريد");
    } finally {
      setSaving(false);
    }
  };
  const openAttachment = async (path: string) => {
    try {
      window.open(await getInvoiceAttachmentUrl(path), "_blank", "noopener");
    } catch {
      setError("تعذر فتح المرفق");
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
      date: f.date,
      currentOdometer: String(f.currentOdometer ?? (f.odoEnd || "")),
      liters: String(f.liters),
      cost: String(f.cost),
      station: f.station === "—" ? "" : f.station,
      pricePerLiter: f.pricePerLiter ? String(f.pricePerLiter) : "",
      supplierId: f.supplierId ?? "",
    });
    setAddingFuel(true);
  };
  const submitFuel = async () => {
    if (!fuelForm.busCode.trim() || !fuelForm.driverName.trim()) {
      setError("اختر رقم العربية واسم السائق");
      return;
    }
    if (!fuelForm.date) return setError("أدخل تاريخ التموين");
    if (!(Number(fuelForm.currentOdometer) > 0)) return setError("أدخل العداد الحالي");
    if (!(Number(fuelForm.liters) > 0)) return setError("أدخل عدد اللترات");
    if (fuelForm.supplierId === NEW_STATION && !newStation.trim()) return setError("اكتب اسم المحطة الجديدة");
    setSaving(true);
    setError(null);
    try {
      let supplierId = fuelForm.supplierId;
      let station = fuelForm.station;
      if (supplierId === NEW_STATION) {
        supplierId = await addSupplier({ name: newStation.trim(), phone: "", dueDate: "", alertDate: "" });
        station = newStation.trim();
      } else if (supplierId) {
        station = suppliers.find((s) => s.id === supplierId)?.name ?? station;
      }
      const payload = {
        busCode: fuelForm.busCode,
        driverName: fuelForm.driverName,
        date: fuelForm.date,
        currentOdometer: Number(fuelForm.currentOdometer) || 0,
        liters: Number(fuelForm.liters) || 0,
        cost: Number(fuelForm.cost) || 0,
        station,
        pricePerLiter: Number(fuelForm.pricePerLiter) || null,
        supplierId: supplierId === NEW_STATION ? "" : supplierId,
      };
      if (fuelForm.id) await updateFuelLog(fuelForm.id, payload);
      else await addFuelLog(payload);
      await loadAll();
      setNewStation("");
      setAddingFuel(false);
    } catch (e) {
      console.error(e);
      setError(dbErrorMessage(e, "تعذر حفظ سجل السولار"));
    } finally {
      setSaving(false);
    }
  };

  const [newStation, setNewStation] = useState("");
  const ALL: DateRange = { from: "", to: "" };
  const [ordRange, setOrdRange] = useState<DateRange>(ALL);
  const [invRange, setInvRange] = useState<DateRange>(ALL);
  const [fuelRange, setFuelRange] = useState<DateRange>(ALL);
  const [movements, setMovements] = useState<InventoryMovementRow[]>([]);
  const [printKind, setPrintKind] = useState<"orders" | "inventory" | "fuel" | null>(null);
  useEffect(() => {
    fetchInventoryMovements(invRange).then(setMovements).catch(() => setMovements([]));
  }, [invRange, inventory, purchases]);
  const ordersInRange = useMemo(() => orders.filter((o) => inDateRange(o.date, ordRange)), [orders, ordRange]);
  const orderTotals = useMemo(() => {
    const live = ordersInRange.filter((o) => o.status !== "ملغي");
    const parts = live.reduce((a, o) => a + o.items.reduce((x, i) => x + i.quantity * i.unitPrice, 0), 0);
    const labor = live.reduce((a, o) => a + o.laborCost, 0);
    return { count: live.length, parts, labor, total: parts + labor };
  }, [ordersInRange]);
  const purchasesInRange = useMemo(() => purchases.filter((p) => inDateRange(p.date, invRange)), [purchases, invRange]);
  const moveTotals = useMemo(() => ({ inQty: movements.reduce((a, m) => a + m.inQty, 0), inValue: movements.reduce((a, m) => a + m.inValue, 0), outQty: movements.reduce((a, m) => a + m.outQty, 0), outValue: movements.reduce((a, m) => a + m.outValue, 0) }), [movements]);
  const fuelInRange = useMemo(() => fuelLogs.filter((l) => inDateRange(l.date, fuelRange)), [fuelLogs, fuelRange]);
  const fuelPeriod = useMemo(() => ({ fills: fuelInRange.length, liters: fuelInRange.reduce((a, l) => a + l.liters, 0), cost: fuelInRange.reduce((a, l) => a + l.cost, 0) }), [fuelInRange]);
  const printReport = (kind: "orders" | "inventory" | "fuel") => {
    setPrintKind(kind);
    document.body.classList.add("print-statement");
    const cleanup = () => {
      document.body.classList.remove("print-statement");
      setPrintKind(null);
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => window.print(), 250);
  };
  const SummaryStrip = ({ items }: { items: [string, string][] }) => (
    <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
      {items.map(([l, v]) => (
        <div key={l} className="rounded-lg border border-border bg-secondary/30 p-3">
          <p className="text-xs text-muted-foreground">{l}</p>
          <p className="mt-1 font-bold text-primary">{v}</p>
        </div>
      ))}
    </div>
  );
  const setFuelCalc = (patch: Partial<typeof emptyFuelForm>) =>
    setFuelForm((f) => {
      const n = { ...f, ...patch };
      if (("liters" in patch || "pricePerLiter" in patch) && Number(n.pricePerLiter) > 0) {
        n.cost = String(Math.round((Number(n.liters) || 0) * Number(n.pricePerLiter) * 100) / 100);
      }
      return n;
    });
  const fuelTotals = useMemo(() => {
    const today = todayStr();
    const month = today.slice(0, 7);
    const sum = (rows: FuelLog[]) => ({ liters: rows.reduce((a, r) => a + r.liters, 0), cost: rows.reduce((a, r) => a + r.cost, 0) });
    return { day: sum(fuelLogs.filter((l) => l.date === today)), month: sum(fuelLogs.filter((l) => l.date.startsWith(month))) };
  }, [fuelLogs]);
  const fuelByBus = useMemo(() => computeFuelByBus(fuelInRange), [fuelInRange]);
  const fuelFills = useMemo(() => computeFuelFills(fuelLogs.map((f) => ({ id: f.id, bus: f.bus, date: f.date, order: f.createdAt, liters: f.liters, cost: f.cost, currentOdometer: f.currentOdometer, odoStart: f.odoStart, odoEnd: f.odoEnd }))), [fuelLogs]);
  const plateOf = (code: string) => busList.find((b) => b.code === code)?.plate ?? code;

  // ---------- delete ----------
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === "order") await deleteMaintenanceOrder(deleteTarget.id);
      else if (deleteTarget.kind === "item") await deleteInventoryItem(deleteTarget.id);
      else if (deleteTarget.kind === "purchase") await deleteInventoryPurchase(deleteTarget.id, deleteTarget.path ?? null);
      else await deleteFuelLog(deleteTarget.id);
      await loadAll();
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الحذف");
    } finally {
      setDeleting(false);
    }
  };

  const [statementItem, setStatementItem] = useState<InventoryItem | null>(null);

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

  const rights = workshopRights(useMyRole());

  return (
    <AppShell>
      <PageHeader
        title={rights.fuel ? "الورشة والمخزون والسولار" : rights.inventory ? "الورشة والمخزون" : "الورشة"}
        subtitle={rights.fuel ? "أوامر الصيانة، قطع الغيار، وسجل التزود بالوقود" : rights.inventory ? "أوامر الصيانة وقطع الغيار" : "أوامر الصيانة"}
      />

      {rights.fuel && fuelAlerts.length > 0 && (
        <div className="no-print mb-4 rounded-xl border-2 border-red-500 bg-red-500/10 p-4" role="alert">
          <p className="mb-2 text-sm font-extrabold text-red-500">⚠️ تنبيه تنفيذي: {fuelAlerts.length} عربية باستهلاك سولار أعلى من الطبيعي هذا الشهر</p>
          <div className="grid gap-2">
            {fuelAlerts.map((a) => (
              <div key={a.bus} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-500/40 bg-background/40 p-2 text-sm">
                <span>
                  <b className="text-primary">{a.bus}</b> — {a.per100?.toLocaleString("ar-EG", { maximumFractionDigits: 1 })} لتر/100كم{" "}
                  {a.reason === "target" ? `(المعيار ${a.target?.toLocaleString("ar-EG")}) — تجاوز ${a.wastePct.toFixed(0)}%` : `(متوسط الأسطول ${a.fleetAvg?.toLocaleString("ar-EG", { maximumFractionDigits: 1 })}) — أعلى بنسبة ${a.wastePct.toFixed(0)}%`}
                </span>
                <Button size="sm" className="bg-red-600 text-white hover:bg-red-700" onClick={() => openFuelInspection(a.bus)}>
                  فتح أمر فحص موتور / رشاشات (استهلاك سولار عالي)
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      <Tabs defaultValue="orders">
        <TabsList className="no-print mb-4 border border-border bg-secondary/50">
          <TabsTrigger value="orders">أوامر الصيانة</TabsTrigger>
          {rights.inventory && <TabsTrigger value="inventory">المخزن</TabsTrigger>}
          {rights.fuel && <TabsTrigger value="fuel">سجل السولار</TabsTrigger>}
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
                  ordersInRange.map((o) => ({ الأمر: o.code, العربية: o.bus, التاريخ: o.date, العطل: o.issue, "قطع الغيار": o.parts, المصنعية: o.laborCost, الإجمالي: o.cost, الحالة: o.status })),
                )
              }
              extra={
                <>
                  <Button variant="outline" className="border-border" onClick={() => printReport("orders")}>
                    <Printer className="ml-2 h-4 w-4" /> طباعة التقرير
                  </Button>
                  <Button variant="outline" className="border-border" onClick={() => { setLedgerBus(busCodes[0] ?? ""); setLedgerOpen(true); }}>
                    <FileText className="ml-2 h-4 w-4" /> كشف صيانة السيارة
                  </Button>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAddOrder}>
                    <Plus className="ml-2 h-4 w-4" /> أمر صيانة جديد
                  </Button>
                </>
              }
            />
            <DateRangeFilter value={ordRange} onChange={setOrdRange} className="mb-2" />
            <SummaryStrip items={[["عدد الأوامر (بدون الملغي)", String(orderTotals.count)], ["قطع الغيار", currency(orderTotals.parts)], ["المصنعية", currency(orderTotals.labor)], ["إجمالي تكلفة الفترة", currency(orderTotals.total)]]} />
            {loading ? (
              <p className="py-6 text-center text-muted-foreground">جارِ التحميل...</p>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-4">
                {columns.map((col) => (
                  <div key={col} className="rounded-xl border border-border bg-secondary/20 p-3">
                    <h3 className="mb-3 flex items-center justify-between text-sm font-bold">
                      <span>{col}</span>
                      <StatusPill label={String(ordersInRange.filter((o) => o.status === col).length)} tone={statusTone(col)} />
                    </h3>
                    <div className="space-y-3">
                      {ordersInRange
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

        {rights.inventory && (
        <TabsContent value="inventory">
          <Panel title="مخزن قطع الغيار">
            <Toolbar
              query={query}
              onQuery={setQuery}
              placeholder="ابحث باسم الصنف..."
              onExport={() => exportToExcel("المخزن", inventory.map((i) => ({ الصنف: i.name, الكود: i.code, الوحدة: i.unitType, الرصيد: i.stock, "الحد الأدنى": i.minStock, "سعر الوحدة": i.unitPrice })))}
              extra={
                <>
                  <Button variant="outline" className="border-border" onClick={() => printReport("inventory")}>
                    <Printer className="ml-2 h-4 w-4" /> طباعة تقرير الحركة
                  </Button>
                  <Button variant="outline" className="border-border" onClick={() => setImportingInventory(true)}>
                    استيراد CSV
                  </Button>
                  <Button variant="outline" className="border-border" onClick={openAddItem}>
                    <Plus className="ml-2 h-4 w-4" /> إضافة صنف يدوي
                  </Button>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openReceiveStock}>
                    <Plus className="ml-2 h-4 w-4" /> إضافة صنف / توريد جديد
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
                        <Button size="sm" variant="outline" className="border-border whitespace-nowrap" onClick={() => setStatementItem(i)}>
                          كشف حركة الصنف 📋
                        </Button>
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
          <Panel title="حركة المخزن خلال الفترة (وارد / منصرف)" className="mt-4">
            <DateRangeFilter value={invRange} onChange={setInvRange} className="mb-3" />
            <DataTable head={["الصنف", "الوحدة", "الوارد (كمية)", "قيمة الوارد", "المنصرف (كمية)", "قيمة المنصرف"]}>
              {movements.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-4 text-center text-muted-foreground">لا توجد حركة في هذه الفترة.</td></tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.inventoryId} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3 font-bold">{m.name}</td>
                    <td className="px-4 py-3 text-xs">{m.unitType}</td>
                    <td className="px-4 py-3">{fmtQty(m.inQty)}</td>
                    <td className="px-4 py-3 text-success">{currency(m.inValue)}</td>
                    <td className="px-4 py-3">{fmtQty(m.outQty)}</td>
                    <td className="px-4 py-3 text-warning">{currency(m.outValue)}</td>
                  </tr>
                ))
              )}
              {movements.length > 0 && (
                <tr className="bg-secondary/40 font-bold">
                  <td className="px-4 py-3" colSpan={2}>الإجمالي</td>
                  <td className="px-4 py-3">{fmtQty(moveTotals.inQty)}</td>
                  <td className="px-4 py-3 text-success">{currency(moveTotals.inValue)}</td>
                  <td className="px-4 py-3">{fmtQty(moveTotals.outQty)}</td>
                  <td className="px-4 py-3 text-warning">{currency(moveTotals.outValue)}</td>
                </tr>
              )}
            </DataTable>
          </Panel>
          <Panel title="سجل التوريدات (إذون التوريد)" className="mt-4">
            <DataTable head={["التاريخ", "المورد", "الصنف", "الكمية", "سعر الوحدة", "الإجمالي", "رقم الفاتورة", "المرفق", "الإجراءات"]}>
              {purchasesInRange.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-4 text-center text-muted-foreground">لا توجد توريدات في هذه الفترة.</td></tr>
              ) : (
                purchasesInRange.map((p) => (
                  <tr key={p.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3">{p.date}</td>
                    <td className="px-4 py-3">{p.supplierName}</td>
                    <td className="px-4 py-3 font-bold">{p.itemName}</td>
                    <td className="px-4 py-3">{fmtQty(p.quantity)} {unitShort[p.unitType]}</td>
                    <td className="px-4 py-3">{currency(p.unitPrice)}</td>
                    <td className="px-4 py-3 text-warning">{currency(p.total)}</td>
                    <td className="px-4 py-3">{p.invoiceRef || "—"}</td>
                    <td className="px-4 py-3">
                      {p.attachmentPath ? (
                        <button type="button" className="text-primary hover:underline" onClick={() => openAttachment(p.attachmentPath!)}>عرض</button>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="text-primary hover:bg-primary/10" onClick={() => openEditPurchase(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget({ kind: "purchase", id: p.id, path: p.attachmentPath, label: `توريد ${p.itemName} من ${p.supplierName}` })}>
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
        )}

        {rights.fuel && (
        <TabsContent value="fuel">
          <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {[
              ["لترات اليوم", `${fmtQty(fuelTotals.day.liters)} لتر`],
              ["مصروف سولار اليوم", currency(fuelTotals.day.cost)],
              ["لترات الشهر", `${fmtQty(fuelTotals.month.liters)} لتر`],
              ["مصروف سولار الشهر", currency(fuelTotals.month.cost)],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-border bg-secondary/30 p-3">
                <p className="text-xs text-muted-foreground">{l}</p>
                <p className="mt-1 font-bold text-primary">{v}</p>
              </div>
            ))}
          </div>
          <Panel title="فترة التقرير">
            <DateRangeFilter value={fuelRange} onChange={setFuelRange} />
            <SummaryStrip items={[["عدد مرات التزود", String(fuelPeriod.fills)], ["إجمالي اللترات", `${fmtQty(fuelPeriod.liters)} لتر`], ["إجمالي التكلفة", currency(fuelPeriod.cost)], ["متوسط سعر اللتر", fuelPeriod.liters ? currency(fuelPeriod.cost / fuelPeriod.liters) : "—"]]} />
          </Panel>
          <Panel title="استهلاك السولار لكل سيارة" className="mt-4">
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
              onExport={() => exportToExcel("سجل السولار", fuelInRange.map((f) => ({ التاريخ: f.date, "رقم العربية": f.bus, السائق: f.driver, اللترات: f.liters, التكلفة: f.cost, المحطة: f.station })))}
              extra={
                <>
                  <Button variant="outline" className="border-border" onClick={() => printReport("fuel")}>
                    <Printer className="ml-2 h-4 w-4" /> طباعة التقرير
                  </Button>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={openAddFuel}>
                    <Plus className="ml-2 h-4 w-4" /> إضافة سجل
                  </Button>
                </>
              }
            />
            <DataTable head={["التاريخ", "رقم اللوحة", "اسم السائق", "العداد السابق", "العداد الحالي", "المسافة المقطوعة", "الكمية (لتر)", "المعدل (لتر/كم)", "التكلفة", "المحطة", "الإجراءات"]}>
              {fuelInRange
                .filter((f) => (f.bus + plateOf(f.bus) + f.driver + f.station).includes(query) || query === "")
                .map((f) => (
                  <tr key={f.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3">{f.date}</td>
                    <td className="px-4 py-3 font-bold text-primary">{plateOf(f.bus)}</td>
                    <td className="px-4 py-3">{f.driver}</td>
                    <td className="px-4 py-3">{fuelFills.get(f.id)?.previous?.toLocaleString("ar-EG") ?? "—"}</td>
                    <td className="px-4 py-3">{fuelFills.get(f.id)?.odometer?.toLocaleString("ar-EG") ?? "—"}</td>
                    <td className="px-4 py-3">{fuelFills.get(f.id)?.distance ? `${fuelFills.get(f.id)?.distance?.toLocaleString("ar-EG")} كم` : "—"}</td>
                    <td className="px-4 py-3">{f.liters}</td>
                    <td className="px-4 py-3">{fuelFills.get(f.id)?.ratio != null ? (fuelFills.get(f.id)?.ratio ?? 0).toFixed(3) : "—"}</td>
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
              {fuelInRange.length > 0 && (
                <tr className="bg-secondary/40 font-bold">
                  <td className="px-4 py-3" colSpan={6}>الإجمالي ({fuelPeriod.fills} تزود)</td>
                  <td className="px-4 py-3">{fmtQty(fuelPeriod.liters)}</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-warning">{currency(fuelPeriod.cost)}</td>
                  <td className="px-4 py-3" colSpan={2}></td>
                </tr>
              )}
            </DataTable>
          </Panel>
        </TabsContent>
        )}
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
                <BusPicker value={form.bus} buses={busList} onChange={(v) => setForm({ ...form, bus: v })} />
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

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">عداد كيلومتر الأتوبيس عند الصيانة</Label>
              <Input value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} type="number" min="0" className="border-border bg-input/60" />
              {(() => {
                const cur = busList.find((b) => b.code === form.bus)?.odometer;
                return cur ? <p className="text-xs text-muted-foreground">العداد الحالي المسجل للعربية: {cur.toLocaleString("ar-EG")} كم — يتحدّث تلقائياً لو القراءة أعلى.</p> : null;
              })()}
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
            <PaymentSourceSelect value={form.paySource} onChange={(v) => setForm({ ...form, paySource: v })} label="طريقة الدفع / مصدر التمويل (للمصنعية)" />
            <div className="rounded-lg border border-border bg-secondary/20 p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
                <input type="checkbox" checked={form.driverFault} onChange={(e) => setForm({ ...form, driverFault: e.target.checked, ...(e.target.checked ? {} : { faultDriverId: "", faultAmount: "" }) })} />
                خطأ / إهمال سائق (خصم من المرتب)
              </label>
              {form.driverFault && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">السائق المسؤول</Label>
                    <PersonPicker value={form.faultDriverId} options={driverOpts} onChange={(v) => setForm({ ...form, faultDriverId: v })} placeholder="ابحث عن السائق" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">مبلغ الخصم (اتركه فارغًا = تكلفة الأمر كاملة {currency(totals.total)})</Label>
                    <Input value={form.faultAmount} onChange={(e) => setForm({ ...form, faultAmount: e.target.value })} type="number" min="0" className="border-border bg-input/60" />
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-2">يُسجَّل الخصم كجزاء في مرتب السائق عند اكتمال الأمر (الحالة «مكتمل»).</p>
                </div>
              )}
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
              <BusPicker value={ledgerBus} buses={busList} onChange={setLedgerBus} />
            </div>
            <DateRangeFilter value={{ from: ledgerFrom, to: ledgerTo }} onChange={(r) => { setLedgerFrom(r.from); setLedgerTo(r.to); }} className="sm:col-span-2" />
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
            {rights.print && (
              <Button className="bg-primary text-primary-foreground" onClick={printLedger} disabled={!ledgerBus || ledger.rows.length === 0}>
                <Printer className="ml-2 h-4 w-4" /> طباعة كشف صيانة العربية / PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ItemStatementSheet item={statementItem} onClose={() => setStatementItem(null)} />

      {printKind === "orders" && (
        <ReportPrint
          title="تقرير الورشة وأوامر الصيانة"
          range={ordRange}
          columns={["م", "التاريخ", "رقم الأمر", "العربية", "العطل / الخدمة", "قطع الغيار", "المصنعية", "الإجمالي", "الحالة"]}
          rows={ordersInRange.map((o, i) => { const parts = o.items.reduce((x, it) => x + it.quantity * it.unitPrice, 0); return [i + 1, o.date, o.code, o.bus, o.issue, currency(parts), currency(o.laborCost), currency(o.cost), o.status]; })}
          footer={["", "", "", "", `الإجمالي (${orderTotals.count} أمر بدون الملغي)`, currency(orderTotals.parts), currency(orderTotals.labor), currency(orderTotals.total), ""]}
        />
      )}
      {printKind === "inventory" && (
        <ReportPrint
          title="تقرير حركة المخزن (وارد / منصرف)"
          range={invRange}
          columns={["م", "الصنف", "الوحدة", "الوارد (كمية)", "قيمة الوارد", "المنصرف (كمية)", "قيمة المنصرف"]}
          rows={movements.map((m, i) => [i + 1, m.name, m.unitType, fmtQty(m.inQty), currency(m.inValue), fmtQty(m.outQty), currency(m.outValue)])}
          footer={["", "الإجمالي", "", fmtQty(moveTotals.inQty), currency(moveTotals.inValue), fmtQty(moveTotals.outQty), currency(moveTotals.outValue)]}
        />
      )}
      {printKind === "fuel" && (
        <ReportPrint
          title="تقرير السولار والوقود"
          range={fuelRange}
          columns={["م", "التاريخ", "رقم اللوحة", "السائق", "المحطة", "اللترات", "التكلفة"]}
          rows={fuelInRange.map((f, i) => [i + 1, f.date, plateOf(f.bus), f.driver, f.station, fmtQty(f.liters), currency(f.cost)])}
          footer={["", "", "", "", `الإجمالي (${fuelPeriod.fills} تزود)`, fmtQty(fuelPeriod.liters), currency(fuelPeriod.cost)]}
        />
      )}

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
        <DialogContent className="glass max-h-[90vh] overflow-y-auto text-foreground sm:max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-primary">{receiveForm.id ? "تعديل إذن التوريد" : "إذن توريد المخزن"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              عند الحفظ يزيد رصيد الصنف تلقائيًا، ويُضاف إجمالي الفاتورة إلى مستحقات المورد. التعديل أو الحذف يعكس الأثر السابق أولًا.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">اختيار المورد</Label>
                <Select value={receiveForm.supplierId} onValueChange={(v) => setReceiveForm({ ...receiveForm, supplierId: v })}>
                  <SelectTrigger className="border-border bg-input/60"><SelectValue placeholder="اختر المورد" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    <SelectItem value="__new">+ مورد جديد</SelectItem>
                  </SelectContent>
                </Select>
                {receiveForm.supplierId === "__new" && (
                  <Input placeholder="اسم المورد الجديد" value={receiveForm.newSupplierName} onChange={(e) => setReceiveForm({ ...receiveForm, newSupplierName: e.target.value })} className="border-border bg-input/60" />
                )}
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">اسم الصنف</Label>
                <Select
                  value={receiveForm.itemId}
                  onValueChange={(v) => {
                    const it = inventory.find((x) => x.id === v);
                    setReceiveForm({ ...receiveForm, itemId: v, unitType: it?.unitType ?? receiveForm.unitType, unitPrice: it && !receiveForm.unitPrice ? String(it.unitPrice) : receiveForm.unitPrice });
                  }}
                >
                  <SelectTrigger className="border-border bg-input/60"><SelectValue placeholder="اختر الصنف" /></SelectTrigger>
                  <SelectContent>
                    {inventory.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                    <SelectItem value="__new">+ صنف جديد</SelectItem>
                  </SelectContent>
                </Select>
                {receiveForm.itemId === "__new" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="اسم الصنف الجديد" value={receiveForm.newItemName} onChange={(e) => setReceiveForm({ ...receiveForm, newItemName: e.target.value })} className="border-border bg-input/60" />
                    <Input placeholder="الكود (اختياري)" value={receiveForm.newItemCode} onChange={(e) => setReceiveForm({ ...receiveForm, newItemCode: e.target.value })} className="border-border bg-input/60" />
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">تاريخ التوريد / الفاتورة</Label>
                <Input value={receiveForm.date} onChange={(e) => setReceiveForm({ ...receiveForm, date: e.target.value })} type="date" className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">الوحدة</Label>
                <Select value={receiveForm.unitType} onValueChange={(v) => setReceiveForm({ ...receiveForm, unitType: v as UnitType })} disabled={!!receiveForm.itemId && receiveForm.itemId !== "__new"}>
                  <SelectTrigger className="border-border bg-input/60"><SelectValue /></SelectTrigger>
                  <SelectContent>{UNIT_TYPES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">رقم الفاتورة (اختياري)</Label>
                <Input value={receiveForm.invoiceRef} onChange={(e) => setReceiveForm({ ...receiveForm, invoiceRef: e.target.value })} className="border-border bg-input/60" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">الكمية المشتراة</Label>
                <Input value={receiveForm.quantity} onChange={(e) => setReceiveForm({ ...receiveForm, quantity: e.target.value })} type="number" min="0" step="any" className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">سعر تكلفة الوحدة</Label>
                <Input value={receiveForm.unitPrice} onChange={(e) => setReceiveForm({ ...receiveForm, unitPrice: e.target.value })} type="number" min="0" step="any" className="border-border bg-input/60" />
              </div>
            </div>
            {rights.payments && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">المدفوع فورًا للمورد (اختياري — والباقي يبقى مستحقًا عليه)</Label>
                <Input value={receiveForm.paidAmount} onChange={(e) => setReceiveForm({ ...receiveForm, paidAmount: e.target.value })} type="number" min="0" step="any" className="border-border bg-input/60" />
              </div>
              {(Number(receiveForm.paidAmount) || 0) > 0 && <PaymentSourceSelect value={receiveForm.paySource} onChange={(v) => setReceiveForm({ ...receiveForm, paySource: v })} />}
            </div>
            )}
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">صورة الفاتورة (اختياري){receiveForm.previousPath ? " — يوجد مرفق حالي، اختر ملفًا لاستبداله" : ""}</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={(e) => setReceiveForm({ ...receiveForm, file: e.target.files?.[0] ?? null })} className="border-border bg-input/60" />
            </div>
            {receiveForm.quantity && receiveForm.unitPrice && (
              <p className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
                إجمالي الفاتورة: <b className="text-primary">{currency(purchaseTotal(Number(receiveForm.quantity), Number(receiveForm.unitPrice)))}</b>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button className="bg-primary text-primary-foreground" onClick={submitReceiveStock} disabled={saving}>
              {saving ? "جارِ الحفظ..." : receiveForm.id ? "حفظ التعديلات" : "تسجيل التوريد"}
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
                <Label className="text-xs text-muted-foreground">رقم اللوحة</Label>
                <BusPicker value={fuelForm.busCode} buses={busList} onChange={(v) => setFuelForm({ ...fuelForm, busCode: v })} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">اسم السائق</Label>
                <Select value={fuelForm.driverName} onValueChange={(v) => setFuelForm({ ...fuelForm, driverName: v })}>
                  <SelectTrigger className="border-border bg-input/60"><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>{driverNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">تاريخ التموين</Label>
              <Input value={fuelForm.date} onChange={(e) => setFuelForm({ ...fuelForm, date: e.target.value })} type="date" className="border-border bg-input/60" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">العداد الحالي</Label>
              <Input value={fuelForm.currentOdometer} onChange={(e) => setFuelForm({ ...fuelForm, currentOdometer: e.target.value })} type="number" className="border-border bg-input/60" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">عدد اللترات</Label>
                <Input value={fuelForm.liters} onChange={(e) => setFuelCalc({ liters: e.target.value })} type="number" min="0" className="border-border bg-input/60" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">سعر اللتر</Label>
                <Input value={fuelForm.pricePerLiter} onChange={(e) => setFuelCalc({ pricePerLiter: e.target.value })} type="number" min="0" step="0.01" className="border-border bg-input/60" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">إجمالي التكلفة {Number(fuelForm.pricePerLiter) > 0 ? "(محسوبة تلقائياً = لترات × سعر اللتر)" : ""}</Label>
              <Input value={fuelForm.cost} onChange={(e) => setFuelForm({ ...fuelForm, cost: e.target.value })} readOnly={Number(fuelForm.pricePerLiter) > 0} type="number" min="0" className="border-border bg-input/60" />
            </div>
            <p className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
              إجمالي اللترات: <b className="text-primary">{fmtQty(Number(fuelForm.liters) || 0)}</b> &nbsp;|&nbsp; إجمالي التكلفة: <b className="text-warning">{currency(Number(fuelForm.cost) || 0)}</b>
            </p>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">محطة الوقود (من الموردين)</Label>
              <Select value={fuelForm.supplierId || "none"} onValueChange={(v) => setFuelForm({ ...fuelForm, supplierId: v === "none" ? "" : v })}>
                <SelectTrigger className="border-border bg-input/60"><SelectValue placeholder="اختر المحطة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون مورد (نقدي / غير مسجل)</SelectItem>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  <SelectItem value={NEW_STATION}>+ إضافة محطة / مورد جديد</SelectItem>
                </SelectContent>
              </Select>
              {fuelForm.supplierId === NEW_STATION && <Input value={newStation} onChange={(e) => setNewStation(e.target.value)} placeholder="اسم المحطة الجديدة" className="border-border bg-input/60" />}
              {fuelForm.supplierId && fuelForm.supplierId !== NEW_STATION && <p className="text-xs text-muted-foreground">قيمة التموين هتتسجل مستحقات في كشف حساب المورد تلقائياً.</p>}
            </div>
          </div>
          {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">{error}</p>}
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
              سيتم حذف {deleteTarget?.label} نهائيًا{deleteTarget?.kind === "order" ? " وإرجاع قطع الغيار المخصومة إلى المخزن" : deleteTarget?.kind === "purchase" ? " وخصم الكمية من المخزن والقيمة من حساب المورد" : ""}. لا يمكن التراجع عن هذا الإجراء.
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
