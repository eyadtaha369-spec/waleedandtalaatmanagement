import { useEffect, useState } from "react";
import { fetchBuses, fetchMaintenanceOrders } from "@/lib/queries";
import { computePreventiveAlerts, type PreventiveAlert } from "@/lib/preventive";

/** شريط تنبيهات الصيانة الوقائية (زيت 4000 كم / تشحيم 15 يوم). */
export function PreventiveAlertsBanner({ refreshKey }: { refreshKey?: unknown }) {
  const [alerts, setAlerts] = useState<PreventiveAlert[]>([]);
  useEffect(() => {
    let live = true;
    Promise.all([fetchBuses(), fetchMaintenanceOrders()])
      .then(([buses, orders]) => live && setAlerts(computePreventiveAlerts(buses, orders)))
      .catch((e) => {
        console.error("[preventive-alerts]", e);
        if (live) setAlerts([]);
      });
    return () => {
      live = false;
    };
  }, [refreshKey]);
  if (!alerts.length) return null;
  return (
    <div className="no-print mb-4 grid gap-2" dir="rtl">
      {alerts.map((a) => (
        <p
          key={a.key}
          role="alert"
          className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm font-bold ${
            a.level === "due" ? "border-[#EF4444]/60 bg-[#EF4444]/10 text-[#EF4444]" : "border-[#F59E0B]/60 bg-[#F59E0B]/10 text-[#F59E0B]"
          }`}
        >
          <span>{a.kind === "oil" ? "🛢️" : "🔧"}</span>
          <span>{a.message}</span>
        </p>
      ))}
    </div>
  );
}
