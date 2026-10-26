import { supabase } from "@/lib/supabase";
import { normalizeText, subscriptionTotal, type ReviewedStudent } from "@/lib/student-import";
import type {
  Bus,
  Driver,
  Attendance,
  BusRoute,
  Student,
  MaintenanceOrder,
  InventoryItem,
  FuelLog,
  MaintenanceItem,
  UnitType,
  TreasuryEntry,
  Expense,
  Loan,
  Payslip,
} from "@/lib/fleet-data";

// ---- Fleet ----

/** "[رقم اللوحة] - [النوع / الموديل]" — the plate leads; falls back to the bus code when no plate is set. */
export function busOptionLabel(b: { plate: string; code: string; busType: string; model: string }) {
  const plate = b.plate && b.plate !== "—" ? b.plate : b.code;
  const kind = [b.busType, b.model].filter((x) => x && x !== "—").join(" / ");
  return kind ? `${plate} - ${kind}` : plate;
}

export async function fetchBuses(): Promise<Bus[]> {
  const { data, error } = await supabase
    .from("buses")
    .select("*, routes(driver_id, drivers(name))")
    .order("bus_code");
  if (error) throw error;
  return (data ?? []).map((b: any) => ({
    id: b.id,
    code: b.bus_code,
    plate: b.plate_number ?? "—",
    model: b.model ?? "—",
    busType: b.bus_type ?? "أتوبيس 50",
    capacity: b.capacity ?? 0,
    odometer: b.odometer ?? 0,
    licenseExpiry: b.license_expiry ?? "—",
    insuranceExpiry: b.insurance_expiry ?? "—",
    lastMaintenance: "—",
    driver: b.routes?.[0]?.drivers?.name ?? "—",
    status: b.status ?? "تعمل",
    fuelTarget: b.fuel_target_ratio == null ? null : Number(b.fuel_target_ratio),
    fuelBasis: b.fuel_target_basis === "km100" ? "km100" : b.fuel_target_basis === "km" ? "km" : "shift",
  }));
}

export async function addBus(input: { code: string; plate: string; model: string; busType?: string; capacity: number; odometer: number; status?: string; licenseExpiry?: string; insuranceExpiry?: string }) {
  const { error } = await supabase.from("buses").insert({
    bus_code: input.code,
    plate_number: input.plate,
    model: input.model,
    bus_type: input.busType ?? "أتوبيس 50",
    capacity: input.capacity,
    odometer: input.odometer,
    status: input.status ?? "تعمل",
    license_expiry: input.licenseExpiry || null,
    insurance_expiry: input.insuranceExpiry || null,
  });
  if (error) throw error;
}

export async function fetchDrivers(): Promise<Driver[]> {
  const { data, error } = await supabase.from("drivers").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    id: d.id,
    name: d.name,
    phone: d.phone ?? "—",
    license: d.license_type ?? "—",
    licenseExpiry: d.license_expiry ?? "—",
    baseSalary: Number(d.base_salary) || 0,
    primaryBus: "—",
    backupBus: "—",
    shift: "راحة",
  }));
}

export async function fetchAttendance(): Promise<Attendance[]> {
  const { data, error } = await supabase
    .from("attendance")
    .select("*, drivers(name)")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((a: any) => ({
    id: a.id,
    driver: a.drivers?.name ?? "—",
    date: a.date,
    checkIn: a.check_in ?? "—",
    checkOut: a.check_out ?? "—",
    status: a.status ?? "غائب",
  }));
}

export async function checkInDriver(driverId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toTimeString().slice(0, 5);
  const { data: existing } = await supabase
    .from("attendance")
    .select("id")
    .eq("driver_id", driverId)
    .eq("date", today)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase.from("attendance").update({ check_in: now, status: "حاضر" }).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("attendance").insert({ driver_id: driverId, date: today, check_in: now, status: "حاضر" });
    if (error) throw error;
  }
}

export async function checkOutDriver(driverId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toTimeString().slice(0, 5);
  const { data: existing } = await supabase
    .from("attendance")
    .select("id")
    .eq("driver_id", driverId)
    .eq("date", today)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase.from("attendance").update({ check_out: now }).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("attendance").insert({ driver_id: driverId, date: today, check_out: now, status: "حاضر" });
    if (error) throw error;
  }
}

export async function upsertAttendanceRecord(input: {
  id?: string | undefined;
  driverName: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: string;
}) {
  const { data: driver } = await supabase.from("drivers").select("id").eq("name", input.driverName).maybeSingle();
  if (!driver) throw new Error("لم يتم العثور على سائق بهذا الاسم");
  const payload = {
    driver_id: driver.id,
    date: input.date,
    check_in: input.checkIn || null,
    check_out: input.checkOut || null,
    status: input.status || "حاضر",
  };
  if (input.id) {
    const { error } = await supabase.from("attendance").update(payload).eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("attendance").insert(payload);
    if (error) throw error;
  }
}

export async function addDriver(input: { name: string; phone: string; license: string; licenseExpiry: string; baseSalary: number }) {
  const { error } = await supabase.from("drivers").insert({
    driver_code: `DRV-${Date.now().toString().slice(-6)}`,
    name: input.name,
    phone: input.phone,
    license_type: input.license,
    license_expiry: input.licenseExpiry || null,
    base_salary: input.baseSalary || 0,
  });
  if (error) throw error;
}

// ---- Operations ----

export async function fetchRoutes(): Promise<BusRoute[]> {
  const { data, error } = await supabase.from("routes").select("*, buses(bus_code)").order("route_name");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.route_name,
    pickupPoints: r.pickup_points ?? "—",
    departure: r.departure_time ?? "—",
    arrival: r.return_time ?? "—",
    bus: r.buses?.bus_code ?? "—",
    seats: r.seats ?? 0,
    booked: r.booked ?? 0,
  }));
}

export async function addRoute(input: {
  name: string;
  pickupPoints: string;
  departure: string;
  arrival: string;
  busCode: string;
  seats: number;
}) {
  const { data: bus } = await supabase.from("buses").select("id").eq("bus_code", input.busCode).maybeSingle();
  const { error } = await supabase.from("routes").insert({
    route_code: `RT-${Date.now().toString().slice(-6)}`,
    route_name: input.name,
    pickup_points: input.pickupPoints,
    departure_time: input.departure || null,
    return_time: input.arrival || null,
    bus_id: bus?.id ?? null,
    seats: input.seats,
    booked: 0,
  });
  if (error) {
    if (error.code === "23505") throw new Error(`الأتوبيس ${input.busCode} مخصص بالفعل لخط آخر`);
    throw error;
  }
}

export async function fetchStudents(): Promise<Student[]> {
  // PostgREST caps a response at 1,000 rows — page through so totals cover every student.
  const data: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: page, error } = await supabase
      .from("students")
      .select("*, routes(route_name)")
      .order("name")
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    data.push(...(page ?? []));
    if (!page || page.length < 1000) break;
  }
  return data.map((s: any) => ({
    id: s.id,
    name: s.name,
    route: s.routes?.route_name ?? "—",
    guardianPhone: s.parent_phone ?? "—",
    monthly: Number(s.total_amount ?? 0),
    paid: Number(s.paid_amount ?? 0),
    status: s.payment_status ?? "قيد السداد",
  }));
}

export async function addStudent(input: {
  name: string;
  guardianPhone: string;
  routeName: string;
  monthly: number;
}) {
  const { data: route } = await supabase.from("routes").select("id").eq("route_name", input.routeName).maybeSingle();
  const { error } = await supabase.from("students").insert({
    sub_code: `STU-${Date.now().toString().slice(-6)}`,
    name: input.name,
    parent_phone: input.guardianPhone,
    route_id: route?.id ?? null,
    total_amount: input.monthly,
    paid_amount: 0,
    payment_status: "متأخر",
  });
  if (error) throw error;
}

// ---- Subscription finance dashboard & expenses ----

export interface SubscriptionExpense {
  id: string;
  date: string;
  description: string;
  routeName: string;
  amount: number;
  payFrom: string;
  notes: string;
}

export interface SubscriptionExpenseInput {
  date: string;
  description: string;
  routeName: string;
  amount: number;
  payFrom: string;
  notes: string;
}

export interface SubscriptionFinance {
  collected: number;
  remaining: number;
  expenses: number;
  net: number;
}

/** collected = Σ paid, remaining = Σ max(0, total − paid), net = collected − expenses. */
export function computeSubscriptionFinance(
  students: { monthly: number; paid: number }[],
  expenses: { amount: number }[],
): SubscriptionFinance {
  const collected = students.reduce((s, x) => s + x.paid, 0);
  const remaining = students.reduce((s, x) => s + Math.max(0, x.monthly - x.paid), 0);
  const exp = expenses.reduce((s, x) => s + x.amount, 0);
  return { collected, remaining, expenses: exp, net: collected - exp };
}

export async function fetchSubscriptionExpenses(): Promise<SubscriptionExpense[]> {
  const { data, error } = await supabase.from("subscription_expenses").select("*").order("date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((e: any) => ({
    id: e.id,
    date: e.date,
    description: e.description,
    routeName: e.route_name ?? "",
    amount: Number(e.amount ?? 0),
    payFrom: e.pay_from ?? "",
    notes: e.notes ?? "",
  }));
}

const subscriptionExpenseRow = async (input: SubscriptionExpenseInput) => {
  if (!input.description.trim()) throw new Error("أدخل بيان المصروف");
  if (!(input.amount > 0)) throw new Error("أدخل مبلغًا صحيحًا");
  let routeId: string | null = null;
  if (input.routeName) {
    const { data } = await supabase.from("routes").select("id").eq("route_name", input.routeName).maybeSingle();
    routeId = data?.id ?? null;
  }
  return {
    date: input.date || undefined,
    description: input.description.trim(),
    route_id: routeId,
    route_name: input.routeName || null,
    amount: input.amount,
    pay_from: input.payFrom || "الخزينة الرئيسية",
    notes: input.notes.trim() || null,
  };
};

/** The database trigger also posts the matching withdrawal to the treasury. */
export async function addSubscriptionExpense(input: SubscriptionExpenseInput) {
  const { data, error } = await supabase.from("subscription_expenses").insert(await subscriptionExpenseRow(input)).select("id").single();
  if (error) throw new Error(dbErrorMessage(error, "تعذر حفظ المصروف"));
  await syncCustodyLink({ table: "subscription_expenses", id: data.id as string }, { date: input.date || new Date().toISOString().slice(0, 10), amount: input.amount, category: "مصروفات اشتراكات", description: input.description, payFrom: input.payFrom, notes: input.notes });
}

export async function updateSubscriptionExpense(id: string, input: SubscriptionExpenseInput) {
  const { error } = await supabase.from("subscription_expenses").update(await subscriptionExpenseRow(input)).eq("id", id);
  if (error) throw new Error(dbErrorMessage(error, "تعذر تعديل المصروف"));
  await syncCustodyLink({ table: "subscription_expenses", id }, { date: input.date || new Date().toISOString().slice(0, 10), amount: input.amount, category: "مصروفات اشتراكات", description: input.description, payFrom: input.payFrom, notes: input.notes });
}

export async function deleteSubscriptionExpense(id: string) {
  await syncCustodyLink({ table: "subscription_expenses", id }, null);
  const { error } = await supabase.from("subscription_expenses").delete().eq("id", id);
  if (error) throw new Error(dbErrorMessage(error, "تعذر حذف المصروف"));
}

export async function fetchPaymentHistory(studentId: string) {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("student_id", studentId)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p: any) => ({ date: p.date, amount: Number(p.amount), method: p.method ?? "—" }));
}

export async function addPayment(studentId: string, amount: number, method: string) {
  const { error } = await supabase.from("payments").insert({ student_id: studentId, amount, method });
  if (error) throw error;
}

// ---- Workshop ----

export async function fetchMaintenanceOrders(): Promise<MaintenanceOrder[]> {
  const { data, error } = await supabase
    .from("maintenance_orders")
    .select("*, buses(bus_code), maintenance_order_items(id, inventory_id, quantity, unit_price, inventory(name, unit_type))")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((o: any) => ({
    id: o.id,
    code: o.order_number,
    bus: o.buses?.bus_code ?? "—",
    date: o.order_date ?? (o.created_at as string).slice(0, 10),
    issue: o.issue_description ?? "—",
    parts: o.parts ?? "—",
    cost: Number(o.total_cost ?? 0),
    laborCost: Number(o.labor_cost ?? 0),
    paySource: o.pay_source ?? "",
    driverFault: !!o.driver_fault,
    faultDriverId: o.fault_driver_id ?? "",
    faultAmount: o.fault_amount == null ? null : Number(o.fault_amount),
    maintenanceMileage: o.maintenance_mileage == null ? null : Number(o.maintenance_mileage),
    status: o.status ?? "بانتظار القطع",
    items: (o.maintenance_order_items ?? []).map(
      (i: any): MaintenanceItem => ({
        id: i.id,
        inventoryId: i.inventory_id,
        name: i.inventory?.name ?? "صنف",
        unitType: i.inventory?.unit_type ?? "بالقطعة",
        quantity: Number(i.quantity ?? 0),
        unitPrice: Number(i.unit_price ?? 0),
      }),
    ),
  }));
}

export interface MaintenanceOrderInput {
  busCode: string;
  issue: string;
  status: string;
  laborCost: number;
  orderDate: string;
  paySource?: string;
  driverFault?: boolean;
  faultDriverId?: string;
  faultAmount?: number | null;
  maintenanceMileage?: number | null;
  items: { inventoryId: string; quantity: number; unitPrice: number }[];
}

/** Parts total + overall total (labour + parts) of an order. */
export function computeOrderTotals(items: { quantity: number; unitPrice: number }[], laborCost: number) {
  const partsTotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  return { partsTotal, total: partsTotal + laborCost };
}

/**
 * Checks every requested quantity against the stock that will be available when the order is saved.
 * When editing, what this order already holds is returned to stock first, so it counts as available.
 * Returns an Arabic message for the first shortage, or null.
 */
export function findStockShortage(
  requested: { inventoryId: string; name: string; quantity: number }[],
  stockById: Map<string, number>,
  alreadyAllocated: Map<string, number>,
): string | null {
  const wanted = new Map<string, { name: string; quantity: number }>();
  for (const r of requested) {
    const cur = wanted.get(r.inventoryId) ?? { name: r.name, quantity: 0 };
    cur.quantity += r.quantity;
    wanted.set(r.inventoryId, cur);
  }
  for (const [id, w] of wanted) {
    const available = (stockById.get(id) ?? 0) + (alreadyAllocated.get(id) ?? 0);
    if (w.quantity > available) return `المخزون غير كافٍ للصنف ${w.name}: المطلوب ${w.quantity} والمتاح ${available}`;
  }
  return null;
}

export async function saveMaintenanceOrder(id: string | null, input: MaintenanceOrderInput) {
  if (input.driverFault && !input.faultDriverId) throw new Error("اختر السائق المسؤول عن الخطأ / الإهمال");
  const items = input.items.filter((i) => i.inventoryId && i.quantity > 0);

  // 1) validate stock up-front so a shortage never leaves a half-saved order
  const ids = [...new Set(items.map((i) => i.inventoryId))];
  const { data: stockRows, error: stockErr } = ids.length
    ? await supabase.from("inventory").select("id, name, stock").in("id", ids)
    : { data: [], error: null };
  if (stockErr) throw stockErr;
  const stockById = new Map((stockRows ?? []).map((r: any) => [r.id as string, Number(r.stock)]));
  const names = new Map((stockRows ?? []).map((r: any) => [r.id as string, r.name as string]));

  let previous: { inventory_id: string; quantity: number; unit_price: number }[] = [];
  let previousStatus = "";
  if (id) {
    const [{ data: prev }, { data: ord }] = await Promise.all([
      supabase.from("maintenance_order_items").select("inventory_id, quantity, unit_price").eq("order_id", id),
      supabase.from("maintenance_orders").select("status").eq("id", id).maybeSingle(),
    ]);
    previous = (prev ?? []).map((p: any) => ({ inventory_id: p.inventory_id, quantity: Number(p.quantity), unit_price: Number(p.unit_price) }));
    previousStatus = ord?.status ?? "";
  }
  // parts held by an active order are returned to stock before the new ones are deducted
  const allocated = new Map<string, number>();
  if (id && previousStatus !== "ملغي") for (const p of previous) allocated.set(p.inventory_id, (allocated.get(p.inventory_id) ?? 0) + p.quantity);
  if (input.status !== "ملغي") {
    const shortage = findStockShortage(
      items.map((i) => ({ inventoryId: i.inventoryId, name: names.get(i.inventoryId) ?? "الصنف", quantity: i.quantity })),
      stockById,
      allocated,
    );
    if (shortage) throw new Error(shortage);
  }

  // 2) the order row
  const { data: bus } = await supabase.from("buses").select("id").eq("bus_code", input.busCode).maybeSingle();
  const fields = {
    bus_id: bus?.id ?? null,
    issue_description: input.issue,
    status: input.status,
    labor_cost: input.laborCost,
    order_date: input.orderDate,
    pay_source: input.paySource || null,
    driver_fault: !!input.driverFault,
    fault_driver_id: input.driverFault ? input.faultDriverId || null : null,
    fault_amount: input.driverFault && input.faultAmount != null && input.faultAmount > 0 ? input.faultAmount : null,
    maintenance_mileage: input.maintenanceMileage != null && input.maintenanceMileage > 0 ? Math.round(input.maintenanceMileage) : null,
  };
  if (fields.maintenance_mileage) await syncBusOdometer(fields.bus_id, fields.maintenance_mileage);
  let orderId = id;
  if (orderId) {
    const { error } = await supabase.from("maintenance_orders").update(fields).eq("id", orderId);
    if (error) throw error;
    // 3a) give the old parts back (database trigger returns them to stock)
    const { error: delErr } = await supabase.from("maintenance_order_items").delete().eq("order_id", orderId);
    if (delErr) throw delErr;
  } else {
    const { data: created, error } = await supabase
      .from("maintenance_orders")
      .insert({ ...fields, order_number: `MO-${Date.now().toString().slice(-6)}`, total_cost: 0 })
      .select("id")
      .single();
    if (error) throw error;
    orderId = created.id as string;
  }

  // 3b) deduct the new parts (database trigger deducts from stock)
  if (items.length) {
    const { error: insErr } = await supabase
      .from("maintenance_order_items")
      .insert(items.map((i) => ({ order_id: orderId, inventory_id: i.inventoryId, quantity: i.quantity, unit_price: i.unitPrice })));
    if (insErr) {
      if (id) {
        // put the previous parts back so the order is not left without them
        await supabase.from("maintenance_order_items").insert(previous.map((p) => ({ order_id: id, ...p })));
      } else {
        await supabase.from("maintenance_orders").delete().eq("id", orderId);
      }
      throw insErr;
    }
  }

  // 4) totals
  const { total } = computeOrderTotals(items, input.laborCost);
  const summary = items.map((i) => `${names.get(i.inventoryId) ?? "صنف"} × ${i.quantity}`).join("، ");
  const { error: totErr } = await supabase.from("maintenance_orders").update({ total_cost: total, parts: summary || null }).eq("id", orderId);
  if (totErr) throw totErr;
  // الأجور (العمالة) هي ما يُدفع نقدًا؛ قطع الغيار تُسحب من المخزن
  await syncMaintenancePayout(orderId as string, { status: input.status, date: input.orderDate, laborCost: input.laborCost, paySource: input.paySource ?? "", busCode: input.busCode, issue: input.issue });
}

/**
 * عند اكتمال أمر الصيانة تُخصم أجور الصيانة لحظيًا من مصدر الدفع: دفتر العهدة، أو حساب الخزينة المختار؛
 * وتُسحب الحركة تلقائيًا إن عاد الأمر لحالة غير مكتملة أو أُلغي. (قطع الغيار تُسحب من المخزن ولا تُدفع نقدًا هنا.)
 */
async function syncMaintenancePayout(orderId: string, o: { status: string; date: string; laborCost: number; paySource: string; busCode: string; issue: string }) {
  const active = o.status === "مكتمل" && o.laborCost > 0;
  const desc = `أجور صيانة — ${o.busCode}${o.issue ? ` — ${o.issue}` : ""}`;
  await syncCustodyLink(
    { table: "maintenance_orders", id: orderId },
    active ? { date: o.date, amount: o.laborCost, category: CUSTODY_MAINT_CATEGORY, description: desc, payFrom: o.paySource, busCode: o.busCode, maintenanceOrderId: orderId } : null,
  );
  const { data: dep } = await supabase.from("treasury").select("id").eq("maintenance_order_id", orderId).maybeSingle();
  if (active && o.paySource && o.paySource !== CUSTODY_SOURCE) {
    const row = { date: o.date, account: o.paySource, opening: 0, deposits: 0, withdrawals: o.laborCost, notes: desc, maintenance_order_id: orderId };
    const { error } = dep ? await supabase.from("treasury").update(row).eq("id", dep.id) : await supabase.from("treasury").insert(row);
    if (error) throw new Error(dbErrorMessage(error, "تعذر خصم أجور الصيانة من الخزينة"));
  } else if (dep) {
    const { error } = await supabase.from("treasury").delete().eq("id", dep.id);
    if (error) throw new Error(dbErrorMessage(error, "تعذر تحديث الخزينة"));
  }
}

export async function updateMaintenanceStatus(id: string, status: string) {
  const { data: o, error: gErr } = await supabase.from("maintenance_orders").select("order_date, created_at, labor_cost, pay_source, issue_description, buses(bus_code)").eq("id", id).maybeSingle();
  if (gErr) throw gErr;
  const labor = Number(o?.labor_cost ?? 0);
  if (status === "مكتمل" && labor > 0 && !o?.pay_source) throw new Error("حدّد طريقة الدفع / مصدر التمويل لأجور الصيانة من تعديل الأمر قبل إكماله");
  const { error } = await supabase.from("maintenance_orders").update({ status }).eq("id", id);
  if (error) throw error;
  if (o) await syncMaintenancePayout(id, { status, date: o.order_date ?? String(o.created_at).slice(0, 10), laborCost: labor, paySource: o.pay_source ?? "", busCode: (o as any).buses?.bus_code ?? "", issue: o.issue_description ?? "" });
}

export async function fetchInventory(): Promise<InventoryItem[]> {
  const { data, error } = await supabase.from("inventory").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map((i: any) => ({
    id: i.id,
    name: i.name,
    code: i.code,
    stock: Number(i.stock ?? 0),
    minStock: Number(i.min_stock ?? 0),
    unitPrice: Number(i.unit_price ?? 0),
    unitType: (i.unit_type ?? "بالقطعة") as UnitType,
  }));
}

export async function addInventoryItem(input: { name: string; code: string; stock: number; minStock: number; unitPrice: number; unitType: UnitType }) {
  const { error } = await supabase.from("inventory").insert({
    name: input.name,
    code: input.code || `SKU-${Date.now().toString().slice(-6)}`,
    stock: input.stock,
    min_stock: input.minStock,
    unit_price: input.unitPrice,
    unit_type: input.unitType,
  });
  if (error) throw error;
}

export async function fetchFuelLogs(): Promise<FuelLog[]> {
  const { data, error } = await supabase
    .from("fuel_logs")
    .select("*, buses(bus_code), drivers(name)")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((f: any) => ({
    id: f.id,
    date: f.date,
    bus: f.buses?.bus_code ?? "—",
    driver: f.drivers?.name ?? "—",
    odoStart: f.odo_start ?? 0,
    odoEnd: f.odo_end ?? 0,
    currentOdometer: f.current_odometer ?? null,
    createdAt: f.created_at ?? "",
    liters: Number(f.liters ?? 0),
    cost: Number(f.cost ?? 0),
    station: f.station ?? "—",
    pricePerLiter: f.price_per_liter == null ? null : Number(f.price_per_liter),
    supplierId: f.supplier_id ?? "",
  }));
}

export interface FuelLogInput {
  busCode: string;
  driverName: string;
  date: string;
  currentOdometer: number;
  liters: number;
  cost: number;
  station: string;
  pricePerLiter?: number | null;
  supplierId?: string;
}

/** Readable Arabic message that keeps the exact database text (PostgREST errors are not `Error` instances). */
export function dbErrorMessage(e: unknown, fallback: string) {
  const o = e as { code?: string; message?: string; details?: string; hint?: string } | null;
  if (!o) return fallback;
  if (o.code === "23505") return `${fallback}: القيمة مكررة (${o.details ?? o.message ?? ""})`;
  if (o.code === "23503") return `${fallback}: السجل مرتبط ببيانات أخرى (حركات مخزن أو دفعات) ولا يمكن حذفه`;
  if (o.code === "42501" || /row-level security/i.test(o.message ?? "")) return `${fallback}: ليس لديك صلاحية تنفيذ هذا الإجراء`;
  const parts = [o.message, o.details, o.hint].filter(Boolean).join(" — ");
  return parts ? `${fallback}: ${parts}` : fallback;
}

async function resolveFuelPayload(input: FuelLogInput) {
  const [{ data: bus }, { data: driver }] = await Promise.all([
    supabase.from("buses").select("id").eq("bus_code", input.busCode).maybeSingle(),
    input.driverName.trim() ? supabase.from("drivers").select("id").eq("name", input.driverName).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    bus_id: bus?.id ?? null,
    driver_id: driver?.id ?? null,
    date: input.date,
    current_odometer: input.currentOdometer,
    odo_start: null,
    odo_end: input.currentOdometer, // kept in sync so older reports still read a value
    liters: input.liters,
    cost: input.cost,
    station: input.station,
    price_per_liter: input.pricePerLiter != null && input.pricePerLiter > 0 ? input.pricePerLiter : null,
    supplier_id: input.supplierId || null,
  };
}

/** The bus odometer only moves forward: it takes the new reading when it is higher than the stored one. */
async function syncBusOdometer(busId: string | null, reading: number) {
  if (!busId || !(reading > 0)) return;
  const { error } = await supabase.from("buses").update({ odometer: reading }).eq("id", busId).lt("odometer", reading);
  if (error) throw error;
}

export async function addFuelLog(input: FuelLogInput) {
  const payload = await resolveFuelPayload(input);
  const { data, error } = await supabase.from("fuel_logs").insert(payload).select("id").single();
  if (error) throw error;
  await syncBusOdometer(payload.bus_id, input.currentOdometer);
  await syncFuelSupplierInvoice(data.id as string, null, input);
}

/** مشتريات الوقود من محطة (مورّد) تظهر كفاتورة في كشف حسابه، وتتبع سجل السولار عند التعديل والحذف. */
async function syncFuelSupplierInvoice(fuelId: string, previousInvoiceId: string | null, input: Pick<FuelLogInput, "supplierId" | "date" | "cost" | "liters" | "busCode" | "station">) {
  const supplierId = input.supplierId || "";
  const amount = Number(input.cost) || 0;
  const ref = `وقود-${fuelId.slice(0, 6)}`;
  const details = `سولار ${input.liters} لتر — عربية ${input.busCode}${input.station ? ` — ${input.station}` : ""}`;
  if (previousInvoiceId && (!supplierId || amount <= 0)) {
    const { error } = await supabase.from("supplier_invoices").delete().eq("id", previousInvoiceId);
    if (error) throw error;
    await supabase.from("fuel_logs").update({ supplier_invoice_id: null }).eq("id", fuelId);
    return;
  }
  if (!supplierId || amount <= 0) return;
  if (previousInvoiceId) {
    const { data: cur } = await supabase.from("supplier_invoices").select("supplier_id").eq("id", previousInvoiceId).maybeSingle();
    if (cur && cur.supplier_id === supplierId) {
      const { error } = await supabase.from("supplier_invoices").update({ invoice_date: input.date, total_amount: amount, items_details: details }).eq("id", previousInvoiceId);
      if (error) throw error;
      return;
    }
    const { error: dErr } = await supabase.from("supplier_invoices").delete().eq("id", previousInvoiceId);
    if (dErr) throw dErr;
  }
  const { data: inv, error } = await supabase
    .from("supplier_invoices")
    .insert({ supplier_id: supplierId, invoice_date: input.date, invoice_ref: ref, total_amount: amount, items_details: details, paid_amount: 0 })
    .select("id")
    .single();
  if (error) throw error;
  const { error: lErr } = await supabase.from("fuel_logs").update({ supplier_invoice_id: inv.id }).eq("id", fuelId);
  if (lErr) throw lErr;
}

export interface BusFuelSummary {
  bus: string;
  fills: number;
  liters: number;
  cost: number;
  km: number;
  kmPerLiter: number;
  costPerKm: number;
}

export interface FuelFillInput {
  id: string;
  bus: string;
  date: string;
  order?: string; // tie-breaker for same-day fills (created_at)
  liters: number;
  cost: number;
  currentOdometer?: number | null;
  odoStart?: number;
  odoEnd?: number;
}

export interface FuelFill {
  id: string;
  bus: string;
  date: string;
  liters: number;
  cost: number;
  odometer: number | null; // العداد الحالي
  previous: number | null; // العداد السابق
  distance: number | null; // المسافة المقطوعة = الحالي − السابق
  ratio: number | null; // لتر لكل كم = اللترات ÷ المسافة
}

/**
 * Distance between consecutive fills of the same bus: current odometer − previous fill's odometer.
 * Older logs that carry an explicit start/end pair keep using it.
 */
export function computeFuelFills(logs: FuelFillInput[]): Map<string, FuelFill> {
  const out = new Map<string, FuelFill>();
  const byBus = new Map<string, FuelFillInput[]>();
  for (const l of logs) byBus.set(l.bus, [...(byBus.get(l.bus) ?? []), l]);
  for (const list of byBus.values()) {
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.order ?? "") < (b.order ?? "") ? -1 : (a.order ?? "") > (b.order ?? "") ? 1 : 0));
    let last: number | null = null;
    for (const l of list) {
      const start = l.odoStart ?? 0;
      const end = l.odoEnd ?? 0;
      let odometer: number | null;
      let previous: number | null;
      if (l.currentOdometer == null && end > start) {
        odometer = end;
        previous = start;
      } else {
        odometer = l.currentOdometer ?? (end > 0 ? end : null);
        previous = last;
      }
      const distance = odometer != null && previous != null && odometer > previous ? odometer - previous : null;
      if (odometer != null) last = odometer;
      out.set(l.id, { id: l.id, bus: l.bus, date: l.date, liters: l.liters, cost: l.cost, odometer, previous, distance, ratio: distance && l.liters > 0 ? l.liters / distance : null });
    }
  }
  return out;
}

/** Fuel consumption per vehicle: litres, cost, distance and efficiency. */
export function computeFuelByBus(logs: { id?: string; bus: string; date?: string; createdAt?: string; liters: number; cost: number; odoStart?: number; odoEnd?: number; currentOdometer?: number | null }[]): BusFuelSummary[] {
  const fills = computeFuelFills(logs.map((l, i) => ({ id: l.id ?? String(i), bus: l.bus, date: l.date ?? "", order: l.createdAt ?? String(i).padStart(8, "0"), liters: l.liters, cost: l.cost, currentOdometer: l.currentOdometer ?? null, odoStart: l.odoStart ?? 0, odoEnd: l.odoEnd ?? 0 })));
  const m = new Map<string, { fills: number; liters: number; cost: number; km: number; coveredLiters: number; coveredCost: number }>();
  for (const f of fills.values()) {
    const cur = m.get(f.bus) ?? { fills: 0, liters: 0, cost: 0, km: 0, coveredLiters: 0, coveredCost: 0 };
    cur.fills += 1;
    cur.liters += f.liters;
    cur.cost += f.cost;
    if (f.distance) {
      cur.km += f.distance;
      cur.coveredLiters += f.liters;
      cur.coveredCost += f.cost;
    }
    m.set(f.bus, cur);
  }
  return [...m.entries()]
    .map(([bus, t]) => ({
      bus,
      fills: t.fills,
      liters: t.liters,
      cost: t.cost,
      km: t.km,
      kmPerLiter: t.coveredLiters > 0 && t.km > 0 ? Math.round((t.km / t.coveredLiters) * 100) / 100 : 0,
      costPerKm: t.km > 0 ? Math.round((t.coveredCost / t.km) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.cost - a.cost);
}

// ---- Bus maintenance ledger (كشف صيانة السيارة) ----

export interface BusLedgerOrder {
  id: string;
  code: string;
  date: string;
  issue: string;
  status: string;
  items: MaintenanceItem[];
  partsTotal: number;
  laborCost: number;
  total: number;
}

export function computeBusLedger(
  orders: { id: string; code: string; date: string; issue: string; status: string; items: MaintenanceItem[]; laborCost: number }[],
  busCode: string,
  from: string,
  to: string,
  buses: Map<string, string>,
) {
  const rows: BusLedgerOrder[] = orders
    .filter((o) => buses.get(o.id) === busCode && o.status !== "ملغي" && (!from || o.date >= from) && (!to || o.date <= to))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((o) => {
      const { partsTotal, total } = computeOrderTotals(o.items, o.laborCost);
      return { id: o.id, code: o.code, date: o.date, issue: o.issue, status: o.status, items: o.items, partsTotal, laborCost: o.laborCost, total };
    });
  return {
    rows,
    totalParts: rows.reduce((s, r) => s + r.partsTotal, 0),
    totalLabor: rows.reduce((s, r) => s + r.laborCost, 0),
    grandTotal: rows.reduce((s, r) => s + r.total, 0),
  };
}

// ---- Finance ----

export interface TreasuryInput {
  date: string;
  account: string;
  clientId: string;
  opening: number;
  deposits: number;
  withdrawals: number;
  notes: string;
}

export async function fetchTreasury(): Promise<TreasuryEntry[]> {
  const { data, error } = await supabase.from("treasury").select("*").order("date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t: any) => ({
    id: t.id,
    date: t.date,
    account: t.account,
    opening: Number(t.opening ?? 0),
    deposits: Number(t.deposits ?? 0),
    withdrawals: Number(t.withdrawals ?? 0),
    clientId: t.client_id ?? "",
    isRollover: !!t.is_rollover,
    notes: t.notes ?? "",
  }));
}

const treasuryRow = (input: TreasuryInput) => ({
  date: input.date || undefined,
  account: input.account,
  client_id: input.clientId || null,
  opening: input.opening,
  deposits: input.deposits,
  withdrawals: input.withdrawals,
  notes: input.notes || null,
});

export async function addTreasuryEntry(input: TreasuryInput) {
  const { error } = await supabase.from("treasury").insert(treasuryRow(input));
  if (error) throw error;
}

export interface ExpenseInput {
  date: string;
  category: string;
  supplierId: string;
  description: string;
  notes: string;
  payFrom: string;
  amount: number;
  /** مفتاح السيارة المستأجرة «المالك||العربية» عند بند «السيارات المستأجرة» */
  rentedVehicle?: string;
  /** «driver:id» أو «employee:id» عند بند «مرتبات»: يُحتسب سلفة في مرتب الشخص */
  subjectKey?: string;
}

export const CUSTODY_SOURCE = "عهدة الخزينة";
/** طريقة الدفع / مصدر التمويل — used by every expense-generating form. */
export const PAYMENT_SOURCES = [
  "عهدة الخزينة",
  "الخزينة الرئيسية (من الجيب / النقدية)",
  "تحصيلات الشركات",
  "انستا باي (Instapay)",
  "محفظة إلكترونية",
  "كاش (Cash)",
] as const;
export const PAY_FROM_OPTIONS = PAYMENT_SOURCES;

export async function fetchExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase.from("expenses").select("*, suppliers!expenses_supplier_id_fkey(supplier_name, balance_due)").order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((e: any) => ({
    id: e.id,
    date: e.date,
    category: e.category,
    supplier: e.suppliers?.supplier_name ?? e.supplier ?? "—",
    supplierId: e.supplier_id ?? "",
    amount: Number(e.amount ?? 0),
    supplierBalance: Number(e.suppliers?.balance_due ?? e.supplier_balance ?? 0),
    description: e.description ?? "",
    notes: e.notes ?? "",
    payFrom: e.pay_from ?? "",
    subjectKey: e.subject_type && e.subject_id ? `${e.subject_type}:${e.subject_id}` : "",
  }));
}

const expenseRow = async (input: ExpenseInput) => {
  let supplierName: string | null = null;
  if (input.supplierId) {
    const { data } = await supabase.from("suppliers").select("supplier_name").eq("id", input.supplierId).maybeSingle();
    supplierName = data?.supplier_name ?? null;
  }
  return {
    date: input.date || undefined,
    category: input.category,
    supplier: supplierName,
    supplier_id: input.supplierId || null,
    description: input.description || null,
    notes: input.notes || null,
    pay_from: input.payFrom || null,
    amount: input.amount,
    subject_type: input.category === "مرتبات" && input.subjectKey ? input.subjectKey.split(":")[0] : null,
    subject_id: input.category === "مرتبات" && input.subjectKey ? input.subjectKey.split(":")[1] : null,
  };
};

/** Saving also (via database trigger) deducts the amount from the chosen treasury account and, for a supplier, posts a payment. */
export async function addExpense(input: ExpenseInput) {
  if (input.category === RENTED_EXPENSE_CATEGORY && !input.rentedVehicle) throw new Error("اختر السيارة المستأجرة");
  const { data, error } = await supabase.from("expenses").insert(await expenseRow(input)).select("id").single();
  if (error) throw error;
  await syncCustodyLink({ table: "expenses", id: data.id as string }, { date: input.date, amount: input.amount, category: input.category, description: input.description || input.category, payFrom: input.payFrom, notes: input.notes, ...(input.category === "مرتبات" && input.subjectKey ? { subjectKey: input.subjectKey } : {}) });
  await syncRentedAdvanceLink({ table: "expenses", id: data.id as string }, input.category === RENTED_EXPENSE_CATEGORY ? { date: input.date, amount: input.amount, vehicle: input.rentedVehicle ?? "", payFrom: input.payFrom, notes: input.description || input.notes } : null);
}

export interface LoanInput {
  lender: string;
  total: number;
  installments: { amount: number; dueDate: string }[];
}

/** Earliest installment due today or later (falls back to the last one). */
export function nextInstallment(installments: { amount: number; dueDate: string }[], today = new Date().toISOString().slice(0, 10)) {
  const sorted = [...installments].filter((i) => i.dueDate).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  return sorted.find((i) => i.dueDate >= today) ?? sorted[sorted.length - 1] ?? null;
}

export async function fetchLoans(): Promise<Loan[]> {
  const [{ data, error }, { data: inst, error: e2 }] = await Promise.all([
    supabase.from("loans").select("*").order("created_at"),
    supabase.from("loan_installments").select("*").order("due_date"),
  ]);
  if (error) throw error;
  if (e2) throw e2;
  return (data ?? []).map((l: any) => {
    const installments = (inst ?? [])
      .filter((i: any) => i.loan_id === l.id)
      .map((i: any) => ({ id: i.id, amount: Number(i.amount ?? 0), dueDate: i.due_date as string }));
    const next = nextInstallment(installments);
    return {
      id: l.id,
      lender: l.lender,
      total: Number(l.total ?? 0),
      installment: next?.amount ?? Number(l.installment ?? 0),
      nextDue: next?.dueDate ?? l.next_due ?? "—",
      installments,
    };
  });
}

async function saveLoanInstallments(loanId: string, installments: LoanInput["installments"]) {
  const { error: delErr } = await supabase.from("loan_installments").delete().eq("loan_id", loanId);
  if (delErr) throw delErr;
  const rows = installments.filter((i) => i.dueDate && i.amount > 0).map((i) => ({ loan_id: loanId, amount: i.amount, due_date: i.dueDate }));
  if (rows.length) {
    const { error } = await supabase.from("loan_installments").insert(rows);
    if (error) throw error;
  }
}

const loanSummary = (input: LoanInput) => {
  const next = nextInstallment(input.installments);
  return { lender: input.lender, total: input.total, installment: next?.amount ?? 0, next_due: next?.dueDate ?? null };
};

export async function addLoan(input: LoanInput) {
  const { data, error } = await supabase.from("loans").insert(loanSummary(input)).select("id").single();
  if (error) throw error;
  await saveLoanInstallments(data.id, input.installments);
}

export async function addPayslip(input: { employeeName: string; role: string; baseSalary: number; overtime: number; advances: number; penalties: number }) {
  let { data: staff } = await supabase.from("staff").select("id").eq("name", input.employeeName).maybeSingle();
  if (!staff) {
    const { data: newStaff, error: staffError } = await supabase
      .from("staff")
      .insert({ name: input.employeeName, role: input.role, base_salary: input.baseSalary })
      .select("id")
      .single();
    if (staffError) throw staffError;
    staff = newStaff;
  }
  const { error } = await supabase.from("payslips").insert({
    staff_id: staff!.id,
    overtime: input.overtime,
    advances: input.advances,
    penalties: input.penalties,
  });
  if (error) throw error;
}

// ---- Dashboard ----

export interface AlertRow {
  id: string;
  type: string;
  text: string;
  level: string;
}

export async function fetchAlerts(): Promise<AlertRow[]> {
  const { data, error } = await supabase
    .from("alerts")
    .select("*")
    .eq("resolved", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((a: any) => ({ id: a.id, type: a.type, text: a.text, level: a.level ?? "متوسط" }));
}

/** Marks an alert as read; the daily generator never re-opens it unless a new threshold event occurs. */
export async function markAlertRead(id: string) {
  const { error } = await supabase.from("alerts").update({ resolved: true, resolved_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(dbErrorMessage(error, "تعذر تحديث التنبيه"));
}

export async function markAllAlertsRead(ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabase.from("alerts").update({ resolved: true, resolved_at: new Date().toISOString() }).in("id", ids);
  if (error) throw new Error(dbErrorMessage(error, "تعذر تحديث التنبيهات"));
}

export function computeFuelEfficiency(
  rows: { liters: number; odo_start: number; odo_end: number; bus_code: string }[],
): { bus: string; "لتر/100كم": number }[] {
  const totals = new Map<string, { liters: number; km: number }>();
  for (const row of rows) {
    const code = row.bus_code ?? "—";
    const km = Math.max((row.odo_end ?? 0) - (row.odo_start ?? 0), 0);
    const entry = totals.get(code) ?? { liters: 0, km: 0 };
    entry.liters += Number(row.liters ?? 0);
    entry.km += km;
    totals.set(code, entry);
  }
  return Array.from(totals.entries()).map(([bus, t]) => ({
    bus,
    "لتر/100كم": t.km > 0 ? Math.round((t.liters / t.km) * 100) : 0,
  }));
}

export async function fetchFuelChart(): Promise<{ bus: string; "لتر/100كم": number }[]> {
  const { data, error } = await supabase.from("fuel_logs").select("id, date, created_at, liters, cost, odo_start, odo_end, current_odometer, buses(bus_code)");
  if (error) throw error;
  const fills = computeFuelFills(
    (data ?? []).map((r: any) => ({ id: r.id, bus: r.buses?.bus_code ?? "—", date: r.date, order: r.created_at ?? "", liters: Number(r.liters ?? 0), cost: Number(r.cost ?? 0), currentOdometer: r.current_odometer ?? null, odoStart: r.odo_start ?? 0, odoEnd: r.odo_end ?? 0 })),
  );
  const rows = [...fills.values()].filter((f) => f.distance).map((f) => ({ liters: f.liters, odo_start: 0, odo_end: f.distance ?? 0, bus_code: f.bus }));
  return computeFuelEfficiency(rows);
}

export function computeMonthlyFinance(
  treasuryRows: { date: string; deposits: number }[],
  expenseRows: { date: string; amount: number }[],
  /** student subscription collections (not posted to the treasury table) */
  collectionRows: { date: string; amount: number }[] = [],
  /** subscription expenses (already withdrawn from the treasury through a trigger, so counted once, here) */
  subscriptionExpenseRows: { date: string; amount: number }[] = [],
): { month: string; الإيرادات: number; المصروفات: number }[] {
  const monthKey = (d: string) => new Date(d).toLocaleDateString("ar-EG", { month: "long" });
  const byMonth = new Map<string, { rev: number; exp: number }>();
  for (const row of treasuryRows) {
    const k = monthKey(row.date);
    const e = byMonth.get(k) ?? { rev: 0, exp: 0 };
    e.rev += Number(row.deposits ?? 0);
    byMonth.set(k, e);
  }
  for (const row of collectionRows) {
    const k = monthKey(row.date);
    const e = byMonth.get(k) ?? { rev: 0, exp: 0 };
    e.rev += Number(row.amount ?? 0);
    byMonth.set(k, e);
  }
  for (const row of [...expenseRows, ...subscriptionExpenseRows]) {
    const k = monthKey(row.date);
    const e = byMonth.get(k) ?? { rev: 0, exp: 0 };
    e.exp += Number(row.amount ?? 0);
    byMonth.set(k, e);
  }
  return Array.from(byMonth.entries()).map(([month, v]) => ({ month, الإيرادات: v.rev, المصروفات: v.exp }));
}

export async function fetchMonthlyFinance(): Promise<{ month: string; الإيرادات: number; المصروفات: number }[]> {
  const [t, ex, pay, subEx] = await Promise.all([
    pageAll((f, to) => supabase.from("treasury").select("date, deposits").order("id").range(f, to)),
    pageAll((f, to) => supabase.from("expenses").select("date, amount").order("id").range(f, to)),
    pageAll((f, to) => supabase.from("payments").select("date, amount").eq("type", "دائن").order("id").range(f, to)),
    pageAll((f, to) => supabase.from("subscription_expenses").select("date, amount").order("id").range(f, to)),
  ]);
  for (const r of [t, ex, pay, subEx]) if (r.error) throw r.error;
  return computeMonthlyFinance(t.data as any, ex.data as any, pay.data as any, subEx.data as any);
}

export async function fetchPayroll(): Promise<Payslip[]> {
  const { data, error } = await supabase
    .from("payslips")
    .select("*, staff(name, role, base_salary)")
    .order("month", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    id: p.id,
    employee: p.staff?.name ?? "—",
    role: p.staff?.role ?? "—",
    base: Number(p.staff?.base_salary ?? 0),
    overtime: Number(p.overtime ?? 0),
    advances: Number(p.advances ?? 0),
    penalties: Number(p.penalties ?? 0),
  }));
}

export function nextMonthPrefix(monthPrefix: string): string {
  const [y, m] = monthPrefix.split("-").map(Number);
  const next = new Date(Date.UTC(y!, m!, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

// ---- Date ranges (shared by every statement) ----

/** Inclusive date range (YYYY-MM-DD). An empty bound means "open". */
export interface DateRange {
  from: string;
  to: string;
}
/** A calendar month ("YYYY-MM") or an explicit date range. */
export type Period = string | DateRange;

const addDaysIso = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** [start, end) bounds for `.gte(start).lt(end)` queries. */
export function periodBounds(p: Period): { start: string; end: string } {
  if (typeof p === "string") return { start: `${p}-01`, end: `${nextMonthPrefix(p)}-01` };
  return { start: p.from || "1900-01-01", end: p.to ? addDaysIso(p.to, 1) : "2999-12-31" };
}

/** Calendar months touched by the period (used for monthly base salaries and adjustments). */
export function periodMonths(p: Period): string[] {
  if (typeof p === "string") return [p];
  if (!p.from || !p.to) return [(p.from || p.to || new Date().toISOString().slice(0, 10)).slice(0, 7)];
  const out: string[] = [];
  let m = p.from.slice(0, 7);
  const last = p.to.slice(0, 7);
  while (m <= last && out.length < 600) {
    out.push(m);
    m = nextMonthPrefix(m);
  }
  return out;
}

export type RangePreset = "current" | "previous" | "all";

export function rangeForPreset(preset: RangePreset, today = new Date().toISOString().slice(0, 10)): DateRange {
  const cur = today.slice(0, 7);
  if (preset === "all") return { from: "", to: "" };
  if (preset === "current") return { from: `${cur}-01`, to: addDaysIso(`${nextMonthPrefix(cur)}-01`, -1) };
  const prev = addDaysIso(`${cur}-01`, -1).slice(0, 7);
  return { from: `${prev}-01`, to: addDaysIso(`${cur}-01`, -1) };
}

export function inDateRange(date: string, r: DateRange) {
  return (!r.from || date >= r.from) && (!r.to || date <= r.to);
}

export function periodLabel(p: Period): string {
  if (typeof p === "string") return p;
  if (!p.from && !p.to) return "كل الفترات";
  return `${p.from || "البداية"} إلى ${p.to || "اليوم"}`;
}

export async function fetchAttendanceSummary(driverName: string, monthPrefix: string) {
  const { data, error } = await supabase
    .from("attendance")
    .select("status, drivers(name)")
    .gte("date", `${monthPrefix}-01`)
    .lt("date", `${nextMonthPrefix(monthPrefix)}-01`);
  if (error) throw error;
  const rows = (data ?? []).filter((r: any) => r.drivers?.name === driverName);
  return {
    present: rows.filter((r: any) => r.status === "حاضر").length,
    late: rows.filter((r: any) => r.status === "متأخر").length,
    absent: rows.filter((r: any) => r.status === "غائب").length,
  };
}

// ---- Roles & team ----

export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  role: "admin" | "accountant" | "dispatcher" | "staff" | "pending" | "storekeeper" | "workshop_keeper" | "maintenance_manager";
}

export async function fetchMyProfile(): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, email: data.email, fullName: data.full_name, role: data.role };
}

export async function fetchTeam(): Promise<Profile[]> {
  const { data, error } = await supabase.from("profiles").select("*").order("email");
  if (error) throw error;
  return (data ?? []).map((d: any) => ({ id: d.id, email: d.email, fullName: d.full_name, role: d.role }));
}

export async function updateProfileRole(id: string, role: Profile["role"]) {
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) throw error;
}

export async function updateProfileName(id: string, fullName: string) {
  const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", id);
  if (error) throw error;
}

// ---- Audit log ----

export interface AuditEntry {
  id: string;
  tableName: string;
  action: string;
  changedByEmail: string | null;
  changedAt: string;
  oldData: any;
  newData: any;
}

export async function fetchAuditLog(limit = 100): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((a: any) => ({
    id: a.id,
    tableName: a.table_name,
    action: a.action,
    changedByEmail: a.changed_by_email,
    changedAt: a.changed_at,
    oldData: a.old_data,
    newData: a.new_data,
  }));
}

// ---- Global search ----

export interface SearchResult {
  label: string;
  sublabel: string;
  page: "/fleet" | "/operations" | "/workshop";
}

export async function globalSearch(term: string): Promise<SearchResult[]> {
  if (!term.trim()) return [];
  const like = `%${term}%`;
  const [buses, drivers, students, routes] = await Promise.all([
    supabase.from("buses").select("bus_code, plate_number").or(`bus_code.ilike.${like},plate_number.ilike.${like}`).limit(5),
    supabase.from("drivers").select("name, phone").ilike("name", like).limit(5),
    supabase.from("students").select("name, parent_phone").ilike("name", like).limit(5),
    supabase.from("routes").select("route_name, pickup_points").ilike("route_name", like).limit(5),
  ]);
  const results: SearchResult[] = [];
  for (const b of buses.data ?? []) results.push({ label: b.bus_code, sublabel: `أتوبيس • ${b.plate_number ?? "—"}`, page: "/fleet" });
  for (const d of drivers.data ?? []) results.push({ label: d.name, sublabel: `سائق • ${d.phone ?? "—"}`, page: "/fleet" });
  for (const s of students.data ?? []) results.push({ label: s.name, sublabel: `طالب • ${s.parent_phone ?? "—"}`, page: "/operations" });
  for (const r of routes.data ?? []) results.push({ label: r.route_name, sublabel: `خط سير`, page: "/operations" });
  return results;
}

// ---- Backup / export ----

const BACKUP_TABLES = [
  "buses", "drivers", "routes", "students", "maintenance_orders", "attendance",
  "payments", "inventory", "fuel_logs", "treasury", "expenses", "loans",
  "staff", "payslips", "alerts",
] as const;

export async function exportAllData(): Promise<Record<string, unknown[]>> {
  const result: Record<string, unknown[]> = {};
  for (const table of BACKUP_TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) throw new Error(`تعذر تصدير جدول ${table}: ${error.message}`);
    result[table] = data ?? [];
  }
  return result;
}

// ---- Bulk CSV import ----

export async function bulkInsertBuses(rows: Record<string, string>[]) {
  const payload = rows.map((r) => ({
    bus_code: r["bus_code"] ?? r["الكود"],
    plate_number: r["plate_number"] ?? r["رقم اللوحة"],
    model: r["model"] ?? r["الموديل"],
    capacity: Number(r["capacity"] ?? r["السعة"]) || 0,
    odometer: Number(r["odometer"] ?? r["العداد"]) || 0,
    status: r["status"] ?? r["الحالة"] ?? "تعمل",
  }));
  const { error } = await supabase.from("buses").insert(payload);
  if (error) throw error;
  return payload.length;
}

export async function bulkInsertDrivers(rows: Record<string, string>[]) {
  const payload = rows.map((r) => ({
    driver_code: `DRV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`,
    name: r["name"] ?? r["الاسم"],
    phone: r["phone"] ?? r["الهاتف"],
    license_type: r["license_type"] ?? r["نوع الرخصة"],
    license_expiry: (r["license_expiry"] ?? r["انتهاء الرخصة"]) || null,
    base_salary: Number(r["base_salary"] ?? r["المرتب الأساسي"]) || 0,
  }));
  const { error } = await supabase.from("drivers").insert(payload);
  if (error) throw error;
  return payload.length;
}

export async function bulkInsertStudents(rows: Record<string, string>[]) {
  const names = [...new Set(rows.map((r) => r["route_name"] ?? r["اسم الخط"]).filter(Boolean))];
  const { data: routes } = await supabase.from("routes").select("id, route_name").in("route_name", names);
  const routeMap = new Map((routes ?? []).map((r: any) => [r.route_name, r.id]));
  const payload = rows.map((r) => ({
    sub_code: `STU-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`,
    name: r["name"] ?? r["الاسم"],
    parent_phone: r["parent_phone"] ?? r["هاتف ولي الأمر"],
    route_id: routeMap.get(r["route_name"] ?? r["اسم الخط"]) ?? null,
    total_amount: Number(r["total_amount"] ?? r["الاشتراك الشهري"]) || 0,
    paid_amount: Number(r["paid_amount"] ?? r["المسدد"]) || 0,
  }));
  const { error } = await supabase.from("students").insert(payload);
  if (error) throw error;
  return payload.length;
}

// ---- Student Excel import ----

/** PostgREST returns at most 1,000 rows per request — fetch every page. */
async function pageAll(make: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>): Promise<{ data: any[]; error: any }> {
  const all: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await make(from, from + 999);
    if (error) return { data: all, error };
    all.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return { data: all, error: null };
}

export async function fetchStudentImportContext() {
  const [st, rt] = await Promise.all([
    pageAll((f, t) => supabase.from("students").select("name, phone").order("id").range(f, t)),
    supabase.from("routes").select("id, route_name, monthly_price"),
  ]);
  if (st.error) throw st.error;
  if (rt.error) throw rt.error;
  return {
    students: (st.data ?? []).map((s: any) => ({ name: s.name as string, phone: (s.phone ?? null) as string | null })),
    routes: (rt.data ?? []).map((r: any) => ({ id: r.id as string, name: r.route_name as string, price: Number(r.monthly_price ?? 0) })),
  };
}

const IMPORT_CHUNK = 100;
const chunked = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export interface StudentImportResult {
  students: number;
  routesCreated: number;
  payments: number;
}

/** Creates missing routes, inserts students and their initial payments in chunks, then refreshes route occupancy. */
export async function importStudents(
  rows: ReviewedStudent[],
  onProgress?: (done: number, total: number) => void,
): Promise<StudentImportResult> {
  const ready = rows.filter((r) => r.status === "valid");
  if (ready.length === 0) return { students: 0, routesCreated: 0, payments: 0 };
  const ctx = await fetchStudentImportContext();
  const routeIds = new Map(ctx.routes.map((r) => [normalizeText(r.name), r.id]));
  const prices = new Map(ctx.routes.map((r) => [r.id, r.price]));

  const missing = [...new Map(ready.filter((r) => r.routeName && !routeIds.has(normalizeText(r.routeName))).map((r) => [normalizeText(r.routeName), r.routeName])).entries()];
  let routesCreated = 0;
  if (missing.length > 0) {
    const stamp = Date.now().toString(36).toUpperCase();
    const { data, error } = await supabase
      .from("routes")
      .insert(missing.map(([, name], i) => ({ route_code: `RT-${stamp}-${i}`, route_name: name, seats: 0, booked: 0 })))
      .select("id, route_name");
    if (error) throw new Error(dbErrorMessage(error, "تعذر إنشاء الخطوط الجديدة"));
    for (const r of data ?? []) routeIds.set(normalizeText((r as any).route_name), (r as any).id);
    routesCreated = data?.length ?? 0;
  }

  const stamp = Date.now().toString(36).toUpperCase();
  let done = 0;
  let payments = 0;
  const touched = new Set<string>();
  for (const [ci, chunk] of chunked(ready, IMPORT_CHUNK).entries()) {
    const payload = chunk.map((r, i) => {
      const routeId = r.routeName ? routeIds.get(normalizeText(r.routeName)) ?? null : null;
      if (routeId) touched.add(routeId);
      return {
        sub_code: `STU-${stamp}-${ci * IMPORT_CHUNK + i}`,
        name: r.name,
        phone: r.studentPhone || null,
        parent_phone: r.parentPhone || null,
        route_id: routeId,
        pickup_point: r.pickupPoint || null,
        subscription_type: r.subscriptionType || null,
        notes: r.notes || null,
        total_amount: subscriptionTotal(r, routeId ? prices.get(routeId) ?? 0 : 0),
        paid_amount: 0,
      };
    });
    const { data, error } = await supabase.from("students").insert(payload).select("id, sub_code");
    if (error) throw new Error(`${dbErrorMessage(error, "تعذر حفظ الطلاب")} (تم حفظ ${done} طالب قبل التوقف)`);
    const idByCode = new Map((data ?? []).map((d: any) => [d.sub_code as string, d.id as string]));
    const pays = chunk
      .map((r, i) => ({ r, id: idByCode.get(payload[i]!.sub_code) }))
      .filter((x) => x.id && x.r.amountPaid > 0)
      .map((x) => ({ student_id: x.id!, amount: x.r.amountPaid, method: "استيراد إكسيل", notes: x.r.subscriptionType || null }));
    if (pays.length > 0) {
      const { error: pe } = await supabase.from("payments").insert(pays);
      if (pe) throw new Error(`${dbErrorMessage(pe, "تعذر تسجيل المدفوعات")} (تم حفظ الطلاب حتى هذه الدفعة)`);
      payments += pays.length;
    }
    done += chunk.length;
    onProgress?.(done, ready.length);
  }

  // route occupancy ("booked") = number of linked students
  for (const id of touched) {
    const { count } = await supabase.from("students").select("id", { count: "exact", head: true }).eq("route_id", id);
    await supabase.from("routes").update({ booked: count ?? 0 }).eq("id", id);
  }
  return { students: done, routesCreated, payments };
}

export async function bulkInsertRoutes(rows: Record<string, string>[]) {
  const codes = [...new Set(rows.map((r) => r["bus_code"] ?? r["كود الأتوبيس"]).filter(Boolean))];
  const { data: buses } = await supabase.from("buses").select("id, bus_code").in("bus_code", codes);
  const busMap = new Map((buses ?? []).map((b: any) => [b.bus_code, b.id]));
  const payload = rows.map((r) => ({
    route_code: `RT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`,
    route_name: r["route_name"] ?? r["اسم الخط"],
    pickup_points: r["pickup_points"] ?? r["نقاط التجمع"],
    departure_time: (r["departure_time"] ?? r["موعد التحرك"]) || null,
    return_time: (r["return_time"] ?? r["موعد الوصول"]) || null,
    bus_id: busMap.get(r["bus_code"] ?? r["كود الأتوبيس"]) ?? null,
    seats: Number(r["seats"] ?? r["عدد المقاعد"]) || 0,
    booked: 0,
  }));
  const { error } = await supabase.from("routes").insert(payload);
  if (error) throw error;
  return payload.length;
}

export async function bulkInsertInventory(rows: Record<string, string>[]) {
  const payload = rows.map((r) => ({
    name: r["name"] ?? r["اسم الصنف"],
    code: r["code"] ?? r["الكود"],
    stock: Number(r["stock"] ?? r["الرصيد"]) || 0,
    min_stock: Number(r["min_stock"] ?? r["الحد الأدنى"]) || 0,
    unit_price: Number(r["unit_price"] ?? r["سعر الوحدة"]) || 0,
    unit_type: ["بالقطعة", "بالكيلو", "باللتر"].includes(r["unit_type"] ?? r["الوحدة"] ?? "") ? (r["unit_type"] ?? r["الوحدة"]) : "بالقطعة",
  }));
  const { error } = await supabase.from("inventory").insert(payload);
  if (error) throw error;
  return payload.length;
}

// ---- Daily shift & payroll (Module 1) ----

export interface DailyShift {
  id: string;
  driverId: string;
  driver: string;
  busId: string | null;
  bus: string;
  busPlate: string;
  routeId: string | null;
  route: string;
  shiftFrom: string;
  shiftTo: string;
  date: string;
  status: string;
  overtimeAllowance: number;
  dailyAdvance: number;
  penalty: number;
  tollFee: number; // الكرتة
  notes: string;
}

export async function fetchDailyShifts(period: Period): Promise<DailyShift[]> {
  const { start, end } = periodBounds(period);
  const { data, error } = await supabase
    .from("attendance")
    .select("*, drivers(name), buses(bus_code, plate_number), routes(route_name)")
    .gte("date", start)
    .lt("date", end)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((a: any) => ({
    id: a.id,
    driverId: a.driver_id,
    driver: a.drivers?.name ?? "—",
    busId: a.bus_id,
    bus: a.buses?.bus_code ?? "—",
    busPlate: a.buses?.plate_number ?? a.buses?.bus_code ?? "—",
    routeId: a.route_id,
    route: a.routes?.route_name ?? "—",
    shiftFrom: a.shift_from ?? "",
    shiftTo: a.shift_to ?? "",
    date: a.date,
    status: a.status ?? "حاضر",
    overtimeAllowance: Number(a.overtime_allowance ?? 0),
    dailyAdvance: Number(a.daily_advance ?? 0),
    penalty: Number(a.penalty ?? 0),
    tollFee: Number(a.toll_fee ?? 0),
    notes: a.notes ?? "",
  }));
}

export async function upsertDailyShift(input: {
  id?: string | undefined;
  driverName: string;
  busCode: string;
  routeName: string;
  shiftFrom: string;
  shiftTo: string;
  date: string;
  status: string;
  overtimeAllowance: number;
  dailyAdvance: number;
  penalty: number;
  tollFee?: number;
  notes: string;
}) {
  const { data: driver } = await supabase.from("drivers").select("id").eq("name", input.driverName).maybeSingle();
  if (!driver) throw new Error("لم يتم العثور على سائق بهذا الاسم");

  let busId: string | null = null;
  if (input.busCode.trim()) {
    const { data: bus } = await supabase.from("buses").select("id").eq("bus_code", input.busCode).maybeSingle();
    busId = bus?.id ?? null;
  }
  let routeId: string | null = null;
  if (input.routeName.trim()) {
    const { data: route } = await supabase.from("routes").select("id").eq("route_name", input.routeName).maybeSingle();
    routeId = route?.id ?? null;
  }

  const payload = {
    driver_id: driver.id,
    bus_id: busId,
    route_id: routeId,
    shift_from: input.shiftFrom || null,
    shift_to: input.shiftTo || null,
    date: input.date,
    status: input.status,
    overtime_allowance: input.overtimeAllowance,
    daily_advance: input.dailyAdvance,
    penalty: input.penalty,
    toll_fee: input.tollFee ?? 0,
    notes: input.notes,
  };

  if (input.id) {
    const { error } = await supabase.from("attendance").update(payload).eq("id", input.id);
    if (error) throw error;
    return;
  }

  const { data: existing } = await supabase
    .from("attendance")
    .select("id")
    .eq("driver_id", driver.id)
    .eq("date", input.date)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase.from("attendance").update(payload).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("attendance").insert(payload);
    if (error) throw error;
  }
}

export async function deleteDailyShift(id: string) {
  const { error } = await supabase.from("attendance").delete().eq("id", id);
  if (error) throw error;
}

export interface DriverPayrollRow {
  driver: string;
  baseSalary: number;
  totalOvertime: number;
  totalAdvances: number;
  totalPenalties: number;
  totalTolls: number;
  tripFees: number;
  shiftEarnings: number;
  netSalary: number;
}

export function computeDriverPayroll(
  drivers: { name: string; base_salary: number }[],
  shifts: { driver: string; overtimeAllowance: number; dailyAdvance: number; penalty: number; toll?: number }[],
  tripFees: { driver: string; fee: number }[] = [],
  shiftEarnings: { driver: string; value: number }[] = [],
): DriverPayrollRow[] {
  return drivers.map((d) => {
    const rows = shifts.filter((s) => s.driver === d.name);
    const totalOvertime = rows.reduce((sum, r) => sum + r.overtimeAllowance, 0);
    const totalAdvances = rows.reduce((sum, r) => sum + r.dailyAdvance, 0);
    const totalPenalties = rows.reduce((sum, r) => sum + r.penalty, 0);
    const totalTolls = rows.reduce((sum, r) => sum + (r.toll ?? 0), 0);
    const driverTripFees = tripFees.filter((t) => t.driver === d.name).reduce((sum, t) => sum + t.fee, 0);
    const driverShiftEarnings = shiftEarnings.filter((t) => t.driver === d.name).reduce((sum, t) => sum + t.value, 0);
    const baseSalary = Number(d.base_salary ?? 0);
    return {
      driver: d.name,
      baseSalary,
      totalOvertime,
      totalAdvances,
      totalPenalties,
      totalTolls,
      tripFees: driverTripFees,
      shiftEarnings: driverShiftEarnings,
      netSalary: baseSalary + totalOvertime + driverTripFees + driverShiftEarnings - (totalAdvances + totalPenalties + totalTolls),
    };
  });
}

/** نسبة أجر الوردية حسب حالة الحضور: حاضر كامل، نصف يوم نصف الأجر، غياب/إجازة بدون أجر وردية. */
export function shiftPayFactor(status: string) {
  const s = (status || "حاضر").trim();
  if (s === "غياب" || s === "إجازة") return 0;
  if (s === "نصف يوم") return 0.5;
  return 1;
}

export async function fetchDriverPayroll(period: Period): Promise<DriverPayrollRow[]> {
  const { start, end } = periodBounds(period);
  const [{ data: drivers, error: dErr }, shifts, { data: tripRows }, dispatchShifts, custodyAdv, { data: faultOrders }] = await Promise.all([
    supabase.from("drivers").select("id, name, base_salary"),
    fetchDailyShifts(period),
    supabase.from("trips").select("driver_fee, drivers(name)").neq("status", "ملغاة").gte("trip_date", start).lt("trip_date", end),
    fetchDispatchShifts(period),
    fetchCustodyAdvances(period),
    // أوامر صيانة مكتملة بخطأ/إهمال سائق: تُخصم من مرتبه كجزاء
    supabase.from("maintenance_orders").select("fault_driver_id, fault_amount, total_cost").eq("driver_fault", true).eq("status", "مكتمل").not("fault_driver_id", "is", null).gte("order_date", start).lt("order_date", end),
  ]);
  if (dErr) throw dErr;
  return computeDriverPayroll(
    (drivers ?? []).map((d: any) => ({ name: d.name, base_salary: Number(d.base_salary ?? 0) * periodMonths(period).length })),
    [
      ...shifts.map((s) => ({ driver: s.driver, overtimeAllowance: s.overtimeAllowance, dailyAdvance: s.dailyAdvance, penalty: s.penalty, toll: s.tollFee })),
      // إضافي/سلفة/جزاء/كرتة المسجلة مباشرة في ورديات الحركة تُرحَّل تلقائيًا للمرتب
      ...dispatchShifts.map((o) => ({ driver: o.driver, overtimeAllowance: o.overtime, dailyAdvance: o.advance, penalty: o.penalty, toll: o.karta })),
      // مبالغ صُرفت للسائق من عهدة الخزينة تُخصم كسلفة
      ...(faultOrders ?? []).map((m: any) => ({ driver: (drivers ?? []).find((d: any) => d.id === m.fault_driver_id)?.name ?? "", overtimeAllowance: 0, dailyAdvance: 0, penalty: Number(m.fault_amount ?? m.total_cost ?? 0) })),
      ...custodyAdv.filter((c) => c.type === "driver").map((c) => ({ driver: (drivers ?? []).find((d: any) => d.id === c.id)?.name ?? c.name, overtimeAllowance: 0, dailyAdvance: c.amount, penalty: 0 })),
    ],
    [
      ...(tripRows ?? []).map((t: any) => ({ driver: t.drivers?.name ?? "", fee: Number(t.driver_fee ?? 0) })),
      // أجور المأموريات (مرحَّلة تلقائيًا في ورديات الحركة)
      ...dispatchShifts.filter((o) => o.missionId).map((o) => ({ driver: o.driver, fee: o.driverValue })),
    ],
    dispatchShifts.filter((o) => !o.missionId).map((o) => ({ driver: o.driver, value: o.driverValue * shiftPayFactor(o.attendanceStatus) })),
  );
}

// ---- Payroll adjustments + final net formula ----

export type PayrollSubjectType = "driver" | "employee";

export interface PayrollAdjustment {
  bonus: number;
  advances: number;
  penalties: number;
  tolls: number;
  notes: string;
  locked: boolean;
  paySource?: string;
}

export const EMPTY_ADJUSTMENT: PayrollAdjustment = { bonus: 0, advances: 0, penalties: 0, tolls: 0, notes: "", locked: false };

/**
 * Net = base + shift allowances + trip fees + bonus - (advances + penalties + tolls/karta fees)
 * `advances`/`penalties` combine the daily records with the month adjustment.
 */
export function computeFinalPayroll(
  row: { baseSalary: number; shiftAllowances: number; tripFees: number; advances: number; penalties: number; tolls?: number },
  adj: PayrollAdjustment = EMPTY_ADJUSTMENT,
) {
  const additions = row.shiftAllowances + row.tripFees + adj.bonus;
  const advances = row.advances + adj.advances;
  const penalties = row.penalties + adj.penalties;
  const tolls = (row.tolls ?? 0) + adj.tolls;
  const deductions = advances + penalties + tolls;
  return { baseSalary: row.baseSalary, shiftAllowances: row.shiftAllowances, tripFees: row.tripFees, bonus: adj.bonus, advances, penalties, tolls, additions, deductions, net: row.baseSalary + additions - deductions };
}

export const adjustmentKey = (type: PayrollSubjectType, id: string) => `${type}:${id}`;

/** Adjustments for every month the period touches, summed per person (locked only if all of them are locked). */
export async function fetchPayrollAdjustments(period: Period): Promise<Map<string, PayrollAdjustment>> {
  const months = periodMonths(period);
  const { data, error } = await supabase.from("payroll_adjustments").select("*").in("month", months);
  if (error) throw error;
  const out = new Map<string, PayrollAdjustment & { n: number; lockedN: number }>();
  for (const r of data ?? []) {
    const key = adjustmentKey((r as any).subject_type, (r as any).subject_id);
    const cur = out.get(key) ?? { ...EMPTY_ADJUSTMENT, n: 0, lockedN: 0 };
    cur.bonus += Number((r as any).bonus ?? 0);
    cur.advances += Number((r as any).advances ?? 0);
    cur.penalties += Number((r as any).penalties ?? 0);
    cur.tolls += Number((r as any).tolls ?? 0);
    cur.notes = cur.notes || ((r as any).notes ?? "");
    cur.paySource = cur.paySource || ((r as any).pay_source ?? "");
    cur.n += 1;
    if ((r as any).locked) cur.lockedN += 1;
    out.set(key, cur);
  }
  return new Map(
    [...out.entries()].map(([k, v]) => [k, { bonus: v.bonus, advances: v.advances, penalties: v.penalties, tolls: v.tolls, notes: v.notes, paySource: v.paySource ?? "", locked: v.n > 0 && v.lockedN === v.n }]),
  );
}

export async function savePayrollAdjustment(type: PayrollSubjectType, id: string, month: string, adj: PayrollAdjustment) {
  const { data, error } = await supabase
    .from("payroll_adjustments")
    .upsert(
      { subject_type: type, subject_id: id, month, bonus: adj.bonus, advances: adj.advances, penalties: adj.penalties, tolls: adj.tolls, notes: adj.notes || null, locked: adj.locked, pay_source: adj.paySource || null },
      { onConflict: "subject_type,subject_id,month" },
    )
    .select("id")
    .single();
  if (error) throw error;
  // سلف وكرتات تُدفع من «عهدة الخزينة» تنعكس في دفتر العهدة
  const { data: who } = await supabase.from(type === "driver" ? "drivers" : "employees").select("name").eq("id", id).maybeSingle();
  const today = new Date().toISOString().slice(0, 10);
  await syncCustodyLink(
    { table: "payroll_adjustments", id: data.id as string },
    { date: today.startsWith(month) ? today : `${month}-01`, amount: adj.advances + adj.tolls, category: "سلف وكرتات مرتبات", description: `سلف/كرتات مرتب — ${who?.name ?? ""}`.trim(), payFrom: adj.paySource ?? "" },
  );
  // ...وإن كان المصدر غير العهدة (الخزينة الرئيسية / إنستا باي ...) يُسحب المبلغ من حساب الخزينة المختار
  const amount = adj.advances + adj.tolls;
  const toTreasury = !!adj.paySource && adj.paySource !== CUSTODY_SOURCE && amount > 0;
  const { data: dep } = await supabase.from("treasury").select("id").eq("payroll_adjustment_id", data.id as string).maybeSingle();
  if (toTreasury) {
    const row = { date: today.startsWith(month) ? today : `${month}-01`, account: adj.paySource as string, opening: 0, deposits: 0, withdrawals: amount, notes: `سلف/كرتات مرتب — ${who?.name ?? ""}`.trim(), payroll_adjustment_id: data.id as string };
    const { error: tErr } = dep ? await supabase.from("treasury").update(row).eq("id", dep.id) : await supabase.from("treasury").insert(row);
    if (tErr) throw new Error(dbErrorMessage(tErr, "تعذر خصم السلفة من الخزينة"));
  } else if (dep) {
    const { error: tErr } = await supabase.from("treasury").delete().eq("id", dep.id);
    if (tErr) throw new Error(dbErrorMessage(tErr, "تعذر تحديث الخزينة"));
  }
}

// ---- Client ledger & statement (Module 2) ----

export interface LedgerEntry {
  id: string;
  date: string;
  type: "مدين" | "دائن";
  amount: number;
  method: string;
  notes: string;
}

export interface ClientLedgerRow {
  id: string;
  name: string;
  phone: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
  status: "خالص" | "عليه مديونية";
}

export async function fetchClientLedger(): Promise<ClientLedgerRow[]> {
  const { data, error } = await supabase.from("students").select("id, name, parent_phone, total_amount, paid_amount").order("name");
  if (error) throw error;
  return (data ?? []).map((s: any) => {
    const totalDebit = Number(s.total_amount ?? 0);
    const totalCredit = Number(s.paid_amount ?? 0);
    const balance = totalDebit - totalCredit;
    return {
      id: s.id,
      name: s.name,
      phone: s.parent_phone ?? "—",
      totalDebit,
      totalCredit,
      balance,
      status: balance <= 0 ? "خالص" : "عليه مديونية",
    };
  });
}

export async function fetchClientStatement(studentId: string): Promise<LedgerEntry[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("student_id", studentId)
    .order("date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    id: p.id,
    date: p.date,
    type: (p.type ?? "دائن") as "مدين" | "دائن",
    amount: Number(p.amount ?? 0),
    method: p.method ?? "—",
    notes: p.notes ?? "",
  }));
}

export function computeRunningBalance(entries: LedgerEntry[]): (LedgerEntry & { runningBalance: number })[] {
  let balance = 0;
  return entries.map((e) => {
    balance += e.type === "مدين" ? e.amount : -e.amount;
    return { ...e, runningBalance: balance };
  });
}

export async function addLedgerTransaction(input: {
  studentName: string;
  type: "مدين" | "دائن";
  amount: number;
  method: string;
  notes: string;
}) {
  const { data: student } = await supabase.from("students").select("id").eq("name", input.studentName).maybeSingle();
  if (!student) throw new Error("لم يتم العثور على عميل بهذا الاسم");
  const { error } = await supabase.from("payments").insert({
    student_id: student.id,
    type: input.type,
    amount: input.amount,
    method: input.method,
    notes: input.notes,
  });
  if (error) throw error;
}

// ---- Update / delete: every editable entity ----

export async function updateBus(id: string, input: { code: string; plate: string; model: string; busType?: string; capacity: number; odometer: number; status?: string; licenseExpiry?: string; insuranceExpiry?: string }) {
  const { error } = await supabase.from("buses").update({
    bus_code: input.code,
    plate_number: input.plate,
    model: input.model,
    bus_type: input.busType ?? "أتوبيس 50",
    capacity: input.capacity,
    odometer: input.odometer,
    status: input.status ?? "تعمل",
    license_expiry: input.licenseExpiry || null,
    insurance_expiry: input.insuranceExpiry || null,
  }).eq("id", id);
  if (error) throw error;
}
export async function deleteBus(id: string) {
  const { error } = await supabase.from("buses").delete().eq("id", id);
  if (error) throw error;
}

export async function updateDriver(id: string, input: { name: string; phone: string; license: string; licenseExpiry: string; baseSalary: number }) {
  const { error } = await supabase.from("drivers").update({
    name: input.name,
    phone: input.phone,
    license_type: input.license,
    license_expiry: input.licenseExpiry || null,
    base_salary: input.baseSalary || 0,
  }).eq("id", id);
  if (error) throw error;
}
export async function deleteDriver(id: string) {
  const { error } = await supabase.from("drivers").delete().eq("id", id);
  if (error) throw error;
}

export async function updateRoute(id: string, input: { name: string; pickupPoints: string; departure: string; arrival: string; busCode: string; seats: number }) {
  const { data: bus } = await supabase.from("buses").select("id").eq("bus_code", input.busCode).maybeSingle();
  const { error } = await supabase.from("routes").update({
    route_name: input.name,
    pickup_points: input.pickupPoints,
    departure_time: input.departure || null,
    return_time: input.arrival || null,
    bus_id: bus?.id ?? null,
    seats: input.seats,
  }).eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error(`الأتوبيس ${input.busCode} مخصص بالفعل لخط آخر`);
    throw error;
  }
}
export async function deleteRoute(id: string) {
  const { error } = await supabase.from("routes").delete().eq("id", id);
  if (error) throw error;
}

export async function updateStudent(id: string, input: { name: string; guardianPhone: string; routeName: string }) {
  const { data: route } = await supabase.from("routes").select("id").eq("route_name", input.routeName).maybeSingle();
  const { error } = await supabase.from("students").update({
    name: input.name,
    parent_phone: input.guardianPhone,
    route_id: route?.id ?? null,
  }).eq("id", id);
  if (error) throw error;
}
export async function deleteStudent(id: string) {
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteMaintenanceOrder(id: string) {
  await syncCustodyLink({ table: "maintenance_orders", id }, null);
  await supabase.from("treasury").delete().eq("maintenance_order_id", id);
  const { error } = await supabase.from("maintenance_orders").delete().eq("id", id);
  if (error) throw error;
}

export async function updateInventoryItem(id: string, input: { name: string; code: string; stock: number; minStock: number; unitPrice: number; unitType: UnitType }) {
  const { error } = await supabase.from("inventory").update({
    name: input.name,
    code: input.code,
    stock: input.stock,
    min_stock: input.minStock,
    unit_price: input.unitPrice,
    unit_type: input.unitType,
  }).eq("id", id);
  if (error) throw error;
}
export async function deleteInventoryItem(id: string) {
  const { error } = await supabase.from("inventory").delete().eq("id", id);
  if (error) throw error;
}

export async function updateFuelLog(id: string, input: FuelLogInput) {
  const payload = await resolveFuelPayload(input);
  const { data: prev } = await supabase.from("fuel_logs").select("supplier_invoice_id").eq("id", id).maybeSingle();
  const { error } = await supabase.from("fuel_logs").update(payload).eq("id", id);
  if (error) throw error;
  await syncBusOdometer(payload.bus_id, input.currentOdometer);
  await syncFuelSupplierInvoice(id, (prev?.supplier_invoice_id as string | null) ?? null, input);
}
export async function deleteFuelLog(id: string) {
  const { data: prev } = await supabase.from("fuel_logs").select("supplier_invoice_id").eq("id", id).maybeSingle();
  const { error } = await supabase.from("fuel_logs").delete().eq("id", id);
  if (error) throw error;
  if (prev?.supplier_invoice_id) await supabase.from("supplier_invoices").delete().eq("id", prev.supplier_invoice_id as string);
}

export async function updateTreasuryEntry(id: string, input: TreasuryInput) {
  const { error } = await supabase.from("treasury").update(treasuryRow(input)).eq("id", id);
  if (error) throw error;
}
export async function deleteTreasuryEntry(id: string) {
  const { error } = await supabase.from("treasury").delete().eq("id", id);
  if (error) throw error;
}

export async function updateExpense(id: string, input: ExpenseInput) {
  if (input.category === RENTED_EXPENSE_CATEGORY && !input.rentedVehicle) throw new Error("اختر السيارة المستأجرة");
  const { error } = await supabase.from("expenses").update(await expenseRow(input)).eq("id", id);
  if (error) throw error;
  await syncCustodyLink({ table: "expenses", id }, { date: input.date, amount: input.amount, category: input.category, description: input.description || input.category, payFrom: input.payFrom, notes: input.notes, ...(input.category === "مرتبات" && input.subjectKey ? { subjectKey: input.subjectKey } : {}) });
  await syncRentedAdvanceLink({ table: "expenses", id }, input.category === RENTED_EXPENSE_CATEGORY ? { date: input.date, amount: input.amount, vehicle: input.rentedVehicle ?? "", payFrom: input.payFrom, notes: input.description || input.notes } : null);
}
export async function deleteExpense(id: string) {
  await syncRentedAdvanceLink({ table: "expenses", id }, null);
  await syncCustodyLink({ table: "expenses", id }, null);
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

export async function updateLoan(id: string, input: LoanInput) {
  const { error } = await supabase.from("loans").update(loanSummary(input)).eq("id", id);
  if (error) throw error;
  await saveLoanInstallments(id, input.installments);
}
export async function deleteLoan(id: string) {
  const { error } = await supabase.from("loans").delete().eq("id", id);
  if (error) throw error;
}

export async function updatePayslip(id: string, input: { employeeName: string; role: string; baseSalary: number; overtime: number; advances: number; penalties: number }) {
  let { data: staff } = await supabase.from("staff").select("id").eq("name", input.employeeName).maybeSingle();
  if (!staff) {
    const { data: newStaff, error: staffError } = await supabase
      .from("staff")
      .insert({ name: input.employeeName, role: input.role, base_salary: input.baseSalary })
      .select("id")
      .single();
    if (staffError) throw staffError;
    staff = newStaff;
  } else {
    await supabase.from("staff").update({ role: input.role, base_salary: input.baseSalary }).eq("id", staff.id);
  }
  const { error } = await supabase.from("payslips").update({
    staff_id: staff!.id,
    overtime: input.overtime,
    advances: input.advances,
    penalties: input.penalties,
  }).eq("id", id);
  if (error) throw error;
}
export async function deletePayslip(id: string) {
  const { error } = await supabase.from("payslips").delete().eq("id", id);
  if (error) throw error;
}

export async function updateLedgerTransaction(id: string, input: { studentName: string; type: "مدين" | "دائن"; amount: number; method: string; notes: string }) {
  const { data: student } = await supabase.from("students").select("id").eq("name", input.studentName).maybeSingle();
  if (!student) throw new Error("لم يتم العثور على عميل بهذا الاسم");
  const { error } = await supabase.from("payments").update({
    student_id: student.id,
    type: input.type,
    amount: input.amount,
    method: input.method,
    notes: input.notes,
  }).eq("id", id);
  if (error) throw error;
}
export async function deleteLedgerTransaction(id: string) {
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) throw error;
}

// ---- Corporate clients & daily bus operations (dispatch) ----

export interface Client {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
}

export async function fetchClients(): Promise<Client[]> {
  const { data, error } = await supabase.from("clients").select("*").order("client_name");
  if (error) throw error;
  return (data ?? []).map((c: any) => ({ id: c.id, name: c.client_name, contactPerson: c.contact_person ?? "", phone: c.phone ?? "" }));
}

export async function addClient(input: { name: string; contactPerson: string; phone: string }) {
  const { error } = await supabase.from("clients").insert({ client_name: input.name, contact_person: input.contactPerson, phone: input.phone });
  if (error) throw error;
}
export async function updateClient(id: string, input: { name: string; contactPerson: string; phone: string }) {
  const { error } = await supabase.from("clients").update({ client_name: input.name, contact_person: input.contactPerson, phone: input.phone }).eq("id", id);
  if (error) throw error;
}
export async function deleteClient(id: string) {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

export interface DispatchShift {
  id: string;
  date: string;
  busId: string | null;
  bus: string;
  busPlate: string;
  busType: string;
  driverId: string | null;
  driver: string;
  clientId: string | null;
  client: string;
  route: string;
  busValue: number; // قيمة الأتوبيس — credited to the company account
  driverValue: number; // قيمة السواقة — credited to the driver's salary
  notes: string;
  missionId: string; // non-empty when posted automatically from a مأمورية
  paySource: string;
  attendanceStatus: string;
  overtime: number;
  advance: number;
  penalty: number;
  karta: number;
}

export const ATTENDANCE_STATUSES = ["حاضر", "غياب", "إجازة", "نصف يوم"] as const;

const SHIFT_SELECT = "*, buses(bus_code, bus_type, plate_number), drivers(name), clients(client_name)";

function mapShift(o: any): DispatchShift {
  return {
    id: o.id,
    date: o.op_date,
    busId: o.bus_id,
    bus: o.buses?.bus_code ?? o.ext_bus_label ?? "—",
    busPlate: o.buses?.plate_number ?? o.buses?.bus_code ?? o.ext_bus_label ?? "—",
    busType: o.buses?.bus_type ?? o.ext_vehicle_type ?? "—",
    driverId: o.driver_id,
    driver: o.drivers?.name ?? "—",
    clientId: o.client_id,
    client: o.clients?.client_name ?? "—",
    route: o.route ?? "",
    busValue: Number(o.bus_value ?? 0),
    driverValue: Number(o.driver_value ?? 0),
    notes: o.notes ?? "",
    missionId: o.mission_id ?? "",
    paySource: o.pay_source ?? "",
    attendanceStatus: o.attendance_status ?? "حاضر",
    overtime: Number(o.overtime_amount ?? 0),
    advance: Number(o.advance_amount ?? 0),
    penalty: Number(o.penalty_amount ?? 0),
    karta: Number(o.karta_amount ?? 0),
  };
}

export async function fetchDispatchShifts(period: Period): Promise<DispatchShift[]> {
  const { start, end } = periodBounds(period);
  const { data, error } = await pageAll((f, t) =>
    supabase.from("dispatch_shifts").select(SHIFT_SELECT).gte("op_date", start).lt("op_date", end).order("op_date", { ascending: false }).order("id").range(f, t),
  );
  if (error) throw error;
  return data.map(mapShift);
}

export async function fetchDispatchShiftsByDate(date: string): Promise<DispatchShift[]> {
  const { data, error } = await supabase
    .from("dispatch_shifts")
    .select(SHIFT_SELECT)
    .eq("op_date", date)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapShift);
}

export interface DispatchShiftInput {
  date: string;
  busCode: string;
  driverName: string;
  clientName: string;
  route: string;
  busValue: number;
  driverValue: number;
  notes: string;
  paySource?: string;
  attendanceStatus?: string;
  overtime?: number;
  advance?: number;
  penalty?: number;
  karta?: number;
}

async function resolveShiftPayloads(inputs: DispatchShiftInput[]) {
  const [{ data: buses }, { data: drivers }, { data: clients }] = await Promise.all([
    supabase.from("buses").select("id, bus_code"),
    supabase.from("drivers").select("id, name"),
    supabase.from("clients").select("id, client_name"),
  ]);
  const busMap = new Map((buses ?? []).map((b: any) => [b.bus_code, b.id]));
  const driverMap = new Map((drivers ?? []).map((d: any) => [d.name, d.id]));
  const clientMap = new Map((clients ?? []).map((c: any) => [c.client_name, c.id]));
  return inputs.map((i) => ({
    op_date: i.date,
    bus_id: busMap.get(i.busCode) ?? null,
    driver_id: driverMap.get(i.driverName) ?? null,
    client_id: clientMap.get(i.clientName) ?? null,
    route: i.route || null,
    bus_value: i.busValue,
    driver_value: i.driverValue,
    notes: i.notes,
    pay_source: i.paySource || null,
    attendance_status: i.attendanceStatus ?? "حاضر",
    overtime_amount: i.overtime ?? 0,
    advance_amount: i.advance ?? 0,
    penalty_amount: i.penalty ?? 0,
    karta_amount: i.karta ?? 0,
  }));
}

/** advance + karta paid out of pocket → mirrored in the custody ledger when the source is «عهدة الخزينة». */
async function syncShiftCustody(id: string, i: DispatchShiftInput) {
  const amount = (i.advance ?? 0) + (i.karta ?? 0);
  await syncCustodyLink(
    { table: "dispatch_shifts", id },
    { date: i.date, amount, category: "سلفة / كرتة وردية", description: `سلفة وكرتة وردية ${i.driverName} — ${i.busCode}`, payFrom: i.paySource ?? "" },
  );
}

export async function addDispatchShifts(inputs: DispatchShiftInput[]) {
  if (inputs.length === 0) return;
  const payload = await resolveShiftPayloads(inputs);
  const { data, error } = await supabase.from("dispatch_shifts").insert(payload).select("id");
  if (error) throw error;
  for (let k = 0; k < inputs.length; k++) {
    const row = data?.[k];
    const input = inputs[k];
    if (row && input) await syncShiftCustody(row.id as string, input);
  }
}
export async function updateDispatchShift(id: string, input: DispatchShiftInput) {
  const payload = (await resolveShiftPayloads([input]))[0];
  if (!payload) throw new Error("بيانات الوردية غير صالحة");
  const { error } = await supabase.from("dispatch_shifts").update(payload).eq("id", id);
  if (error) throw error;
  await syncShiftCustody(id, input);
}
export async function deleteDispatchShift(id: string) {
  await syncCustodyLink({ table: "dispatch_shifts", id }, null);
  const { error } = await supabase.from("dispatch_shifts").delete().eq("id", id);
  if (error) throw error;
}

export interface DailyReport {
  shiftCount: number;
  totalCompanyRevenue: number;
  totalDriverEarnings: number;
  netAfterDrivers: number;
  byCompany: { client: string; shifts: number; total: number }[];
  byDriver: { driver: string; shifts: number; total: number }[];
}

export function computeDailyReport(shifts: { client: string; driver: string; busValue: number; driverValue: number }[]): DailyReport {
  const group = (key: "client" | "driver", value: "busValue" | "driverValue") => {
    const m = new Map<string, { shifts: number; total: number }>();
    for (const s of shifts) {
      const cur = m.get(s[key]) ?? { shifts: 0, total: 0 };
      cur.shifts += 1;
      cur.total += s[value];
      m.set(s[key], cur);
    }
    return [...m.entries()].map(([name, v]) => ({ name, ...v }));
  };
  const totalCompanyRevenue = shifts.reduce((a, s) => a + s.busValue, 0);
  const totalDriverEarnings = shifts.reduce((a, s) => a + s.driverValue, 0);
  return {
    shiftCount: shifts.length,
    totalCompanyRevenue,
    totalDriverEarnings,
    netAfterDrivers: totalCompanyRevenue - totalDriverEarnings,
    byCompany: group("client", "busValue").map((g) => ({ client: g.name, shifts: g.shifts, total: g.total })),
    byDriver: group("driver", "driverValue").map((g) => ({ driver: g.name, shifts: g.shifts, total: g.total })),
  };
}

// ---- Client invoicing (accounts receivable per corporate client) ----

export interface ClientInvoiceRow {
  date: string;
  busCode: string;
  busType: string;
  driver: string;
  route: string;
  amount: number;
}

export async function fetchClientInvoiceRows(clientName: string, period: Period): Promise<ClientInvoiceRow[]> {
  const { start, end } = periodBounds(period);
  const shifts = await fetchDispatchShifts(period);
  return shifts
    .filter((o) => o.client === clientName)
    .map((o) => ({ date: o.date, busCode: o.bus, busType: o.busType, driver: o.driver, route: o.route, amount: o.busValue }));
}

export function computeClientInvoiceSummary(rows: ClientInvoiceRow[]) {
  return {
    totalShifts: rows.length,
    totalBusesDeployed: new Set(rows.map((r) => r.busCode)).size,
    totalDue: rows.reduce((sum, r) => sum + r.amount, 0),
  };
}

// ---- Client statement: ledger postings + month-to-month carry-forward ----

export interface ClientLedgerPosting {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
}

/** Balance still owed by the client = dues - credits. Anything unpaid rolls into the next month's opening balance. */
export function computeClientMonthBalance(opening: number, monthDues: number, postings: { debit: number; credit: number }[]) {
  const debits = postings.reduce((s, p) => s + p.debit, 0);
  const credits = postings.reduce((s, p) => s + p.credit, 0);
  return { opening, monthDues, debits, credits, closing: opening + monthDues + debits - credits };
}

export async function fetchClientStatementExtras(clientName: string, period: Period): Promise<{ opening: number; postings: ClientLedgerPosting[] }> {
  const { start, end } = periodBounds(period);
  const { data: client } = await supabase.from("clients").select("id").eq("client_name", clientName).maybeSingle();
  if (!client) return { opening: 0, postings: [] };
  const [{ data: priorShifts, error: e1 }, { data: entries, error: e2 }] = await Promise.all([
    supabase.from("dispatch_shifts").select("bus_value").eq("client_id", client.id).lt("op_date", start),
    supabase.from("client_ledger_entries").select("*").eq("client_id", client.id).order("entry_date"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const prior = (entries ?? []).filter((e: any) => e.entry_date < start);
  const opening =
    (priorShifts ?? []).reduce((s: number, r: any) => s + Number(r.bus_value ?? 0), 0) +
    prior.reduce((s: number, e: any) => s + Number(e.debit ?? 0) - Number(e.credit ?? 0), 0);
  const postings = (entries ?? [])
    .filter((e: any) => e.entry_date >= start && e.entry_date < end)
    .map((e: any) => ({ id: e.id, date: e.entry_date, description: e.description, debit: Number(e.debit ?? 0), credit: Number(e.credit ?? 0) }));
  return { opening, postings };
}

// ---- Executive P&L ----

export function computeMonthlyPL(
  operations: { busValue: number }[],
  generalExpenseTotal: number,
  netDriverPayrollTotal: number,
) {
  const totalRevenue = operations.reduce((sum, o) => sum + o.busValue, 0);
  const totalExpenses = generalExpenseTotal + netDriverPayrollTotal;
  return { totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses };
}

// ---- Employees (non-driver staff: mechanics, warehouse, admin) ----

export const EMPLOYEE_JOB_TITLES = [
  "محاسب",
  "مدير مكتب",
  "مدير ورشة",
  "صنيعي ورشة",
  "عامل",
  "مدير تشغيل",
  "رئيس مجلس إدارة",
  "سكرتير",
  "مشرفين",
] as const;

export interface Employee {
  id: string;
  name: string;
  phone: string;
  jobTitle: string;
  baseSalary: number;
  isActive: boolean;
}

export async function fetchEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase.from("employees").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map((e: any) => ({
    id: e.id,
    name: e.name,
    phone: e.phone ?? "",
    jobTitle: e.job_title ?? "",
    baseSalary: Number(e.base_salary ?? 0),
    isActive: e.is_active !== false,
  }));
}
type EmployeeInput = { name: string; phone: string; jobTitle: string; baseSalary: number; isActive: boolean };
export async function addEmployee(input: EmployeeInput) {
  const { error } = await supabase.from("employees").insert({ name: input.name, phone: input.phone, job_title: input.jobTitle, base_salary: input.baseSalary, is_active: input.isActive });
  if (error) throw error;
}
export async function updateEmployee(id: string, input: EmployeeInput) {
  const { error } = await supabase.from("employees").update({ name: input.name, phone: input.phone, job_title: input.jobTitle, base_salary: input.baseSalary, is_active: input.isActive }).eq("id", id);
  if (error) throw error;
}
export async function deleteEmployee(id: string) {
  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) throw error;
}

export interface EmployeePayrollRow {
  employee: string;
  jobTitle: string;
  baseSalary: number;
  totalAllowances: number;
  totalAdvances: number;
  totalPenalties: number;
  netSalary: number;
}

export function computeEmployeePayroll(
  employees: { name: string; jobTitle: string; baseSalary: number; isActive: boolean }[],
  rows: { employeeName: string; allowance: number; advance: number; penalty: number }[],
): EmployeePayrollRow[] {
  return employees
    .filter((e) => e.isActive)
    .map((e) => {
      const mine = rows.filter((r) => r.employeeName === e.name);
      const totalAllowances = mine.reduce((sum, r) => sum + r.allowance, 0);
      const totalAdvances = mine.reduce((sum, r) => sum + r.advance, 0);
      const totalPenalties = mine.reduce((sum, r) => sum + r.penalty, 0);
      return {
        employee: e.name,
        jobTitle: e.jobTitle,
        baseSalary: e.baseSalary,
        totalAllowances,
        totalAdvances,
        totalPenalties,
        netSalary: e.baseSalary + totalAllowances - (totalAdvances + totalPenalties),
      };
    });
}

export async function fetchEmployeePayroll(period: Period): Promise<EmployeePayrollRow[]> {
  const { start, end } = periodBounds(period);
  const [employees, custodyAdv, { data, error }] = await Promise.all([
    fetchEmployees(),
    fetchCustodyAdvances(period),
    supabase
      .from("employee_attendance")
      .select("allowance, advance, penalty, employees(name)")
      .gte("date", start)
      .lt("date", end),
  ]);
  if (error) throw error;
  const monthsCount = periodMonths(period).length;
  return computeEmployeePayroll(
    employees.map((e) => ({ ...e, baseSalary: e.baseSalary * monthsCount })),
    (data ?? []).map((r: any) => ({
      employeeName: r.employees?.name ?? "",
      allowance: Number(r.allowance ?? 0),
      advance: Number(r.advance ?? 0),
      penalty: Number(r.penalty ?? 0),
    })).concat(custodyAdv.filter((c) => c.type === "employee").map((c) => ({ employeeName: employees.find((e) => e.id === c.id)?.name ?? c.name, allowance: 0, advance: c.amount, penalty: 0 }))),
  );
}

export interface EmployeeAttendanceRow {
  id: string;
  employeeId: string;
  employee: string;
  date: string;
  status: string;
  notes: string;
  allowance: number;
  advance: number;
  penalty: number;
}

export async function fetchEmployeeAttendance(): Promise<EmployeeAttendanceRow[]> {
  const { data, error } = await supabase
    .from("employee_attendance")
    .select("*, employees(name)")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((a: any) => ({
    id: a.id,
    employeeId: a.employee_id,
    employee: a.employees?.name ?? "—",
    date: a.date,
    status: a.status ?? "حاضر",
    notes: a.notes ?? "",
    allowance: Number(a.allowance ?? 0),
    advance: Number(a.advance ?? 0),
    penalty: Number(a.penalty ?? 0),
  }));
}

export async function upsertEmployeeAttendance(input: { id?: string | undefined; employeeName: string; date: string; status: string; notes: string; allowance: number; advance: number; penalty: number }) {
  const { data: employee } = await supabase.from("employees").select("id").eq("name", input.employeeName).maybeSingle();
  if (!employee) throw new Error("لم يتم العثور على موظف بهذا الاسم");
  const payload = { employee_id: employee.id, date: input.date, status: input.status, notes: input.notes, allowance: input.allowance, advance: input.advance, penalty: input.penalty };
  if (input.id) {
    const { error } = await supabase.from("employee_attendance").update(payload).eq("id", input.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("employee_attendance").insert(payload);
    if (error) throw error;
  }
}
export async function deleteEmployeeAttendance(id: string) {
  const { error } = await supabase.from("employee_attendance").delete().eq("id", id);
  if (error) throw error;
}

// ---- Client routes (registered under each corporate client, replaces free-typing) ----

export interface ClientRoute {
  id: string;
  clientId: string;
  routeName: string;
  vehicleCapacity: number;
}

export async function fetchClientRoutes(clientId: string): Promise<ClientRoute[]> {
  const { data, error } = await supabase.from("client_routes").select("*").eq("client_id", clientId).order("route_name");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, clientId: r.client_id, routeName: r.route_name, vehicleCapacity: Number(r.vehicle_capacity ?? 0) }));
}
export async function fetchAllClientRoutes(): Promise<ClientRoute[]> {
  const { data, error } = await supabase.from("client_routes").select("*").order("route_name");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, clientId: r.client_id, routeName: r.route_name, vehicleCapacity: Number(r.vehicle_capacity ?? 0) }));
}
export async function addClientRoute(input: { clientId: string; routeName: string; vehicleCapacity: number }) {
  const { error } = await supabase.from("client_routes").insert({ client_id: input.clientId, route_name: input.routeName, vehicle_capacity: input.vehicleCapacity });
  if (error) throw error;
}
export async function updateClientRoute(id: string, input: { routeName: string; vehicleCapacity: number }) {
  const { error } = await supabase.from("client_routes").update({ route_name: input.routeName, vehicle_capacity: input.vehicleCapacity }).eq("id", id);
  if (error) throw error;
}
export async function deleteClientRoute(id: string) {
  const { error } = await supabase.from("client_routes").delete().eq("id", id);
  if (error) throw error;
}

// ---- Suppliers & inventory receiving ----

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  balanceDue: number;
  dueDate: string;
  alertDate: string;
}

export async function fetchSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase.from("suppliers").select("*").order("supplier_name");
  if (error) throw error;
  return (data ?? []).map((s: any) => ({
    id: s.id,
    name: s.supplier_name,
    phone: s.phone ?? "",
    balanceDue: Number(s.balance_due ?? 0),
    dueDate: s.due_date ?? "",
    alertDate: s.alert_date ?? "",
  }));
}

export interface SupplierSummary extends Supplier {
  totalPurchases: number; // إجمالي المسحوبات
  totalPayments: number; // إجمالي الدفعات
}

export async function fetchSupplierSummaries(): Promise<SupplierSummary[]> {
  const [suppliers, { data: purchases, error: e1 }, { data: invoices, error: e2 }, { data: payments, error: e3 }] = await Promise.all([
    fetchSuppliers(),
    supabase.from("inventory_transactions").select("supplier_id, total_cost").eq("type", "IN"),
    supabase.from("supplier_invoices").select("supplier_id, total_amount"),
    supabase.from("supplier_payments").select("supplier_id, amount"),
  ]);
  if (e1 || e2 || e3) throw e1 ?? e2 ?? e3;
  const sum = (rows: any[] | null, key: string, field: string) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) if (r[key]) m.set(r[key], (m.get(r[key]) ?? 0) + Number(r[field] ?? 0));
    return m;
  };
  const pur = sum(purchases, "supplier_id", "total_cost");
  const inv = sum(invoices, "supplier_id", "total_amount");
  const pay = sum(payments, "supplier_id", "amount");
  return suppliers.map((s) => ({
    ...s,
    totalPurchases: (pur.get(s.id) ?? 0) + (inv.get(s.id) ?? 0),
    totalPayments: pay.get(s.id) ?? 0,
  }));
}

interface SupplierInput {
  name: string;
  phone: string;
  dueDate: string;
  alertDate: string;
}
/** Default alert date = 2 days before the due date. */
export function defaultAlertDate(dueDate: string): string {
  if (!dueDate) return "";
  const d = new Date(`${dueDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 2);
  return d.toISOString().slice(0, 10);
}
function supplierPayload(input: SupplierInput) {
  return {
    supplier_name: input.name,
    phone: input.phone,
    due_date: input.dueDate || null,
    alert_date: input.alertDate || defaultAlertDate(input.dueDate) || null,
  };
}
export async function addSupplier(input: SupplierInput): Promise<string> {
  const { data, error } = await supabase.from("suppliers").insert(supplierPayload(input)).select("id").single();
  if (error) throw error;
  return data.id as string;
}
export async function updateSupplier(id: string, input: SupplierInput) {
  const { error } = await supabase.from("suppliers").update(supplierPayload(input)).eq("id", id);
  if (error) throw error;
}
export async function deleteSupplier(id: string) {
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw new Error(dbErrorMessage(error, "تعذر حذف المورد"));
}

export async function addSupplierPayment(input: { supplierId: string; amount: number; method: string; notes: string; date?: string }): Promise<string> {
  const { data, error } = await supabase
    .from("supplier_payments")
    .insert({
      supplier_id: input.supplierId,
      amount: input.amount,
      method: input.method,
      notes: input.notes,
      ...(input.date ? { date: input.date } : {}),
    })
    .select("id")
    .single();
  if (error) throw error;
  const { data: sup } = await supabase.from("suppliers").select("supplier_name").eq("id", input.supplierId).maybeSingle();
  await syncCustodyLink(
    { table: "supplier_payments", id: data.id as string },
    { date: input.date || new Date().toISOString().slice(0, 10), amount: input.amount, category: CUSTODY_SUPPLIERS_CATEGORY, description: `سداد للمورد ${sup?.supplier_name ?? ""}`.trim(), payFrom: input.method, notes: input.notes },
  );
  return data.id as string;
}

/**
 * Immediate payment that accompanies a purchase / invoice: creates, updates or removes the payment on the
 * supplier's statement (the DB trigger moves balance_due) and mirrors it in the custody ledger when relevant.
 * Returns the payment id to store on the invoice / purchase, or null when nothing is paid.
 */
async function syncImmediatePayment(existingId: string | null, p: { supplierId: string; amount: number; source: string; date: string; notes: string }): Promise<string | null> {
  if (!(p.amount > 0) || !p.source) {
    if (existingId) await deleteSupplierPayment(existingId);
    return null;
  }
  if (!existingId) return addSupplierPayment({ supplierId: p.supplierId, amount: p.amount, method: p.source, notes: p.notes, date: p.date });
  const { error } = await supabase.from("supplier_payments").update({ supplier_id: p.supplierId, amount: p.amount, date: p.date, method: p.source, notes: p.notes }).eq("id", existingId);
  if (error) throw error;
  const { data: sup } = await supabase.from("suppliers").select("supplier_name").eq("id", p.supplierId).maybeSingle();
  await syncCustodyLink(
    { table: "supplier_payments", id: existingId },
    { date: p.date, amount: p.amount, category: CUSTODY_SUPPLIERS_CATEGORY, description: `سداد للمورد ${sup?.supplier_name ?? ""}`.trim(), payFrom: p.source, notes: p.notes },
  );
  return existingId;
}

export async function deleteSupplierPayment(id: string) {
  await syncCustodyLink({ table: "supplier_payments", id }, null);
  // a payment that came from the custody ledger takes its custody row with it
  await supabase.from("custody_entries").delete().eq("supplier_payment_id", id);
  const { error } = await supabase.from("supplier_payments").delete().eq("id", id);
  if (error) throw error;
}

// ---- Supplier invoices (with image attachment in private storage) ----

const INVOICE_BUCKET = "supplier-invoices";

export interface SupplierInvoiceInput {
  supplierId: string;
  invoiceDate: string;
  invoiceRef: string;
  totalAmount: number;
  itemsDetails: string;
  /** مدفوع فورًا (جزئيًا أو كليًا) ومن أي مصدر */
  paidAmount?: number;
  paySource?: string;
  file?: File | null;
}

async function uploadInvoiceFile(supplierId: string, file: File): Promise<string> {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `${supplierId}/${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;
  const { error } = await supabase.storage.from(INVOICE_BUCKET).upload(path, file, file.type ? { contentType: file.type } : {});
  if (error) throw error;
  return path;
}

export async function addSupplierInvoice(input: SupplierInvoiceInput) {
  const paid = input.paidAmount ?? 0;
  if (paid > 0 && !input.paySource) throw new Error("اختر طريقة الدفع / مصدر التمويل للمبلغ المدفوع");
  const attachment = input.file ? await uploadInvoiceFile(input.supplierId, input.file) : null;
  const { data, error } = await supabase
    .from("supplier_invoices")
    .insert({
      supplier_id: input.supplierId,
      invoice_date: input.invoiceDate,
      invoice_ref: input.invoiceRef,
      total_amount: input.totalAmount,
      items_details: input.itemsDetails,
      attachment_path: attachment,
      pay_source: input.paySource || null,
      paid_amount: paid,
    })
    .select("id")
    .single();
  if (error) {
    if (attachment) await supabase.storage.from(INVOICE_BUCKET).remove([attachment]);
    throw error;
  }
  const paymentId = await syncImmediatePayment(null, { supplierId: input.supplierId, amount: paid, source: input.paySource ?? "", date: input.invoiceDate, notes: `دفعة فاتورة ${input.invoiceRef}`.trim() });
  if (paymentId) await supabase.from("supplier_invoices").update({ payment_id: paymentId }).eq("id", data.id);
}

export async function updateSupplierInvoice(id: string, input: SupplierInvoiceInput, previousPath: string | null) {
  const paid = input.paidAmount ?? 0;
  if (paid > 0 && !input.paySource) throw new Error("اختر طريقة الدفع / مصدر التمويل للمبلغ المدفوع");
  const { data: prev } = await supabase.from("supplier_invoices").select("payment_id").eq("id", id).maybeSingle();
  const attachment = input.file ? await uploadInvoiceFile(input.supplierId, input.file) : previousPath;
  const paymentId = await syncImmediatePayment((prev?.payment_id as string | null) ?? null, { supplierId: input.supplierId, amount: paid, source: input.paySource ?? "", date: input.invoiceDate, notes: `دفعة فاتورة ${input.invoiceRef}`.trim() });
  const { error } = await supabase
    .from("supplier_invoices")
    .update({
      invoice_date: input.invoiceDate,
      invoice_ref: input.invoiceRef,
      total_amount: input.totalAmount,
      items_details: input.itemsDetails,
      attachment_path: attachment,
      pay_source: input.paySource || null,
      paid_amount: paid,
      payment_id: paymentId,
    })
    .eq("id", id);
  if (error) throw error;
  if (input.file && previousPath) await supabase.storage.from(INVOICE_BUCKET).remove([previousPath]);
}

export async function deleteSupplierInvoice(id: string, attachmentPath: string | null) {
  const { data: prev } = await supabase.from("supplier_invoices").select("payment_id").eq("id", id).maybeSingle();
  const { error } = await supabase.from("supplier_invoices").delete().eq("id", id);
  if (error) throw error;
  if (prev?.payment_id) await deleteSupplierPayment(prev.payment_id as string);
  if (attachmentPath) await supabase.storage.from(INVOICE_BUCKET).remove([attachmentPath]);
}

export async function getInvoiceAttachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(INVOICE_BUCKET).createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export interface SupplierLedgerEntry {
  id: string;
  source: "inventory" | "invoice" | "payment" | "opening";
  date: string;
  kind: "شراء" | "فاتورة" | "سداد" | "رصيد سابق";
  reference: string;
  description: string;
  withdrawals: number; // المسحوبات (الصادر)
  payments: number; // الدفعات المسددة
  attachmentPath: string | null;
  // raw invoice fields, for editing
  invoiceRef?: string;
  itemsDetails?: string;
  invoicePaid?: number;
  invoiceSource?: string;
}

export async function fetchSupplierLedger(supplierId: string): Promise<SupplierLedgerEntry[]> {
  const [{ data: purchases }, { data: invoices }, { data: payments }] = await Promise.all([
    supabase.from("inventory_transactions").select("*, inventory(name)").eq("supplier_id", supplierId).eq("type", "IN"),
    supabase.from("supplier_invoices").select("*").eq("supplier_id", supplierId),
    supabase.from("supplier_payments").select("*").eq("supplier_id", supplierId),
  ]);
  const entries: SupplierLedgerEntry[] = [];
  for (const p of purchases ?? []) {
    entries.push({
      id: p.id,
      source: "inventory",
      date: (p.tx_date as string | null) ?? (p.created_at as string).slice(0, 10),
      kind: "شراء",
      reference: p.invoice_ref || "توريد مخزون",
      description: `${p.inventory?.name ?? "صنف"} × ${p.quantity}`,
      withdrawals: Number(p.total_cost ?? 0),
      payments: 0,
      attachmentPath: p.attachment_path ?? null,
    });
  }
  for (const i of invoices ?? []) {
    entries.push({
      id: i.id,
      source: "invoice",
      date: i.invoice_date,
      kind: "فاتورة",
      reference: i.invoice_ref,
      description: i.items_details || "",
      withdrawals: Number(i.total_amount ?? 0),
      payments: 0,
      attachmentPath: i.attachment_path ?? null,
      invoiceRef: i.invoice_ref,
      itemsDetails: i.items_details ?? "",
      invoicePaid: Number(i.paid_amount ?? 0),
      invoiceSource: i.pay_source ?? "",
    });
  }
  for (const pay of payments ?? []) {
    entries.push({
      id: pay.id,
      source: "payment",
      date: pay.date,
      kind: "سداد",
      reference: pay.method || "دفعة",
      description: pay.notes || "",
      withdrawals: 0,
      payments: Number(pay.amount ?? 0),
      attachmentPath: null,
    });
  }
  return entries;
}

/** Orders entries oldest-first and attaches a running balance (المتبقي) to each. */
/** Restrict a supplier ledger to a date range; earlier activity is carried in as one opening-balance row. */
export function applySupplierRange(entries: SupplierLedgerEntry[], range: DateRange): SupplierLedgerEntry[] {
  const inside = entries.filter((e) => inDateRange(e.date, range));
  if (!range.from) return inside;
  const opening = entries.filter((e) => e.date < range.from).reduce((a, e) => a + e.withdrawals - e.payments, 0);
  if (!opening) return inside;
  const row: SupplierLedgerEntry = {
    id: "opening", source: "opening", date: range.from, kind: "رصيد سابق", reference: "", description: "رصيد مرحَّل من قبل الفترة",
    withdrawals: opening > 0 ? opening : 0, payments: opening < 0 ? -opening : 0, attachmentPath: null,
  };
  return [row, ...inside];
}

export function computeSupplierStatement<T extends { date: string; withdrawals: number; payments: number }>(entries: T[]) {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let balance = 0;
  const rows = sorted.map((e) => {
    balance += e.withdrawals - e.payments;
    return { ...e, balance };
  });
  return {
    rows,
    totalWithdrawals: sorted.reduce((a, e) => a + e.withdrawals, 0),
    totalPayments: sorted.reduce((a, e) => a + e.payments, 0),
    remaining: balance,
  };
}

export interface InventoryPurchaseInput {
  itemId: string; // existing item id, or "" to create a new one
  newItemName: string;
  newItemCode: string;
  unitType: UnitType;
  supplierId: string; // existing supplier id, or "" when newSupplierName is given
  newSupplierName: string;
  date: string;
  quantity: number;
  unitPrice: number;
  invoiceRef: string;
  /** مدفوع فورًا (جزئيًا أو كليًا) ومن أي مصدر، والباقي يبقى مستحقًا للمورد */
  paidAmount?: number;
  paySource?: string;
  file?: File | null;
}

export interface InventoryPurchase {
  id: string;
  date: string;
  itemId: string;
  itemName: string;
  unitType: UnitType;
  supplierId: string;
  supplierName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  invoiceRef: string;
  attachmentPath: string | null;
  paidAmount: number;
  paySource: string;
}

export const purchaseTotal = (quantity: number, unitPrice: number) => Math.round(quantity * unitPrice * 100) / 100;

async function resolvePurchaseRefs(input: InventoryPurchaseInput): Promise<{ itemId: string; supplierId: string }> {
  let supplierId = input.supplierId;
  if (!supplierId) {
    const name = input.newSupplierName.trim();
    if (!name) throw new Error("اختر المورد أو أدخل اسم مورد جديد");
    const { data: existing } = await supabase.from("suppliers").select("id").eq("supplier_name", name).maybeSingle();
    if (existing) supplierId = existing.id;
    else {
      const { data, error } = await supabase.from("suppliers").insert({ supplier_name: name }).select("id").single();
      if (error) throw error;
      supplierId = data.id;
    }
  }
  let itemId = input.itemId;
  if (!itemId) {
    const name = input.newItemName.trim();
    if (!name) throw new Error("اختر الصنف أو أدخل اسم صنف جديد");
    const { data: existing } = await supabase.from("inventory").select("id").eq("name", name).maybeSingle();
    if (existing) itemId = existing.id;
    else {
      const { data, error } = await supabase
        .from("inventory")
        .insert({ name, code: input.newItemCode.trim() || `SKU-${Date.now().toString().slice(-6)}`, stock: 0, min_stock: 0, unit_price: input.unitPrice, unit_type: input.unitType })
        .select("id")
        .single();
      if (error) throw error;
      itemId = data.id;
    }
  }
  return { itemId, supplierId };
}

/** Stock inward from a supplier. The database trigger raises stock and the supplier's balance_due. */
export async function receiveInventoryStock(input: InventoryPurchaseInput) {
  if (!(input.quantity > 0)) throw new Error("أدخل كمية صحيحة");
  const paid = input.paidAmount ?? 0;
  if (paid > 0 && !input.paySource) throw new Error("اختر طريقة الدفع / مصدر التمويل للمبلغ المدفوع");
  const { itemId, supplierId } = await resolvePurchaseRefs(input);
  const attachment = input.file ? await uploadInvoiceFile(supplierId, input.file) : null;
  const { data, error } = await supabase
    .from("inventory_transactions")
    .insert({
      inventory_id: itemId,
      type: "IN",
      quantity: input.quantity,
      unit_price: input.unitPrice,
      total_cost: purchaseTotal(input.quantity, input.unitPrice),
      supplier_id: supplierId,
      tx_date: input.date,
      invoice_ref: input.invoiceRef.trim() || null,
      attachment_path: attachment,
      pay_source: input.paySource || null,
      paid_amount: paid,
    })
    .select("id")
    .single();
  if (error) {
    if (attachment) await supabase.storage.from(INVOICE_BUCKET).remove([attachment]);
    throw error;
  }
  const paymentId = await syncImmediatePayment(null, { supplierId, amount: paid, source: input.paySource ?? "", date: input.date, notes: `دفعة إذن توريد ${input.invoiceRef}`.trim() });
  if (paymentId) await supabase.from("inventory_transactions").update({ payment_id: paymentId }).eq("id", data.id);
  await supabase.from("inventory").update({ unit_price: input.unitPrice }).eq("id", itemId);
}

/** Would reverting this purchase push the item's stock below zero? */
async function assertPurchaseRevertible(id: string, newItemId: string | null, newQty: number) {
  const { data: tx } = await supabase.from("inventory_transactions").select("inventory_id, quantity").eq("id", id).single();
  if (!tx) throw new Error("التوريد غير موجود");
  const { data: inv } = await supabase.from("inventory").select("stock, name").eq("id", tx.inventory_id).single();
  const stockAfter = Number(inv?.stock ?? 0) - Number(tx.quantity) + (newItemId === tx.inventory_id ? newQty : 0);
  if (stockAfter < 0) throw new Error(`لا يمكن التعديل: الكمية الموردة استُهلكت جزئيًا وسيصبح رصيد ${inv?.name ?? "الصنف"} سالبًا`);
}

export async function updateInventoryPurchase(id: string, input: InventoryPurchaseInput, previousPath: string | null) {
  if (!(input.quantity > 0)) throw new Error("أدخل كمية صحيحة");
  const paid = input.paidAmount ?? 0;
  if (paid > 0 && !input.paySource) throw new Error("اختر طريقة الدفع / مصدر التمويل للمبلغ المدفوع");
  const { itemId, supplierId } = await resolvePurchaseRefs(input);
  await assertPurchaseRevertible(id, itemId, input.quantity);
  const { data: prev } = await supabase.from("inventory_transactions").select("payment_id").eq("id", id).maybeSingle();
  const paymentId = await syncImmediatePayment((prev?.payment_id as string | null) ?? null, { supplierId, amount: paid, source: input.paySource ?? "", date: input.date, notes: `دفعة إذن توريد ${input.invoiceRef}`.trim() });
  const attachment = input.file ? await uploadInvoiceFile(supplierId, input.file) : previousPath;
  const { error } = await supabase
    .from("inventory_transactions")
    .update({
      inventory_id: itemId,
      quantity: input.quantity,
      unit_price: input.unitPrice,
      total_cost: purchaseTotal(input.quantity, input.unitPrice),
      supplier_id: supplierId,
      tx_date: input.date,
      invoice_ref: input.invoiceRef.trim() || null,
      attachment_path: attachment,
      pay_source: input.paySource || null,
      paid_amount: paid,
      payment_id: paymentId,
    })
    .eq("id", id);
  if (error) throw error;
  if (input.file && previousPath) await supabase.storage.from(INVOICE_BUCKET).remove([previousPath]);
}

export async function deleteInventoryPurchase(id: string, attachmentPath: string | null) {
  await assertPurchaseRevertible(id, null, 0);
  const { data: prev } = await supabase.from("inventory_transactions").select("payment_id").eq("id", id).maybeSingle();
  const { error } = await supabase.from("inventory_transactions").delete().eq("id", id);
  if (error) throw error;
  if (prev?.payment_id) await deleteSupplierPayment(prev.payment_id as string);
  if (attachmentPath) await supabase.storage.from(INVOICE_BUCKET).remove([attachmentPath]);
}

export async function fetchInventoryPurchases(): Promise<InventoryPurchase[]> {
  const { data, error } = await supabase
    .from("inventory_transactions")
    .select("*, inventory(name, unit_type), suppliers(supplier_name)")
    .eq("type", "IN")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t: any) => ({
    id: t.id,
    date: t.tx_date ?? String(t.created_at).slice(0, 10),
    itemId: t.inventory_id,
    itemName: t.inventory?.name ?? "صنف",
    unitType: (t.inventory?.unit_type ?? "بالقطعة") as UnitType,
    supplierId: t.supplier_id ?? "",
    supplierName: t.suppliers?.supplier_name ?? "—",
    quantity: Number(t.quantity),
    unitPrice: Number(t.unit_price ?? 0),
    total: Number(t.total_cost ?? 0),
    invoiceRef: t.invoice_ref ?? "",
    attachmentPath: t.attachment_path ?? null,
    paidAmount: Number(t.paid_amount ?? 0),
    paySource: t.pay_source ?? "",
  }));
}

// ---- Item movement statement (كشف حركة الصنف) ----

export interface ItemMovement {
  id: string;
  kind: "IN" | "OUT";
  /** yyyy-mm-dd */
  date: string;
  /** ISO timestamp used for ordering and the time-of-day column */
  at: string;
  party: string;
  quantity: number;
  unitPrice: number;
}

export interface ItemLedgerRow extends ItemMovement {
  qtyIn: number;
  qtyOut: number;
  value: number;
  balance: number;
}

export interface ItemLedger {
  openingBalance: number;
  rows: ItemLedgerRow[];
  totalIn: number;
  totalOut: number;
  totalInValue: number;
  totalOutValue: number;
  currentStock: number;
  stockValue: number;
}

export async function fetchItemMovements(itemId: string): Promise<ItemMovement[]> {
  const { data, error } = await supabase
    .from("inventory_transactions")
    .select("id, type, quantity, unit_price, tx_date, created_at, suppliers(supplier_name), maintenance_orders(order_number, buses(plate_number, bus_code))")
    .eq("inventory_id", itemId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((t: any) => {
    const kind: "IN" | "OUT" = t.type === "IN" ? "IN" : "OUT";
    const order = t.maintenance_orders;
    const bus = order?.buses;
    const party =
      kind === "IN"
        ? t.suppliers?.supplier_name ?? "—"
        : order
          ? `عربية ${bus?.plate_number ?? bus?.bus_code ?? "—"} • أمر صيانة ${order.order_number ?? "—"}`
          : "صرف / تسوية مخزنية";
    return {
      id: t.id,
      kind,
      date: t.tx_date ?? String(t.created_at).slice(0, 10),
      at: String(t.created_at),
      party,
      quantity: Number(t.quantity),
      unitPrice: Number(t.unit_price ?? 0),
    };
  });
}

/**
 * Chronological statement for one item. The running balance is anchored on the
 * item's current stock, so stock that was entered manually (without a movement)
 * is still reflected as an opening balance. Rows are filtered to the range
 * after the balance has been computed over the full history.
 */
export function computeItemLedger(movements: ItemMovement[], range: DateRange, currentStock: number, unitPrice: number): ItemLedger {
  const sorted = [...movements].sort((a, b) => (a.date === b.date ? a.at.localeCompare(b.at) : a.date.localeCompare(b.date)));
  const net = sorted.reduce((sum, m) => sum + (m.kind === "IN" ? m.quantity : -m.quantity), 0);
  const base = currentStock - net;
  let bal = base;
  const all: ItemLedgerRow[] = sorted.map((m) => {
    bal += m.kind === "IN" ? m.quantity : -m.quantity;
    return { ...m, qtyIn: m.kind === "IN" ? m.quantity : 0, qtyOut: m.kind === "OUT" ? m.quantity : 0, value: m.quantity * m.unitPrice, balance: bal };
  });
  const rows = all.filter((r) => inDateRange(r.date, range));
  const first = rows[0];
  const openingBalance = first ? first.balance - first.qtyIn + first.qtyOut : all.filter((r) => range.from && r.date < range.from).at(-1)?.balance ?? base;
  return {
    openingBalance,
    rows,
    totalIn: rows.reduce((s, r) => s + r.qtyIn, 0),
    totalOut: rows.reduce((s, r) => s + r.qtyOut, 0),
    totalInValue: rows.reduce((s, r) => s + (r.kind === "IN" ? r.value : 0), 0),
    totalOutValue: rows.reduce((s, r) => s + (r.kind === "OUT" ? r.value : 0), 0),
    currentStock,
    stockValue: currentStock * unitPrice,
  };
}

// ---- Executive Monthly Financial Report (Spec #2) ----

export interface MonthlyFinancialReport {
  revenueSubscriptionsAndClients: number;
  revenueExternalTripsAndCash: number;
  totalRevenue: number;
  expenseSalaries: number;
  expenseSparePartsFromStock: number;
  expenseExternalMaintenance: number;
  expenseFuel: number;
  expenseAdminAndMisc: number;
  totalExpenses: number;
  netProfit: number;
}

export function computeFinancialReport(inputs: {
  clientRevenue: number;
  studentCollections: number;
  externalTripsRevenue: number;
  driverAndEmployeeSalaries: number;
  sparePartsCost: number;
  externalMaintenanceCost: number;
  fuelCost: number;
  adminAndMiscExpenses: number;
}): MonthlyFinancialReport {
  const revenueSubscriptionsAndClients = inputs.clientRevenue + inputs.studentCollections;
  const revenueExternalTripsAndCash = inputs.externalTripsRevenue;
  const totalRevenue = revenueSubscriptionsAndClients + revenueExternalTripsAndCash;
  const totalExpenses =
    inputs.driverAndEmployeeSalaries + inputs.sparePartsCost + inputs.externalMaintenanceCost + inputs.fuelCost + inputs.adminAndMiscExpenses;
  return {
    revenueSubscriptionsAndClients,
    revenueExternalTripsAndCash,
    totalRevenue,
    expenseSalaries: inputs.driverAndEmployeeSalaries,
    expenseSparePartsFromStock: inputs.sparePartsCost,
    expenseExternalMaintenance: inputs.externalMaintenanceCost,
    expenseFuel: inputs.fuelCost,
    expenseAdminAndMisc: inputs.adminAndMiscExpenses,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
  };
}

export async function fetchMonthlyFinancialReport(period: Period): Promise<MonthlyFinancialReport> {
  const { start, end } = periodBounds(period);

  const [
    ops,
    { data: studentPayments },
    driverPayroll,
    employeePayroll,
    { data: outTransactions },
    { data: maintenanceOrders },
    { data: fuelLogs },
    { data: generalExpenses },
  ] = await Promise.all([
    fetchDispatchShifts(period),
    pageAll((f, t) => supabase.from("payments").select("amount").eq("type", "دائن").gte("date", start).lt("date", end).order("id").range(f, t)),
    fetchDriverPayroll(period),
    fetchEmployeePayroll(period),
    supabase.from("inventory_transactions").select("quantity, inventory(unit_price)").eq("type", "OUT").gte("created_at", start).lt("created_at", end),
    supabase.from("maintenance_orders").select("total_cost").gte("created_at", start).lt("created_at", end),
    supabase.from("fuel_logs").select("cost").gte("date", start).lt("date", end),
    supabase.from("expenses").select("category, amount").gte("date", start).lt("date", end),
  ]);

  const clientRevenue = ops.reduce((sum, o) => sum + o.busValue, 0);
  const studentCollections = (studentPayments ?? []).reduce((sum, p: any) => sum + Number(p.amount ?? 0), 0);
  const driverSalaries = driverPayroll.reduce((sum, p) => sum + p.netSalary, 0);
  const employeeSalaries = employeePayroll.reduce((sum, p) => sum + p.netSalary, 0);
  const sparePartsCost = (outTransactions ?? []).reduce((sum, t: any) => sum + Number(t.quantity ?? 0) * Number(t.inventory?.unit_price ?? 0), 0);
  const externalMaintenanceCost = (maintenanceOrders ?? []).reduce((sum, m: any) => sum + Number(m.total_cost ?? 0), 0);
  const gasFromFuelLogs = (fuelLogs ?? []).reduce((sum, f: any) => sum + Number(f.cost ?? 0), 0);
  const adminAndMisc = (generalExpenses ?? [])
    .filter((e: any) => ["إداريات", "مصاريف خارجية", "موردين"].includes(e.category))
    .reduce((sum, e: any) => sum + Number(e.amount ?? 0), 0);

  return computeFinancialReport({
    clientRevenue,
    studentCollections,
    externalTripsRevenue: 0, // wired once the Trips module exists
    driverAndEmployeeSalaries: driverSalaries + employeeSalaries,
    sparePartsCost,
    externalMaintenanceCost,
    fuelCost: gasFromFuelLogs,
    adminAndMiscExpenses: adminAndMisc,
  });
}

export interface SupplierMonthlySummary {
  id: string;
  name: string;
  purchasesThisMonth: number;
  balanceDue: number;
}

export async function fetchSupplierMonthlySummary(period: Period): Promise<SupplierMonthlySummary[]> {
  const { start, end } = periodBounds(period);
  const [suppliers, { data: purchases }] = await Promise.all([
    fetchSuppliers(),
    supabase.from("inventory_transactions").select("supplier_id, total_cost").eq("type", "IN").gte("created_at", start).lt("created_at", end),
  ]);
  const bySupplier = new Map<string, number>();
  for (const p of purchases ?? []) {
    if (!p.supplier_id) continue;
    bySupplier.set(p.supplier_id, (bySupplier.get(p.supplier_id) ?? 0) + Number(p.total_cost ?? 0));
  }
  return suppliers.map((s) => ({ id: s.id, name: s.name, purchasesThisMonth: bySupplier.get(s.id) ?? 0, balanceDue: s.balanceDue }));
}

// ---- Consolidated treasury summary ----

export type TreasurySummary = MonthlyReportBreakdown;

/** Treasury summary over a date range — same structure/formula as the monthly report. */
export async function fetchTreasurySummary(range: DateRange): Promise<TreasurySummary> {
  return fetchMonthlyReport(range);
}

// ---- Executive monthly financial report (Spec #2) ----

export interface MonthlyReportBreakdown {
  subscriptionRevenue: number;
  companyRevenue: number;
  tripRevenue: number;
  totalRevenue: number;
  payrollExpense: number;
  maintenanceExpense: number;
  partsExpense: number;
  fuelExpense: number;
  adminMiscExpense: number;
  /** تكلفة تأجير السيارات المستأجرة المستحقة للمالكين (مقابل إيرادها في إيراد الشركات) */
  rentedExpense: number;
  /** مصروفات الاشتراكات والخطوط (subscription_expenses) */
  subscriptionExpense: number;
  totalExpenses: number;
  netProfit: number;
}

export function computeMonthlyReport(input: {
  subscriptionRevenue: number;
  companyRevenue: number;
  tripRevenue: number;
  payrollExpense: number;
  maintenanceExpense: number;
  partsExpense: number;
  fuelExpense: number;
  adminMiscExpense: number;
  subscriptionExpense?: number;
  rentedExpense?: number;
}): MonthlyReportBreakdown {
  const subscriptionExpense = input.subscriptionExpense ?? 0;
  const rentedExpense = input.rentedExpense ?? 0;
  const totalRevenue = input.subscriptionRevenue + input.companyRevenue + input.tripRevenue;
  const totalExpenses = input.payrollExpense + input.maintenanceExpense + input.partsExpense + input.adminMiscExpense + subscriptionExpense + rentedExpense;
  // fuel is reported on its own line and is NOT part of totalExpenses
  return { ...input, subscriptionExpense, rentedExpense, totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses - input.fuelExpense };
}

export async function fetchMonthlyReport(period: Period): Promise<MonthlyReportBreakdown> {
  const { start, end } = periodBounds(period);
  const [
    { data: subPayments },
    ops,
    driverPayroll,
    { data: staffPayslips },
    employeePayroll,
    { data: maintOrders },
    { data: outTx },
    { data: allExpenses },
    { data: subExpenses },
    { data: fuelLogRows },
    { data: rentedRows },
  ] = await Promise.all([
    pageAll((f, t) => supabase.from("payments").select("amount").eq("type", "دائن").gte("date", start).lt("date", end).order("id").range(f, t)),
    fetchDispatchShifts(period),
    fetchDriverPayroll(period),
    supabase.from("payslips").select("overtime, advances, penalties, staff(base_salary)").gte("month", start).lt("month", end),
    fetchEmployeePayroll(period),
    supabase.from("maintenance_orders").select("total_cost, created_at").gte("created_at", start).lt("created_at", end),
    supabase.from("inventory_transactions").select("total_cost, created_at").eq("type", "OUT").gte("created_at", start).lt("created_at", end),
    supabase.from("expenses").select("category, amount, date").gte("date", start).lt("date", end),
    pageAll((f, t) => supabase.from("subscription_expenses").select("amount").gte("date", start).lt("date", end).order("id").range(f, t)),
    pageAll((f, t) => supabase.from("fuel_logs").select("cost").gte("date", start).lt("date", end).order("id").range(f, t)),
    pageAll((f, t) => supabase.from("rented_bus_operations").select("rental_fare").gte("op_date", start).lt("op_date", end).order("id").range(f, t)),
  ]);

  const rentedExpense = (rentedRows ?? []).reduce((sum: number, r: any) => sum + Number(r.rental_fare ?? 0), 0);
  const subscriptionExpense = (subExpenses ?? []).reduce((sum: number, e: any) => sum + Number(e.amount ?? 0), 0);
  const subscriptionRevenue = (subPayments ?? []).reduce((sum, p: any) => sum + Number(p.amount ?? 0), 0);
  const companyRevenue = ops.reduce((sum, o) => sum + o.busValue, 0);
  const { data: tripsThisMonth } = await supabase
    .from("trips")
    .select("total_price")
    .neq("status", "ملغاة")
    .gte("trip_date", start)
    .lt("trip_date", end);
  const tripRevenue = (tripsThisMonth ?? []).reduce((sum: number, t: any) => sum + Number(t.total_price ?? 0), 0);

  const driverPayrollTotal = driverPayroll.reduce((sum, p) => sum + p.netSalary, 0);
  const staffPayrollTotal = (staffPayslips ?? []).reduce((sum: number, p: any) => {
    const base = Number(p.staff?.base_salary ?? 0);
    return sum + base + Number(p.overtime ?? 0) - Number(p.advances ?? 0) - Number(p.penalties ?? 0);
  }, 0);
  const employeeBaseTotal = employeePayroll.reduce((sum, p) => sum + p.netSalary, 0);

  const expenseByCategory = (cats: string[]) =>
    (allExpenses ?? []).filter((e: any) => cats.includes(e.category)).reduce((sum: number, e: any) => sum + Number(e.amount ?? 0), 0);

  const maintenanceExpense = (maintOrders ?? []).reduce((sum: number, o: any) => sum + Number(o.total_cost ?? 0), 0);
  const partsExpense = (outTx ?? []).reduce((sum: number, t: any) => sum + Number(t.total_cost ?? 0), 0) + expenseByCategory(["قطع غيار"]);
  const fuelExpense = (fuelLogRows ?? []).reduce((sum: number, f: any) => sum + Number(f.cost ?? 0), 0) + expenseByCategory(["غاز"]);
  const adminMiscExpense = expenseByCategory(["إداريات", "مصاريف خارجية", "موردين"]);

  return computeMonthlyReport({
    subscriptionRevenue,
    companyRevenue,
    tripRevenue,
    payrollExpense: driverPayrollTotal + staffPayrollTotal + employeeBaseTotal + expenseByCategory(["مرتبات"]),
    maintenanceExpense,
    partsExpense,
    fuelExpense,
    adminMiscExpense,
    subscriptionExpense,
    rentedExpense,
  });
}

export interface SupplierMonthlyRow {
  id: string;
  name: string;
  purchasedThisMonth: number;
  balanceDue: number;
}

export async function fetchSupplierMonthlyBreakdown(period: Period): Promise<SupplierMonthlyRow[]> {
  const { start, end } = periodBounds(period);
  const [{ data: suppliers }, { data: transactions }] = await Promise.all([
    supabase.from("suppliers").select("*"),
    supabase.from("inventory_transactions").select("supplier_id, total_cost").eq("type", "IN").gte("created_at", start).lt("created_at", end),
  ]);
  const purchasedBySupplier = new Map<string, number>();
  for (const t of transactions ?? []) {
    if (!t.supplier_id) continue;
    purchasedBySupplier.set(t.supplier_id, (purchasedBySupplier.get(t.supplier_id) ?? 0) + Number(t.total_cost ?? 0));
  }
  return (suppliers ?? []).map((s: any) => ({
    id: s.id,
    name: s.supplier_name,
    purchasedThisMonth: purchasedBySupplier.get(s.id) ?? 0,
    balanceDue: Number(s.balance_due ?? 0),
  }));
}

// ---- Private trips & excursions (Spec #3) ----

export const TRIP_NOTIFICATION_OPTIONS = [
  "تنبيه قبل الرحلة بيومين (48 ساعة)",
  "تنبيه قبل الرحلة بيوم (24 ساعة)",
  "التنبيهين معاً (قبلها بيومين وقبلها بيوم)",
  "بدون تنبيه",
] as const;

export interface Trip {
  id: string;
  clientName: string;
  clientPhone: string;
  busId: string | null;
  bus: string;
  driverId: string | null;
  driver: string;
  tripDate: string;
  destination: string;
  totalPrice: number;
  amountPaid: number;
  balanceDue: number;
  driverFee: number;
  paySource: string;
  notificationPreference: string;
  status: "مجدولة" | "جاري التنفيذ" | "مكتملة" | "ملغاة";
}

export async function fetchTrips(): Promise<Trip[]> {
  const { data, error } = await supabase
    .from("trips")
    .select("*, buses(bus_code), drivers(name)")
    .order("trip_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t: any) => ({
    id: t.id,
    clientName: t.client_name,
    clientPhone: t.client_phone ?? "",
    busId: t.bus_id,
    bus: t.buses?.bus_code ?? "—",
    driverId: t.driver_id,
    driver: t.drivers?.name ?? "—",
    tripDate: t.trip_date,
    destination: t.destination ?? "",
    totalPrice: Number(t.total_price ?? 0),
    amountPaid: Number(t.amount_paid ?? 0),
    balanceDue: Number(t.balance_due ?? 0),
    driverFee: Number(t.driver_fee ?? 0),
    paySource: t.pay_source ?? "",
    notificationPreference: t.notification_preference ?? "بدون تنبيه",
    status: t.status ?? "مجدولة",
  }));
}

interface TripInput {
  clientName: string;
  clientPhone: string;
  busCode: string;
  driverName: string;
  tripDate: string;
  destination: string;
  totalPrice: number;
  amountPaid: number;
  driverFee: number;
  notificationPreference: string;
  status: string;
  paySource?: string;
}

async function resolveTripPayload(input: TripInput) {
  const [{ data: bus }, { data: driver }] = await Promise.all([
    input.busCode.trim() ? supabase.from("buses").select("id").eq("bus_code", input.busCode).maybeSingle() : Promise.resolve({ data: null }),
    input.driverName.trim() ? supabase.from("drivers").select("id").eq("name", input.driverName).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    client_name: input.clientName,
    client_phone: input.clientPhone,
    bus_id: bus?.id ?? null,
    driver_id: driver?.id ?? null,
    trip_date: input.tripDate,
    destination: input.destination,
    total_price: input.totalPrice,
    amount_paid: input.amountPaid,
    driver_fee: input.driverFee,
    notification_preference: input.notificationPreference,
    status: input.status,
    pay_source: input.paySource || null,
  };
}

/** Where an incoming trip collection lands: the custody ledger («عهدة») or a treasury deposit on the chosen account. */
async function syncTripCollection(tripId: string, i: TripInput) {
  const date = i.tripDate.slice(0, 10);
  const amount = i.amountPaid;
  const toCustody = !!i.paySource && i.paySource === CUSTODY_SOURCE && amount > 0;
  const toTreasury = !!i.paySource && i.paySource !== CUSTODY_SOURCE && amount > 0;
  const note = `تحصيل رحلة: ${i.clientName}${i.destination ? ` — ${i.destination}` : ""}`;

  const { data: dep } = await supabase.from("treasury").select("id").eq("trip_id", tripId).maybeSingle();
  // شركة مسجلة بنفس الاسم → التحصيل يظهر دائنًا في كشف حسابها (مستحق الرحلة يُرحَّل مدينًا بتريجر قاعدة البيانات)
  const { data: client } = i.clientName.trim() ? await supabase.from("clients").select("id").eq("client_name", i.clientName.trim()).maybeSingle() : { data: null };
  if (toTreasury) {
    const row = { date, account: i.paySource as string, opening: 0, deposits: amount, withdrawals: 0, notes: note, trip_id: tripId, client_id: (client?.id as string | undefined) ?? null };
    const { error } = dep ? await supabase.from("treasury").update(row).eq("id", dep.id) : await supabase.from("treasury").insert(row);
    if (error) throw new Error(dbErrorMessage(error, "تعذر ترحيل التحصيل للخزينة"));
  } else if (dep) {
    const { error } = await supabase.from("treasury").delete().eq("id", dep.id);
    if (error) throw new Error(dbErrorMessage(error, "تعذر تحديث الخزينة"));
  }

  const { data: cus } = await supabase.from("custody_entries").select("id").eq("source_table", "trips").eq("source_id", tripId).maybeSingle();
  if (toCustody) {
    const row = custodyRow({ date, kind: "in", amount, person: i.clientName, category: "", description: note, notes: "", sourceTable: "trips", sourceId: tripId });
    const { error } = cus ? await supabase.from("custody_entries").update(row).eq("id", cus.id) : await supabase.from("custody_entries").insert(row);
    if (error) throw new Error(dbErrorMessage(error, "تعذر ترحيل التحصيل للعهدة"));
  } else if (cus) {
    const { error } = await supabase.from("custody_entries").delete().eq("id", cus.id);
    if (error) throw new Error(dbErrorMessage(error, "تعذر تحديث العهدة"));
  }
}

export async function addTrip(input: TripInput) {
  if (input.amountPaid > 0 && !input.paySource) throw new Error("اختر طريقة الدفع / مصدر التمويل للمبلغ المحصّل");
  const payload = await resolveTripPayload(input);
  const { data, error } = await supabase.from("trips").insert(payload).select("id").single();
  if (error) throw error;
  await syncTripCollection(data.id as string, input);
}
export async function updateTrip(id: string, input: TripInput) {
  if (input.amountPaid > 0 && !input.paySource) throw new Error("اختر طريقة الدفع / مصدر التمويل للمبلغ المحصّل");
  const payload = await resolveTripPayload(input);
  const { error } = await supabase.from("trips").update(payload).eq("id", id);
  if (error) throw error;
  await syncTripCollection(id, input);
}
export async function deleteTrip(id: string) {
  await syncTripCollection(id, { clientName: "", clientPhone: "", busCode: "", driverName: "", tripDate: "1900-01-01", destination: "", totalPrice: 0, amountPaid: 0, driverFee: 0, notificationPreference: "", status: "", paySource: "" });
  const { error } = await supabase.from("trips").delete().eq("id", id);
  if (error) throw error;
}

// ---- Rented / external vehicles ----

export interface RentedOp {
  id: string;
  date: string;
  owner: string;
  bus: string;
  driver: string;
  clientId: string;
  destination: string;
  fare: number; // تكلفة التأجير المستحقة لمالك العربية
  clientFare: number; // سعر الشركة (إيراد)
  vehicleType: string;
  routeName: string;
  paid: boolean;
  paidAt: string;
  paySource: string;
  notes: string;
  missionId: string;
  /** جزء من الإيجار مخصوم من سلف سابقة */
  advanceApplied: number;
}

export const RENTED_VEHICLE_TYPES = ["هاي إس (HiAce)", "ملاكي", "أوتوبيس 33", "أوتوبيس 50", "دوبل كابينة"] as const;

/** صافي ربح الوردية = سعر الشركة − تكلفة التأجير */
export const rentedNetProfit = (o: { clientFare: number; fare: number }) => o.clientFare - o.fare;

export interface RentedOpInput {
  date: string;
  owner: string;
  bus: string;
  driver: string;
  clientId: string;
  destination: string;
  fare: number;
  clientFare: number;
  vehicleType: string;
  routeName: string;
  paid: boolean;
  paySource?: string;
  notes: string;
}

export async function fetchRentedOps(): Promise<RentedOp[]> {
  const { data, error } = await supabase.from("rented_bus_operations").select("*").order("op_date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    date: r.op_date,
    owner: r.owner_name,
    bus: r.bus_label,
    driver: r.driver_name ?? "",
    clientId: r.client_id ?? "",
    destination: r.destination ?? "",
    fare: Number(r.rental_fare ?? 0),
    clientFare: Number(r.client_fare ?? 0),
    vehicleType: r.vehicle_type ?? "",
    routeName: r.route_name ?? "",
    paid: !!r.paid,
    paidAt: r.paid_at ?? "",
    paySource: r.pay_source ?? "",
    notes: r.notes ?? "",
    missionId: r.mission_id ?? "",
    advanceApplied: Number(r.advance_applied ?? 0),
  }));
}

const rentedRow = (i: RentedOpInput) => ({
  op_date: i.date,
  owner_name: i.owner.trim(),
  bus_label: i.bus.trim(),
  driver_name: i.driver.trim() || null,
  client_id: i.clientId || null,
  destination: i.destination.trim() || null,
  rental_fare: i.fare,
  client_fare: i.clientFare,
  vehicle_type: i.vehicleType || null,
  route_name: i.routeName.trim() || null,
  paid: i.paid,
  paid_at: i.paid ? new Date().toISOString().slice(0, 10) : null,
  pay_source: i.paid ? i.paySource || null : null,
  notes: i.notes || null,
});

/** Rental cost settled from «عهدة الخزينة» is mirrored in the custody ledger. */
async function syncRentedPayout(id: string, i: { date: string; owner: string; bus: string; fare: number; paid: boolean; paySource?: string; applied?: number }) {
  await syncCustodyLink(
    { table: "rented_bus_operations", id },
    i.paid ? { date: i.date, amount: Math.max(0, i.fare - (i.applied ?? 0)), category: "سيارات مستأجرة", description: `إيجار ${i.owner} — ${i.bus}`, payFrom: i.paySource ?? "" } : null,
  );
}

export async function addRentedOp(input: RentedOpInput) {
  if (input.paid && !input.paySource) throw new Error("اختر طريقة الدفع / مصدر التمويل لتكلفة التأجير");
  const { data, error } = await supabase.from("rented_bus_operations").insert(rentedRow(input)).select("id").single();
  if (error) throw error;
  await syncRentedPayout(data.id as string, { ...input });
}
export async function updateRentedOp(id: string, input: RentedOpInput, wasPaid: boolean, paidAt: string) {
  if (input.paid && !input.paySource) throw new Error("اختر طريقة الدفع / مصدر التمويل لتكلفة التأجير");
  const { data: prev } = await supabase.from("rented_bus_operations").select("advance_applied, owner_name").eq("id", id).maybeSingle();
  let applied = Number(prev?.advance_applied ?? 0);
  const row: Record<string, unknown> = rentedRow(input);
  if (input.paid && wasPaid && paidAt) row['paid_at'] = paidAt; // keep the original settlement date
  if (applied > 0 && !input.paid) {
    await releaseRentedAdvance(String(prev?.owner_name ?? input.owner), applied);
    applied = 0;
    row['advance_applied'] = 0;
  }
  const { error } = await supabase.from("rented_bus_operations").update(row).eq("id", id);
  if (error) throw error;
  await syncRentedPayout(id, { ...input, applied });
}
export async function deleteRentedOp(id: string) {
  const { data: prev } = await supabase.from("rented_bus_operations").select("advance_applied, owner_name").eq("id", id).maybeSingle();
  if (prev && Number(prev.advance_applied ?? 0) > 0) await releaseRentedAdvance(String(prev.owner_name), Number(prev.advance_applied));
  await syncCustodyLink({ table: "rented_bus_operations", id }, null);
  const { error } = await supabase.from("rented_bus_operations").delete().eq("id", id);
  if (error) throw error;
}

/**
 * "تم السداد / تصفير الحساب": marks the given trips as paid. Open advances of the owner are deducted first
 * (oldest trip first); only the remainder is paid from the chosen funding source.
 */
export async function settleRentedOps(ids: string[], paySource: string, advances: RentedAdvance[] = []) {
  if (!ids.length) return;
  const { data, error: fErr } = await supabase.from("rented_bus_operations").select("id, op_date, owner_name, bus_label, rental_fare, advance_applied").in("id", ids).order("op_date");
  if (fErr) throw error_(fErr, "تعذر تحميل الرحلات");
  const pool = advances.map((a) => ({ id: a.id, left: Math.max(0, a.amount - a.applied), applied: a.applied })).filter((a) => a.left > 0);
  const poolTotal = pool.reduce((t, a) => t + a.left, 0);
  const totalFare = (data ?? []).reduce((t, r: any) => t + Number(r.rental_fare ?? 0), 0);
  if (!paySource && totalFare > poolTotal) throw new Error("اختر طريقة الدفع / مصدر التمويل");
  const today = new Date().toISOString().slice(0, 10);
  for (const r of data ?? []) {
    const fare = Number(r.rental_fare ?? 0);
    let need = fare;
    for (const a of pool) {
      if (need <= 0) break;
      const take = Math.min(a.left, need);
      a.left -= take;
      a.applied += take;
      need -= take;
    }
    const applied = fare - need;
    const { error } = await supabase.from("rented_bus_operations").update({ paid: true, paid_at: today, pay_source: need > 0 ? paySource : paySource || "خصم من سلفة", advance_applied: applied }).eq("id", r.id);
    if (error) throw error_(error, "تعذر تسجيل السداد");
    await syncRentedPayout(r.id as string, { date: r.op_date as string, owner: r.owner_name as string, bus: r.bus_label as string, fare, paid: true, paySource, applied });
  }
  for (const a of pool) {
    const { error } = await supabase.from("rented_advances").update({ applied: a.applied }).eq("id", a.id);
    if (error) throw error_(error, "تعذر تحديث السلف");
  }
}
const error_ = (e: unknown, fallback: string) => new Error(dbErrorMessage(e, fallback));

// ---- سلف / دفعات تحت الحساب للسيارات المستأجرة ----

export const RENTED_EXPENSE_CATEGORY = "السيارات المستأجرة";

export interface RentedAdvance {
  id: string;
  date: string;
  owner: string;
  bus: string;
  amount: number;
  applied: number;
  paySource: string;
  notes: string;
  sourceTable: string;
  sourceId: string;
}

export const rentedVehicleKey = (owner: string, bus: string) => `${owner}||${bus}`;
export const parseRentedVehicleKey = (key: string) => {
  const [owner = "", bus = ""] = key.split("||");
  return { owner, bus };
};

const mapRentedAdvance = (r: any): RentedAdvance => ({
  id: r.id,
  date: r.adv_date,
  owner: r.owner_name,
  bus: r.bus_label ?? "",
  amount: Number(r.amount ?? 0),
  applied: Number(r.applied ?? 0),
  paySource: r.pay_source ?? "",
  notes: r.notes ?? "",
  sourceTable: r.source_table ?? "",
  sourceId: r.source_id ?? "",
});

export async function fetchRentedAdvances(): Promise<RentedAdvance[]> {
  const { data, error } = await pageAll((f, t) => supabase.from("rented_advances").select("*").order("adv_date", { ascending: false }).order("id").range(f, t));
  if (error) throw error_(error, "تعذر تحميل سلف السيارات المستأجرة");
  return data.map(mapRentedAdvance);
}

/** كل السيارات المستأجرة المسجلة (مالك + عربية) من الحركات والسلف. */
export function listRentedVehicles(ops: { owner: string; bus: string }[], advances: { owner: string; bus: string }[] = []) {
  const seen = new Map<string, { value: string; label: string; group: string; owner: string; bus: string }>();
  for (const v of [...ops, ...advances]) {
    if (!v.owner) continue;
    const key = rentedVehicleKey(v.owner, v.bus);
    if (!seen.has(key)) seen.set(key, { value: key, label: v.bus ? `${v.bus} — ${v.owner}` : `${v.owner} (كل العربيات)`, group: v.owner, owner: v.owner, bus: v.bus });
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label, "ar"));
}

/** Rolls advance usage back when a settled trip is edited back to pending or deleted (newest advance first). */
async function releaseRentedAdvance(owner: string, amount: number) {
  const { data } = await supabase.from("rented_advances").select("id, applied").eq("owner_name", owner).gt("applied", 0).order("adv_date", { ascending: false });
  let left = amount;
  for (const a of data ?? []) {
    if (left <= 0) break;
    const cut = Math.min(Number(a.applied), left);
    left -= cut;
    await supabase.from("rented_advances").update({ applied: Number(a.applied) - cut }).eq("id", a.id);
  }
}

export interface RentedAdvanceInput {
  date: string;
  owner: string;
  bus: string;
  amount: number;
  paySource: string;
  notes: string;
}

/** دفعة فورية من الخزينة/العهدة لسيارة مستأجرة — تُسجَّل في كشف حسابها وتتحرك الأرصدة. */
async function syncRentedAdvanceCash(id: string, i: RentedAdvanceInput | null) {
  const desc = i ? `سلفة سيارة مستأجرة ${i.owner}${i.bus ? ` — ${i.bus}` : ""}` : "";
  await syncCustodyLink({ table: "rented_advances", id }, i ? { date: i.date, amount: i.amount, category: RENTED_EXPENSE_CATEGORY, description: desc, payFrom: i.paySource, notes: i.notes } : null);
  const { data: dep } = await supabase.from("treasury").select("id").eq("rented_advance_id", id).maybeSingle();
  const toTreasury = !!i && i.paySource !== CUSTODY_SOURCE && i.amount > 0;
  if (toTreasury && i) {
    const row = { date: i.date, account: i.paySource, opening: 0, deposits: 0, withdrawals: i.amount, notes: desc, rented_advance_id: id };
    const { error } = dep ? await supabase.from("treasury").update(row).eq("id", dep.id) : await supabase.from("treasury").insert(row);
    if (error) throw error_(error, "تعذر ترحيل السلفة للخزينة");
  } else if (dep) {
    const { error } = await supabase.from("treasury").delete().eq("id", dep.id);
    if (error) throw error_(error, "تعذر تحديث الخزينة");
  }
}

export async function addRentedAdvance(i: RentedAdvanceInput) {
  if (!i.owner.trim()) throw new Error("اختر السيارة المستأجرة / المالك");
  if (!(i.amount > 0)) throw new Error("أدخل مبلغ السلفة");
  if (!i.paySource) throw new Error("اختر طريقة الدفع / مصدر التمويل");
  const { data, error } = await supabase.from("rented_advances").insert({ adv_date: i.date, owner_name: i.owner.trim(), bus_label: i.bus.trim() || null, amount: i.amount, pay_source: i.paySource, notes: i.notes.trim() || null }).select("id").single();
  if (error) throw error_(error, "تعذر حفظ السلفة");
  try {
    await syncRentedAdvanceCash(data.id as string, i);
  } catch (e) {
    await supabase.from("rented_advances").delete().eq("id", data.id);
    throw e;
  }
}
export async function updateRentedAdvance(id: string, i: RentedAdvanceInput) {
  if (!(i.amount > 0)) throw new Error("أدخل مبلغ السلفة");
  if (!i.paySource) throw new Error("اختر طريقة الدفع / مصدر التمويل");
  const { error } = await supabase.from("rented_advances").update({ adv_date: i.date, owner_name: i.owner.trim(), bus_label: i.bus.trim() || null, amount: i.amount, pay_source: i.paySource, notes: i.notes.trim() || null }).eq("id", id);
  if (error) throw error_(error, "تعذر تعديل السلفة");
  await syncRentedAdvanceCash(id, i);
}
export async function deleteRentedAdvance(id: string) {
  const { data: adv } = await supabase.from("rented_advances").select("applied").eq("id", id).maybeSingle();
  if (adv && Number(adv.applied) > 0) throw new Error("لا يمكن حذف سلفة خُصمت بالفعل من رحلات مسددة");
  await syncRentedAdvanceCash(id, null);
  const { error } = await supabase.from("rented_advances").delete().eq("id", id);
  if (error) throw error_(error, "تعذر حذف السلفة");
}

/**
 * يربط مصروفًا من العهدة/الخزينة (بند «السيارات المستأجرة») بكشف حساب السيارة المختارة كدفعة تحت الحساب.
 * الحركة المالية نفسها يسجلها المصروف/العهدة، فلا تُكرَّر هنا.
 */
export async function syncRentedAdvanceLink(
  source: { table: string; id: string },
  active: { date: string; amount: number; vehicle: string; payFrom: string; notes: string } | null,
) {
  const { data: existing } = await supabase.from("rented_advances").select("id").eq("source_table", source.table).eq("source_id", source.id).maybeSingle();
  if (!active || !(active.amount > 0) || !active.vehicle) {
    if (existing) {
      const { error } = await supabase.from("rented_advances").delete().eq("id", existing.id);
      if (error) throw error_(error, "تعذر تحديث حساب السيارة المستأجرة");
    }
    return;
  }
  const { owner, bus } = parseRentedVehicleKey(active.vehicle);
  const row = { adv_date: active.date, owner_name: owner, bus_label: bus || null, amount: active.amount, pay_source: active.payFrom || null, notes: active.notes || null, source_table: source.table, source_id: source.id };
  const { error } = existing ? await supabase.from("rented_advances").update(row).eq("id", existing.id) : await supabase.from("rented_advances").insert(row);
  if (error) throw error_(error, "تعذر ترحيل الدفعة إلى حساب السيارة المستأجرة");
}

export function computeRentedLedger(
  ops: RentedOp[],
  filter: { owner: string; bus: string; range: DateRange },
  advances: RentedAdvance[] = [],
) {
  const rows = ops
    .filter((o) => (!filter.owner || o.owner === filter.owner) && (!filter.bus || o.bus === filter.bus) && inDateRange(o.date, filter.range))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const advRows = advances
    .filter((a) => (!filter.owner || a.owner === filter.owner) && (!filter.bus || !a.bus || a.bus === filter.bus) && inDateRange(a.date, filter.range))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const totalDue = rows.reduce((s, r) => s + r.fare, 0);
  const totalPaid = rows.filter((r) => r.paid).reduce((s, r) => s + r.fare, 0);
  const totalAdvances = advRows.reduce((s, a) => s + a.amount, 0);
  const openAdvances = advRows.reduce((s, a) => s + Math.max(0, a.amount - a.applied), 0);
  return {
    rows,
    advRows,
    totalDue,
    totalPaid,
    totalAdvances,
    openAdvances,
    /** المتبقي = المستحق غير المسدد − السلف التي لم تُخصم بعد */
    remaining: totalDue - totalPaid - openAdvances,
    totalClientFare: rows.reduce((s, r) => s + r.clientFare, 0),
    totalNet: rows.reduce((s, r) => s + rentedNetProfit(r), 0),
    unpaidIds: rows.filter((r) => !r.paid).map((r) => r.id),
  };
}

// ---- المأموريات (missions) ----
// A DB trigger posts each mission to: the client statement + driver earnings (dispatch_shifts row)
// and, for rented vehicles, to the owner's payable (rented_bus_operations row).

export type MissionSource = "internal" | "rented";

export interface Mission {
  id: string;
  date: string;
  clientId: string;
  clientName: string;
  vehicleType: string;
  source: MissionSource;
  route: string;
  waitingHours: number;
  clientPrice: number;
  vehicleCost: number;
  driverFee: number;
  busId: string;
  driverId: string;
  owner: string;
  busLabel: string;
  externalDriver: string;
  notes: string;
}

export type MissionInput = Omit<Mission, "id" | "clientName">;

export const MISSION_SOURCE_LABEL: Record<MissionSource, string> = {
  internal: "سيارة من الأسطول الداخلي",
  rented: "سيارة مستأجرة / خارجية",
};

/** صافي المأمورية = سعر الشركة − تكلفة السيارة − أجر السائق */
export const missionNet = (m: { clientPrice: number; vehicleCost: number; driverFee: number }) => m.clientPrice - m.vehicleCost - m.driverFee;

export async function fetchMissions(): Promise<Mission[]> {
  const { data, error } = await supabase.from("missions").select("*, clients(client_name)").order("mission_date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    date: r.mission_date,
    clientId: r.client_id,
    clientName: r.clients?.client_name ?? "—",
    vehicleType: r.vehicle_type,
    source: r.vehicle_source,
    route: r.route_text,
    waitingHours: Number(r.waiting_hours ?? 0),
    clientPrice: Number(r.client_price ?? 0),
    vehicleCost: Number(r.vehicle_cost ?? 0),
    driverFee: Number(r.driver_fee ?? 0),
    busId: r.bus_id ?? "",
    driverId: r.driver_id ?? "",
    owner: r.owner_name ?? "",
    busLabel: r.bus_label ?? "",
    externalDriver: r.external_driver ?? "",
    notes: r.notes ?? "",
  }));
}

const missionRow = (i: MissionInput) => ({
  mission_date: i.date,
  client_id: i.clientId,
  vehicle_type: i.vehicleType,
  vehicle_source: i.source,
  route_text: i.route.trim(),
  waiting_hours: i.waitingHours,
  client_price: i.clientPrice,
  vehicle_cost: i.source === "rented" ? i.vehicleCost : 0,
  driver_fee: i.driverFee,
  bus_id: i.source === "internal" ? i.busId || null : null,
  driver_id: i.driverId || null,
  owner_name: i.source === "rented" ? i.owner.trim() || null : null,
  bus_label: i.source === "rented" ? i.busLabel.trim() || null : null,
  external_driver: i.source === "rented" ? i.externalDriver.trim() || null : null,
  notes: i.notes.trim() || null,
});

export async function addMission(input: MissionInput) {
  const { error } = await supabase.from("missions").insert(missionRow(input));
  if (error) throw error;
}
export async function updateMission(id: string, input: MissionInput) {
  const { error } = await supabase.from("missions").update(missionRow(input)).eq("id", id);
  if (error) throw error;
}
export async function deleteMission(id: string) {
  const { error } = await supabase.from("missions").delete().eq("id", id); // linked postings cascade
  if (error) throw error;
}

// ---- ملف وكفاءة الأسطول (bus master profile + fuel waste) ----

export type FuelBasis = "shift" | "km100" | "km";
export const FUEL_BASIS_LABEL: Record<FuelBasis, string> = { km: "لتر / كيلو", km100: "لتر / 100 كم", shift: "لتر / وردية" };
export const FUEL_BASIS_SHORT: Record<FuelBasis, string> = { km: "ل/كم", km100: "ل/100كم", shift: "ل/وردية" };

export interface BusActivity {
  key: string;
  date: string;
  kind: "وردية" | "رحلة" | "مأمورية" | "حركة يومية";
  route: string;
  client: string;
  driver: string;
  revenue: number;
}

export interface BusMaintenanceRow {
  id: string;
  code: string;
  date: string;
  issue: string;
  status: string;
  parts: { name: string; quantity: number; unitType: string; total: number }[];
  total: number;
}

export interface BusFuelRow {
  id: string;
  date: string;
  driver: string;
  liters: number;
  cost: number;
  odometer: number | null;
  previous: number | null;
  km: number; // المسافة المقطوعة منذ التموين السابق
  ratio: number | null; // لتر لكل كم
}

export interface BusProfileData {
  activities: BusActivity[];
  maintenance: BusMaintenanceRow[];
  fuel: BusFuelRow[];
}

export async function fetchBusProfile(busId: string, range: DateRange): Promise<BusProfileData> {
  const { start, end } = periodBounds(range);
  const [att, disp, trips, orders, fuel] = await Promise.all([
    supabase.from("attendance").select("id, date, status, drivers(name), routes(route_name)").eq("bus_id", busId).gte("date", start).lt("date", end),
    supabase.from("dispatch_shifts").select("id, op_date, route, bus_value, mission_id, rented_op_id, drivers(name), clients(client_name)").eq("bus_id", busId).gte("op_date", start).lt("op_date", end),
    supabase.from("trips").select("id, trip_date, client_name, destination, total_price, status, drivers(name)").eq("bus_id", busId).neq("status", "ملغاة").gte("trip_date", start).lt("trip_date", end),
    supabase.from("maintenance_orders").select("id, order_number, order_date, created_at, issue_description, status, total_cost, maintenance_order_items(quantity, unit_price, inventory(name, unit_type))").eq("bus_id", busId),
    supabase.from("fuel_logs").select("id, date, created_at, odo_start, odo_end, current_odometer, liters, cost, drivers(name)").eq("bus_id", busId).lt("date", end),
  ]);
  for (const r of [att, disp, trips, orders, fuel]) if (r.error) throw r.error;

  const dispatchDates = new Set((disp.data ?? []).map((d: any) => d.op_date));
  const activities: BusActivity[] = [
    ...(disp.data ?? []).map((d: any): BusActivity => ({
      key: `d${d.id}`, date: d.op_date, kind: d.mission_id ? "مأمورية" : "وردية",
      route: d.route ?? "", client: d.clients?.client_name ?? "—", driver: d.drivers?.name ?? "—", revenue: Number(d.bus_value ?? 0),
    })),
    ...(trips.data ?? []).map((t: any): BusActivity => ({
      key: `t${t.id}`, date: String(t.trip_date).slice(0, 10), kind: "رحلة",
      route: t.destination ?? "", client: t.client_name ?? "—", driver: t.drivers?.name ?? "—", revenue: Number(t.total_price ?? 0),
    })),
    // a daily-operations record only counts when no dispatch row already covers that bus-day
    ...(att.data ?? [])
      .filter((a: any) => a.status !== "غائب" && !dispatchDates.has(a.date))
      .map((a: any): BusActivity => ({
        key: `a${a.id}`, date: a.date, kind: "حركة يومية", route: a.routes?.route_name ?? "", client: "—", driver: a.drivers?.name ?? "—", revenue: 0,
      })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const maintenance: BusMaintenanceRow[] = (orders.data ?? [])
    .map((o: any) => ({ o, date: (o.order_date ?? String(o.created_at).slice(0, 10)) as string }))
    .filter(({ date }) => date >= start && date < end)
    .map(({ o, date }) => ({
      id: o.id, code: o.order_number, date, issue: o.issue_description ?? "—", status: o.status ?? "—", total: Number(o.total_cost ?? 0),
      parts: (o.maintenance_order_items ?? []).map((i: any) => ({
        name: i.inventory?.name ?? "صنف", unitType: i.inventory?.unit_type ?? "", quantity: Number(i.quantity ?? 0), total: Number(i.quantity ?? 0) * Number(i.unit_price ?? 0),
      })),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  // distances need the fill before the range, so every fill up to its end is read and then narrowed to it
  const fills = computeFuelFills((fuel.data ?? []).map((f: any) => ({ id: f.id, bus: busId, date: f.date, order: f.created_at ?? "", liters: Number(f.liters ?? 0), cost: Number(f.cost ?? 0), currentOdometer: f.current_odometer ?? null, odoStart: f.odo_start ?? 0, odoEnd: f.odo_end ?? 0 })));
  const driverOf = new Map((fuel.data ?? []).map((f: any) => [f.id, f.drivers?.name ?? "—"]));
  const fuelRows: BusFuelRow[] = [...fills.values()]
    .filter((f) => f.date >= start)
    .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0))
    .map((f) => ({ id: f.id, date: f.date, driver: driverOf.get(f.id) ?? "—", liters: f.liters, cost: f.cost, odometer: f.odometer, previous: f.previous, km: f.distance ?? 0, ratio: f.ratio }));
  return { activities, maintenance, fuel: fuelRows };
}

export interface FuelAnalysis {
  liters: number;
  cost: number;
  km: number;
  units: number; // shifts, or hundreds of km
  actual: number | null;
  target: number | null;
  status: "no-target" | "no-data" | "waste" | "ok";
  wastePct: number;
  wastedLiters: number;
  excessCost: number;
}

/** Actual = liters / shifts (or / (km/100)). Waste when actual > target. */
export function computeFuelAnalysis(input: { liters: number; cost: number; km: number; shifts: number; target: number | null; basis: FuelBasis }): FuelAnalysis {
  const units = input.basis === "km" ? input.km : input.basis === "km100" ? input.km / 100 : input.shifts;
  const base = { liters: input.liters, cost: input.cost, km: input.km, units, target: input.target };
  if (!input.target || input.target <= 0) return { ...base, actual: units > 0 ? input.liters / units : null, status: "no-target", wastePct: 0, wastedLiters: 0, excessCost: 0 };
  if (units <= 0 || input.liters <= 0) return { ...base, actual: null, status: "no-data", wastePct: 0, wastedLiters: 0, excessCost: 0 };
  const actual = input.liters / units;
  if (actual <= input.target) return { ...base, actual, status: "ok", wastePct: 0, wastedLiters: 0, excessCost: 0 };
  const wastedLiters = (actual - input.target) * units;
  const price = input.liters > 0 ? input.cost / input.liters : 0;
  return { ...base, actual, status: "waste", wastePct: ((actual - input.target) / input.target) * 100, wastedLiters, excessCost: wastedLiters * price };
}

export function computeBusProfile(data: BusProfileData, target: number | null, basis: FuelBasis) {
  const revenue = data.activities.reduce((s, a) => s + a.revenue, 0);
  const maintenanceTotal = data.maintenance.reduce((s, m) => s + m.total, 0);
  const liters = data.fuel.reduce((s, f) => s + f.liters, 0);
  const fuelCost = data.fuel.reduce((s, f) => s + f.cost, 0);
  const km = data.fuel.reduce((s, f) => s + f.km, 0);
  // per-km ratios only count fills whose distance since the previous fill is known
  const covered = data.fuel.filter((f) => f.km > 0);
  const coveredLiters = covered.reduce((s, f) => s + f.liters, 0);
  const coveredCost = covered.reduce((s, f) => s + f.cost, 0);
  const shifts = data.activities.length;
  const drivers = new Map<string, number>();
  for (const a of data.activities) if (a.driver !== "—") drivers.set(a.driver, (drivers.get(a.driver) ?? 0) + 1);
  return {
    shifts,
    trips: data.activities.filter((a) => a.kind === "رحلة").length,
    revenue,
    maintenanceTotal,
    liters,
    fuelCost,
    km,
    drivers: [...drivers.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    fuel: basis === "shift" ? computeFuelAnalysis({ liters, cost: fuelCost, km, shifts, target, basis }) : computeFuelAnalysis({ liters: coveredLiters, cost: coveredCost, km, shifts, target, basis }),
  };
}

export async function updateBusFuelTarget(id: string, target: number | null, basis: FuelBasis) {
  const { error } = await supabase.from("buses").update({ fuel_target_ratio: target, fuel_target_basis: basis }).eq("id", id);
  if (error) throw error;
}

// ---- Payroll detail ledgers (كارت التفاصيل الشامل) ----

export interface PayrollTripRow {
  id: string;
  date: string;
  driver: string;
  destination: string;
  client: string;
  fee: number;
}

export async function fetchPayrollTrips(period: Period): Promise<PayrollTripRow[]> {
  const { start, end } = periodBounds(period);
  const { data, error } = await supabase
    .from("trips")
    .select("id, trip_date, client_name, destination, driver_fee, drivers(name)")
    .neq("status", "ملغاة")
    .gte("trip_date", start)
    .lt("trip_date", end)
    .order("trip_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t: any) => ({
    id: t.id,
    date: String(t.trip_date).slice(0, 10),
    driver: t.drivers?.name ?? "",
    destination: t.destination ?? "",
    client: t.client_name ?? "",
    fee: Number(t.driver_fee ?? 0),
  }));
}

export async function fetchEmployeeAttendanceInPeriod(period: Period): Promise<EmployeeAttendanceRow[]> {
  const { start, end } = periodBounds(period);
  const { data, error } = await supabase
    .from("employee_attendance")
    .select("*, employees(name)")
    .gte("date", start)
    .lt("date", end)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((a: any) => ({
    id: a.id,
    employeeId: a.employee_id,
    employee: a.employees?.name ?? "",
    date: a.date,
    status: a.status ?? "",
    notes: a.notes ?? "",
    allowance: Number(a.allowance ?? 0),
    advance: Number(a.advance ?? 0),
    penalty: Number(a.penalty ?? 0),
  }));
}

// ---- عهدة الخزينة (petty cash & custody) ----

export const CUSTODY_PAYROLL_CATEGORY = "مرتبات / سلف";
export const CUSTODY_MAINT_CATEGORY = "صيانة / ورش";
export const CUSTODY_SUPPLIERS_CATEGORY = "موردين";
export const CUSTODY_RENTED_CATEGORY = "السيارات المستأجرة";
export const CUSTODY_CATEGORIES = ["نثرية", "إداريات", "سولار", CUSTODY_MAINT_CATEGORY, CUSTODY_PAYROLL_CATEGORY, CUSTODY_SUPPLIERS_CATEGORY, CUSTODY_RENTED_CATEGORY, "انتقالات", "أخرى"] as const;

export interface CustodyEntry {
  id: string;
  date: string;
  kind: "in" | "out";
  amount: number;
  person: string; // المستلم / صاحب العهدة
  category: string; // بند المصروف (للصرف فقط)
  description: string; // البيان / مصدر العهدة / جهة الصرف
  notes: string;
  /** set when the row was generated automatically by an expense paid from the custody */
  sourceTable: string;
  sourceId: string;
  /** مرتبات / سلف: the driver or employee the amount is advanced to */
  subjectType: "" | "driver" | "employee";
  subjectId: string;
  /** صيانة / ورش */
  busCode: string;
  maintenanceOrderId: string;
  /** موردين: the supplier paid, and the supplier_payments row posted to their statement */
  supplierId: string;
  supplierPaymentId: string;
}

export type CustodyInput = Omit<CustodyEntry, "id" | "sourceTable" | "sourceId" | "subjectType" | "subjectId" | "busCode" | "maintenanceOrderId" | "supplierId" | "supplierPaymentId"> &
  Partial<Pick<CustodyEntry, "sourceTable" | "sourceId" | "subjectType" | "subjectId" | "busCode" | "maintenanceOrderId" | "supplierId">> & { rentedVehicle?: string };

export type CustodyPreset = "day" | "week" | "month" | "custom";

/** Week runs Saturday → Friday (Egyptian work week). */
export function custodyRange(preset: Exclude<CustodyPreset, "custom">, today = new Date().toISOString().slice(0, 10)): DateRange {
  if (preset === "day") return { from: today, to: today };
  if (preset === "month") return rangeForPreset("current", today);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0=Sun … 6=Sat
  const sinceSat = (dow + 1) % 7;
  const from = addDaysIso(today, -sinceSat);
  return { from, to: addDaysIso(from, 6) };
}

export function computeCustody(entries: CustodyEntry[], range: DateRange) {
  const rows = entries
    .filter((e) => inDateRange(e.date, range))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const totalIn = rows.filter((r) => r.kind === "in").reduce((s, r) => s + r.amount, 0);
  const totalOut = rows.filter((r) => r.kind === "out").reduce((s, r) => s + r.amount, 0);
  const byCategory = new Map<string, number>();
  for (const r of rows) if (r.kind === "out") byCategory.set(r.category || "أخرى", (byCategory.get(r.category || "أخرى") ?? 0) + r.amount);
  // رصيد افتتاحي = صافي كل ما قبل بداية الفترة
  const opening = range.from
    ? entries.filter((e) => e.date < range.from).reduce((s, e) => s + (e.kind === "in" ? e.amount : -e.amount), 0)
    : 0;
  return {
    rows,
    totalIn,
    totalOut,
    opening,
    balance: totalIn - totalOut,
    closing: opening + totalIn - totalOut,
    byCategory: Array.from(byCategory.entries()).map(([category, total]) => ({ category, total })),
  };
}

function mapCustody(r: any): CustodyEntry {
  return {
    id: r.id,
    date: r.entry_date,
    kind: r.kind,
    amount: Number(r.amount ?? 0),
    person: r.person ?? "",
    category: r.category ?? "",
    description: r.description ?? "",
    notes: r.notes ?? "",
    sourceTable: r.source_table ?? "",
    sourceId: r.source_id ?? "",
    subjectType: (r.subject_type ?? "") as CustodyEntry["subjectType"],
    subjectId: r.subject_id ?? "",
    busCode: r.bus_code ?? "",
    maintenanceOrderId: r.maintenance_order_id ?? "",
    supplierId: r.supplier_id ?? "",
    supplierPaymentId: r.supplier_payment_id ?? "",
  };
}

export async function fetchCustody(): Promise<CustodyEntry[]> {
  const { data, error } = await pageAll((f, t) => supabase.from("custody_entries").select("*").order("entry_date", { ascending: false }).order("id").range(f, t));
  if (error) throw new Error(dbErrorMessage(error, "تعذر تحميل العهدة"));
  return data.map(mapCustody);
}

const custodyRow = (i: CustodyInput) => ({
  entry_date: i.date,
  kind: i.kind,
  amount: i.amount,
  person: i.person.trim() || null,
  category: i.category.trim() || null,
  description: i.description.trim() || null,
  notes: i.notes.trim() || null,
  source_table: i.sourceTable || null,
  source_id: i.sourceId || null,
  subject_type: i.subjectType || null,
  subject_id: i.subjectId || null,
  bus_code: i.busCode || null,
  maintenance_order_id: i.maintenanceOrderId || null,
  supplier_id: i.supplierId || null,
});

const isSupplierPayout = (i: CustodyInput) => i.kind === "out" && i.category === CUSTODY_SUPPLIERS_CATEGORY && !!i.supplierId;

/** Posts / updates / removes the matching payment on the supplier's statement (the DB trigger moves the balance). */
async function syncSupplierPayment(custodyId: string, existingPaymentId: string, i: CustodyInput): Promise<string> {
  const ref = `مرجع عهدة الخزينة ${custodyId.slice(0, 8)}`;
  if (!isSupplierPayout(i)) {
    if (existingPaymentId) {
      const { error } = await supabase.from("supplier_payments").delete().eq("id", existingPaymentId);
      if (error) throw new Error(dbErrorMessage(error, "تعذر تحديث حساب المورد"));
    }
    return "";
  }
  const payload = {
    supplier_id: i.supplierId,
    amount: i.amount,
    date: i.date,
    method: CUSTODY_SOURCE,
    notes: [i.description, ref].filter(Boolean).join(" — "),
  };
  if (existingPaymentId) {
    const { error } = await supabase.from("supplier_payments").update(payload).eq("id", existingPaymentId);
    if (error) throw new Error(dbErrorMessage(error, "تعذر تحديث حساب المورد"));
    return existingPaymentId;
  }
  const { data, error } = await supabase.from("supplier_payments").insert(payload).select("id").single();
  if (error) throw new Error(dbErrorMessage(error, "تعذر تسجيل الدفعة في حساب المورد"));
  return data.id as string;
}

const isRentedPayout = (i: CustodyInput) => i.kind === "out" && i.category === CUSTODY_RENTED_CATEGORY && !!i.rentedVehicle;
async function syncCustodyRentedAdvance(id: string, i: CustodyInput) {
  await syncRentedAdvanceLink({ table: "custody_entries", id }, isRentedPayout(i) ? { date: i.date, amount: i.amount, vehicle: i.rentedVehicle ?? "", payFrom: CUSTODY_SOURCE, notes: i.description || i.notes } : null);
}

export async function addCustodyEntry(i: CustodyInput) {
  const id = crypto.randomUUID();
  const paymentId = await syncSupplierPayment(id, "", i);
  const { error } = await supabase.from("custody_entries").insert({ ...custodyRow(i), id, supplier_payment_id: paymentId || null });
  if (error) {
    if (paymentId) await supabase.from("supplier_payments").delete().eq("id", paymentId); // roll back the half-saved payout
    throw new Error(dbErrorMessage(error, "تعذر حفظ الحركة"));
  }
  await syncCustodyRentedAdvance(id, i);
}
export async function updateCustodyEntry(id: string, i: CustodyInput) {
  const { data: prev } = await supabase.from("custody_entries").select("supplier_payment_id").eq("id", id).maybeSingle();
  const paymentId = await syncSupplierPayment(id, (prev?.supplier_payment_id as string | null) ?? "", i);
  const { error } = await supabase.from("custody_entries").update({ ...custodyRow(i), supplier_payment_id: paymentId || null }).eq("id", id);
  if (error) throw new Error(dbErrorMessage(error, "تعذر تعديل الحركة"));
  await syncCustodyRentedAdvance(id, i);
}
export async function deleteCustodyEntry(id: string) {
  await syncRentedAdvanceLink({ table: "custody_entries", id }, null);
  const { data: prev } = await supabase.from("custody_entries").select("supplier_payment_id").eq("id", id).maybeSingle();
  const { error } = await supabase.from("custody_entries").delete().eq("id", id);
  if (error) throw new Error(dbErrorMessage(error, "تعذر حذف الحركة"));
  if (prev?.supplier_payment_id) await supabase.from("supplier_payments").delete().eq("id", prev.supplier_payment_id as string);
}

/**
 * Keeps the custody ledger in step with an expense that names «عهدة الخزينة» as its payment source:
 * creates/updates one linked «صرف» row, or removes it when the source is no longer the custody
 * (or the expense is deleted — pass `active: null`).
 */
export async function syncCustodyLink(
  source: { table: string; id: string },
  active: { date: string; amount: number; category: string; description: string; payFrom: string; notes?: string; busCode?: string; maintenanceOrderId?: string; subjectKey?: string } | null,
) {
  const { data: existing, error: findErr } = await supabase.from("custody_entries").select("id").eq("source_table", source.table).eq("source_id", source.id).maybeSingle();
  if (findErr) throw new Error(dbErrorMessage(findErr, "تعذر ربط المصروف بعهدة الخزينة"));
  if (!active || active.payFrom !== CUSTODY_SOURCE || !(active.amount > 0)) {
    if (existing) {
      const { error } = await supabase.from("custody_entries").delete().eq("id", existing.id);
      if (error) throw new Error(dbErrorMessage(error, "تعذر تحديث عهدة الخزينة"));
    }
    return;
  }
  const row = custodyRow({
    date: active.date,
    kind: "out",
    amount: active.amount,
    person: "",
    category: active.category,
    description: active.description,
    notes: active.notes ?? "",
    sourceTable: source.table,
    sourceId: source.id,
    busCode: active.busCode ?? "",
    maintenanceOrderId: active.maintenanceOrderId ?? "",
    ...(active.subjectKey ? { subjectType: active.subjectKey.split(":")[0] as "driver" | "employee", subjectId: active.subjectKey.split(":")[1] ?? "" } : {}),
  });
  const { error } = existing ? await supabase.from("custody_entries").update(row).eq("id", existing.id) : await supabase.from("custody_entries").insert(row);
  if (error) throw new Error(dbErrorMessage(error, "تعذر تسجيل المصروف في عهدة الخزينة"));
}

/** Custody payments made to a driver/employee — counted as advances against their salary. Matched by id, not by name. */
export async function fetchCustodyAdvances(period: Period): Promise<{ type: "driver" | "employee"; id: string; name: string; amount: number }[]> {
  const { start, end } = periodBounds(period);
  const [{ data, error }, { data: exp, error: eErr }] = await Promise.all([
    supabase.from("custody_entries").select("subject_type, subject_id, person, amount").eq("kind", "out").not("subject_type", "is", null).gte("entry_date", start).lt("entry_date", end),
    // مصروفات «مرتبات» المصروفة من الخزينة الرئيسية/غيرها (المصروف من العهدة يُحتسب عبر دفتر العهدة فلا يتكرر)
    supabase.from("expenses").select("subject_type, subject_id, amount, pay_from").eq("category", "مرتبات").not("subject_type", "is", null).neq("pay_from", CUSTODY_SOURCE).gte("date", start).lt("date", end),
  ]);
  if (error) throw new Error(dbErrorMessage(error, "تعذر تحميل سلف العهدة"));
  if (eErr) throw new Error(dbErrorMessage(eErr, "تعذر تحميل سلف المصروفات"));
  return [
    ...(data ?? []).map((r: any) => ({ type: r.subject_type, id: r.subject_id ?? "", name: r.person ?? "", amount: Number(r.amount ?? 0) })),
    ...(exp ?? []).map((r: any) => ({ type: r.subject_type, id: r.subject_id ?? "", name: "", amount: Number(r.amount ?? 0) })),
  ];
}

/** Names are compared trimmed — a trailing space in the drivers table must not hide a driver's shifts. */
export const sameDriver = (a: string, b: string) => a.trim() === b.trim();

/** Totals shown above one driver's filtered shifts: shifts, allowances (overtime), advances & penalties, karta. */
export function computeDriverShiftSummary(shifts: DispatchShift[], attendance: DailyShift[]) {
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const advances = sum(shifts.map((o) => o.advance)) + sum(attendance.map((a) => a.dailyAdvance));
  const penalties = sum(shifts.map((o) => o.penalty)) + sum(attendance.map((a) => a.penalty));
  return {
    shiftCount: shifts.length,
    driverEarnings: sum(shifts.map((o) => o.driverValue)),
    allowances: sum(shifts.map((o) => o.overtime)) + sum(attendance.map((a) => a.overtimeAllowance)),
    advances,
    penalties,
    advancesAndPenalties: advances + penalties,
    karta: sum(shifts.map((o) => o.karta)) + sum(attendance.map((a) => a.tollFee)),
  };
}

// ---- تحصيل / صرف من كشف حساب الشركة → الخزينة ----

/**
 * يسجّل حركة في كشف حساب الشركة مباشرة في دفتر الخزينة (حساب الشركة)؛
 * التحصيل إيداع (دائن) والصرف للشركة سحب (مدين)، وقيد الكشف يُنشأ تلقائيًا بتريجر قاعدة البيانات.
 */
export async function addClientTreasuryEntry(input: { clientName: string; date: string; kind: "in" | "out"; amount: number; notes: string }) {
  if (!(input.amount > 0)) throw new Error("أدخل مبلغًا أكبر من صفر");
  const { data: client, error: cErr } = await supabase.from("clients").select("id").eq("client_name", input.clientName).maybeSingle();
  if (cErr || !client) throw new Error(dbErrorMessage(cErr, "تعذر العثور على الشركة"));
  const note = input.notes.trim() || (input.kind === "in" ? "تحصيل من كشف حساب الشركة" : "صرف للشركة من كشف الحساب");
  await addTreasuryEntry({
    date: input.date,
    account: input.clientName,
    clientId: client.id as string,
    opening: 0,
    deposits: input.kind === "in" ? input.amount : 0,
    withdrawals: input.kind === "out" ? input.amount : 0,
    notes: note,
  });
}

// ---- الإغلاق المالي الشهري المستقل لكل قسم ----

/** آخر رصيد لكل حساب خزينة حتى (ولا يشمل) تاريخ `before`. */
export function computeTreasuryClosings(rows: { date: string; account: string; opening: number; deposits: number; withdrawals: number; createdAt?: string }[], before: string) {
  const last = new Map<string, { date: string; createdAt: string; closing: number }>();
  for (const r of rows) {
    if (r.date >= before) continue;
    const cur = last.get(r.account);
    const at = r.createdAt ?? "";
    if (!cur || r.date > cur.date || (r.date === cur.date && at >= cur.createdAt)) last.set(r.account, { date: r.date, createdAt: at, closing: r.opening + r.deposits - r.withdrawals });
  }
  return [...last.entries()].map(([account, v]) => ({ account, closing: v.closing })).sort((a, b) => a.account.localeCompare(b.account, "ar"));
}

export const CLOSING_MODULES = [
  { key: "clients", title: "إغلاق حسابات الشركات", desc: "ورديات الشركات ومطالباتها وقيود كشف الحساب والرحلات الخارجية. يمكن إغلاق إجمالي الشركات أو شركة بعينها." },
  { key: "payroll", title: "إغلاق مرتبات وأجور الشهر", desc: "تسويات المرتبات وحضور السائقين والموظفين وسلفهم وجزاءاتهم." },
  { key: "suppliers", title: "إغلاق حسابات الموردين", desc: "فواتير ومدفوعات الموردين وتوريدات المخزن، ويشمل مُلّاك السيارات المستأجرة وسلفهم." },
  { key: "workshop", title: "إغلاق الورشة وأوامر الصيانة", desc: "أوامر الصيانة وما صُرف لها من قطع غيار المخزن." },
  { key: "fuel", title: "إغلاق استهلاك السولار والوقود", desc: "سجلات التزود بالوقود وقراءات العداد." },
  { key: "treasury", title: "إغلاق الخزينة والعهدة وترحيل الأرصدة الافتتاحية", desc: "حركات الخزينة والعهدة والمصروفات، ويُرحَّل رصيد كل حساب خزينة كرصيد افتتاحي للشهر الجديد." },
] as const;
export type ClosingModule = (typeof CLOSING_MODULES)[number]["key"];

export interface ModuleClosing {
  id: string;
  month: string;
  module: ClosingModule;
  clientId: string;
  clientName: string;
  locked: boolean;
  snapshot: Record<string, any>;
  closedAt: string;
  closedBy: string;
  unlockedBy: string;
}

export async function fetchModuleClosings(month: string): Promise<ModuleClosing[]> {
  const { data, error } = await supabase.from("module_closings").select("*, clients(client_name)").eq("month", month).order("closed_at");
  if (error) throw new Error(dbErrorMessage(error, "تعذر تحميل حالة الإغلاق"));
  return (data ?? []).map((r: any) => ({ id: r.id, month: r.month, module: r.module, clientId: r.client_id ?? "", clientName: r.clients?.client_name ?? "", locked: r.locked !== false, snapshot: r.snapshot ?? {}, closedAt: r.closed_at, closedBy: r.closed_by ?? "", unlockedBy: r.unlocked_by ?? "" }));
}

/** لقطة الإغلاق لكل قسم (وأي ترحيل لازم يحصل قبل القفل). */
async function buildClosingSnapshot(month: string, module: ClosingModule, clientId: string): Promise<{ snapshot: Record<string, any>; carry?: () => Promise<void> }> {
  const next = nextMonthPrefix(month);
  const start = `${month}-01`;
  const nextStart = `${next}-01`;
  const period: Period = month;
  if (module === "treasury") {
    const [{ data: tRows, error }, custody] = await Promise.all([
      pageAll((f, t) => supabase.from("treasury").select("date, account, opening, deposits, withdrawals, created_at").lt("date", nextStart).order("id").range(f, t)),
      fetchCustody(),
    ]);
    if (error) throw new Error(dbErrorMessage(error, "تعذر قراءة الخزينة"));
    const treasury = computeTreasuryClosings((tRows ?? []).map((r: any) => ({ date: r.date, account: r.account, opening: Number(r.opening ?? 0), deposits: Number(r.deposits ?? 0), withdrawals: Number(r.withdrawals ?? 0), createdAt: r.created_at })), nextStart);
    const snapshot = { treasury, treasuryTotal: treasury.reduce((s, t) => s + t.closing, 0), custodyClosing: computeCustody(custody, { from: "", to: `${month}-31` }).closing };
    const carry = async () => {
      const { data: existing } = await supabase.from("treasury").select("account").eq("is_rollover", true).eq("date", nextStart);
      const have = new Set((existing ?? []).map((r: any) => r.account as string));
      const rows = treasury.filter((t) => !have.has(t.account)).map((t) => ({ date: nextStart, account: t.account, opening: t.closing, deposits: 0, withdrawals: 0, is_rollover: true, notes: `رصيد افتتاحي — ترحيل من إغلاق ${month}` }));
      if (rows.length) {
        const { error: e } = await supabase.from("treasury").insert(rows);
        if (e) throw new Error(dbErrorMessage(e, "تعذر ترحيل أرصدة الخزينة"));
      }
    };
    return { snapshot, carry };
  }
  if (module === "clients") {
    const [{ data: shifts, error: sErr }, { data: ledger, error: lErr }, { data: clients }] = await Promise.all([
      pageAll((f, t) => supabase.from("dispatch_shifts").select("client_id, bus_value").lt("op_date", nextStart).order("id").range(f, t)),
      pageAll((f, t) => supabase.from("client_ledger_entries").select("client_id, debit, credit").lt("entry_date", nextStart).order("id").range(f, t)),
      supabase.from("clients").select("id, client_name"),
    ]);
    if (sErr) throw new Error(dbErrorMessage(sErr, "تعذر قراءة ورديات الشركات"));
    if (lErr) throw new Error(dbErrorMessage(lErr, "تعذر قراءة قيود الشركات"));
    const names = new Map((clients ?? []).map((c: any) => [c.id as string, c.client_name as string]));
    const recv = new Map<string, number>();
    for (const x of shifts ?? []) if ((x as any).client_id) recv.set((x as any).client_id, (recv.get((x as any).client_id) ?? 0) + Number((x as any).bus_value ?? 0));
    for (const e of ledger ?? []) recv.set((e as any).client_id, (recv.get((e as any).client_id) ?? 0) + Number((e as any).debit ?? 0) - Number((e as any).credit ?? 0));
    const list = [...recv.entries()].filter(([id, v]) => (!clientId || id === clientId) && Math.abs(v) > 0.001).map(([id, closing]) => ({ client: names.get(id) ?? id, closing })).sort((a, b) => b.closing - a.closing);
    return { snapshot: { receivable: list, total: list.reduce((s, c) => s + c.closing, 0) } };
  }
  if (module === "payroll") {
    const [drivers, employees, adj] = await Promise.all([fetchDriverPayroll(period), fetchEmployeePayroll(period), fetchPayrollAdjustments(period)]);
    let adjTotal = 0;
    for (const a of adj.values()) adjTotal += a.bonus - a.advances - a.penalties - a.tolls;
    return { snapshot: { drivers: drivers.length, employees: employees.length, payrollNet: drivers.reduce((s, d) => s + d.netSalary, 0) + employees.reduce((s, e) => s + e.netSalary, 0) + adjTotal } };
  }
  if (module === "suppliers") {
    const [suppliers, { data: rented }] = await Promise.all([
      fetchSuppliers(),
      pageAll((f, t) => supabase.from("rented_bus_operations").select("rental_fare, advance_applied, paid").eq("paid", false).lt("op_date", nextStart).order("id").range(f, t)),
    ]);
    const payable = suppliers.reduce((s, x) => s + x.balanceDue, 0);
    const owners = (rented ?? []).reduce((s: number, r: any) => s + Number(r.rental_fare ?? 0), 0);
    return { snapshot: { suppliersPayable: payable, suppliersCount: suppliers.length, rentedOwnersUnpaid: owners } };
  }
  if (module === "workshop") {
    const [{ data: orders }, { data: out }] = await Promise.all([
      supabase.from("maintenance_orders").select("total_cost, labor_cost, status").gte("order_date", start).lt("order_date", nextStart),
      supabase.from("inventory_transactions").select("total_cost").eq("type", "OUT").gte("created_at", start).lt("created_at", nextStart),
    ]);
    const active = (orders ?? []).filter((o: any) => o.status !== "ملغي");
    return { snapshot: { orders: active.length, totalCost: active.reduce((s: number, o: any) => s + Number(o.total_cost ?? 0), 0), labor: active.reduce((s: number, o: any) => s + Number(o.labor_cost ?? 0), 0), partsFromStock: (out ?? []).reduce((s: number, t: any) => s + Number(t.total_cost ?? 0), 0) } };
  }
  const { data: fuel } = await pageAll((f, t) => supabase.from("fuel_logs").select("liters, cost").gte("date", start).lt("date", nextStart).order("id").range(f, t));
  return { snapshot: { fills: (fuel ?? []).length, liters: (fuel ?? []).reduce((s: number, r: any) => s + Number(r.liters ?? 0), 0), cost: (fuel ?? []).reduce((s: number, r: any) => s + Number(r.cost ?? 0), 0) } };
}

/** يقفل قسمًا واحدًا لشهر معيّن (الشركات: إجمالي أو شركة محددة). يعمل أيضًا كـ«إعادة قفل» بعد فتح التعديل. */
export async function closeModuleMonth(month: string, module: ClosingModule, clientId = "") {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("اختر الشهر");
  const cid = module === "clients" ? clientId : "";
  let q = supabase.from("module_closings").select("id, locked").eq("month", month).eq("module", module);
  q = cid ? q.eq("client_id", cid) : q.is("client_id", null);
  const { data: existing } = await q.maybeSingle();
  if (existing && existing.locked !== false) throw new Error("هذا القسم مغلق بالفعل لهذا الشهر");
  const { snapshot, carry } = await buildClosingSnapshot(month, module, cid);
  if (carry) await carry();
  const who = (await supabase.auth.getUser()).data.user?.email || "";
  const row = { snapshot, locked: true, closed_at: new Date().toISOString(), closed_by: who || null };
  const { error } = existing
    ? await supabase.from("module_closings").update(row).eq("id", existing.id)
    : await supabase.from("module_closings").insert({ ...row, month, module, client_id: cid || null });
  if (error) throw new Error(dbErrorMessage(error, "تعذر حفظ الإغلاق"));
}

/** إلغاء الإغلاق / فتح التعديل لقسم واحد (للأدمن فقط — يفرضه تريجر قاعدة البيانات أيضًا). */
export async function unlockModuleMonth(id: string) {
  const who = (await supabase.auth.getUser()).data.user?.email || "";
  const { error } = await supabase.from("module_closings").update({ locked: false, unlocked_at: new Date().toISOString(), unlocked_by: who || null }).eq("id", id);
  if (error) throw new Error(dbErrorMessage(error, "تعذر فتح التعديل"));
}

// ---- مؤشر كفاءة السولار لكل عربية (من سجلات السولار وقراءات العداد) ----

export interface FleetFuelRow {
  bus: string;
  liters: number;
  km: number;
  per100: number | null; // لتر / 100 كم
  target: number | null;
  basis: "shift" | "km100" | "km";
  status: "waste" | "ok" | "no-target" | "no-data";
  wastePct: number;
}

/** متوسط الاستهلاك لكل عربية ومقارنته بمعيارها؛ التنبيه يعمل لمعايير (لتر/100كم) و(لتر/كم) من العداد. */
export function computeFleetFuelRows(
  buses: { code: string; fuelTarget: number | null; fuelBasis: "shift" | "km100" | "km" }[],
  summaries: BusFuelSummary[],
): FleetFuelRow[] {
  const byBus = new Map(summaries.map((s) => [s.bus, s]));
  return buses
    .map((b) => {
      const s = byBus.get(b.code);
      const per100 = s && s.kmPerLiter > 0 ? Math.round((100 / s.kmPerLiter) * 100) / 100 : null;
      const base = { bus: b.code, liters: s?.liters ?? 0, km: s?.km ?? 0, per100, target: b.fuelTarget, basis: b.fuelBasis };
      if (per100 == null) return { ...base, status: "no-data" as const, wastePct: 0 };
      if (!b.fuelTarget || b.fuelTarget <= 0 || b.fuelBasis === "shift") return { ...base, status: "no-target" as const, wastePct: 0 };
      const actual = b.fuelBasis === "km" ? per100 / 100 : per100;
      return actual > b.fuelTarget
        ? { ...base, status: "waste" as const, wastePct: ((actual - b.fuelTarget) / b.fuelTarget) * 100 }
        : { ...base, status: "ok" as const, wastePct: 0 };
    })
    .sort((a, b) => (a.status === "waste" ? 0 : 1) - (b.status === "waste" ? 0 : 1) || b.wastePct - a.wastePct);
}

// ---- تنبيه الرخص المنتهية (تنبيه فقط — لا يمنع الحفظ) ----

export const LICENSE_WARNING_MESSAGE = "تنبيه: رخصة السائق أو الأتوبيس منتهية الصلاحية (يرجى سرعة التجديد)";

/** تاريخ صالح بصيغة YYYY-MM-DD وأقدم من اليوم = منتهي (غير المسجَّل «—» لا يحجب). */
export const isExpiredDate = (d: string | null | undefined, today = new Date().toISOString().slice(0, 10)) => !!d && /^\d{4}-\d{2}-\d{2}/.test(d) && d.slice(0, 10) < today;

export function licenseIssues(
  driverLicenseExpiry: string | undefined,
  bus: { licenseExpiry: string; insuranceExpiry: string } | undefined,
  today?: string,
) {
  return {
    driver: isExpiredDate(driverLicenseExpiry, today),
    bus: !!bus && (isExpiredDate(bus.licenseExpiry, today) || isExpiredDate(bus.insuranceExpiry, today)),
  };
}

export interface FuelAlert extends FleetFuelRow {
  reason: "target" | "average";
  fleetAvg: number | null;
}

/**
 * عربيات استهلاكها أعلى من الطبيعي: تجاوز معيارها المحدد، أو (بدون معيار) أعلى من متوسط الأسطول بنسبة `margin`.
 * متوسط الأسطول يحتاج 3 عربيات على الأقل ببيانات عداد.
 */
export function computeFuelAlerts(rows: FleetFuelRow[], margin = 0.3): FuelAlert[] {
  const withData = rows.filter((r) => r.per100 != null);
  const avg = withData.length >= 3 ? withData.reduce((s, r) => s + (r.per100 ?? 0), 0) / withData.length : null;
  const out: FuelAlert[] = [];
  for (const r of rows) {
    if (r.status === "waste") out.push({ ...r, reason: "target", fleetAvg: avg });
    else if (r.status === "no-target" && avg != null && r.per100 != null && r.per100 > avg * (1 + margin)) {
      out.push({ ...r, reason: "average", fleetAvg: avg, wastePct: ((r.per100 - avg) / avg) * 100 });
    }
  }
  return out.sort((a, b) => b.wastePct - a.wastePct);
}
