import { PGliteWorker } from "@electric-sql/pglite/worker";
import { openDb, type Db } from "@even/db";

let dbPromise: Promise<Db> | undefined;

/** Opens (once) the PGlite database in a Web Worker, migrates and seeds it. */
export function getDb(): Promise<Db> {
  dbPromise ??= (async () => {
    const client = new PGliteWorker(
      new Worker(new URL("./pglite.worker.ts", import.meta.url), { type: "module" }),
      { dataDir: "idb://even" },
    );
    await client.waitReady;
    return openDb(client);
  })();
  return dbPromise;
}
