import { and, desc, eq, gte, inArray, isNotNull, lte, max, sql } from "drizzle-orm";

import { logAudit } from "./audit";
import { newId, type DbOrTx } from "./client";
import { periods, postings, transactions, type Period } from "./schema";

export class PeriodLockedError extends Error {
  constructor(date: string, through: string) {
    super(
      `Ngày ${date} thuộc kỳ đã chốt (đến ${through}). Mở khoá kỳ trước khi thêm, sửa hoặc xoá.`,
    );
    this.name = "PeriodLockedError";
  }
}

/** The last locked day of each account that has one. */
export async function lockedThrough(
  db: DbOrTx,
  accountIds?: readonly string[],
): Promise<Map<string, string>> {
  if (accountIds?.length === 0) return new Map();
  const rows = await db
    .select({ accountId: periods.accountId, to: max(periods.to) })
    .from(periods)
    .where(
      and(
        isNotNull(periods.lockedAt),
        accountIds ? inArray(periods.accountId, [...accountIds]) : undefined,
      ),
    )
    .groupBy(periods.accountId);
  return new Map(rows.flatMap((r) => (r.to ? [[r.accountId, r.to] as const] : [])));
}

/** Throws when any of the entries falls in a locked period of its account. */
export async function assertUnlocked(
  db: DbOrTx,
  entries: readonly { accountId?: string | null; date: string }[],
): Promise<void> {
  const ids = [...new Set(entries.flatMap((e) => (e.accountId ? [e.accountId] : [])))];
  if (ids.length === 0) return;
  const locks = await lockedThrough(db, ids);
  for (const e of entries) {
    const through = e.accountId ? locks.get(e.accountId) : undefined;
    if (through && e.date <= through) throw new PeriodLockedError(e.date, through);
  }
}

/** The stored postings of transactions, with their dates, for lock checks. */
export async function postingDates(db: DbOrTx, transactionIds: readonly string[]) {
  if (transactionIds.length === 0) return [];
  return db
    .select({ accountId: postings.accountId, date: transactions.date })
    .from(postings)
    .innerJoin(transactions, eq(postings.transactionId, transactions.id))
    .where(inArray(postings.transactionId, [...transactionIds]));
}

export async function listPeriods(db: DbOrTx, accountId?: string): Promise<Period[]> {
  return db
    .select()
    .from(periods)
    .where(accountId ? eq(periods.accountId, accountId) : undefined)
    .orderBy(desc(periods.to));
}

export interface LockPeriodInput {
  accountId: string;
  from: string;
  to: string;
  statementId?: string | null;
  statementBalance: number;
  ledgerBalance: number;
}

/**
 * Locks a reconciled period: its transactions on the account become "reconciled" and can no
 * longer be added to, changed or deleted.
 */
export async function lockPeriod(db: DbOrTx, input: LockPeriodInput): Promise<string> {
  const id = newId();
  await db
    .insert(periods)
    .values({ id, ...input, lockedAt: sql`now()` })
    .onConflictDoUpdate({
      target: [periods.accountId, periods.to],
      set: {
        from: input.from,
        statementId: input.statementId ?? null,
        statementBalance: input.statementBalance,
        ledgerBalance: input.ledgerBalance,
        lockedAt: sql`now()`,
      },
    });
  const touching = db
    .select({ id: postings.transactionId })
    .from(postings)
    .where(eq(postings.accountId, input.accountId));
  await db
    .update(transactions)
    .set({ status: "reconciled", updatedAt: sql`now()` })
    .where(
      and(
        inArray(transactions.id, touching),
        gte(transactions.date, input.from),
        lte(transactions.date, input.to),
      ),
    );
  await logAudit(db, "period.lock", "account", input.accountId, {
    from: input.from,
    to: input.to,
    statementBalance: input.statementBalance,
    ledgerBalance: input.ledgerBalance,
  });
  return id;
}

/** Unlocks the latest locked period of an account. Earlier periods stay locked. */
export async function unlockPeriod(db: DbOrTx, accountId: string): Promise<Period | null> {
  const [latest] = await db
    .select()
    .from(periods)
    .where(and(eq(periods.accountId, accountId), isNotNull(periods.lockedAt)))
    .orderBy(desc(periods.to))
    .limit(1);
  if (!latest) return null;
  await db.update(periods).set({ lockedAt: null }).where(eq(periods.id, latest.id));
  const touching = db
    .select({ id: postings.transactionId })
    .from(postings)
    .where(eq(postings.accountId, accountId));
  await db
    .update(transactions)
    .set({ status: "cleared", updatedAt: sql`now()` })
    .where(
      and(
        inArray(transactions.id, touching),
        gte(transactions.date, latest.from),
        lte(transactions.date, latest.to),
      ),
    );
  await logAudit(db, "period.unlock", "account", accountId, {
    from: latest.from,
    to: latest.to,
  });
  return latest;
}
