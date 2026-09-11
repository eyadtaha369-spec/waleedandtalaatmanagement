import { supabase } from "@/lib/supabase";
import type {
  Bus,
  Driver,
  Attendance,
  BusRoute,
  Student,
  MaintenanceOrder,
  InventoryItem,
  FuelLog,
  TreasuryEntry,
  Expense,
  Loan,
  Payslip,
} from "@/lib/fleet-data";

// ---- Fleet ----

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
    capacity: b.capacity ?? 0,
    odometer: b.odometer ?? 0,
    licenseExpiry: b.license_expiry ?? "—",
    insuranceExpiry: b.insurance_expiry ?? "—",
    lastMaintenance: "—",
    driver: b.routes?.[0]?.drivers?.name ?? "—",
    status: b.status ?? "تعمل",
  }));
}

export async function addBus(input: { code: string; plate: string; model: string; capacity: number; odometer: number }) {
  const { error } = await supabase.from("buses").insert({
    bus_code: input.code,
    plate_number: input.plate,
    model: input.model,
    capacity: input.capacity,
    odometer: input.odometer,
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

export async function addDriver(input: { name: string; phone: string; license: string; licenseExpiry: string }) {
  const { error } = await supabase.from("drivers").insert({
    driver_code: `DRV-${Date.now().toString().slice(-6)}`,
    name: input.name,
    phone: input.phone,
    license_type: input.license,
    license_expiry: input.licenseExpiry || null,
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
  if (error) throw error;
}

export async function fetchStudents(): Promise<Student[]> {
  const { data, error } = await supabase.from("students").select("*, routes(route_name)").order("name");
  if (error) throw error;
  return (data ?? []).map((s: any) => ({
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
    .select("*, buses(bus_code)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((o: any) => ({
    id: o.id,
    code: o.order_number,
    bus: o.buses?.bus_code ?? "—",
    issue: o.issue_description ?? "—",
    parts: o.parts ?? "—",
    cost: Number(o.total_cost ?? 0),
    status: o.status ?? "بانتظار القطع",
  }));
}

export async function addMaintenanceOrder(input: { busCode: string; issue: string; parts: string; cost: number }) {
  const { data: bus } = await supabase.from("buses").select("id").eq("bus_code", input.busCode).maybeSingle();
  const { error } = await supabase.from("maintenance_orders").insert({
    order_number: `MO-${Date.now().toString().slice(-6)}`,
    bus_id: bus?.id ?? null,
    issue_description: input.issue,
    parts: input.parts,
    total_cost: input.cost,
    status: "بانتظار القطع",
  });
  if (error) throw error;
}

export async function updateMaintenanceStatus(id: string, status: string) {
  const { error } = await supabase.from("maintenance_orders").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function fetchInventory(): Promise<InventoryItem[]> {
  const { data, error } = await supabase.from("inventory").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map((i: any) => ({
    id: i.id,
    name: i.name,
    code: i.code,
    stock: i.stock ?? 0,
    minStock: i.min_stock ?? 0,
    unitPrice: Number(i.unit_price ?? 0),
  }));
}

export async function addInventoryItem(input: { name: string; code: string; stock: number; minStock: number; unitPrice: number }) {
  const { error } = await supabase.from("inventory").insert({
    name: input.name,
    code: input.code,
    stock: input.stock,
    min_stock: input.minStock,
    unit_price: input.unitPrice,
  });
  if (error) throw error;
}

export async function fetchFuelLogs(): Promise<FuelLog[]> {
  const { data, error } = await supabase
    .from("fuel_logs")
    .select("*, buses(bus_code)")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((f: any) => ({
    id: f.id,
    date: f.date,
    bus: f.buses?.bus_code ?? "—",
    odoStart: f.odo_start ?? 0,
    odoEnd: f.odo_end ?? 0,
    liters: Number(f.liters ?? 0),
    cost: Number(f.cost ?? 0),
    station: f.station ?? "—",
  }));
}

export async function addFuelLog(input: { busCode: string; odoStart: number; odoEnd: number; liters: number; cost: number; station: string }) {
  const { data: bus } = await supabase.from("buses").select("id").eq("bus_code", input.busCode).maybeSingle();
  const { error } = await supabase.from("fuel_logs").insert({
    bus_id: bus?.id ?? null,
    odo_start: input.odoStart,
    odo_end: input.odoEnd,
    liters: input.liters,
    cost: input.cost,
    station: input.station,
  });
  if (error) throw error;
}

// ---- Finance ----

export async function fetchTreasury(): Promise<TreasuryEntry[]> {
  const { data, error } = await supabase.from("treasury").select("*").order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t: any) => ({
    id: t.id,
    date: t.date,
    account: t.account,
    opening: Number(t.opening ?? 0),
    deposits: Number(t.deposits ?? 0),
    withdrawals: Number(t.withdrawals ?? 0),
  }));
}

export async function addTreasuryEntry(input: { account: string; opening: number; deposits: number; withdrawals: number }) {
  const { error } = await supabase.from("treasury").insert({
    account: input.account,
    opening: input.opening,
    deposits: input.deposits,
    withdrawals: input.withdrawals,
  });
  if (error) throw error;
}

export async function fetchExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase.from("expenses").select("*").order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((e: any) => ({
    id: e.id,
    date: e.date,
    category: e.category,
    supplier: e.supplier ?? "—",
    amount: Number(e.amount ?? 0),
    supplierBalance: Number(e.supplier_balance ?? 0),
  }));
}

export async function addExpense(input: { category: string; supplier: string; amount: number; supplierBalance: number }) {
  const { error } = await supabase.from("expenses").insert({
    category: input.category,
    supplier: input.supplier,
    amount: input.amount,
    supplier_balance: input.supplierBalance,
  });
  if (error) throw error;
}

export async function fetchLoans(): Promise<Loan[]> {
  const { data, error } = await supabase.from("loans").select("*").order("next_due");
  if (error) throw error;
  return (data ?? []).map((l: any) => ({
    id: l.id,
    lender: l.lender,
    total: Number(l.total ?? 0),
    paid: Number(l.paid ?? 0),
    installment: Number(l.installment ?? 0),
    nextDue: l.next_due ?? "—",
  }));
}

export async function addLoan(input: { lender: string; total: number; paid: number; installment: number; nextDue: string }) {
  const { error } = await supabase.from("loans").insert({
    lender: input.lender,
    total: input.total,
    paid: input.paid,
    installment: input.installment,
    next_due: input.nextDue || null,
  });
  if (error) throw error;
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

export async function fetchFuelChart(): Promise<{ bus: string; "لتر/100كم": number }[]> {
  const { data, error } = await supabase.from("fuel_logs").select("liters, odo_start, odo_end, buses(bus_code)");
  if (error) throw error;
  const totals = new Map<string, { liters: number; km: number }>();
  for (const row of (data ?? []) as any[]) {
    const code = row.buses?.bus_code ?? "—";
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

export async function fetchMonthlyFinance(): Promise<{ month: string; الإيرادات: number; المصروفات: number }[]> {
  const [{ data: treasuryData, error: e1 }, { data: expenseData, error: e2 }] = await Promise.all([
    supabase.from("treasury").select("date, deposits"),
    supabase.from("expenses").select("date, amount"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const monthKey = (d: string) => new Date(d).toLocaleDateString("ar-EG", { month: "long" });
  const byMonth = new Map<string, { rev: number; exp: number }>();
  for (const row of (treasuryData ?? []) as any[]) {
    const k = monthKey(row.date);
    const e = byMonth.get(k) ?? { rev: 0, exp: 0 };
    e.rev += Number(row.deposits ?? 0);
    byMonth.set(k, e);
  }
  for (const row of (expenseData ?? []) as any[]) {
    const k = monthKey(row.date);
    const e = byMonth.get(k) ?? { rev: 0, exp: 0 };
    e.exp += Number(row.amount ?? 0);
    byMonth.set(k, e);
  }
  return Array.from(byMonth.entries()).map(([month, v]) => ({ month, الإيرادات: v.rev, المصروفات: v.exp }));
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
