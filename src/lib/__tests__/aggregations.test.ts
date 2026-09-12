import { describe, it, expect } from "vitest";
import { computeFuelEfficiency, computeMonthlyFinance, computeDriverPayroll, computeRunningBalance, nextMonthPrefix, computeClientInvoiceSummary, computeMonthlyPL, computeMonthlyReport } from "@/lib/queries";

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
      { driver: "أحمد", baseSalary: 3000, totalOvertime: 300, totalAdvances: 100, totalPenalties: 50, tripFees: 0, netSalary: 3150 },
    ]);
  });

  it("gives a driver with no shifts this month just their base salary", () => {
    const result = computeDriverPayroll([{ name: "سارة", base_salary: 2500 }], []);
    expect(result).toEqual([
      { driver: "سارة", baseSalary: 2500, totalOvertime: 0, totalAdvances: 0, totalPenalties: 0, tripFees: 0, netSalary: 2500 },
    ]);
  });

  it("keeps each driver's totals independent", () => {
    const result = computeDriverPayroll(
      [{ name: "أحمد", base_salary: 3000 }, { name: "محمد", base_salary: 2800 }],
      [{ driver: "أحمد", overtimeAllowance: 500, dailyAdvance: 0, penalty: 0 }],
    );
    expect(result.find((r) => r.driver === "محمد")).toEqual({
      driver: "محمد", baseSalary: 2800, totalOvertime: 0, totalAdvances: 0, totalPenalties: 0, tripFees: 0, netSalary: 2800,
    });
  });

  it("adds trip commissions into the driver's net salary", () => {
    const result = computeDriverPayroll(
      [{ name: "أحمد", base_salary: 3000 }],
      [],
      [{ driver: "أحمد", fee: 200 }, { driver: "أحمد", fee: 150 }],
    );
    expect(result[0]).toEqual({
      driver: "أحمد", baseSalary: 3000, totalOvertime: 0, totalAdvances: 0, totalPenalties: 0, tripFees: 350, netSalary: 3350,
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

describe("computeClientInvoiceSummary", () => {
  it("sums amounts and counts shifts across all rows", () => {
    const result = computeClientInvoiceSummary([
      { date: "2026-01-01", busCode: "WV-001", busType: "أتوبيس 50", driver: "أحمد", route: "خط 1", amount: 500 },
      { date: "2026-01-02", busCode: "WV-002", busType: "أتوبيس 33", driver: "محمد", route: "خط 2", amount: 700 },
    ]);
    expect(result).toEqual({ totalShifts: 2, totalBusesDeployed: 2, totalDue: 1200 });
  });

  it("counts each bus only once even if it ran multiple shifts", () => {
    const result = computeClientInvoiceSummary([
      { date: "2026-01-01", busCode: "WV-001", busType: "أتوبيس 50", driver: "أحمد", route: "خط 1", amount: 500 },
      { date: "2026-01-02", busCode: "WV-001", busType: "أتوبيس 50", driver: "أحمد", route: "خط 2", amount: 300 },
    ]);
    expect(result.totalBusesDeployed).toBe(1);
    expect(result.totalShifts).toBe(2);
    expect(result.totalDue).toBe(800);
  });

  it("returns zeros for a client with no shifts this month", () => {
    expect(computeClientInvoiceSummary([])).toEqual({ totalShifts: 0, totalBusesDeployed: 0, totalDue: 0 });
  });
});

describe("computeMonthlyPL", () => {
  it("computes net profit as revenue minus gas, general expenses, and payroll", () => {
    const result = computeMonthlyPL(
      [{ gasCost: 200, fare1: 1000, fare2: 500 }],
      300, // general expenses
      2000, // net driver payroll
    );
    expect(result).toEqual({ totalRevenue: 1500, totalExpenses: 2500, netProfit: -1000 });
  });

  it("sums fare1 and fare2 from every operation, and gas across all of them", () => {
    const result = computeMonthlyPL(
      [
        { gasCost: 100, fare1: 500, fare2: 0 },
        { gasCost: 150, fare1: 400, fare2: 200 },
      ],
      0,
      0,
    );
    expect(result).toEqual({ totalRevenue: 1100, totalExpenses: 250, netProfit: 850 });
  });

  it("handles a month with zero operations", () => {
    expect(computeMonthlyPL([], 100, 50)).toEqual({ totalRevenue: 0, totalExpenses: 150, netProfit: -150 });
  });
});

describe("computeMonthlyReport", () => {
  it("sums revenue and expense line items and derives net profit", () => {
    const result = computeMonthlyReport({
      subscriptionRevenue: 1000,
      companyRevenue: 2000,
      tripRevenue: 0,
      payrollExpense: 1500,
      maintenanceExpense: 300,
      partsExpense: 200,
      fuelExpense: 400,
      adminMiscExpense: 100,
    });
    expect(result.totalRevenue).toBe(3000);
    expect(result.totalExpenses).toBe(2500);
    expect(result.netProfit).toBe(500);
  });

  it("can report a net loss when expenses exceed revenue", () => {
    const result = computeMonthlyReport({
      subscriptionRevenue: 500,
      companyRevenue: 0,
      tripRevenue: 0,
      payrollExpense: 1000,
      maintenanceExpense: 0,
      partsExpense: 0,
      fuelExpense: 0,
      adminMiscExpense: 0,
    });
    expect(result.netProfit).toBe(-500);
  });

  it("includes trip revenue in the total once it is non-zero", () => {
    const result = computeMonthlyReport({
      subscriptionRevenue: 0,
      companyRevenue: 0,
      tripRevenue: 750,
      payrollExpense: 0,
      maintenanceExpense: 0,
      partsExpense: 0,
      fuelExpense: 0,
      adminMiscExpense: 0,
    });
    expect(result.totalRevenue).toBe(750);
    expect(result.netProfit).toBe(750);
  });
});
