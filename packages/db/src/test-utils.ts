import { PGlite } from "@electric-sql/pglite";

import { openDb } from "./client";

/** A fresh in-memory database with migrations and seed data applied. */
export async function memoryDb() {
  const client = new PGlite();
  const db = await openDb(client);
  return { client, db };
}
