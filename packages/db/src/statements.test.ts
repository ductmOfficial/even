import { buildExpense } from "@even/domain";
import { beforeEach, describe, expect, it } from "vitest";

import { accountBalances, createAccount } from "./accounts";
import { listAudit } from "./audit";
import { exportBackup, restoreBackup } from "./backup";
import type { Db } from "./client";
import { listPeriods, lockedThrough, lockPeriod, PeriodLockedError, unlockPeriod } from "./periods";
import {
  deleteStatement,
  findAccountByNumber,
  getStatement,
  listStatementLines,
  saveStatement,
  setLineStatus,
  statementLineKeys,
  type StatementInput,
  type StatementLineInput,
} from "./statements";
import { memoryDb } from "./test-utils";
import {
  createTransaction,
  deleteTransactions,
  getTransaction,
  updateTransaction,
} from "./transactions";

let db: Db;
beforeEach(async () => {
  ({ db } = await memoryDb());
});

const line = (date: string, amount: number, extra: Partial<StatementLineInput> = {}) => ({
  date,
  postDate: null,
  amount,
  balance: null,
  description: "Coffee",
  counterparty: null,
  counterpartyBank: null,
  reference: null,
  cardLast4: null,
  original: null,
  ...extra,
});

const statement = (
  from: string,
  to: string,
  lines: StatementLineInput[],
  extra: Partial<StatementInput> = {},
): StatementInput => ({
  kind: "tcb-account",
  bank: "TCB",
  accountNumber: "1234567890",
  holder: "NGUYEN VAN A",
  periodFrom: from,
  periodTo: to,
  openingBalance: 1_000_000,
  reportedOpeningBalance: null,
  closingBalance: 1_000_000 + lines.reduce((s, l) => s + l.amount, 0),
  creditCard: null,
  lines,
  ...extra,
});

const expense = (accountId: string, date: string, amount: number) =>
  buildExpense({
    date,
    description: "Coffee",
    accountId,
    currency: "VND",
    amount,
    categoryId: "food.coffee",
  });

describe("statement line keys", () => {
  it("prefer the bank reference and number identical lines", () => {
    expect(
      statementLineKeys([
        line("2026-09-01", -50_000),
        line("2026-09-01", -50_000),
        line("2026-09-01", -50_000, { reference: "FT1" }),
      ]),
    ).toEqual([
      "2026-09-01|-50000|coffee#1",
      "2026-09-01|-50000|coffee#2",
      "2026-09-01|-50000|FT1#1",
    ]);
  });
});

describe("statements", () => {
  it("links to an account by number, stores lines once and is idempotent", async () => {
    const accountId = await createAccount(db, { name: "Bank", type: "bank", number: "1234567890" });
    expect((await findAccountByNumber(db, "1234567890"))?.id).toBe(accountId);

    const sep = statement("2026-09-01", "2026-09-30", [
      line("2026-09-03", -50_000, { reference: "FT1" }),
      line("2026-09-29", 200_000, { reference: "FT2" }),
    ]);
    expect(
      await saveStatement(db, { accountId, statement: sep, filename: "sep.pdf" }),
    ).toMatchObject({
      existing: false,
      inserted: 2,
      skipped: 0,
    });
    expect(await saveStatement(db, { accountId, statement: sep })).toMatchObject({
      existing: true,
      inserted: 0,
    });

    // An overlapping statement repeats the line of 29/09.
    const overlap = statement("2026-09-15", "2026-10-15", [
      line("2026-09-29", 200_000, { reference: "FT2" }),
      line("2026-10-02", -30_000, { reference: "FT3" }),
    ]);
    expect(await saveStatement(db, { accountId, statement: overlap })).toMatchObject({
      inserted: 1,
      skipped: 1,
    });
    const lines = await listStatementLines(db, { accountId, from: "2026-09-01", to: "2026-10-31" });
    expect(lines.map((l) => l.reference)).toEqual(["FT1", "FT2", "FT3"]);

    const tx = await createTransaction(db, expense(accountId, "2026-09-03", 50_000));
    await setLineStatus(db, [lines[0]?.id ?? ""], "matched", tx);
    await deleteTransactions(db, [tx]);
    const stored = await getStatement(db, lines[0]?.statementId ?? "");
    // Deleting the transaction keeps the line, unlinked.
    expect(stored?.lines[0]).toMatchObject({ status: "matched", transactionId: null });

    await deleteStatement(db, stored?.id ?? "");
    expect(await getStatement(db, stored?.id ?? "")).toBeUndefined();
    expect((await listAudit(db)).map((a) => a.action)).toEqual([
      "statement.delete",
      "statement.import",
      "statement.import",
    ]);
  });

  it("keeps credit card details", async () => {
    const accountId = await createAccount(db, { name: "Card", type: "credit_card" });
    const card = statement("2026-08-19", "2026-09-18", [line("2026-09-01", -100_000)], {
      kind: "tcb-credit-card",
      openingBalance: -2_000_000,
      closingBalance: -2_100_000,
      creditCard: {
        statementDate: "2026-09-18",
        dueDate: "2026-10-15",
        minimumPayment: 105_000,
        creditLimit: 50_000_000,
      },
    });
    const { statementId } = await saveStatement(db, { accountId, statement: card });
    expect(await getStatement(db, statementId)).toMatchObject({
      dueDate: "2026-10-15",
      minimumPayment: 105_000,
      creditLimit: 50_000_000,
      closingBalance: -2_100_000,
    });
  });
});

describe("period locks", () => {
  it("block changes on or before the locked date, until unlocked", async () => {
    const accountId = await createAccount(db, {
      name: "Bank",
      type: "bank",
      openingBalance: 1_000_000,
      openingDate: "2026-08-31",
    });
    const sep = await createTransaction(db, expense(accountId, "2026-09-10", 100_000));
    await lockPeriod(db, {
      accountId,
      from: "2026-09-01",
      to: "2026-09-30",
      statementBalance: 900_000,
      ledgerBalance: 900_000,
    });
    expect((await lockedThrough(db)).get(accountId)).toBe("2026-09-30");
    expect((await getTransaction(db, sep))?.status).toBe("reconciled");

    await expect(createTransaction(db, expense(accountId, "2026-09-20", 1))).rejects.toThrow(
      PeriodLockedError,
    );
    await expect(deleteTransactions(db, [sep])).rejects.toThrow(/kỳ đã chốt/);
    // Moving a transaction out of the locked period is a change to it too.
    await expect(
      updateTransaction(db, sep, expense(accountId, "2026-10-01", 100_000)),
    ).rejects.toThrow(PeriodLockedError);
    // After the period, everything works.
    const oct = await createTransaction(db, expense(accountId, "2026-10-01", 1_000));
    await updateTransaction(db, oct, expense(accountId, "2026-10-02", 2_000));

    expect((await unlockPeriod(db, accountId))?.to).toBe("2026-09-30");
    expect((await getTransaction(db, sep))?.status).toBe("cleared");
    await deleteTransactions(db, [sep]);
    expect((await accountBalances(db)).find((b) => b.accountId === accountId)?.balance).toBe(
      998_000,
    );
    expect((await listPeriods(db, accountId))[0]?.lockedAt).toBeNull();
    expect((await listAudit(db)).map((a) => a.action)).toEqual(["period.unlock", "period.lock"]);
  });

  it("do not lock other accounts", async () => {
    const a = await createAccount(db, { name: "A", type: "bank" });
    const b = await createAccount(db, { name: "B", type: "bank" });
    await lockPeriod(db, {
      accountId: a,
      from: "2026-09-01",
      to: "2026-09-30",
      statementBalance: 0,
      ledgerBalance: 0,
    });
    await createTransaction(db, expense(b, "2026-09-10", 1));
  });
});

describe("backup", () => {
  it("round-trips statements, periods and the audit log", async () => {
    const accountId = await createAccount(db, { name: "Bank", type: "bank", number: "1" });
    await saveStatement(db, {
      accountId,
      statement: statement("2026-09-01", "2026-09-30", [line("2026-09-03", -1)]),
    });
    await lockPeriod(db, {
      accountId,
      from: "2026-09-01",
      to: "2026-09-30",
      statementBalance: 999_999,
      ledgerBalance: 999_999,
    });
    const backup = JSON.parse(JSON.stringify(await exportBackup(db))) as Awaited<
      ReturnType<typeof exportBackup>
    >;
    expect(backup.version).toBe(2);
    await restoreBackup(db, backup);
    expect(await listStatementLines(db, { accountId })).toHaveLength(1);
    expect((await lockedThrough(db)).get(accountId)).toBe("2026-09-30");
    expect(await listAudit(db)).toHaveLength(2);

    // A version 1 backup has none of these.
    const v1 = { ...backup, version: 1, data: { ...backup.data } };
    delete v1.data.statements;
    delete v1.data.statementLines;
    delete v1.data.periods;
    delete v1.data.auditLog;
    await restoreBackup(db, v1);
    expect(await listStatementLines(db, { accountId })).toHaveLength(0);
  });
});
