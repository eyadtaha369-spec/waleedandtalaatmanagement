import { describe, it, expect } from "vitest";
import { computeFuelEfficiency, computeMonthlyFinance, computeDriverPayroll, computeRunningBalance, nextMonthPrefix, computeClientInvoiceSummary, computeMonthlyPL, computeMonthlyReport, computeEmployeePayroll, computeDailyReport, computeSupplierStatement, defaultAlertDate, computeOrderTotals, findStockShortage, computeFuelByBus, computeBusLedger, computeFinalPayroll, nextInstallment, computeClientMonthBalance, periodBounds, periodMonths, rangeForPreset, inDateRange, computeRentedLedger, missionNet, applySupplierRange } from "@/lib/queries";

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
      { driver: "أحمد", baseSalary: 3000, totalOvertime: 300, totalAdvances: 100, totalPenalties: 50, tripFees: 0, netSalary: 3150 , shiftEarnings: 0},
    ]);
  });

  it("gives a driver with no shifts this month just their base salary", () => {
    const result = computeDriverPayroll([{ name: "سارة", base_salary: 2500 }], []);
    expect(result).toEqual([
      { driver: "سارة", baseSalary: 2500, totalOvertime: 0, totalAdvances: 0, totalPenalties: 0, tripFees: 0, netSalary: 2500 , shiftEarnings: 0},
    ]);
  });

  it("keeps each driver's totals independent", () => {
    const result = computeDriverPayroll(
      [{ name: "أحمد", base_salary: 3000 }, { name: "محمد", base_salary: 2800 }],
      [{ driver: "أحمد", overtimeAllowance: 500, dailyAdvance: 0, penalty: 0 }],
    );
    expect(result.find((r) => r.driver === "محمد")).toEqual({
      driver: "محمد", baseSalary: 2800, totalOvertime: 0, totalAdvances: 0, totalPenalties: 0, tripFees: 0, netSalary: 2800, shiftEarnings: 0,
    });
  });

  it("adds trip commissions into the driver's net salary", () => {
    const result = computeDriverPayroll(
      [{ name: "أحمد", base_salary: 3000 }],
      [],
      [{ driver: "أحمد", fee: 200 }, { driver: "أحمد", fee: 150 }],
    );
    expect(result[0]).toEqual({
      driver: "أحمد", baseSalary: 3000, totalOvertime: 0, totalAdvances: 0, totalPenalties: 0, tripFees: 350, netSalary: 3350, shiftEarnings: 0,
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
  it("computes net profit as bus-value revenue minus general expenses and payroll", () => {
    const result = computeMonthlyPL([{ busValue: 1500 }], 300, 1200);
    expect(result).toEqual({ totalRevenue: 1500, totalExpenses: 1500, netProfit: 0 });
  });

  it("sums bus value across every shift (unlimited shifts per day)", () => {
    const result = computeMonthlyPL([{ busValue: 500 }, { busValue: 400 }, { busValue: 200 }], 0, 0);
    expect(result).toEqual({ totalRevenue: 1100, totalExpenses: 0, netProfit: 1100 });
  });

  it("handles a month with zero shifts", () => {
    expect(computeMonthlyPL([], 100, 50)).toEqual({ totalRevenue: 0, totalExpenses: 150, netProfit: -150 });
  });
});

describe("computeDailyReport", () => {
  it("groups revenue per company and earnings per driver, with an overall summary", () => {
    const r = computeDailyReport([
      { client: "شركة أ", driver: "أحمد", busValue: 1000, driverValue: 200 },
      { client: "شركة أ", driver: "أحمد", busValue: 800, driverValue: 150 },
      { client: "شركة ب", driver: "محمود", busValue: 600, driverValue: 100 },
    ]);
    expect(r.shiftCount).toBe(3);
    expect(r.totalCompanyRevenue).toBe(2400);
    expect(r.totalDriverEarnings).toBe(450);
    expect(r.netAfterDrivers).toBe(1950);
    expect(r.byCompany).toEqual([
      { client: "شركة أ", shifts: 2, total: 1800 },
      { client: "شركة ب", shifts: 1, total: 600 },
    ]);
    expect(r.byDriver).toEqual([
      { driver: "أحمد", shifts: 2, total: 350 },
      { driver: "محمود", shifts: 1, total: 100 },
    ]);
  });

  it("returns zeros for a day with no shifts", () => {
    expect(computeDailyReport([])).toEqual({ shiftCount: 0, totalCompanyRevenue: 0, totalDriverEarnings: 0, netAfterDrivers: 0, byCompany: [], byDriver: [] });
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

describe("computeEmployeePayroll", () => {
  it("includes only active employees and nets allowances, advances and penalties", () => {
    const result = computeEmployeePayroll(
      [
        { name: "أحمد", jobTitle: "محاسب", baseSalary: 5000, isActive: true },
        { name: "سامي", jobTitle: "عامل", baseSalary: 3000, isActive: false },
      ],
      [
        { employeeName: "أحمد", allowance: 500, advance: 1000, penalty: 100 },
        { employeeName: "أحمد", allowance: 0, advance: 200, penalty: 0 },
        { employeeName: "سامي", allowance: 0, advance: 0, penalty: 0 },
      ],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ employee: "أحمد", jobTitle: "محاسب", totalAllowances: 500, totalAdvances: 1200, totalPenalties: 100, netSalary: 4200 });
  });
});

describe("computeDriverPayroll with dispatch shift earnings", () => {
  it("adds driver value (قيمة السواقة) from shifts to the net salary", () => {
    const [row] = computeDriverPayroll(
      [{ name: "أحمد", base_salary: 3000 }],
      [{ driver: "أحمد", overtimeAllowance: 100, dailyAdvance: 500, penalty: 50 }],
      [{ driver: "أحمد", fee: 200 }],
      [{ driver: "أحمد", value: 400 }, { driver: "أحمد", value: 300 }, { driver: "غيره", value: 999 }],
    );
    expect(row?.shiftEarnings).toBe(700);
    expect(row?.netSalary).toBe(3000 + 100 + 200 + 700 - 550);
  });
});

describe("supplier statement", () => {
  it("orders by date and keeps a running remaining balance", () => {
    const r = computeSupplierStatement([
      { date: "2026-10-05", withdrawals: 0, payments: 400 },
      { date: "2026-10-01", withdrawals: 1000, payments: 0 },
      { date: "2026-10-03", withdrawals: 500, payments: 0 },
    ]);
    expect(r.rows.map((x) => x.balance)).toEqual([1000, 1500, 1100]);
    expect(r.totalWithdrawals).toBe(1500);
    expect(r.totalPayments).toBe(400);
    expect(r.remaining).toBe(1100);
  });
  it("returns zeros with no entries", () => {
    expect(computeSupplierStatement([]).remaining).toBe(0);
  });
});

describe("defaultAlertDate", () => {
  it("is two days before the due date, across month boundaries", () => {
    expect(defaultAlertDate("2026-10-10")).toBe("2026-10-08");
    expect(defaultAlertDate("2026-11-01")).toBe("2026-10-30");
    expect(defaultAlertDate("")).toBe("");
  });
});

describe("workshop (Spec E)", () => {
  const item = (q: number, p: number) => ({ id: "i" + q, inventoryId: "inv", name: "فلتر", unitType: "بالقطعة", quantity: q, unitPrice: p });

  it("computeOrderTotals sums parts and labor", () => {
    expect(computeOrderTotals([{ quantity: 2, unitPrice: 50 }, { quantity: 1.5, unitPrice: 100 }], 30)).toEqual({ partsTotal: 250, total: 280 });
    expect(computeOrderTotals([], 0)).toEqual({ partsTotal: 0, total: 0 });
  });

  it("findStockShortage flags shortages and counts already-allocated stock", () => {
    const stock = new Map([["a", 3]]);
    expect(findStockShortage([{ inventoryId: "a", name: "زيت", quantity: 4 }], stock, new Map())).toContain("زيت");
    expect(findStockShortage([{ inventoryId: "a", name: "زيت", quantity: 4 }], stock, new Map([["a", 1]]))).toBeNull();
    expect(
      findStockShortage([{ inventoryId: "a", name: "زيت", quantity: 2 }, { inventoryId: "a", name: "زيت", quantity: 2 }], stock, new Map()),
    ).not.toBeNull();
  });

  it("computeFuelByBus aggregates per bus", () => {
    const r = computeFuelByBus([
      { bus: "B1", liters: 10, cost: 100, odoStart: 0, odoEnd: 100 },
      { bus: "B1", liters: 10, cost: 100, odoStart: 100, odoEnd: 200 },
      { bus: "B2", liters: 5, cost: 50, odoStart: 0, odoEnd: 0 },
    ]);
    const b1 = r.find((x) => x.bus === "B1")!;
    expect(b1).toMatchObject({ fills: 2, liters: 20, cost: 200, km: 200, kmPerLiter: 10 });
    expect(r.find((x) => x.bus === "B2")!.kmPerLiter).toBe(0);
  });

  it("computeBusLedger filters by bus/date and excludes cancelled", () => {
    const mk = (id: string, date: string, status: string) => ({ id, code: id, date, issue: "x", status, items: [item(2, 50)], laborCost: 20 });
    const orders = [mk("o1", "2026-01-05", "مكتمل"), mk("o2", "2026-01-20", "ملغي"), mk("o3", "2026-03-01", "مكتمل"), mk("o4", "2026-01-10", "مكتمل")];
    const buses = new Map([["o1", "B1"], ["o2", "B1"], ["o3", "B1"], ["o4", "B2"]]);
    const l = computeBusLedger(orders, "B1", "2026-01-01", "2026-01-31", buses);
    expect(l.rows.map((r) => r.id)).toEqual(["o1"]);
    expect(l.totalParts).toBe(100);
    expect(l.grandTotal).toBe(120);
  });
});

describe("finance (Spec G)", () => {
  it("computeFinalPayroll applies the net formula", () => {
    const r = computeFinalPayroll(
      { baseSalary: 5000, shiftAllowances: 800, tripFees: 200, advances: 300, penalties: 100 },
      { bonus: 150, advances: 200, penalties: 50, tolls: 75, notes: "", locked: false },
    );
    expect(r.additions).toBe(1150);
    expect(r.deductions).toBe(500 + 150 + 75);
    expect(r.net).toBe(5000 + 1150 - 725);
  });

  it("computeFinalPayroll without adjustments", () => {
    expect(computeFinalPayroll({ baseSalary: 1000, shiftAllowances: 0, tripFees: 0, advances: 100, penalties: 0 }).net).toBe(900);
  });

  it("nextInstallment picks the earliest upcoming, else the last", () => {
    const list = [{ amount: 1, dueDate: "2026-01-10" }, { amount: 2, dueDate: "2026-03-10" }, { amount: 3, dueDate: "2026-02-10" }];
    expect(nextInstallment(list, "2026-02-01")?.amount).toBe(3);
    expect(nextInstallment(list, "2026-12-01")?.amount).toBe(2);
    expect(nextInstallment([])).toBeNull();
  });

  it("computeClientMonthBalance rolls unpaid balance forward", () => {
    const r = computeClientMonthBalance(1000, 5000, [{ debit: 0, credit: 2500 }]);
    expect(r.closing).toBe(3500);
  });
});

describe("date ranges and rented ledger", () => {
  it("periodBounds handles month and range", () => {
    expect(periodBounds("2026-10")).toEqual({ start: "2026-10-01", end: "2026-11-01" });
    expect(periodBounds({ from: "2026-10-05", to: "2026-10-31" })).toEqual({ start: "2026-10-05", end: "2026-11-01" });
  });
  it("periodMonths lists touched months", () => {
    expect(periodMonths({ from: "2026-10-20", to: "2026-12-02" })).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(periodMonths("2026-10")).toEqual(["2026-10"]);
  });
  it("rangeForPreset", () => {
    expect(rangeForPreset("current", "2026-10-11")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(rangeForPreset("previous", "2026-01-15")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(rangeForPreset("all")).toEqual({ from: "", to: "" });
  });
  it("inDateRange is inclusive", () => {
    expect(inDateRange("2026-10-01", { from: "2026-10-01", to: "2026-10-01" })).toBe(true);
    expect(inDateRange("2026-10-02", { from: "2026-10-01", to: "2026-10-01" })).toBe(false);
  });
  it("computeRentedLedger totals and filters", () => {
    const mk = (id: string, date: string, bus: string, fare: number, paid: boolean) => ({ id, date, owner: "أ", bus, driver: "", clientId: "", destination: "", gasCost: 10, fare, clientFare: fare + 100, vehicleType: "ملاكي", routeName: "", missionId: "", paid, paidAt: "", notes: "" });
    const ops = [mk("1", "2026-10-01", "B1", 100, true), mk("2", "2026-10-05", "B1", 200, false), mk("3", "2026-09-05", "B2", 50, false)];
    const l = computeRentedLedger(ops, { owner: "أ", bus: "", range: { from: "2026-10-01", to: "2026-10-31" } });
    expect([l.totalDue, l.totalPaid, l.remaining, l.totalGas, l.unpaidIds]).toEqual([300, 100, 200, 20, ["2"]]);
    expect(l.totalClientFare).toBe(500);
    expect(l.totalNet).toBe(500 - 300 - 20);
    expect(computeRentedLedger(ops, { owner: "أ", bus: "B2", range: { from: "", to: "" } }).remaining).toBe(50);
  });
  it("applySupplierRange carries opening balance", () => {
    const e = (date: string, w: number, p: number) => ({ id: date, source: "payment" as const, date, kind: "سداد" as const, reference: "", description: "", withdrawals: w, payments: p, attachmentPath: null });
    const out = applySupplierRange([e("2026-09-01", 500, 0), e("2026-10-02", 100, 0)], { from: "2026-10-01", to: "2026-10-31" });
    expect(out.map((x) => x.withdrawals)).toEqual([500, 100]);
  });
});

describe("missions", () => {
  it("missionNet = client price - vehicle cost - driver fee", () => {
    expect(missionNet({ clientPrice: 1000, vehicleCost: 600, driverFee: 150 })).toBe(250);
  });
});
