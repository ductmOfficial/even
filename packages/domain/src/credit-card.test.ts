import { describe, expect, it } from "vitest";

import { cardStatus } from "./credit-card";

const statement = {
  statementDate: "2026-10-20",
  dueDate: "2026-11-16",
  closingBalance: -15_400_000,
  minimumPayment: 770_000,
  creditLimit: 100_000_000,
};

describe("cardStatus", () => {
  it("counts down to the due date and tracks payments", () => {
    expect(cardStatus(statement, -18_000_000, 0, "2026-11-14")).toMatchObject({
      statementDue: 15_400_000,
      remaining: 15_400_000,
      minimumRemaining: 770_000,
      daysLeft: 2,
      state: "due",
    });
    expect(cardStatus(statement, -18_000_000, 0, "2026-11-14").utilization).toBeCloseTo(18 / 100);
    expect(cardStatus(statement, -2_000_000, 1_000_000, "2026-11-14")).toMatchObject({
      remaining: 14_400_000,
      minimumRemaining: 0,
    });
    expect(cardStatus(statement, -2_000_000, 15_400_000, "2026-11-20")).toMatchObject({
      remaining: 0,
      state: "paid",
    });
    expect(cardStatus(statement, -2_000_000, 0, "2026-11-20")).toMatchObject({
      daysLeft: -4,
      state: "overdue",
    });
  });

  it("handles a card with nothing owed and no limit", () => {
    expect(
      cardStatus({ ...statement, closingBalance: 500, creditLimit: null }, 0, 0, "2026-11-14"),
    ).toMatchObject({ statementDue: 0, state: "none", utilization: null });
  });
});
