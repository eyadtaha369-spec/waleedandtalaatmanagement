import { describe, it, expect } from "vitest";
import { computePreventiveAlerts } from "@/lib/preventive";

const bus = (code: string, odometer: number) => ({ code, odometer });
const oil = (b: string, date: string, km: number) => ({ bus: b, date, status: "مكتمل", maintenanceType: "زيت", maintenanceMileage: km });
const grease = (b: string, date: string) => ({ bus: b, date, status: "مكتمل", maintenanceType: "تشحيم" });

describe("computePreventiveAlerts", () => {
  it("raises an oil alert at 4000 km since the last oil change", () => {
    const a = computePreventiveAlerts([bus("12", 54000)], [oil("12", "2026-10-01", 50000)], "2026-11-03");
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ kind: "oil", level: "due" });
    expect(a[0]!.message).toContain("4000 كم");
  });
  it("warns early at 3500 km and stays quiet below", () => {
    expect(computePreventiveAlerts([bus("12", 53600)], [oil("12", "2026-10-01", 50000)], "2026-11-03")[0]?.level).toBe("soon");
    expect(computePreventiveAlerts([bus("12", 52000)], [oil("12", "2026-10-01", 50000)], "2026-11-03")).toHaveLength(0);
  });
  it("uses the latest oil change and ignores cancelled orders", () => {
    const orders = [oil("12", "2026-08-01", 40000), oil("12", "2026-10-20", 53000), { ...oil("12", "2026-10-25", 54000), status: "ملغي" }];
    expect(computePreventiveAlerts([bus("12", 56000)], orders, "2026-11-03")).toHaveLength(0);
  });
  it("raises a greasing alert after 15 days", () => {
    const a = computePreventiveAlerts([bus("7", 0)], [grease("7", "2026-10-18")], "2026-11-03");
    expect(a[0]).toMatchObject({ kind: "grease", level: "due" });
    expect(a[0]!.message).toContain("16 يوماً");
    expect(computePreventiveAlerts([bus("7", 0)], [grease("7", "2026-10-25")], "2026-11-03")).toHaveLength(0);
  });
  it("skips stopped buses and buses with no history", () => {
    expect(computePreventiveAlerts([{ code: "9", odometer: 99999, status: "متوقفة" }, bus("10", 99999)], [], "2026-11-03")).toHaveLength(0);
  });
});
