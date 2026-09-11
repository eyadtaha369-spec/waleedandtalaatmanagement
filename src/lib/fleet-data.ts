export type BusStatus = "تعمل" | "بالورشة" | "متوقفة";

export interface Bus {
  id: string;
  code: string;
  plate: string;
  model: string;
  capacity: number;
  odometer: number;
  licenseExpiry: string;
  insuranceExpiry: string;
  lastMaintenance: string;
  driver: string;
  status: BusStatus;
}

export const buses: Bus[] = [
  { id: "1", code: "WV-001", plate: "س ط ن 4521", model: "مرسيدس 2019", capacity: 50, odometer: 214300, licenseExpiry: "2026-10-14", insuranceExpiry: "2027-01-02", lastMaintenance: "2026-08-20", driver: "محمود عبد العزيز", status: "تعمل" },
  { id: "2", code: "WV-002", plate: "ب ي ع 8834", model: "MAN 2021", capacity: 45, odometer: 132980, licenseExpiry: "2026-09-25", insuranceExpiry: "2026-12-11", lastMaintenance: "2026-08-02", driver: "سيد رجب", status: "تعمل" },
  { id: "3", code: "WV-003", plate: "ر ق م 1190", model: "هيونداي 2018", capacity: 28, odometer: 301220, licenseExpiry: "2026-09-14", insuranceExpiry: "2026-11-30", lastMaintenance: "2026-09-05", driver: "عماد فتحي", status: "بالورشة" },
  { id: "4", code: "WV-004", plate: "ط ل ع 7702", model: "تويوتا كوستر 2020", capacity: 26, odometer: 98420, licenseExpiry: "2027-03-18", insuranceExpiry: "2027-02-05", lastMaintenance: "2026-07-28", driver: "أحمد شعبان", status: "تعمل" },
  { id: "5", code: "WV-005", plate: "و ل ي 3300", model: "مرسيدس 2016", capacity: 50, odometer: 412500, licenseExpiry: "2026-09-30", insuranceExpiry: "2026-10-22", lastMaintenance: "2026-06-19", driver: "—", status: "متوقفة" },
  { id: "6", code: "WV-006", plate: "ن ق ل 6621", model: "MAN 2022", capacity: 48, odometer: 76110, licenseExpiry: "2027-06-01", insuranceExpiry: "2027-05-14", lastMaintenance: "2026-08-30", driver: "خالد منصور", status: "تعمل" },
];

export interface Driver {
  id: string;
  name: string;
  phone: string;
  license: string;
  licenseExpiry: string;
  primaryBus: string;
  backupBus: string;
  shift: "الوردية الصباحية" | "الوردية المسائية" | "راحة";
}

export const drivers: Driver[] = [
  { id: "1", name: "محمود عبد العزيز", phone: "01001234567", license: "رخصة درجة أولى", licenseExpiry: "2027-04-11", primaryBus: "WV-001", backupBus: "WV-004", shift: "الوردية الصباحية" },
  { id: "2", name: "سيد رجب", phone: "01122334455", license: "رخصة درجة أولى", licenseExpiry: "2026-10-03", primaryBus: "WV-002", backupBus: "WV-006", shift: "الوردية المسائية" },
  { id: "3", name: "عماد فتحي", phone: "01234567890", license: "رخصة درجة ثانية", licenseExpiry: "2026-12-19", primaryBus: "WV-003", backupBus: "WV-005", shift: "راحة" },
  { id: "4", name: "أحمد شعبان", phone: "01099887766", license: "رخصة درجة أولى", licenseExpiry: "2027-08-25", primaryBus: "WV-004", backupBus: "WV-001", shift: "الوردية الصباحية" },
  { id: "5", name: "خالد منصور", phone: "01555443322", license: "رخصة درجة أولى", licenseExpiry: "2027-01-30", primaryBus: "WV-006", backupBus: "WV-002", shift: "الوردية المسائية" },
];

export interface Attendance {
  id: string;
  driver: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: "حاضر" | "متأخر" | "غائب";
}

export const attendance: Attendance[] = [
  { id: "1", driver: "محمود عبد العزيز", date: "2026-09-10", checkIn: "05:40", checkOut: "17:20", status: "حاضر" },
  { id: "2", driver: "سيد رجب", date: "2026-09-10", checkIn: "06:25", checkOut: "18:05", status: "متأخر" },
  { id: "3", driver: "عماد فتحي", date: "2026-09-10", checkIn: "—", checkOut: "—", status: "غائب" },
  { id: "4", driver: "أحمد شعبان", date: "2026-09-10", checkIn: "05:35", checkOut: "16:50", status: "حاضر" },
  { id: "5", driver: "خالد منصور", date: "2026-09-10", checkIn: "12:05", checkOut: "22:10", status: "حاضر" },
];

export interface BusRoute {
  id: string;
  name: string;
  pickupPoints: string;
  departure: string;
  arrival: string;
  bus: string;
  seats: number;
  booked: number;
}

export const busRoutes: BusRoute[] = [
  { id: "1", name: "خط المعادي - التجمع", pickupPoints: "المعادي الجديدة، زهراء المعادي، القطامية", departure: "06:15", arrival: "07:30", bus: "WV-001", seats: 50, booked: 46 },
  { id: "2", name: "خط فيصل - أكتوبر", pickupPoints: "فيصل، الطالبية، الحصري", departure: "06:00", arrival: "07:25", bus: "WV-002", seats: 45, booked: 39 },
  { id: "3", name: "خط مدينة نصر - العاصمة", pickupPoints: "عباس العقاد، مكرم عبيد، الحي العاشر", departure: "06:40", arrival: "07:55", bus: "WV-006", seats: 48, booked: 48 },
  { id: "4", name: "خط حلوان - المعادي", pickupPoints: "حلوان البلد، التبين، طرة", departure: "06:10", arrival: "07:15", bus: "WV-004", seats: 26, booked: 18 },
];

export interface Student {
  id: string;
  name: string;
  route: string;
  guardianPhone: string;
  monthly: number;
  paid: number;
  status: "خالص" | "متأخر" | "أقساط";
}

export const students: Student[] = [
  { id: "1", name: "يوسف عمرو", route: "خط المعادي - التجمع", guardianPhone: "01011223344", monthly: 1800, paid: 1800, status: "خالص" },
  { id: "2", name: "مريم حسن", route: "خط فيصل - أكتوبر", guardianPhone: "01098765432", monthly: 1600, paid: 800, status: "أقساط" },
  { id: "3", name: "عبد الرحمن ماجد", route: "خط مدينة نصر - العاصمة", guardianPhone: "01277889900", monthly: 2000, paid: 0, status: "متأخر" },
  { id: "4", name: "سلمى طارق", route: "خط حلوان - المعادي", guardianPhone: "01144556677", monthly: 1500, paid: 1500, status: "خالص" },
  { id: "5", name: "زياد أشرف", route: "خط المعادي - التجمع", guardianPhone: "01033445566", monthly: 1800, paid: 900, status: "أقساط" },
  { id: "6", name: "نور الدين سامي", route: "خط فيصل - أكتوبر", guardianPhone: "01566778899", monthly: 1600, paid: 0, status: "متأخر" },
];

export const paymentHistory: Record<string, { date: string; amount: number; method: string }[]> = {
  "1": [{ date: "2026-09-01", amount: 1800, method: "نقدي" }],
  "2": [{ date: "2026-09-03", amount: 800, method: "تحويل بنكي" }],
  "3": [],
  "4": [{ date: "2026-08-30", amount: 1500, method: "محفظة إلكترونية" }],
  "5": [{ date: "2026-09-05", amount: 900, method: "نقدي" }],
  "6": [],
};

export interface MaintenanceOrder {
  id: string;
  code: string;
  bus: string;
  issue: string;
  parts: string;
  cost: number;
  status: "بانتظار القطع" | "قيد التنفيذ" | "مكتمل";
}

export const maintenanceOrders: MaintenanceOrder[] = [
  { id: "1", code: "MO-1041", bus: "WV-003", issue: "تسريب في نظام التبريد", parts: "خرطوم رادياتير، طرمبة مياه", cost: 4200, status: "قيد التنفيذ" },
  { id: "2", code: "MO-1042", bus: "WV-005", issue: "عطل في علبة التروس", parts: "طقم دبرياج", cost: 15600, status: "بانتظار القطع" },
  { id: "3", code: "MO-1043", bus: "WV-001", issue: "تغيير زيت وفلاتر", parts: "زيت 15W40، فلتر زيت", cost: 2350, status: "مكتمل" },
  { id: "4", code: "MO-1044", bus: "WV-002", issue: "استبدال تيل الفرامل", parts: "تيل أمامي وخلفي", cost: 3100, status: "قيد التنفيذ" },
  { id: "5", code: "MO-1045", bus: "WV-006", issue: "صيانة تكييف الركاب", parts: "فريون، سير مروحة", cost: 1850, status: "مكتمل" },
];

export interface InventoryItem {
  id: string;
  name: string;
  code: string;
  stock: number;
  minStock: number;
  unitPrice: number;
}

export const inventory: InventoryItem[] = [
  { id: "1", name: "زيت محرك 15W40 (20 لتر)", code: "OIL-1540", stock: 12, minStock: 10, unitPrice: 1450 },
  { id: "2", name: "فلتر زيت", code: "FLT-OIL", stock: 6, minStock: 15, unitPrice: 220 },
  { id: "3", name: "تيل فرامل أمامي", code: "BRK-FRT", stock: 4, minStock: 8, unitPrice: 890 },
  { id: "4", name: "بطارية 200 أمبير", code: "BAT-200", stock: 9, minStock: 4, unitPrice: 3900 },
  { id: "5", name: "إطار 11R22.5", code: "TYR-1122", stock: 14, minStock: 12, unitPrice: 6200 },
];

export interface FuelLog {
  id: string;
  date: string;
  bus: string;
  odoStart: number;
  odoEnd: number;
  liters: number;
  cost: number;
  station: string;
}

export const fuelLogs: FuelLog[] = [
  { id: "1", date: "2026-09-09", bus: "WV-001", odoStart: 214010, odoEnd: 214300, liters: 120, cost: 1800, station: "محطة التعاون - المعادي" },
  { id: "2", date: "2026-09-09", bus: "WV-002", odoStart: 132700, odoEnd: 132980, liters: 110, cost: 1650, station: "محطة وطنية - فيصل" },
  { id: "3", date: "2026-09-08", bus: "WV-004", odoStart: 98180, odoEnd: 98420, liters: 85, cost: 1275, station: "محطة مصر - حلوان" },
  { id: "4", date: "2026-09-08", bus: "WV-006", odoStart: 75860, odoEnd: 76110, liters: 105, cost: 1575, station: "محطة التعاون - نصر" },
];

export const fuelChart = [
  { bus: "WV-001", "لتر/100كم": 41 },
  { bus: "WV-002", "لتر/100كم": 39 },
  { bus: "WV-003", "لتر/100كم": 46 },
  { bus: "WV-004", "لتر/100كم": 35 },
  { bus: "WV-005", "لتر/100كم": 48 },
  { bus: "WV-006", "لتر/100كم": 37 },
];

export const monthlyFinance = [
  { month: "أبريل", الإيرادات: 810000, المصروفات: 545000 },
  { month: "مايو", الإيرادات: 862000, المصروفات: 578000 },
  { month: "يونيو", الإيرادات: 705000, المصروفات: 512000 },
  { month: "يوليو", الإيرادات: 640000, المصروفات: 470000 },
  { month: "أغسطس", الإيرادات: 928000, المصروفات: 611000 },
  { month: "سبتمبر", الإيرادات: 995000, المصروفات: 634000 },
];

export interface TreasuryEntry {
  id: string;
  date: string;
  account: string;
  opening: number;
  deposits: number;
  withdrawals: number;
}

export const treasury: TreasuryEntry[] = [
  { id: "1", date: "2026-09-10", account: "الخزينة النقدية", opening: 145000, deposits: 62000, withdrawals: 38500 },
  { id: "2", date: "2026-09-10", account: "البنك الأهلي - جاري", opening: 890000, deposits: 210000, withdrawals: 156000 },
  { id: "3", date: "2026-09-09", account: "بنك مصر - توفير", opening: 430000, deposits: 0, withdrawals: 75000 },
];

export interface Expense {
  id: string;
  date: string;
  category: "زيوت ومحروقات" | "قطع غيار" | "إداريات" | "مرتبات";
  supplier: string;
  amount: number;
  supplierBalance: number;
}

export const expenses: Expense[] = [
  { id: "1", date: "2026-09-09", category: "قطع غيار", supplier: "مؤسسة النصر لقطع الغيار", amount: 28400, supplierBalance: 62000 },
  { id: "2", date: "2026-09-08", category: "زيوت ومحروقات", supplier: "شركة التعاون للبترول", amount: 46500, supplierBalance: 18000 },
  { id: "3", date: "2026-09-07", category: "إداريات", supplier: "مكتب المحاسب القانوني", amount: 9000, supplierBalance: 0 },
  { id: "4", date: "2026-09-05", category: "قطع غيار", supplier: "الشرق للإطارات", amount: 31000, supplierBalance: 45000 },
];

export interface Loan {
  id: string;
  lender: string;
  total: number;
  paid: number;
  installment: number;
  nextDue: string;
}

export const loans: Loan[] = [
  { id: "1", lender: "البنك الأهلي - تمويل أتوبيسات", total: 2400000, paid: 1560000, installment: 60000, nextDue: "2026-09-25" },
  { id: "2", lender: "بنك مصر - رأس مال عامل", total: 800000, paid: 300000, installment: 25000, nextDue: "2026-09-18" },
  { id: "3", lender: "شركة التمويل المتحدة", total: 500000, paid: 470000, installment: 15000, nextDue: "2026-10-01" },
];

export interface Payslip {
  id: string;
  employee: string;
  role: string;
  base: number;
  overtime: number;
  advances: number;
  penalties: number;
}

export const payroll: Payslip[] = [
  { id: "1", employee: "محمود عبد العزيز", role: "سائق", base: 9000, overtime: 1800, advances: 1000, penalties: 200 },
  { id: "2", employee: "سيد رجب", role: "سائق", base: 8500, overtime: 2400, advances: 0, penalties: 500 },
  { id: "3", employee: "عماد فتحي", role: "سائق", base: 8000, overtime: 600, advances: 1500, penalties: 0 },
  { id: "4", employee: "هالة صبري", role: "محاسبة", base: 11000, overtime: 0, advances: 2000, penalties: 0 },
  { id: "5", employee: "مصطفى الديب", role: "فني ورشة", base: 7500, overtime: 1200, advances: 500, penalties: 100 },
];

export const alerts = [
  { id: "1", type: "ترخيص", text: "ترخيص الأتوبيس WV-003 ينتهي خلال 4 أيام", level: "عاجل" },
  { id: "2", type: "ترخيص", text: "تأمين الأتوبيس WV-005 ينتهي خلال 42 يومًا", level: "متوسط" },
  { id: "3", type: "صيانة", text: "موعد تغيير الزيت للأتوبيس WV-001 بعد 800 كم", level: "متوسط" },
  { id: "4", type: "مخزون", text: "فلتر الزيت أقل من الحد الأدنى (6 من 15)", level: "عاجل" },
  { id: "5", type: "عقود", text: "عقد مدرسة النيل الدولية ينتهي في 30 سبتمبر", level: "عاجل" },
] as const;

export const currency = (value: number) => `${value.toLocaleString("ar-EG")} ج.م`;
