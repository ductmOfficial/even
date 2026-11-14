CREATE TYPE "public"."statement_kind" AS ENUM('tcb-account', 'tcb-credit-card');--> statement-breakpoint
CREATE TYPE "public"."statement_line_status" AS ENUM('new', 'matched', 'created', 'ignored');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "periods" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"from" date NOT NULL,
	"to" date NOT NULL,
	"statement_id" text,
	"statement_balance" bigint NOT NULL,
	"ledger_balance" bigint NOT NULL,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statement_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"statement_id" text NOT NULL,
	"account_id" text NOT NULL,
	"key" text NOT NULL,
	"sort" integer NOT NULL,
	"date" date NOT NULL,
	"post_date" date,
	"amount" bigint NOT NULL,
	"balance" bigint,
	"description" text NOT NULL,
	"counterparty" text,
	"counterparty_bank" text,
	"reference" text,
	"card_last4" text,
	"original_amount" text,
	"original_currency" text,
	"status" "statement_line_status" DEFAULT 'new' NOT NULL,
	"transaction_id" text
);
--> statement-breakpoint
CREATE TABLE "statements" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"kind" "statement_kind" NOT NULL,
	"bank" text NOT NULL,
	"account_number" text NOT NULL,
	"holder" text,
	"period_from" date NOT NULL,
	"period_to" date NOT NULL,
	"opening_balance" bigint NOT NULL,
	"reported_opening_balance" bigint,
	"closing_balance" bigint NOT NULL,
	"filename" text,
	"statement_date" date,
	"due_date" date,
	"minimum_payment" bigint,
	"credit_limit" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "number" text;--> statement-breakpoint
ALTER TABLE "periods" ADD CONSTRAINT "periods_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "periods" ADD CONSTRAINT "periods_statement_id_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."statements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_statement_id_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."statements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "periods_account_to_idx" ON "periods" USING btree ("account_id","to");--> statement-breakpoint
CREATE UNIQUE INDEX "statement_lines_key_idx" ON "statement_lines" USING btree ("account_id","key");--> statement-breakpoint
CREATE INDEX "statement_lines_statement_idx" ON "statement_lines" USING btree ("statement_id");--> statement-breakpoint
CREATE INDEX "statement_lines_transaction_idx" ON "statement_lines" USING btree ("transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "statements_period_idx" ON "statements" USING btree ("account_id","period_from","period_to");