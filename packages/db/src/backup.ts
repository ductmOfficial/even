import { sql } from "drizzle-orm";

import type { Db } from "./client";
import {
  accounts,
  auditLog,
  categories,
  importBatches,
  periods,
  postings,
  rules,
  settings,
  statementLines,
  statements,
  transactions,
} from "./schema";
import { ensureSeed } from "./seed";

/** 2 adds statements, statement lines, periods and the audit log. */
export const BACKUP_VERSION = 2;

/** Backups written before the app was named Even carry `app: "ledgr"`. */
const BACKUP_APPS: readonly unknown[] = ["even", "ledgr"];

export interface Backup {
  app: "even" | "ledgr";
  version: number;
  exportedAt: string;
  data: {
    accounts: (typeof accounts.$inferSelect)[];
    categories: (typeof categories.$inferSelect)[];
    transactions: (typeof transactions.$inferSelect)[];
    postings: (typeof postings.$inferSelect)[];
    rules: (typeof rules.$inferSelect)[];
    importBatches: (typeof importBatches.$inferSelect)[];
    statements?: (typeof statements.$inferSelect)[];
    statementLines?: (typeof statementLines.$inferSelect)[];
    periods?: (typeof periods.$inferSelect)[];
    auditLog?: (typeof auditLog.$inferSelect)[];
    settings: (typeof settings.$inferSelect)[];
  };
}

export async function exportBackup(db: Db): Promise<Backup> {
  const [a, c, t, p, r, b, s, st, sl, pe, au] = await Promise.all([
    db.select().from(accounts),
    db.select().from(categories),
    db.select().from(transactions),
    db.select().from(postings),
    db.select().from(rules),
    db.select().from(importBatches),
    db.select().from(settings),
    db.select().from(statements),
    db.select().from(statementLines),
    db.select().from(periods),
    db.select().from(auditLog),
  ]);
  return {
    app: "even",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      accounts: a,
      categories: c,
      transactions: t,
      postings: p,
      rules: r,
      importBatches: b,
      statements: st,
      statementLines: sl,
      periods: pe,
      auditLog: au,
      settings: s,
    },
  };
}

export function isBackup(value: unknown): value is Backup {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<Backup>;
  return BACKUP_APPS.includes(v.app) && typeof v.version === "number" && typeof v.data === "object";
}

async function wipe(db: Pick<Db, "execute">) {
  await db.execute(
    sql`truncate table statement_lines, statements, periods, audit_log, postings, transactions, rules, import_batches, settings, accounts, categories cascade`,
  );
}

async function insertChunked<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += 500) await insert(rows.slice(i, i + 500));
}

/** Replaces every table with the backup's content. */
export async function restoreBackup(db: Db, backup: Backup): Promise<void> {
  if (backup.version > BACKUP_VERSION) {
    throw new Error(`Backup version ${String(backup.version)} is newer than this app`);
  }
  const d = backup.data;
  await db.transaction(async (tx) => {
    await wipe(tx);
    await insertChunked(d.categories, (rows) => tx.insert(categories).values(rows));
    await insertChunked(d.accounts, (rows) => tx.insert(accounts).values(rows));
    await insertChunked(d.rules, (rows) => tx.insert(rules).values(rows));
    await insertChunked(d.settings, (rows) => tx.insert(settings).values(rows));
    await insertChunked(d.importBatches, (rows) => tx.insert(importBatches).values(rows));
    await insertChunked(d.transactions, (rows) => tx.insert(transactions).values(rows));
    await insertChunked(d.postings, (rows) => tx.insert(postings).values(rows));
    // Version 1 backups have no statements, periods or audit log.
    await insertChunked(d.statements ?? [], (rows) => tx.insert(statements).values(rows));
    await insertChunked(d.statementLines ?? [], (rows) => tx.insert(statementLines).values(rows));
    await insertChunked(d.periods ?? [], (rows) => tx.insert(periods).values(rows));
    await insertChunked(d.auditLog ?? [], (rows) => tx.insert(auditLog).values(rows));
    await ensureSeed(tx);
  });
}

/** Deletes everything and re-seeds defaults. */
export async function resetAll(db: Db): Promise<void> {
  await db.transaction(async (tx) => {
    await wipe(tx);
    await ensureSeed(tx);
  });
}
