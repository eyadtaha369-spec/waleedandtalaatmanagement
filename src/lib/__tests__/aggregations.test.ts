import { describe, it, expect } from "vitest";
import { computeFuelEfficiency, computeMonthlyFinance, computeDriverPayroll, computeRunningBalance, nextMonthPrefix } from "@/lib/queries";

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

describe("computeDriverPayroll", () => {
  it("computes net salary as base + overtime - (advances + penalties)", () => {
    const result = computeDriverPayroll(
      [{ name: "أحمد", base_salary: 3000 }],
      [
        { driver: "أحمد", overtimeAllowance: 200, dailyAdvance: 100, penalty: 50 },
        { driver: "أحمد", overtimeAllowance: 100, dailyAdvance: 0, penalty: 0 },
      ],
    );
    expect(result).toEqual([
      { driver: "أحمد", baseSalary: 3000, totalOvertime: 300, totalAdvances: 100, totalPenalties: 50, netSalary: 3150 },
    ]);
  });

  it("gives a driver with no shifts this month just their base salary", () => {
    const result = computeDriverPayroll([{ name: "سارة", base_salary: 2500 }], []);
    expect(result).toEqual([
      { driver: "سارة", baseSalary: 2500, totalOvertime: 0, totalAdvances: 0, totalPenalties: 0, netSalary: 2500 },
    ]);
  });

  it("keeps each driver's totals independent", () => {
    const result = computeDriverPayroll(
      [{ name: "أحمد", base_salary: 3000 }, { name: "محمد", base_salary: 2800 }],
      [{ driver: "أحمد", overtimeAllowance: 500, dailyAdvance: 0, penalty: 0 }],
    );
    expect(result.find((r) => r.driver === "محمد")).toEqual({
      driver: "محمد", baseSalary: 2800, totalOvertime: 0, totalAdvances: 0, totalPenalties: 0, netSalary: 2800,
    });
  });
});

describe("computeRunningBalance", () => {
  it("adds debits and subtracts credits in chronological order", () => {
    const result = computeRunningBalance([
      { id: "1", date: "2026-01-01", type: "مدين", amount: 500, method: "—", notes: "" },
      { id: "2", date: "2026-01-05", type: "دائن", amount: 300, method: "نقدي", notes: "" },
    ]);
    expect(result[0]!.runningBalance).toBe(500);
    expect(result[1]!.runningBalance).toBe(200);
  });

  it("can go negative when payments exceed charges (client overpaid)", () => {
    const result = computeRunningBalance([
      { id: "1", date: "2026-01-01", type: "مدين", amount: 100, method: "—", notes: "" },
      { id: "2", date: "2026-01-02", type: "دائن", amount: 150, method: "نقدي", notes: "" },
    ]);
    expect(result[1]!.runningBalance).toBe(-50);
  });

  it("returns an empty array for a client with no transactions", () => {
    expect(computeRunningBalance([])).toEqual([]);
  });
});

describe("nextMonthPrefix", () => {
  it("advances within the same year", () => {
    expect(nextMonthPrefix("2026-03")).toBe("2026-04");
  });

  it("rolls over from December into the next January", () => {
    expect(nextMonthPrefix("2026-12")).toBe("2027-01");
  });

  it("pads single-digit months with a leading zero", () => {
    expect(nextMonthPrefix("2026-01")).toBe("2026-02");
    expect(nextMonthPrefix("2026-09")).toBe("2026-10");
  });
});
