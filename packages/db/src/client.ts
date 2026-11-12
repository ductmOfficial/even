import type { PGlite, PGliteInterface } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import { migrate } from "./migrate";
import * as schema from "./schema";
import { ensureSeed } from "./seed";

export type Db = PgliteDatabase<typeof schema>;
/** A Db or a transaction on it; repository functions accept both. */
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export function createDb(client: PGliteInterface): Db {
  // PGliteWorker implements the same query/transaction interface drizzle uses.
  return drizzle({ client: client as PGlite, schema });
}

/** Migrates, seeds default data and returns a ready Db. */
export async function openDb(client: PGliteInterface): Promise<Db> {
  await migrate(client);
  const db = createDb(client);
  await ensureSeed(db);
  return db;
}

export function newId(): string {
  return crypto.randomUUID();
}
