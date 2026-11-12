import { PGlite } from "@electric-sql/pglite";
import { worker } from "@electric-sql/pglite/worker";

// One PGlite instance per origin: PGliteWorker elects a leader tab that owns the database,
// other tabs proxy their queries to it. Data persists in IndexedDB.
await worker({
  init: (options) => PGlite.create({ dataDir: options.dataDir ?? "idb://even" }),
});
