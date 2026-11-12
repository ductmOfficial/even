import { eq } from "drizzle-orm";

import type { DbOrTx } from "./client";
import { settings } from "./schema";

export async function getSetting<T>(db: DbOrTx, key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return row ? (row.value as T) : fallback;
}

export async function setSetting(db: DbOrTx, key: string, value: unknown): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function getFxRates(db: DbOrTx): Promise<{ USD: number; VND: 1 }> {
  return { USD: await getSetting(db, "fx.USD", 26_300), VND: 1 };
}
