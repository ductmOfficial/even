import { beforeEach, describe, expect, it } from "vitest";

import { createAccount } from "./accounts";
import { exportBackup, restoreBackup } from "./backup";
import type { Db } from "./client";
import { lockPeriod } from "./periods";
import {
  deleteRecurring,
  generateRecurring,
  listRecurring,
  pendingRecurring,
  saveRecurring,
  type RecurringInput,
} from "./recurring";
import { memoryDb } from "./test-utils";
import { listTransactions } from "./transactions";

let db: Db;
let bank: string;
beforeEach(async () => {
  ({ db } = await memoryDb());
  bank = await createAccount(db, {
    name: "Bank",
    type: "bank",
    openingBalance: 50_000_000,
    openingDate: "2026-08-31",
  });
});

const rent = (extra: Partial<RecurringInput> = {}): RecurringInput => ({
  name: "Tiền nhà",
  kind: "expense",
  dayOfMonth: 5,
  accountId: bank,
  categoryId: "housing.rent",
  amount: 7_500_000,
  shares: [],
  startMonth: "2026-09",
  endMonth: null,
  active: true,
  ...extra,
});

describe("recurring templates", () => {
  it("are saved, edited and deleted", async () => {
    const id = await saveRecurring(db, rent());
    await saveRecurring(db, rent({ amount: 8_000_000 }), id);
    expect((await listRecurring(db))[0]).toMatchObject({ id, amount: 8_000_000 });
    await deleteRecurring(db, id);
    expect(await listRecurring(db)).toEqual([]);
  });

  it("create each due month once, to review", async () => {
    await saveRecurring(db, rent());
    expect(await pendingRecurring(db, "2026-10-20")).toHaveLength(2);
    expect(await generateRecurring(db, "2026-10-20")).toEqual({ created: 2, skipped: 0 });
    expect(await generateRecurring(db, "2026-10-20")).toEqual({ created: 0, skipped: 0 });
    const rows = (await listTransactions(db)).filter((r) => r.source === "recurring");
    expect(rows.map((r) => r.date).sort()).toEqual(["2026-09-05", "2026-10-05"]);
    expect(rows.every((r) => r.needsReview)).toBe(true);
    expect(await pendingRecurring(db, "2026-11-05")).toHaveLength(1);
  });

  it("skip months that are locked", async () => {
    await saveRecurring(db, rent());
    await lockPeriod(db, {
      accountId: bank,
      from: "2026-09-01",
      to: "2026-09-30",
      statementBalance: 50_000_000,
      ledgerBalance: 50_000_000,
    });
    expect(await generateRecurring(db, "2026-10-20")).toEqual({ created: 1, skipped: 1 });
  });

  it("ignore inactive templates", async () => {
    await saveRecurring(db, rent({ active: false }));
    expect(await pendingRecurring(db, "2026-10-20")).toEqual([]);
  });

  it("survive a backup", async () => {
    await saveRecurring(db, rent());
    const backup = await exportBackup(db);
    await restoreBackup(db, backup);
    expect(await listRecurring(db)).toHaveLength(1);
  });
});
