import type { PGliteInterface } from "@electric-sql/pglite";

export interface Migration {
  tag: string;
  sql: string;
}

// drizzle-kit writes plain SQL files; Vite (app) and Vitest (tests) bundle them as strings,
// so the same migrations run in the browser worker and in Node without a filesystem.
const files = import.meta.glob<string>("../drizzle/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});

export const MIGRATIONS: readonly Migration[] = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, sql]) => ({ tag: path.slice(path.lastIndexOf("/") + 1, -".sql".length), sql }));

/**
 * Applies pending migrations in order, each in its own transaction.
 * Safe to call on every start-up and from several tabs: the worker serialises access and
 * applied tags are recorded in `__even_migrations`.
 */
export async function migrate(
  client: PGliteInterface,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<string[]> {
  await client.exec(`
    create table if not exists __even_migrations (
      tag text primary key,
      applied_at timestamptz not null default now()
    );
  `);
  const { rows } = await client.query<{ tag: string }>("select tag from __even_migrations");
  const applied = new Set(rows.map((r) => r.tag));
  const done: string[] = [];
  for (const m of migrations) {
    if (applied.has(m.tag)) continue;
    await client.transaction(async (tx) => {
      // `--> statement-breakpoint` markers are SQL comments, so the file runs as one script.
      await tx.exec(m.sql);
      await tx.query("insert into __even_migrations (tag) values ($1)", [m.tag]);
    });
    done.push(m.tag);
  }
  return done;
}
