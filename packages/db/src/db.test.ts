import { buildExpense, buildTransfer, DEFAULT_CATEGORIES, UNCATEGORIZED_ID } from "@even/domain";
import { beforeEach, describe, expect, it } from "vitest";

import { accountBalances, createAccount, listAccounts } from "./accounts";
import { exportBackup, isBackup, resetAll, restoreBackup } from "./backup";
import { createCategory, listCategories, updateCategory } from "./categories";
import type { Db } from "./client";
import { seedDemo } from "./demo";
import { importDrafts } from "./imports";
import { migrate } from "./migrate";
import { categoryTotals, monthlyTotals, netWorth } from "./reports";
import { applyRules, createRule } from "./rules";
import { setSetting } from "./settings";
import { memoryDb } from "./test-utils";
import {
  countNeedsReview,
  createTransaction,
  deleteTransactions,
  getTransaction,
  listTransactions,
  setCategory,
  updateTransaction,
} from "./transactions";

let db: Db;
let client: Awaited<ReturnType<typeof memoryDb>>["client"];

beforeEach(async () => {
  ({ db, client } = await memoryDb());
});

const expense = (
  accountId: string,
  amount: number,
  extra: Partial<Parameters<typeof buildExpense>[0]> = {},
) =>
  buildExpense({
    date: "2026-11-05",
    description: "Kingfood",
    accountId,
    currency: "VND",
    amount,
    categoryId: "food.groceries",
    ...extra,
  });

describe("setup", () => {
  it("seeds categories and is idempotent on re-migrate", async () => {
    expect(await migrate(client)).toEqual([]);
    const cats = await listCategories(db);
    expect(cats).toHaveLength(DEFAULT_CATEGORIES.length);
  });
});

describe("accounts and transactions", () => {
  it("tracks balances, splits and transfers", async () => {
    const bank = await createAccount(db, {
      name: "TCB 4321",
      type: "bank",
      last4: "4321",
      openingBalance: 10_000_000,
      openingDate: "2026-10-31",
    });
    const wallet = await createAccount(db, { name: "ShopeePay", type: "ewallet" });
    const an = await createAccount(db, { name: "An", type: "person" });

    await createTransaction(
      db,
      expense(bank, 1_000_000, { shares: [{ personAccountId: an, amount: 400_000 }] }),
    );
    await createTransaction(
      db,
      buildTransfer({
        date: "2026-11-06",
        description: "Nạp ví",
        from: { accountId: bank, currency: "VND" },
        to: { accountId: wallet, currency: "VND" },
        amount: 500_000,
      }),
    );

    const balances = new Map((await accountBalances(db)).map((b) => [b.accountId, b.balance]));
    expect(balances.get(bank)).toBe(8_500_000);
    expect(balances.get(wallet)).toBe(500_000);
    expect(balances.get(an)).toBe(400_000);

    // As-of a date before the transactions only the opening balance counts.
    const before = new Map(
      (await accountBalances(db, "2026-11-01")).map((b) => [b.accountId, b.balance]),
    );
    expect(before.get(bank)).toBe(10_000_000);

    const totals = await categoryTotals(db, { from: "2026-11-01", to: "2026-11-30" });
    expect(totals).toEqual([{ categoryId: "food.groceries", total: 600_000, count: 1 }]);

    const worth = await netWorth(db);
    expect(worth).toEqual({
      total: 9_400_000,
      assets: 9_000_000,
      liabilities: 0,
      receivables: 400_000,
    });

    const accounts = await listAccounts(db);
    expect(accounts.map((a) => a.name)).toContain("An");
  });

  it("filters, updates and deletes transactions", async () => {
    const bank = await createAccount(db, { name: "VCB", type: "bank" });
    const other = await createAccount(db, { name: "Cash", type: "cash" });
    const id = await createTransaction(db, expense(bank, 100_000));
    await createTransaction(
      db,
      expense(other, 50_000, {
        description: "Phở",
        categoryId: "food.restaurants",
        date: "2026-10-01",
      }),
    );

    expect(await listTransactions(db, { accountId: bank })).toHaveLength(1);
    expect(await listTransactions(db, { from: "2026-11-01", to: "2026-11-30" })).toHaveLength(1);
    expect(await listTransactions(db, { search: "phở" })).toHaveLength(1);
    expect(await listTransactions(db, { categoryIds: ["food.restaurants"] })).toHaveLength(1);

    await updateTransaction(db, id, expense(bank, 120_000, { description: "Kingfood Q7" }));
    const updated = await getTransaction(db, id);
    expect(updated?.description).toBe("Kingfood Q7");
    expect(updated?.postings.map((p) => p.baseAmount)).toEqual([-120_000, 120_000]);

    await deleteTransactions(db, [id]);
    expect(await getTransaction(db, id)).toBeUndefined();
  });

  it("rejects unbalanced drafts", async () => {
    const bank = await createAccount(db, { name: "VCB", type: "bank" });
    await expect(
      createTransaction(db, {
        date: "2026-11-01",
        description: "x",
        kind: "expense",
        postings: [
          { accountId: bank, amount: -1, currency: "VND", baseAmount: -1 },
          { categoryId: "food.groceries", amount: 2, currency: "VND", baseAmount: 2 },
        ],
      }),
    ).rejects.toThrow(/unbalanced/);
  });

  it("revalues foreign balances in net worth", async () => {
    await createAccount(db, {
      name: "PayPal",
      type: "foreign",
      currency: "USD",
      openingBalance: 100_00,
      openingDate: "2026-01-01",
      rate: 25_000,
    });
    await setSetting(db, "fx.USD", 26_000);
    expect((await netWorth(db)).total).toBe(2_600_000);
  });
});

describe("review queue and rules", () => {
  it("recategorises and clears the review flag", async () => {
    const bank = await createAccount(db, { name: "VCB", type: "bank" });
    const id = await createTransaction(
      db,
      expense(bank, 75_000, {
        description: "Highlands",
        categoryId: UNCATEGORIZED_ID,
        needsReview: true,
      }),
    );
    const unknown = await createTransaction(
      db,
      expense(bank, 10_000, {
        description: "QR 0912",
        categoryId: UNCATEGORIZED_ID,
        needsReview: true,
      }),
    );
    expect(await countNeedsReview(db)).toBe(2);

    expect(await applyRules(db)).toBe(1);
    const tx = await getTransaction(db, id);
    expect(tx?.postings.find((p) => p.categoryId)?.categoryId).toBe("food.coffee");

    await createRule(db, {
      pattern: "qr",
      matchType: "contains",
      categoryId: "giving.gifts",
      priority: 1,
    });
    expect(await applyRules(db)).toBe(1);

    await setCategory(db, [unknown], "family.parents");
    const fixed = await getTransaction(db, unknown);
    expect(fixed?.needsReview).toBe(false);
    expect(fixed?.postings.find((p) => p.categoryId)?.categoryId).toBe("family.parents");
  });
});

describe("categories", () => {
  it("creates nested categories that inherit attributes", async () => {
    const id = await createCategory(db, { name: "Rau củ", parentId: "food.groceries" });
    const cat = (await listCategories(db)).find((c) => c.id === id);
    expect(cat).toMatchObject({ kind: "expense", nature: "variable", bucket: "need", sort: 0 });
    await expect(updateCategory(db, UNCATEGORIZED_ID, { archived: true })).rejects.toThrow();
  });
});

describe("imports, demo and backup", () => {
  it("skips rows imported before", async () => {
    const bank = await createAccount(db, { name: "VCB", type: "bank" });
    const items = [
      { draft: expense(bank, 1000), externalId: "a" },
      { draft: expense(bank, 2000), externalId: "b" },
    ];
    expect(await importDrafts(db, items, { source: "test" })).toMatchObject({
      inserted: 2,
      skipped: 0,
    });
    expect(await importDrafts(db, items, { source: "test" })).toMatchObject({
      inserted: 0,
      skipped: 2,
    });
  });

  it("seeds demo data, backs up and restores it", async () => {
    const inserted = await seedDemo(db, { today: "2026-11-08", months: 3 });
    expect(inserted).toBeGreaterThan(50);
    const months = await monthlyTotals(db, { from: "2026-09-01", to: "2026-11-30" });
    expect(months.map((m) => m.month)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(months.every((m) => m.income > 0 && m.expense > 0)).toBe(true);

    const backup = await exportBackup(db);
    const worth = await netWorth(db);
    await resetAll(db);
    expect(await listTransactions(db)).toHaveLength(0);

    await restoreBackup(db, JSON.parse(JSON.stringify(backup)) as typeof backup);
    expect(await listTransactions(db)).toHaveLength(backup.data.transactions.length);
    expect(await netWorth(db)).toEqual(worth);
  });

  it("recognises backups by their app name", async () => {
    const backup = await exportBackup(db);
    expect(backup.app).toBe("even");
    expect(isBackup(backup)).toBe(true);
    expect(isBackup({ ...backup, app: "ledgr" })).toBe(true);
    expect(isBackup({ ...backup, app: "other" })).toBe(false);
    expect(isBackup(null)).toBe(false);
  });
});
