import { countsTowardNetWorth, toBase } from "@even/domain";
import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm";

import { accountBalances, listAccounts } from "./accounts";
import type { DbOrTx } from "./client";
import { categories, postings, transactions } from "./schema";
import { getFxRates } from "./settings";

export interface Range {
  from: string;
  to: string;
}

/** Sum of category lines per category: > 0 net expense, < 0 net income. */
export async function categoryTotals(db: DbOrTx, range: Range) {
  return db
    .select({
      categoryId: sql<string>`${postings.categoryId}`,
      total: sql<number>`sum(${postings.baseAmount})::bigint`.mapWith(Number),
      count: sql<number>`count(distinct ${postings.transactionId})::int`.mapWith(Number),
    })
    .from(postings)
    .innerJoin(transactions, eq(postings.transactionId, transactions.id))
    .where(
      and(
        isNotNull(postings.categoryId),
        gte(transactions.date, range.from),
        lte(transactions.date, range.to),
      ),
    )
    .groupBy(postings.categoryId);
}

export interface MonthTotal {
  month: string;
  income: number;
  expense: number;
}

/** Income and expense per month (VND). Refunds reduce expense; reversals reduce income. */
export async function monthlyTotals(db: DbOrTx, range: Range): Promise<MonthTotal[]> {
  const month = sql<string>`to_char(${transactions.date}, 'YYYY-MM')`;
  const rows = await db
    .select({
      month,
      income:
        sql<number>`coalesce(-sum(${postings.baseAmount}) filter (where ${categories.kind} = 'income'), 0)::bigint`.mapWith(
          Number,
        ),
      expense:
        sql<number>`coalesce(sum(${postings.baseAmount}) filter (where ${categories.kind} = 'expense'), 0)::bigint`.mapWith(
          Number,
        ),
    })
    .from(postings)
    .innerJoin(transactions, eq(postings.transactionId, transactions.id))
    .innerJoin(categories, eq(postings.categoryId, categories.id))
    .where(and(gte(transactions.date, range.from), lte(transactions.date, range.to)))
    .groupBy(month)
    .orderBy(month);
  return rows;
}

export interface NetWorth {
  total: number;
  /** Money you hold (bank, wallets, cash, foreign, investments). */
  assets: number;
  /** Credit card debt and money you owe people (negative). */
  liabilities: number;
  /** What people owe you. */
  receivables: number;
}

/**
 * Net worth as of a date in VND. Foreign balances are revalued at the current FX setting.
 * (Historical FX per day arrives with price feeds in P3.)
 */
export async function netWorth(db: DbOrTx, asOf?: string): Promise<NetWorth> {
  const [accounts, balances, fx] = await Promise.all([
    listAccounts(db, { includeArchived: true }),
    accountBalances(db, asOf),
    getFxRates(db),
  ]);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const result: NetWorth = { total: 0, assets: 0, liabilities: 0, receivables: 0 };
  for (const b of balances) {
    const account = byId.get(b.accountId);
    if (!account || !countsTowardNetWorth(account.type)) continue;
    const value = toBase(b.balance, account.currency, fx[account.currency]);
    result.total += value;
    if (account.type === "person") {
      if (value >= 0) result.receivables += value;
      else result.liabilities += value;
    } else if (value < 0) result.liabilities += value;
    else result.assets += value;
  }
  return result;
}
