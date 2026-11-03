/** تنبيهات الصيانة الوقائية: زيت كل 4000 كم، وتشحيم كل 15 يوم. */
export const OIL_INTERVAL_KM = 4000;
export const OIL_SOON_KM = 3500;
export const GREASE_INTERVAL_DAYS = 15;
export const GREASE_SOON_DAYS = 13;

export interface PreventiveAlert {
  key: string;
  bus: string;
  kind: "oil" | "grease";
  level: "due" | "soon";
  message: string;
}

interface BusLike { code: string; odometer: number; status?: string }
interface OrderLike { bus: string; date: string; status: string; maintenanceType?: string; maintenanceMileage?: number | null }

const dayDiff = (from: string, to: string) => Math.floor((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);

export function computePreventiveAlerts(buses: BusLike[], orders: OrderLike[], today = new Date().toISOString().slice(0, 10)): PreventiveAlert[] {
  const out: PreventiveAlert[] = [];
  for (const b of buses) {
    if (b.status === "متوقفة") continue;
    const mine = orders.filter((o) => o.bus === b.code && o.status !== "ملغي");
    // زيت: المسافة منذ آخر غيار زيت مسجَّل بعداد
    const oils = mine.filter((o) => o.maintenanceType === "زيت" && (o.maintenanceMileage ?? 0) > 0);
    if (oils.length) {
      const last = oils.reduce((a, o) => (o.date > a.date || (o.date === a.date && (o.maintenanceMileage ?? 0) > (a.maintenanceMileage ?? 0)) ? o : a));
      const km = Math.max(0, (b.odometer || 0) - (last.maintenanceMileage ?? 0));
      if (km >= OIL_INTERVAL_KM) out.push({ key: `oil-${b.code}`, bus: b.code, kind: "oil", level: "due", message: `تنبيه صيانة: الأتوبيس ${b.code} وصل مسافة ${OIL_INTERVAL_KM} كم منذ آخر غيار زيت (مطلوب تغيير زيت) — المقطوع ${km.toLocaleString("ar-EG")} كم` });
      else if (km >= OIL_SOON_KM) out.push({ key: `oil-${b.code}`, bus: b.code, kind: "oil", level: "soon", message: `اقترب موعد الزيت: الأتوبيس ${b.code} قطع ${km.toLocaleString("ar-EG")} كم منذ آخر غيار زيت (الحد ${OIL_INTERVAL_KM} كم)` });
    }
    // تشحيم: الأيام منذ آخر تشحيم
    const greases = mine.filter((o) => o.maintenanceType === "تشحيم");
    if (greases.length) {
      const lastDate = greases.reduce((a, o) => (o.date > a ? o.date : a), "");
      const days = dayDiff(lastDate, today);
      if (days >= GREASE_INTERVAL_DAYS) out.push({ key: `grease-${b.code}`, bus: b.code, kind: "grease", level: "due", message: `تنبيه صيانة: الأتوبيس ${b.code} مر عليه ${days} يوماً بدون تشحيم (مطلوب تشحيم)` });
      else if (days >= GREASE_SOON_DAYS) out.push({ key: `grease-${b.code}`, bus: b.code, kind: "grease", level: "soon", message: `اقترب موعد التشحيم: الأتوبيس ${b.code} مر عليه ${days} يوماً منذ آخر تشحيم (الحد ${GREASE_INTERVAL_DAYS} يوماً)` });
    }
  }
  return out.sort((a, b) => (a.level === b.level ? a.bus.localeCompare(b.bus, "ar", { numeric: true }) : a.level === "due" ? -1 : 1));
}
