import { describe, it, expect } from "vitest";
import { computeFuelEfficiency, computeMonthlyFinance } from "@/lib/queries";

describe("computeFuelEfficiency", () => {
  it("computes liters per 100km for a single bus", () => {
    const result = computeFuelEfficiency([{ liters: 20, odo_start: 1000, odo_end: 1200, bus_code: "WV-001" }]);
    expect(result).toEqual([{ bus: "WV-001", "لتر/100كم": 10 }]);
  });

  it("sums multiple fill-ups for the same bus before computing the ratio", () => {
    const result = computeFuelEfficiency([
      { liters: 10, odo_start: 0, odo_end: 100, bus_code: "WV-001" },
      { liters: 10, odo_start: 100, odo_end: 200, bus_code: "WV-001" },
    ]);
    expect(result).toEqual([{ bus: "WV-001", "لتر/100كم": 10 }]);
  });

  it("keeps buses separate", () => {
    const result = computeFuelEfficiency([
      { liters: 20, odo_start: 0, odo_end: 200, bus_code: "WV-001" },
      { liters: 5, odo_start: 0, odo_end: 50, bus_code: "WV-002" },
    ]);
    expect(result).toContainEqual({ bus: "WV-001", "لتر/100كم": 10 });
    expect(result).toContainEqual({ bus: "WV-002", "لتر/100كم": 10 });
  });

  it("never divides by zero when a bus has no recorded distance", () => {
    const result = computeFuelEfficiency([{ liters: 15, odo_start: 500, odo_end: 500, bus_code: "WV-003" }]);
    expect(result).toEqual([{ bus: "WV-003", "لتر/100كم": 0 }]);
  });

  it("ignores a negative or corrupted odometer reading instead of producing a negative distance", () => {
    const result = computeFuelEfficiency([{ liters: 10, odo_start: 500, odo_end: 400, bus_code: "WV-004" }]);
    expect(result).toEqual([{ bus: "WV-004", "لتر/100كم": 0 }]);
  });
});

describe("computeMonthlyFinance", () => {
  it("groups treasury deposits and expenses into the same month bucket", () => {
    const result = computeMonthlyFinance(
      [{ date: "2026-01-05", deposits: 1000 }, { date: "2026-01-20", deposits: 500 }],
      [{ date: "2026-01-10", amount: 300 }],
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.الإيرادات).toBe(1500);
    expect(result[0]!.المصروفات).toBe(300);
  });

  it("keeps different months in separate buckets", () => {
    const result = computeMonthlyFinance(
      [{ date: "2026-01-05", deposits: 1000 }, { date: "2026-02-05", deposits: 700 }],
      [],
    );
    expect(result).toHaveLength(2);
  });

  it("handles a month with expenses but no revenue", () => {
    const result = computeMonthlyFinance([], [{ date: "2026-03-01", amount: 250 }]);
    expect(result).toEqual([{ month: expect.any(String), الإيرادات: 0, المصروفات: 250 }]);
  });
});
