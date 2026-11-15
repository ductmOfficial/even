import { describe, expect, it } from "vitest";

import { validateTransaction } from "./ledger";
import {
  draftFromTemplate,
  dueDate,
  dueMonths,
  occurrenceId,
  type RecurringLike,
} from "./recurring";

const rent: RecurringLike = {
  id: "rent",
  name: "Tiền nhà",
  kind: "expense",
  dayOfMonth: 31,
  accountId: "bank",
  toAccountId: null,
  categoryId: "housing.rent",
  amount: 7_500_000,
  shares: [{ personAccountId: "partner", amount: 3_750_000 }],
  startMonth: "2026-01",
  endMonth: null,
  active: true,
};

describe("recurring templates", () => {
  it("fall on the day, or the last day of shorter months", () => {
    expect(dueDate(rent, "2026-02")).toBe("2026-02-28");
    expect(dueDate({ dayOfMonth: 5 }, "2026-09")).toBe("2026-09-05");
  });

  it("are due from the first month until today, within the end month", () => {
    expect(dueMonths(rent, "2026-03-30")).toEqual(["2026-01", "2026-02"]);
    expect(dueMonths({ ...rent, dayOfMonth: 5 }, "2026-03-05")).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
    expect(dueMonths({ ...rent, dayOfMonth: 5, endMonth: "2026-01" }, "2026-03-05")).toEqual([
      "2026-01",
    ]);
    expect(dueMonths({ ...rent, active: false }, "2026-03-30")).toEqual([]);
    expect(occurrenceId(rent, "2026-02")).toBe("recurring:rent:2026-02");
  });

  it("build balanced expenses with shares, income and transfers", () => {
    const expense = draftFromTemplate(rent, "2026-09");
    validateTransaction(expense);
    expect(expense.postings.map((p) => [p.accountId ?? p.categoryId, p.amount])).toEqual([
      ["bank", -7_500_000],
      ["partner", 3_750_000],
      ["housing.rent", 3_750_000],
    ]);
    const transfer = draftFromTemplate(
      { ...rent, kind: "transfer", toAccountId: "family", categoryId: null, shares: [] },
      "2026-09",
    );
    expect(transfer.kind).toBe("transfer");
    expect(() => draftFromTemplate({ ...rent, kind: "transfer" }, "2026-09")).toThrow(
      /tài khoản nhận/,
    );
    expect(draftFromTemplate({ ...rent, kind: "income", shares: [] }, "2026-09").kind).toBe(
      "income",
    );
  });
});
