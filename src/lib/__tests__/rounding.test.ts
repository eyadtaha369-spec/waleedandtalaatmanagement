import { describe, expect, it } from "vitest";
import { computeClientMonthBalance, computeFinalPayroll, computeOrderTotals, round2 } from "../queries";

describe("rounding", () => {
  it("round2 يعالج الفاصلة العائمة", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
  it("رصيد العميل", () => {
    const r = computeClientMonthBalance(0.1, 0.2, [{ debit: 0.1, credit: 0 }, { debit: 0.2, credit: 0.3 }]);
    expect(r.closing).toBe(0.3);
  });
  it("إجمالي أمر الصيانة", () => {
    expect(computeOrderTotals([{ quantity: 3, unitPrice: 0.1 }], 0.2).total).toBe(0.5);
  });
  it("صافي المرتب", () => {
    const r = computeFinalPayroll({ baseSalary: 1000.1, shiftAllowances: 0.2, tripFees: 0, advances: 0.1, penalties: 0, tolls: 0 });
    expect(r.net).toBe(1000.2);
  });
});
