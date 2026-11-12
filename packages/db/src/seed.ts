import { DEFAULT_CATEGORIES, DEFAULT_RULES, OPENING_BALANCE_ACCOUNT_ID } from "@even/domain";

import type { DbOrTx } from "./client";
import { accounts, categories, rules, settings } from "./schema";

export const DEFAULT_SETTINGS = {
  "fx.USD": 26_300,
} as const;

/** Inserts default categories, rules, the equity account and settings. Idempotent. */
export async function ensureSeed(db: DbOrTx): Promise<void> {
  await db
    .insert(categories)
    .values([...DEFAULT_CATEGORIES])
    .onConflictDoNothing();
  await db
    .insert(rules)
    .values(DEFAULT_RULES.map((r) => ({ ...r })))
    .onConflictDoNothing();
  await db
    .insert(accounts)
    .values({ id: OPENING_BALANCE_ACCOUNT_ID, name: "Số dư đầu kỳ", type: "equity", sort: 999 })
    .onConflictDoNothing();
  await db
    .insert(settings)
    .values(Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value })))
    .onConflictDoNothing();
}
