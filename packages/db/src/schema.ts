import { ACCOUNT_TYPES, CURRENCIES, TRANSACTION_KINDS } from "@even/domain";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const accountType = pgEnum("account_type", ACCOUNT_TYPES);
export const currency = pgEnum("currency", CURRENCIES);
export const transactionKind = pgEnum("transaction_kind", TRANSACTION_KINDS);
export const transactionStatus = pgEnum("transaction_status", ["pending", "cleared", "reconciled"]);
export const categoryKind = pgEnum("category_kind", ["expense", "income"]);
export const categoryNature = pgEnum("category_nature", ["fixed", "variable"]);
export const categoryBucket = pgEnum("category_bucket", ["need", "want", "save"]);
export const ruleMatchType = pgEnum("rule_match_type", ["contains", "regex"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
};

/** Money accounts, credit cards, wallets… and people (for shared expenses / debts). */
export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: accountType("type").notNull(),
  currency: currency("currency").notNull().default("VND"),
  institution: text("institution"),
  last4: text("last4"),
  aliases: text("aliases")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  color: text("color"),
  note: text("note"),
  sort: integer("sort").notNull().default(0),
  archived: boolean("archived").notNull().default(false),
  ...timestamps,
});

export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    parentId: text("parent_id"),
    name: text("name").notNull(),
    kind: categoryKind("kind").notNull(),
    nature: categoryNature("nature"),
    bucket: categoryBucket("bucket"),
    icon: text("icon"),
    plaid: text("plaid"),
    sort: integer("sort").notNull().default(0),
    system: boolean("system").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("categories_parent_idx").on(t.parentId)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    date: date("date", { mode: "string" }).notNull(),
    description: text("description").notNull(),
    note: text("note"),
    kind: transactionKind("kind").notNull(),
    status: transactionStatus("status").notNull().default("cleared"),
    needsReview: boolean("needs_review").notNull().default(false),
    /** "manual", "legacy-excel", later "statement:tcb"… */
    source: text("source").notNull().default("manual"),
    /** Stable hash of the source row; makes imports idempotent. */
    externalId: text("external_id"),
    importBatchId: text("import_batch_id"),
    ...timestamps,
  },
  (t) => [
    index("transactions_date_idx").on(t.date),
    uniqueIndex("transactions_external_id_idx").on(t.externalId),
  ],
);

export const postings = pgTable(
  "postings",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => accounts.id),
    categoryId: text("category_id").references(() => categories.id),
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: currency("currency").notNull(),
    baseAmount: bigint("base_amount", { mode: "number" }).notNull(),
    memo: text("memo"),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [
    index("postings_transaction_idx").on(t.transactionId),
    index("postings_account_idx").on(t.accountId),
    index("postings_category_idx").on(t.categoryId),
    check("postings_one_target", sql`(${t.accountId} is null) <> (${t.categoryId} is null)`),
  ],
);

export const rules = pgTable("rules", {
  id: text("id").primaryKey(),
  pattern: text("pattern").notNull(),
  matchType: ruleMatchType("match_type").notNull().default("contains"),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id),
  priority: integer("priority").notNull().default(100),
  enabled: boolean("enabled").notNull().default(true),
  ...timestamps,
});

export const importBatches = pgTable("import_batches", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  filename: text("filename"),
  rowCount: integer("row_count").notNull().default(0),
  createdAt: timestamps.createdAt,
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type PostingRow = typeof postings.$inferSelect;
export type Rule = typeof rules.$inferSelect;
export type NewRule = typeof rules.$inferInsert;
export type ImportBatch = typeof importBatches.$inferSelect;
