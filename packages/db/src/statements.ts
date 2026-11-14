import { normalizeText } from "@even/domain";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { logAudit } from "./audit";
import { newId, type Db, type DbOrTx } from "./client";
import {
  accounts,
  statementLines,
  statements,
  type Account,
  type Statement,
  type StatementLineRow,
} from "./schema";

/** The fields of a parsed statement this module stores (see @even/parsers). */
export interface StatementInput {
  kind: Statement["kind"];
  bank: string;
  accountNumber: string;
  holder: string | null;
  periodFrom: string;
  periodTo: string;
  openingBalance: number;
  reportedOpeningBalance: number | null;
  closingBalance: number;
  creditCard: {
    statementDate: string;
    dueDate: string | null;
    minimumPayment: number | null;
    creditLimit: number | null;
  } | null;
  lines: readonly StatementLineInput[];
}

export interface StatementLineInput {
  date: string;
  postDate: string | null;
  amount: number;
  balance: number | null;
  description: string;
  counterparty: string | null;
  counterpartyBank: string | null;
  reference: string | null;
  cardLast4: string | null;
  original: { amount: number; currency: string } | null;
}

/**
 * A key that is the same wherever the line is printed: on this statement or on an overlapping
 * one. Identical lines on the same day (two coffees of the same price) get an occurrence number.
 */
export function statementLineKeys(lines: readonly StatementLineInput[]): string[] {
  const seen = new Map<string, number>();
  return lines.map((l) => {
    const what = l.reference ?? normalizeText(`${l.counterparty ?? ""} ${l.description}`);
    const base = `${l.date}|${String(l.amount)}|${what}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `${base}#${String(n)}`;
  });
}

/** The account a statement belongs to, by the number printed on it. */
export async function findAccountByNumber(
  db: DbOrTx,
  number: string,
): Promise<Account | undefined> {
  const [row] = await db.select().from(accounts).where(eq(accounts.number, number));
  return row;
}

export interface SaveStatementResult {
  statementId: string;
  /** The same account and period was imported before; nothing new was stored. */
  existing: boolean;
  inserted: number;
  /** Lines already stored from an overlapping statement. */
  skipped: number;
}

/** Stores a statement and its lines; importing it again stores nothing. */
export async function saveStatement(
  db: Db,
  input: { accountId: string; statement: StatementInput; filename?: string | null },
): Promise<SaveStatementResult> {
  const { accountId, statement: s } = input;
  return db.transaction(async (tx) => {
    const [found] = await tx
      .select({ id: statements.id })
      .from(statements)
      .where(
        and(
          eq(statements.accountId, accountId),
          eq(statements.periodFrom, s.periodFrom),
          eq(statements.periodTo, s.periodTo),
        ),
      );
    if (found) {
      return { statementId: found.id, existing: true, inserted: 0, skipped: s.lines.length };
    }
    const statementId = newId();
    await tx.insert(statements).values({
      id: statementId,
      accountId,
      kind: s.kind,
      bank: s.bank,
      accountNumber: s.accountNumber,
      holder: s.holder,
      periodFrom: s.periodFrom,
      periodTo: s.periodTo,
      openingBalance: s.openingBalance,
      reportedOpeningBalance: s.reportedOpeningBalance,
      closingBalance: s.closingBalance,
      filename: input.filename ?? null,
      statementDate: s.creditCard?.statementDate ?? null,
      dueDate: s.creditCard?.dueDate ?? null,
      minimumPayment: s.creditCard?.minimumPayment ?? null,
      creditLimit: s.creditCard?.creditLimit ?? null,
    });
    const keys = statementLineKeys(s.lines);
    const rows = s.lines.map((l, i) => ({
      id: newId(),
      statementId,
      accountId,
      key: keys[i] ?? String(i),
      sort: i,
      date: l.date,
      postDate: l.postDate,
      amount: l.amount,
      balance: l.balance,
      description: l.description,
      counterparty: l.counterparty,
      counterpartyBank: l.counterpartyBank,
      reference: l.reference,
      cardLast4: l.cardLast4,
      originalAmount: l.original ? String(l.original.amount) : null,
      originalCurrency: l.original?.currency ?? null,
    }));
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const done = await tx
        .insert(statementLines)
        .values(rows.slice(i, i + 500))
        .onConflictDoNothing({ target: [statementLines.accountId, statementLines.key] })
        .returning({ id: statementLines.id });
      inserted += done.length;
    }
    await logAudit(tx, "statement.import", "statement", statementId, {
      accountId,
      from: s.periodFrom,
      to: s.periodTo,
      lines: s.lines.length,
      inserted,
    });
    return { statementId, existing: false, inserted, skipped: s.lines.length - inserted };
  });
}

export async function listStatements(db: DbOrTx, accountId?: string): Promise<Statement[]> {
  return db
    .select()
    .from(statements)
    .where(accountId ? eq(statements.accountId, accountId) : undefined)
    .orderBy(desc(statements.periodTo));
}

export async function getStatement(
  db: DbOrTx,
  id: string,
): Promise<(Statement & { lines: StatementLineRow[] }) | undefined> {
  const [row] = await db.select().from(statements).where(eq(statements.id, id));
  if (!row) return undefined;
  const lines = await db
    .select()
    .from(statementLines)
    .where(eq(statementLines.statementId, id))
    .orderBy(asc(statementLines.sort));
  return { ...row, lines };
}

/** Lines of an account dated within a range, from every statement that covers it. */
export async function listStatementLines(
  db: DbOrTx,
  filter: { accountId: string; from?: string; to?: string },
): Promise<StatementLineRow[]> {
  return db
    .select()
    .from(statementLines)
    .where(
      and(
        eq(statementLines.accountId, filter.accountId),
        filter.from ? sql`${statementLines.date} >= ${filter.from}` : undefined,
        filter.to ? sql`${statementLines.date} <= ${filter.to}` : undefined,
      ),
    )
    .orderBy(asc(statementLines.date), asc(statementLines.sort));
}

export async function setLineStatus(
  db: DbOrTx,
  ids: readonly string[],
  status: StatementLineRow["status"],
  transactionId: string | null = null,
): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(statementLines)
    .set({ status, transactionId })
    .where(inArray(statementLines.id, [...ids]));
}

/** Deletes a statement and its lines; the transactions created from it stay. */
export async function deleteStatement(db: Db, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(statements).where(eq(statements.id, id));
    if (!row) return;
    await tx.delete(statements).where(eq(statements.id, id));
    await logAudit(tx, "statement.delete", "statement", id, {
      accountId: row.accountId,
      from: row.periodFrom,
      to: row.periodTo,
    });
  });
}
