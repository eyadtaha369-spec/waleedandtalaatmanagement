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

export function nextMonthPrefix(monthPrefix: string): string {
  const [y, m] = monthPrefix.split("-").map(Number);
  const next = new Date(Date.UTC(y!, m!, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
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
  busId: string | null;
  bus: string;
  routeId: string | null;
  route: string;
  shiftFrom: string;
  shiftTo: string;
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
    .select("*, drivers(name), buses(bus_code), routes(route_name)")
    .gte("date", `${monthPrefix}-01`)
    .lt("date", `${nextMonthPrefix(monthPrefix)}-01`)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((a: any) => ({
    id: a.id,
    driverId: a.driver_id,
    driver: a.drivers?.name ?? "—",
    busId: a.bus_id,
    bus: a.buses?.bus_code ?? "—",
    routeId: a.route_id,
    route: a.routes?.route_name ?? "—",
    shiftFrom: a.shift_from ?? "",
    shiftTo: a.shift_to ?? "",
    date: a.date,
    status: a.status ?? "حاضر",
    overtimeAllowance: Number(a.overtime_allowance ?? 0),
    dailyAdvance: Number(a.daily_advance ?? 0),
    penalty: Number(a.penalty ?? 0),
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

// ---- Update / delete: every editable entity ----

export async function updateBus(id: string, input: { code: string; plate: string; model: string; capacity: number; odometer: number; status?: string }) {
  const { error } = await supabase.from("buses").update({
    bus_code: input.code,
    plate_number: input.plate,
    model: input.model,
    capacity: input.capacity,
    odometer: input.odometer,
    status: input.status ?? "تعمل",
  }).eq("id", id);
  if (error) throw error;
}
export async function deleteBus(id: string) {
  const { error } = await supabase.from("buses").delete().eq("id", id);
  if (error) throw error;
}

export async function updateDriver(id: string, input: { name: string; phone: string; license: string; licenseExpiry: string }) {
  const { error } = await supabase.from("drivers").update({
    name: input.name,
    phone: input.phone,
    license_type: input.license,
    license_expiry: input.licenseExpiry || null,
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

export async function updateMaintenanceOrder(id: string, input: { busCode: string; issue: string; parts: string; cost: number; status: string }) {
  const { data: bus } = await supabase.from("buses").select("id").eq("bus_code", input.busCode).maybeSingle();
  const { error } = await supabase.from("maintenance_orders").update({
    bus_id: bus?.id ?? null,
    issue_description: input.issue,
    parts: input.parts,
    total_cost: input.cost,
    status: input.status,
  }).eq("id", id);
  if (error) throw error;
}
export async function deleteMaintenanceOrder(id: string) {
  const { error } = await supabase.from("maintenance_orders").delete().eq("id", id);
  if (error) throw error;
}

export async function updateInventoryItem(id: string, input: { name: string; code: string; stock: number; minStock: number; unitPrice: number }) {
  const { error } = await supabase.from("inventory").update({
    name: input.name,
    code: input.code,
    stock: input.stock,
    min_stock: input.minStock,
    unit_price: input.unitPrice,
  }).eq("id", id);
  if (error) throw error;
}
export async function deleteInventoryItem(id: string) {
  const { error } = await supabase.from("inventory").delete().eq("id", id);
  if (error) throw error;
}

export async function updateFuelLog(id: string, input: { busCode: string; odoStart: number; odoEnd: number; liters: number; cost: number; station: string }) {
  const { data: bus } = await supabase.from("buses").select("id").eq("bus_code", input.busCode).maybeSingle();
  const { error } = await supabase.from("fuel_logs").update({
    bus_id: bus?.id ?? null,
    odo_start: input.odoStart,
    odo_end: input.odoEnd,
    liters: input.liters,
    cost: input.cost,
    station: input.station,
  }).eq("id", id);
  if (error) throw error;
}
export async function deleteFuelLog(id: string) {
  const { error } = await supabase.from("fuel_logs").delete().eq("id", id);
  if (error) throw error;
}

export async function updateTreasuryEntry(id: string, input: { account: string; opening: number; deposits: number; withdrawals: number }) {
  const { error } = await supabase.from("treasury").update({
    account: input.account,
    opening: input.opening,
    deposits: input.deposits,
    withdrawals: input.withdrawals,
  }).eq("id", id);
  if (error) throw error;
}
export async function deleteTreasuryEntry(id: string) {
  const { error } = await supabase.from("treasury").delete().eq("id", id);
  if (error) throw error;
}

export async function updateExpense(id: string, input: { category: string; supplier: string; amount: number; supplierBalance: number }) {
  const { error } = await supabase.from("expenses").update({
    category: input.category,
    supplier: input.supplier,
    amount: input.amount,
    supplier_balance: input.supplierBalance,
  }).eq("id", id);
  if (error) throw error;
}
export async function deleteExpense(id: string) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

export async function updateLoan(id: string, input: { lender: string; total: number; paid: number; installment: number; nextDue: string }) {
  const { error } = await supabase.from("loans").update({
    lender: input.lender,
    total: input.total,
    paid: input.paid,
    installment: input.installment,
    next_due: input.nextDue || null,
  }).eq("id", id);
  if (error) throw error;
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

export interface DailyOperation {
  id: string;
  date: string;
  busId: string | null;
  bus: string;
  driverId: string | null;
  driver: string;
  gasCost: number;
  gasLiters: number;
  odometerReading: number;
  client1Id: string | null;
  client1: string;
  route1: string;
  fare1: number;
  client2Id: string | null;
  client2: string;
  route2: string;
  fare2: number;
  notes: string;
}

export async function fetchDailyOperations(monthPrefix: string): Promise<DailyOperation[]> {
  const { data, error } = await supabase
    .from("daily_bus_operations")
    .select("*, buses(bus_code), drivers(name), client1:client_id_1(client_name), client2:client_id_2(client_name)")
    .gte("op_date", `${monthPrefix}-01`)
    .lt("op_date", `${nextMonthPrefix(monthPrefix)}-01`)
    .order("op_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((o: any) => ({
    id: o.id,
    date: o.op_date,
    busId: o.bus_id,
    bus: o.buses?.bus_code ?? "—",
    driverId: o.driver_id,
    driver: o.drivers?.name ?? "—",
    gasCost: Number(o.gas_cost ?? 0),
    gasLiters: Number(o.gas_liters ?? 0),
    odometerReading: Number(o.odometer_reading ?? 0),
    client1Id: o.client_id_1,
    client1: o.client1?.client_name ?? "—",
    route1: o.route_1 ?? "",
    fare1: Number(o.fare_1 ?? 0),
    client2Id: o.client_id_2,
    client2: o.client2?.client_name ?? "—",
    route2: o.route_2 ?? "",
    fare2: Number(o.fare_2 ?? 0),
    notes: o.notes ?? "",
  }));
}

interface DailyOperationInput {
  date: string;
  busCode: string;
  driverName: string;
  gasCost: number;
  gasLiters: number;
  odometerReading: number;
  client1Name: string;
  route1: string;
  fare1: number;
  client2Name: string;
  route2: string;
  fare2: number;
  notes: string;
}

async function resolveDailyOperationPayload(input: DailyOperationInput) {
  const [{ data: bus }, { data: driver }, { data: client1 }, { data: client2 }] = await Promise.all([
    input.busCode.trim() ? supabase.from("buses").select("id").eq("bus_code", input.busCode).maybeSingle() : Promise.resolve({ data: null }),
    input.driverName.trim() ? supabase.from("drivers").select("id").eq("name", input.driverName).maybeSingle() : Promise.resolve({ data: null }),
    input.client1Name.trim() ? supabase.from("clients").select("id").eq("client_name", input.client1Name).maybeSingle() : Promise.resolve({ data: null }),
    input.client2Name.trim() ? supabase.from("clients").select("id").eq("client_name", input.client2Name).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    op_date: input.date,
    bus_id: bus?.id ?? null,
    driver_id: driver?.id ?? null,
    gas_cost: input.gasCost,
    gas_liters: input.gasLiters,
    odometer_reading: input.odometerReading,
    client_id_1: client1?.id ?? null,
    route_1: input.route1 || null,
    fare_1: input.fare1,
    client_id_2: client2?.id ?? null,
    route_2: input.route2 || null,
    fare_2: input.fare2,
    notes: input.notes,
  };
}

export async function addDailyOperation(input: DailyOperationInput) {
  const payload = await resolveDailyOperationPayload(input);
  const { error } = await supabase.from("daily_bus_operations").insert(payload);
  if (error) throw error;
}
export async function updateDailyOperation(id: string, input: DailyOperationInput) {
  const payload = await resolveDailyOperationPayload(input);
  const { error } = await supabase.from("daily_bus_operations").update(payload).eq("id", id);
  if (error) throw error;
}
export async function deleteDailyOperation(id: string) {
  const { error } = await supabase.from("daily_bus_operations").delete().eq("id", id);
  if (error) throw error;
}

// ---- Client invoicing (accounts receivable per corporate client) ----

export interface ClientInvoiceRow {
  date: string;
  busCode: string;
  driver: string;
  route: string;
  amount: number;
}

export async function fetchClientInvoiceRows(clientName: string, monthPrefix: string): Promise<ClientInvoiceRow[]> {
  const ops = await fetchDailyOperations(monthPrefix);
  const rows: ClientInvoiceRow[] = [];
  for (const o of ops) {
    if (o.client1 === clientName) rows.push({ date: o.date, busCode: o.bus, driver: o.driver, route: o.route1, amount: o.fare1 });
    if (o.client2 === clientName) rows.push({ date: o.date, busCode: o.bus, driver: o.driver, route: o.route2, amount: o.fare2 });
  }
  return rows;
}

export function computeClientInvoiceSummary(rows: ClientInvoiceRow[]) {
  return {
    totalShifts: rows.length,
    totalBusesDeployed: new Set(rows.map((r) => r.busCode)).size,
    totalDue: rows.reduce((sum, r) => sum + r.amount, 0),
  };
}

// ---- Executive P&L ----

export function computeMonthlyPL(
  operations: { gasCost: number; fare1: number; fare2: number }[],
  generalExpenseTotal: number,
  netDriverPayrollTotal: number,
) {
  const totalRevenue = operations.reduce((sum, o) => sum + o.fare1 + o.fare2, 0);
  const totalGas = operations.reduce((sum, o) => sum + o.gasCost, 0);
  const totalExpenses = totalGas + generalExpenseTotal + netDriverPayrollTotal;
  return { totalRevenue, totalExpenses, netProfit: totalRevenue - totalExpenses };
}
