import { matchRule, UNCATEGORIZED_ID, type RuleMatchType } from "@even/domain";
import { and, asc, eq, inArray } from "drizzle-orm";

import { newId, type Db, type DbOrTx } from "./client";
import { postings, rules, transactions } from "./schema";

export async function listRules(db: DbOrTx) {
  return db.select().from(rules).orderBy(asc(rules.priority), asc(rules.pattern));
}

export interface RuleInput {
  pattern: string;
  matchType: RuleMatchType;
  categoryId: string;
  priority?: number;
  enabled?: boolean;
}

export async function createRule(db: DbOrTx, input: RuleInput): Promise<string> {
  const id = newId();
  await db.insert(rules).values({ id, ...input, pattern: input.pattern.trim() });
  return id;
}

export async function updateRule(db: DbOrTx, id: string, patch: Partial<RuleInput>) {
  await db.update(rules).set(patch).where(eq(rules.id, id));
}

export async function deleteRule(db: DbOrTx, id: string) {
  await db.delete(rules).where(eq(rules.id, id));
}

/**
 * Runs the rules over transactions that are uncategorised or flagged for review and moves their
 * category line to the matching category. Returns how many transactions changed.
 */
export async function applyRules(db: Db): Promise<number> {
  const allRules = await listRules(db);
  const candidates = await db
    .select({
      id: transactions.id,
      description: transactions.description,
      postingId: postings.id,
      categoryId: postings.categoryId,
    })
    .from(transactions)
    .innerJoin(postings, eq(postings.transactionId, transactions.id))
    .where(
      and(
        eq(transactions.needsReview, true),
        inArray(transactions.kind, ["expense", "income", "refund"]),
      ),
    );

  // Only touch transactions with exactly one category line; splits stay manual.
  const lines = new Map<string, { description: string; postingId: string; categoryId: string }[]>();
  for (const c of candidates) {
    if (!c.categoryId) continue;
    const list = lines.get(c.id) ?? [];
    list.push({ description: c.description, postingId: c.postingId, categoryId: c.categoryId });
    lines.set(c.id, list);
  }

  let changed = 0;
  await db.transaction(async (tx) => {
    for (const [, list] of lines) {
      const [line] = list;
      if (list.length !== 1 || !line) continue;
      const rule = matchRule(line.description, allRules);
      if (!rule || rule.categoryId === line.categoryId) continue;
      await tx
        .update(postings)
        .set({ categoryId: rule.categoryId })
        .where(eq(postings.id, line.postingId));
      changed++;
    }
  });
  return changed;
}

export { UNCATEGORIZED_ID };
