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

export async function addBus(input: { code: string; plate: string; model: string; capacity: number; odometer: number; status?: string }) {
  const { error } = await supabase.from("buses").insert({
    bus_code: input.code,
    plate_number: input.plate,
    model: input.model,
    capacity: input.capacity,
    odometer: input.odometer,
    status: input.status ?? "تعمل",
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
  if (error) {
    if (error.code === "23505") throw new Error(`الأتوبيس ${input.busCode} مخصص بالفعل لخط آخر`);
    throw error;
  }
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
  const { data, error } = await supabase.from("fuel_logs").select("liters, odo_start, odo_end, buses(bus_code)");
  if (error) throw error;
  const rows = (data ?? []).map((row: any) => ({
    liters: row.liters,
    odo_start: row.odo_start,
    odo_end: row.odo_end,
    bus_code: row.buses?.bus_code ?? "—",
  }));
  return computeFuelEfficiency(rows);
}

export function computeMonthlyFinance(
  treasuryRows: { date: string; deposits: number }[],
  expenseRows: { date: string; amount: number }[],
): { month: string; الإيرادات: number; المصروفات: number }[] {
  const monthKey = (d: string) => new Date(d).toLocaleDateString("ar-EG", { month: "long" });
  const byMonth = new Map<string, { rev: number; exp: number }>();
  for (const row of treasuryRows) {
    const k = monthKey(row.date);
    const e = byMonth.get(k) ?? { rev: 0, exp: 0 };
    e.rev += Number(row.deposits ?? 0);
    byMonth.set(k, e);
  }
  for (const row of expenseRows) {
    const k = monthKey(row.date);
    const e = byMonth.get(k) ?? { rev: 0, exp: 0 };
    e.exp += Number(row.amount ?? 0);
    byMonth.set(k, e);
  }
  return Array.from(byMonth.entries()).map(([month, v]) => ({ month, الإيرادات: v.rev, المصروفات: v.exp }));
}

export async function fetchMonthlyFinance(): Promise<{ month: string; الإيرادات: number; المصروفات: number }[]> {
  const [{ data: treasuryData, error: e1 }, { data: expenseData, error: e2 }] = await Promise.all([
    supabase.from("treasury").select("date, deposits"),
    supabase.from("expenses").select("date, amount"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return computeMonthlyFinance((treasuryData ?? []) as any, (expenseData ?? []) as any);
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

export async function fetchAttendanceSummary(driverName: string, monthPrefix: string) {
  const { data, error } = await supabase
    .from("attendance")
    .select("status, drivers(name)")
    .gte("date", `${monthPrefix}-01`)
    .lt("date", `${monthPrefix}-32`);
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
  role: "admin" | "accountant" | "dispatcher" | "staff" | "pending";
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
  date: string;
  status: string;
  overtimeAllowance: number;
  dailyAdvance: number;
  penalty: number;
  notes: string;
}

export async function fetchDailyShifts(monthPrefix: string): Promise<DailyShift[]> {
  const { data, error } = await supabase
    .from("attendance")
    .select("*, drivers(name)")
    .gte("date", `${monthPrefix}-01`)
    .lt("date", `${monthPrefix}-32`)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((a: any) => ({
    id: a.id,
    driverId: a.driver_id,
    driver: a.drivers?.name ?? "—",
    date: a.date,
    status: a.status ?? "حاضر",
    overtimeAllowance: Number(a.overtime_allowance ?? 0),
    dailyAdvance: Number(a.daily_advance ?? 0),
    penalty: Number(a.penalty ?? 0),
    notes: a.notes ?? "",
  }));
}

export async function upsertDailyShift(input: {
  driverName: string;
  date: string;
  status: string;
  overtimeAllowance: number;
  dailyAdvance: number;
  penalty: number;
  notes: string;
}) {
  const { data: driver } = await supabase.from("drivers").select("id").eq("name", input.driverName).maybeSingle();
  if (!driver) throw new Error("لم يتم العثور على سائق بهذا الاسم");
  const { data: existing } = await supabase
    .from("attendance")
    .select("id")
    .eq("driver_id", driver.id)
    .eq("date", input.date)
    .maybeSingle();
  const payload = {
    driver_id: driver.id,
    date: input.date,
    status: input.status,
    overtime_allowance: input.overtimeAllowance,
    daily_advance: input.dailyAdvance,
    penalty: input.penalty,
    notes: input.notes,
  };
  if (existing) {
    const { error } = await supabase.from("attendance").update(payload).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("attendance").insert(payload);
    if (error) throw error;
  }
}

export interface DriverPayrollRow {
  driver: string;
  baseSalary: number;
  totalOvertime: number;
  totalAdvances: number;
  totalPenalties: number;
  netSalary: number;
}

export function computeDriverPayroll(
  drivers: { name: string; base_salary: number }[],
  shifts: { driver: string; overtimeAllowance: number; dailyAdvance: number; penalty: number }[],
): DriverPayrollRow[] {
  return drivers.map((d) => {
    const rows = shifts.filter((s) => s.driver === d.name);
    const totalOvertime = rows.reduce((sum, r) => sum + r.overtimeAllowance, 0);
    const totalAdvances = rows.reduce((sum, r) => sum + r.dailyAdvance, 0);
    const totalPenalties = rows.reduce((sum, r) => sum + r.penalty, 0);
    const baseSalary = Number(d.base_salary ?? 0);
    return {
      driver: d.name,
      baseSalary,
      totalOvertime,
      totalAdvances,
      totalPenalties,
      netSalary: baseSalary + totalOvertime - (totalAdvances + totalPenalties),
    };
  });
}

export async function fetchDriverPayroll(monthPrefix: string): Promise<DriverPayrollRow[]> {
  const [{ data: drivers, error: dErr }, shifts] = await Promise.all([
    supabase.from("drivers").select("name, base_salary"),
    fetchDailyShifts(monthPrefix),
  ]);
  if (dErr) throw dErr;
  return computeDriverPayroll(
    (drivers ?? []).map((d: any) => ({ name: d.name, base_salary: Number(d.base_salary ?? 0) })),
    shifts.map((s) => ({ driver: s.driver, overtimeAllowance: s.overtimeAllowance, dailyAdvance: s.dailyAdvance, penalty: s.penalty })),
  );
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
