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
}


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



export interface MaintenanceOrder {
  id: string;
  code: string;
  bus: string;
  issue: string;
  parts: string;
  cost: number;
  status: "بانتظار القطع" | "قيد التنفيذ" | "مكتمل";
  inventoryItem: string;
  quantityUsed: number;
}


export interface InventoryItem {
  id: string;
  name: string;
  code: string;
  stock: number;
  minStock: number;
  unitPrice: number;
}


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




export interface TreasuryEntry {
  id: string;
  date: string;
  account: string;
  opening: number;
  deposits: number;
  withdrawals: number;
}


export interface Expense {
  id: string;
  date: string;
  category: "زيوت ومحروقات" | "قطع غيار" | "إداريات" | "مرتبات";
  supplier: string;
  amount: number;
  supplierBalance: number;
}


export interface Loan {
  id: string;
  lender: string;
  total: number;
  paid: number;
  installment: number;
  nextDue: string;
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
