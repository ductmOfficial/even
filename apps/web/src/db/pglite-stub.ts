/**
 * drizzle-orm/pglite imports the full PGlite class only to build an instance when given a
 * connection string. We always pass a ready PGliteWorker client, so on the main thread that
 * import is replaced by this stub (see vite.config.ts) and the ~1 MB PGlite runtime stays in
 * the worker bundle.
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- stands in for the real class.
export class PGlite {
  constructor() {
    throw new Error("PGlite must run in the worker; pass a PGliteWorker client to drizzle().");
  }
}

/** Postgres type OIDs drizzle's session needs (same values as PGlite's `types`). */
export const types = {
  DATE: 1082,
  TIMESTAMP: 1114,
  TIMESTAMPTZ: 1184,
  INTERVAL: 1186,
} as const;
