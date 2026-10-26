export type BusStatus = "تعمل" | "بالورشة" | "متوقفة";

export interface Bus {
  id: string;
  code: string;
  plate: string;
  model: string;
  busType: string;
  capacity: number;
  odometer: number;
  licenseExpiry: string;
  insuranceExpiry: string;
  lastMaintenance: string;
  driver: string;
  status: BusStatus;
  fuelTarget: number | null; // معيار الاستهلاك المستهدف
  fuelBasis: "shift" | "km100" | "km"; // لتر/وردية أو لتر/100كم أو لتر/كم
}


export interface Driver {
  id: string;
  name: string;
  phone: string;
  license: string;
  licenseExpiry: string;
  baseSalary: number;
  primaryBus: string;
  backupBus: string;
  shift: "الوردية الصباحية" | "الوردية المسائية" | "راحة";
}


export interface Attendance {
  id: string;
  driver: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: "حاضر" | "متأخر" | "غائب";
}


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


export interface Student {
  id: string;
  name: string;
  route: string;
  guardianPhone: string;
  monthly: number;
  paid: number;
  status: "خالص" | "متأخر" | "أقساط";
}



export type MaintenanceStatus = "بانتظار القطع" | "قيد التنفيذ" | "مكتمل" | "ملغي";

export interface MaintenanceItem {
  id: string;
  inventoryId: string;
  name: string;
  unitType: string;
  quantity: number;
  unitPrice: number;
}

export interface MaintenanceOrder {
  id: string;
  code: string;
  bus: string;
  date: string;
  issue: string;
  parts: string;
  cost: number;
  laborCost: number;
  paySource?: string;
  status: MaintenanceStatus;
  items: MaintenanceItem[];
  driverFault?: boolean;
  faultDriverId?: string;
  /** مبلغ الخصم من السائق؛ فارغ = تكلفة الأمر كاملة */
  faultAmount?: number | null;
  /** عداد الكيلومتر وقت الصيانة */
  maintenanceMileage?: number | null;
}


export type UnitType = "بالقطعة" | "بالكيلو" | "باللتر";
export const UNIT_TYPES: UnitType[] = ["بالقطعة", "بالكيلو", "باللتر"];

export interface InventoryItem {
  id: string;
  name: string;
  code: string;
  stock: number;
  minStock: number;
  unitPrice: number;
  unitType: UnitType;
}


export interface FuelLog {
  id: string;
  date: string;
  bus: string;
  driver: string;
  odoStart: number; // legacy
  odoEnd: number; // legacy
  currentOdometer: number | null;
  createdAt: string;
  liters: number;
  cost: number;
  station: string;
  pricePerLiter?: number | null;
  supplierId?: string;
}




export interface TreasuryEntry {
  id: string;
  date: string;
  account: string;
  opening: number;
  deposits: number;
  withdrawals: number;
  clientId: string;
  isRollover: boolean;
  notes: string;
}


export interface Expense {
  id: string;
  date: string;
  category: "زيوت ومحروقات" | "قطع غيار" | "إداريات" | "مرتبات";
  supplier: string;
  supplierId: string;
  amount: number;
  supplierBalance: number;
  description: string;
  notes: string;
  payFrom: string;
  subjectKey?: string;
}


export interface LoanInstallment {
  id: string;
  amount: number;
  dueDate: string;
}

export interface Loan {
  id: string;
  lender: string;
  total: number;
  installment: number;
  nextDue: string;
  installments: LoanInstallment[];
}


export interface Payslip {
  id: string;
  employee: string;
  role: string;
  base: number;
  overtime: number;
  advances: number;
  penalties: number;
}



export const currency = (value: number) => `${value.toLocaleString("ar-EG")} ج.م`;
