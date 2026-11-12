import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  buildExpense,
  buildIncome,
  buildOpening,
  buildTransfer,
  LedgerError,
  summarize,
  validateTransaction,
  type TransactionDraft,
} from "./ledger";

const sum = (d: TransactionDraft) => d.postings.reduce((s, p) => s + p.baseAmount, 0);

describe("buildExpense", () => {
  it("creates a balanced expense", () => {
    const tx = buildExpense({
      date: "2026-11-01",
      description: "Kingfood",
      accountId: "tcb",
      currency: "VND",
      amount: 320_000,
      categoryId: "food.groceries",
    });
    expect(() => {
      validateTransaction(tx);
    }).not.toThrow();
    expect(tx.postings).toEqual([
      { accountId: "tcb", amount: -320_000, currency: "VND", baseAmount: -320_000 },
      { categoryId: "food.groceries", amount: 320_000, currency: "VND", baseAmount: 320_000 },
    ]);
  });

  it("turns other people's shares into receivables", () => {
    const tx = buildExpense({
      date: "2026-11-01",
      description: "Tiền nhà",
      accountId: "tcb",
      currency: "VND",
      amount: 7_500_000,
      categoryId: "housing.rent",
      shares: [{ personAccountId: "an", amount: 3_750_000 }],
    });
    validateTransaction(tx);
    expect(tx.postings.find((p) => p.accountId === "an")?.baseAmount).toBe(3_750_000);
    expect(tx.postings.find((p) => p.categoryId)?.baseAmount).toBe(3_750_000);
  });

  it("omits the category line when others pay everything", () => {
    const tx = buildExpense({
      date: "2026-11-01",
      description: "Hộ",
      accountId: "tcb",
      currency: "VND",
      amount: 100,
      categoryId: "x",
      shares: [{ personAccountId: "p", amount: 100 }],
    });
    expect(tx.postings).toHaveLength(2);
    validateTransaction(tx);
  });

  it("rejects shares larger than the total", () => {
    expect(() =>
      buildExpense({
        date: "2026-11-01",
        description: "x",
        accountId: "a",
        currency: "VND",
        amount: 100,
        categoryId: "c",
        shares: [{ personAccountId: "p", amount: 101 }],
      }),
    ).toThrow(LedgerError);
  });
});

describe("buildTransfer", () => {
  it("moves VND between accounts", () => {
    const tx = buildTransfer({
      date: "2026-11-01",
      description: "Nạp ví",
      from: { accountId: "tcb", currency: "VND" },
      to: { accountId: "shopeepay", currency: "VND" },
      amount: 500_000,
    });
    validateTransaction(tx);
    expect(tx.kind).toBe("transfer");
  });

  it("records the received amount for USD → VND", () => {
    const tx = buildTransfer({
      date: "2026-11-01",
      description: "Rút PayPal",
      from: { accountId: "paypal", currency: "USD", rate: 26_300 },
      to: { accountId: "vcb", currency: "VND" },
      amount: 100_000,
      toAmount: 26_100_000,
    });
    validateTransaction(tx);
    expect(tx.postings[0]).toMatchObject({ amount: -100_000, baseAmount: -26_100_000 });
    expect(tx.postings[1]).toMatchObject({ amount: 26_100_000, baseAmount: 26_100_000 });
  });

  it("requires the received amount across currencies", () => {
    expect(() =>
      buildTransfer({
        date: "2026-11-01",
        description: "x",
        from: { accountId: "paypal", currency: "USD", rate: 26_000 },
        to: { accountId: "vcb", currency: "VND" },
        amount: 100,
      }),
    ).toThrow(LedgerError);
  });
});

describe("validateTransaction", () => {
  it("rejects unbalanced postings", () => {
    expect(() => {
      validateTransaction({
        date: "2026-11-01",
        description: "x",
        kind: "expense",
        postings: [
          { accountId: "a", amount: -100, currency: "VND", baseAmount: -100 },
          { categoryId: "c", amount: 99, currency: "VND", baseAmount: 99 },
        ],
      });
    }).toThrow(/unbalanced/);
  });

  it("rejects a posting with both an account and a category", () => {
    expect(() => {
      validateTransaction({
        date: "2026-11-01",
        description: "x",
        kind: "expense",
        postings: [
          { accountId: "a", categoryId: "c", amount: -100, currency: "VND", baseAmount: -100 },
          { categoryId: "c", amount: 100, currency: "VND", baseAmount: 100 },
        ],
      });
    }).toThrow(LedgerError);
  });
});

describe("invariants (property-based)", () => {
  const vnd = fc.integer({ min: 1, max: 5_000_000_000 });

  it("expenses with any split always balance", () => {
    fc.assert(
      fc.property(
        vnd,
        fc.array(fc.integer({ min: 1, max: 100 }), { maxLength: 4 }),
        (amount, weights) => {
          const totalWeight = weights.reduce((s, w) => s + w, 0) + 100;
          const shares = weights
            .map((w, i) => ({
              personAccountId: `p${String(i)}`,
              amount: Math.floor((amount * w) / totalWeight),
            }))
            .filter((s) => s.amount > 0);
          const tx = buildExpense({
            date: "2026-01-01",
            description: "x",
            accountId: "a",
            currency: "VND",
            amount,
            categoryId: "c",
            shares,
          });
          validateTransaction(tx);
          return sum(tx) === 0;
        },
      ),
    );
  });

  it("foreign-currency expenses and transfers always balance", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000_000 }),
        fc.double({ min: 20_000, max: 30_000, noNaN: true }),
        fc.integer({ min: 1, max: 1_000_000_000 }),
        (cents, rate, received) => {
          const expense = buildExpense({
            date: "2026-01-01",
            description: "x",
            accountId: "paypal",
            currency: "USD",
            rate,
            amount: cents,
            categoryId: "c",
          });
          const income = buildIncome({
            date: "2026-01-01",
            description: "x",
            accountId: "paypal",
            currency: "USD",
            rate,
            amount: cents,
            categoryId: "i",
          });
          const transfer = buildTransfer({
            date: "2026-01-01",
            description: "x",
            from: { accountId: "paypal", currency: "USD", rate },
            to: { accountId: "vcb", currency: "VND" },
            amount: cents,
            toAmount: received,
          });
          for (const tx of [expense, income, transfer]) validateTransaction(tx);
          return sum(expense) === 0 && sum(income) === 0 && sum(transfer) === 0;
        },
      ),
    );
  });
});

describe("buildOpening", () => {
  it("balances against equity", () => {
    const tx = buildOpening({
      date: "2026-01-01",
      accountId: "tcb",
      currency: "VND",
      amount: 10_000_000,
      equityAccountId: "equity.opening",
    });
    validateTransaction(tx);
  });
});

describe("summarize", () => {
  it("splits accounts, people and categories", () => {
    const tx = buildExpense({
      date: "2026-11-01",
      description: "x",
      accountId: "tcb",
      currency: "VND",
      amount: 1000,
      categoryId: "c",
      shares: [{ personAccountId: "an", amount: 400 }],
    });
    const s = summarize(tx.postings, (id) => id === "an");
    expect(s).toEqual({ net: -600, categoryIds: ["c"], accountIds: ["tcb"], personIds: ["an"] });
  });
});
