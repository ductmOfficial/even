import { validateTransaction, type TransactionDraft } from "@even/domain";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  isNotNull,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { newId, type Db, type DbOrTx } from "./client";
import { postings, transactions, type PostingRow, type Transaction } from "./schema";

export interface TransactionMeta {
  source?: string;
  externalId?: string | null;
  importBatchId?: string | null;
  status?: Transaction["status"];
}

export type TransactionWithPostings = Transaction & { postings: PostingRow[] };

async function insertPostings(db: DbOrTx, transactionId: string, draft: TransactionDraft) {
  await db.insert(postings).values(
    draft.postings.map((p, i) => ({
      id: newId(),
      transactionId,
      accountId: p.accountId ?? null,
      categoryId: p.categoryId ?? null,
      amount: p.amount,
      currency: p.currency,
      baseAmount: p.baseAmount,
      memo: p.memo ?? null,
      sort: i,
    })),
  );
}

/** Validates the double-entry invariant, then writes the transaction and its postings. */
export async function insertTransaction(
  db: DbOrTx,
  draft: TransactionDraft,
  meta: TransactionMeta = {},
): Promise<string> {
  validateTransaction(draft);
  const id = newId();
  await db.insert(transactions).values({
    id,
    date: draft.date,
    description: draft.description.trim(),
    note: draft.note ?? null,
    kind: draft.kind,
    needsReview: draft.needsReview ?? false,
    source: meta.source ?? "manual",
    externalId: meta.externalId ?? null,
    importBatchId: meta.importBatchId ?? null,
    status: meta.status ?? "cleared",
  });
  await insertPostings(db, id, draft);
  return id;
}

/**
 * Inserts many transactions with a handful of multi-row statements. In the browser every
 * statement is flushed to IndexedDB, so batching turns a 2,000-statement import into ~10.
 */
export async function insertTransactionsBatch(
  db: DbOrTx,
  items: readonly { draft: TransactionDraft; meta?: TransactionMeta }[],
): Promise<string[]> {
  const txRows: (typeof transactions.$inferInsert)[] = [];
  const postingRows: (typeof postings.$inferInsert)[] = [];
  for (const { draft, meta = {} } of items) {
    validateTransaction(draft);
    const id = newId();
    txRows.push({
      id,
      date: draft.date,
      description: draft.description.trim(),
      note: draft.note ?? null,
      kind: draft.kind,
      needsReview: draft.needsReview ?? false,
      source: meta.source ?? "manual",
      externalId: meta.externalId ?? null,
      importBatchId: meta.importBatchId ?? null,
      status: meta.status ?? "cleared",
    });
    draft.postings.forEach((p, i) => {
      postingRows.push({
        id: newId(),
        transactionId: id,
        accountId: p.accountId ?? null,
        categoryId: p.categoryId ?? null,
        amount: p.amount,
        currency: p.currency,
        baseAmount: p.baseAmount,
        memo: p.memo ?? null,
        sort: i,
      });
    });
  }
  for (let i = 0; i < txRows.length; i += 500)
    await db.insert(transactions).values(txRows.slice(i, i + 500));
  for (let i = 0; i < postingRows.length; i += 1000)
    await db.insert(postings).values(postingRows.slice(i, i + 1000));
  return txRows.map((r) => r.id);
}

export async function createTransaction(db: Db, draft: TransactionDraft, meta?: TransactionMeta) {
  return db.transaction((tx) => insertTransaction(tx, draft, meta));
}

/** Replaces the transaction's fields and postings. */
export async function updateTransaction(db: Db, id: string, draft: TransactionDraft) {
  validateTransaction(draft);
  await db.transaction(async (tx) => {
    await tx
      .update(transactions)
      .set({
        date: draft.date,
        description: draft.description.trim(),
        note: draft.note ?? null,
        kind: draft.kind,
        needsReview: draft.needsReview ?? false,
        updatedAt: sql`now()`,
      })
      .where(eq(transactions.id, id));
    await tx.delete(postings).where(eq(postings.transactionId, id));
    await insertPostings(tx, id, draft);
  });
}

export async function deleteTransactions(db: DbOrTx, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(transactions).where(inArray(transactions.id, [...ids]));
}

export interface TransactionFilter {
  from?: string;
  to?: string;
  accountId?: string;
  /** Matches any of these categories (pass descendants for a subtree). */
  categoryIds?: readonly string[];
  search?: string;
  needsReview?: boolean;
  limit?: number;
}

export async function listTransactions(
  db: DbOrTx,
  filter: TransactionFilter = {},
): Promise<TransactionWithPostings[]> {
  const conditions = [
    filter.from ? gte(transactions.date, filter.from) : undefined,
    filter.to ? lte(transactions.date, filter.to) : undefined,
    filter.needsReview === undefined ? undefined : eq(transactions.needsReview, filter.needsReview),
    filter.search
      ? or(
          ilike(transactions.description, `%${filter.search}%`),
          ilike(transactions.note, `%${filter.search}%`),
        )
      : undefined,
    filter.accountId
      ? exists(
          db
            .select({ one: sql`1` })
            .from(postings)
            .where(
              and(
                eq(postings.transactionId, transactions.id),
                eq(postings.accountId, filter.accountId),
              ),
            ),
        )
      : undefined,
    filter.categoryIds?.length
      ? exists(
          db
            .select({ one: sql`1` })
            .from(postings)
            .where(
              and(
                eq(postings.transactionId, transactions.id),
                inArray(postings.categoryId, [...filter.categoryIds]),
              ),
            ),
        )
      : undefined,
  ];

  const rows = await db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.date), desc(transactions.createdAt), desc(transactions.id))
    .limit(filter.limit ?? 10_000);
  if (rows.length === 0) return [];

  const lines = await db
    .select()
    .from(postings)
    .where(
      inArray(
        postings.transactionId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(postings.sort));
  const byTx = new Map<string, PostingRow[]>();
  for (const line of lines) {
    const list = byTx.get(line.transactionId);
    if (list) list.push(line);
    else byTx.set(line.transactionId, [line]);
  }
  return rows.map((r) => ({ ...r, postings: byTx.get(r.id) ?? [] }));
}

export async function getTransaction(
  db: DbOrTx,
  id: string,
): Promise<TransactionWithPostings | undefined> {
  const [row] = await db.select().from(transactions).where(eq(transactions.id, id));
  if (!row) return undefined;
  const lines = await db
    .select()
    .from(postings)
    .where(eq(postings.transactionId, id))
    .orderBy(asc(postings.sort));
  return { ...row, postings: lines };
}

/**
 * Re-categorises the category lines of the given transactions and clears their review flag.
 * Transactions with several category lines get all of them moved to the new category.
 */
export async function setCategory(db: Db, ids: readonly string[], categoryId: string) {
  if (ids.length === 0) return;
  await db.transaction(async (tx) => {
    await tx
      .update(postings)
      .set({ categoryId })
      .where(and(inArray(postings.transactionId, [...ids]), isNotNull(postings.categoryId)));
    await tx
      .update(transactions)
      .set({ needsReview: false, updatedAt: sql`now()` })
      .where(inArray(transactions.id, [...ids]));
  });
}

export async function markReviewed(db: DbOrTx, ids: readonly string[], reviewed = true) {
  if (ids.length === 0) return;
  await db
    .update(transactions)
    .set({ needsReview: !reviewed, updatedAt: sql`now()` })
    .where(inArray(transactions.id, [...ids]));
}

export async function countNeedsReview(db: DbOrTx): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int`.mapWith(Number) })
    .from(transactions)
    .where(eq(transactions.needsReview, true));
  return row?.n ?? 0;
}
