# ADR 0001 — Local-first storage with PGlite in a Web Worker

- Status: accepted
- Date: 2026-11-12

## Context

The app replaces a personal spreadsheet. It must be fast for daily entry, work offline, keep financial data on the device by default, and later sync between a laptop and a phone. Reports need real SQL: balances as of any date, grouped totals, joins with FX rates.

## Decision

- Run **PGlite** (Postgres compiled to WASM) in a **dedicated Web Worker** through `PGliteWorker`. PGlite elects one leader tab that owns the database; other tabs proxy queries to it.
- Persist to **IndexedDB** (`idb://even`). `relaxedDurability` stays **off**: with it on, reloading the page right after a write produced an `ErrnoError` when reopening the database.
- Use **Drizzle** for the schema and queries. drizzle-kit generates SQL files; our own migrator (`packages/db/src/migrate.ts`) applies them. Vite and Vitest bundle the SQL as strings via `import.meta.glob`, so the same migrations run in the browser and in Node tests with no filesystem.
- Query reactivity uses **TanStack Query** with explicit invalidation after each write, broadcast to other tabs over a `BroadcastChannel`.

## Consequences

- Every statement is flushed to IndexedDB. Bulk writes must be batched (`insertTransactionsBatch`): importing the demo data went from 39 s to about 6 s.
- `drizzle-orm/pglite` imports the full PGlite runtime. A small Vite plugin replaces that import with a stub on the main thread (`apps/web/src/db/pglite-stub.ts`), which cut the main bundle from 1.6 MB to about 0.5 MB.
- The first load downloads about 15 MB of WASM and data, cached by the browser afterwards (a service worker can cache it later).
- Sync, when it comes, will add ElectricSQL for reads and an outbox to an API for writes. Postgres on both sides keeps one schema.

## Alternatives

- Server-only (Supabase + TanStack Query): simpler, but no offline use and data leaves the device.
- Dexie/IndexedDB: no SQL, so as-of balances and reports would be hand-written.
- SQLite WASM + PowerSync: mature sync, but a different SQL dialect from the Postgres server.
