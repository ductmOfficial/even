import { draftFromTemplate, dueMonths, occurrenceId } from "@even/domain";
import { asc, eq, inArray, like, sql } from "drizzle-orm";

import { newId, type Db, type DbOrTx } from "./client";
import { PeriodLockedError } from "./periods";
import {
  recurringTemplates,
  transactions,
  type NewRecurringTemplate,
  type RecurringTemplate,
} from "./schema";
import { insertTransaction } from "./transactions";

export async function listRecurring(db: DbOrTx): Promise<RecurringTemplate[]> {
  return db.select().from(recurringTemplates).orderBy(asc(recurringTemplates.dayOfMonth));
}

export type RecurringInput = Omit<NewRecurringTemplate, "id" | "createdAt" | "updatedAt">;

export async function saveRecurring(db: DbOrTx, input: RecurringInput, id?: string) {
  if (id) {
    await db
      .update(recurringTemplates)
      .set({ ...input, updatedAt: sql`now()` })
      .where(eq(recurringTemplates.id, id));
    return id;
  }
  const newIdValue = newId();
  await db.insert(recurringTemplates).values({ ...input, id: newIdValue });
  return newIdValue;
}

/** Deletes a template; transactions it created stay. */
export async function deleteRecurring(db: DbOrTx, id: string): Promise<void> {
  await db.delete(recurringTemplates).where(eq(recurringTemplates.id, id));
}

/** Occurrences due on or before `today` that are not in the ledger yet. */
export async function pendingRecurring(
  db: DbOrTx,
  today: string,
): Promise<{ template: RecurringTemplate; month: string }[]> {
  const templates = await listRecurring(db);
  const wanted = templates.flatMap((template) =>
    dueMonths(template, today).map((month) => ({ template, month })),
  );
  if (wanted.length === 0) return [];
  const existing = new Set(
    (
      await db
        .select({ id: transactions.externalId })
        .from(transactions)
        .where(like(transactions.externalId, "recurring:%"))
    ).flatMap((r) => (r.id ? [r.id] : [])),
  );
  return wanted.filter((w) => !existing.has(occurrenceId(w.template, w.month)));
}

export interface GenerateResult {
  created: number;
  /** Occurrences in locked periods, left alone. */
  skipped: number;
}

/**
 * Adds the due occurrences of every active template, as transactions to review, so the
 * statement can match them later. Running it again adds nothing.
 */
export async function generateRecurring(db: Db, today: string): Promise<GenerateResult> {
  const pending = await pendingRecurring(db, today);
  let created = 0;
  let skipped = 0;
  for (const { template, month } of pending) {
    try {
      await db.transaction(async (tx) => {
        await insertTransaction(
          tx,
          { ...draftFromTemplate(template, month), needsReview: true },
          { source: "recurring", externalId: occurrenceId(template, month) },
        );
      });
      created++;
    } catch (error) {
      if (error instanceof PeriodLockedError) skipped++;
      else throw error;
    }
  }
  return { created, skipped };
}

/** Templates by id, for labels. */
export async function recurringByIds(db: DbOrTx, ids: readonly string[]) {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(recurringTemplates)
    .where(inArray(recurringTemplates.id, [...ids]));
}
