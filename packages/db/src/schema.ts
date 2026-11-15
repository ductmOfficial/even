import {
  ACCOUNT_TYPES,
  CURRENCIES,
  RECURRING_KINDS,
  TRANSACTION_KINDS,
  type Share,
} from "@even/domain";
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
export const recurringKind = pgEnum("recurring_kind", RECURRING_KINDS);
export const statementKind = pgEnum("statement_kind", ["tcb-account", "tcb-credit-card"]);
/**
 * new: not in the ledger yet · matched: an existing transaction covers it · created: imported as
 * a new transaction · ignored: deliberately left out.
 */
export const statementLineStatus = pgEnum("statement_line_status", [
  "new",
  "matched",
  "created",
  "ignored",
]);

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
  /** Full account or card account number as printed on statements; links statements to it. */
  number: text("number"),
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

/** One imported bank statement for one account and period. */
export const statements = pgTable(
  "statements",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    kind: statementKind("kind").notNull(),
    bank: text("bank").notNull(),
    accountNumber: text("account_number").notNull(),
    /** Account holder as printed; transfers to this name are transfers between own accounts. */
    holder: text("holder"),
    periodFrom: date("period_from", { mode: "string" }).notNull(),
    periodTo: date("period_to", { mode: "string" }).notNull(),
    openingBalance: bigint("opening_balance", { mode: "number" }).notNull(),
    reportedOpeningBalance: bigint("reported_opening_balance", { mode: "number" }),
    closingBalance: bigint("closing_balance", { mode: "number" }).notNull(),
    filename: text("filename"),
    /** Credit card statements only. */
    statementDate: date("statement_date", { mode: "string" }),
    dueDate: date("due_date", { mode: "string" }),
    minimumPayment: bigint("minimum_payment", { mode: "number" }),
    creditLimit: bigint("credit_limit", { mode: "number" }),
    createdAt: timestamps.createdAt,
  },
  (t) => [uniqueIndex("statements_period_idx").on(t.accountId, t.periodFrom, t.periodTo)],
);

/** A line of a statement, and what became of it in the ledger. */
export const statementLines = pgTable(
  "statement_lines",
  {
    id: text("id").primaryKey(),
    statementId: text("statement_id")
      .notNull()
      .references(() => statements.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    /** Stable per account, so a line printed on two overlapping statements is stored once. */
    key: text("key").notNull(),
    sort: integer("sort").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    postDate: date("post_date", { mode: "string" }),
    amount: bigint("amount", { mode: "number" }).notNull(),
    balance: bigint("balance", { mode: "number" }),
    description: text("description").notNull(),
    counterparty: text("counterparty"),
    counterpartyBank: text("counterparty_bank"),
    reference: text("reference"),
    cardLast4: text("card_last4"),
    originalAmount: text("original_amount"),
    originalCurrency: text("original_currency"),
    status: statementLineStatus("status").notNull().default("new"),
    transactionId: text("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    uniqueIndex("statement_lines_key_idx").on(t.accountId, t.key),
    index("statement_lines_statement_idx").on(t.statementId),
    index("statement_lines_transaction_idx").on(t.transactionId),
  ],
);

/**
 * A reconciled period of one account. Once locked, transactions touching the account on or
 * before `to` cannot be added, changed or deleted until the period is unlocked.
 */
export const periods = pgTable(
  "periods",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    from: date("from", { mode: "string" }).notNull(),
    to: date("to", { mode: "string" }).notNull(),
    statementId: text("statement_id").references(() => statements.id, { onDelete: "set null" }),
    /** Balance on the statement and in the ledger at `to`, when the period was locked. */
    statementBalance: bigint("statement_balance", { mode: "number" }).notNull(),
    ledgerBalance: bigint("ledger_balance", { mode: "number" }).notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamps.createdAt,
  },
  (t) => [uniqueIndex("periods_account_to_idx").on(t.accountId, t.to)],
);

/** What changed and when: imports, period locks and unlocks, adjustments. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    at: timestamp("at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    detail: jsonb("detail"),
  },
  (t) => [index("audit_log_at_idx").on(t.at)],
);

/** Payments that come back every month (rent, salary, subscriptions). */
export const recurringTemplates = pgTable("recurring_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: recurringKind("kind").notNull(),
  dayOfMonth: integer("day_of_month").notNull(),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id),
  toAccountId: text("to_account_id").references(() => accounts.id),
  categoryId: text("category_id").references(() => categories.id),
  amount: bigint("amount", { mode: "number" }).notNull(),
  shares: jsonb("shares")
    .$type<Share[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  startMonth: text("start_month").notNull(),
  endMonth: text("end_month"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
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
export type Statement = typeof statements.$inferSelect;
export type StatementLineRow = typeof statementLines.$inferSelect;
export type Period = typeof periods.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
export type RecurringTemplate = typeof recurringTemplates.$inferSelect;
export type NewRecurringTemplate = typeof recurringTemplates.$inferInsert;
