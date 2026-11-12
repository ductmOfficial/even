import {
  buildOpening,
  OPENING_BALANCE_ACCOUNT_ID,
  type AccountType,
  type Currency,
} from "@even/domain";
import { and, asc, eq, lte, sql } from "drizzle-orm";

import { newId, type Db, type DbOrTx } from "./client";
import { accounts, postings, transactions, type Account } from "./schema";
import { insertTransaction } from "./transactions";

export interface AccountBalance {
  accountId: string;
  /** In the account's own currency, minor units. */
  balance: number;
  /** Historical VND value of the postings (not revalued). */
  baseBalance: number;
}

export async function listAccounts(db: DbOrTx, options: { includeArchived?: boolean } = {}) {
  return db
    .select()
    .from(accounts)
    .where(options.includeArchived ? undefined : eq(accounts.archived, false))
    .orderBy(asc(accounts.sort), asc(accounts.name));
}

export async function getAccount(db: DbOrTx, id: string): Promise<Account | undefined> {
  const [row] = await db.select().from(accounts).where(eq(accounts.id, id));
  return row;
}

/** Balances of every account as of a date (inclusive). */
export async function accountBalances(db: DbOrTx, asOf?: string): Promise<AccountBalance[]> {
  return db
    .select({
      accountId: sql<string>`${postings.accountId}`,
      balance: sql<number>`coalesce(sum(${postings.amount}), 0)::bigint`.mapWith(Number),
      baseBalance: sql<number>`coalesce(sum(${postings.baseAmount}), 0)::bigint`.mapWith(Number),
    })
    .from(postings)
    .innerJoin(transactions, eq(postings.transactionId, transactions.id))
    .where(
      and(sql`${postings.accountId} is not null`, asOf ? lte(transactions.date, asOf) : undefined),
    )
    .groupBy(postings.accountId);
}

export interface AccountInput {
  name: string;
  type: AccountType;
  currency?: Currency;
  institution?: string | null;
  last4?: string | null;
  aliases?: string[];
  color?: string | null;
  note?: string | null;
}

export interface CreateAccountInput extends AccountInput {
  /** Starting balance in minor units of the account currency. */
  openingBalance?: number;
  openingDate?: string;
  /** VND per unit, for foreign-currency opening balances. */
  rate?: number;
}

export async function createAccount(db: Db, input: CreateAccountInput): Promise<string> {
  const id = newId();
  const currency = input.currency ?? "VND";
  await db.transaction(async (tx) => {
    await tx.insert(accounts).values({
      id,
      name: input.name.trim(),
      type: input.type,
      currency,
      institution: input.institution ?? null,
      last4: input.last4?.trim() ? input.last4.trim() : null,
      aliases: input.aliases ?? [],
      color: input.color ?? null,
      note: input.note ?? null,
    });
    if (input.openingBalance && input.openingDate) {
      await insertTransaction(
        tx,
        buildOpening({
          date: input.openingDate,
          accountId: id,
          currency,
          rate: input.rate,
          amount: input.openingBalance,
          equityAccountId: OPENING_BALANCE_ACCOUNT_ID,
        }),
      );
    }
  });
  return id;
}

export async function updateAccount(
  db: DbOrTx,
  id: string,
  patch: Partial<AccountInput> & { archived?: boolean; sort?: number },
): Promise<void> {
  await db
    .update(accounts)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(eq(accounts.id, id));
}
