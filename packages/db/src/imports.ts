import type { TransactionDraft } from "@even/domain";
import { inArray } from "drizzle-orm";

import { newId, type Db } from "./client";
import { importBatches, transactions } from "./schema";
import { insertTransactionsBatch } from "./transactions";

export interface ImportItem {
  draft: TransactionDraft;
  /** Stable id of the source row, used to skip rows imported before. */
  externalId: string;
}

export interface ImportResult {
  batchId: string;
  inserted: number;
  skipped: number;
}

/** Imports drafts in one database transaction; rows already imported (same externalId) are skipped. */
export async function importDrafts(
  db: Db,
  items: readonly ImportItem[],
  batch: { source: string; filename?: string | null },
): Promise<ImportResult> {
  const batchId = newId();
  const existing = new Set<string>();
  const ids = items.map((i) => i.externalId);
  for (let i = 0; i < ids.length; i += 1000) {
    const rows = await db
      .select({ externalId: transactions.externalId })
      .from(transactions)
      .where(inArray(transactions.externalId, ids.slice(i, i + 1000)));
    for (const r of rows) if (r.externalId) existing.add(r.externalId);
  }
  const fresh = items.filter((i) => !existing.has(i.externalId));

  await db.transaction(async (tx) => {
    await tx.insert(importBatches).values({
      id: batchId,
      source: batch.source,
      filename: batch.filename ?? null,
      rowCount: fresh.length,
    });
    await insertTransactionsBatch(
      tx,
      fresh.map((item) => ({
        draft: item.draft,
        meta: { source: batch.source, externalId: item.externalId, importBatchId: batchId },
      })),
    );
  });
  return { batchId, inserted: fresh.length, skipped: items.length - fresh.length };
}
