CREATE TYPE "public"."account_type" AS ENUM('bank', 'credit_card', 'ewallet', 'cash', 'foreign', 'brokerage', 'crypto', 'savings', 'person', 'equity');--> statement-breakpoint
CREATE TYPE "public"."category_bucket" AS ENUM('need', 'want', 'save');--> statement-breakpoint
CREATE TYPE "public"."category_kind" AS ENUM('expense', 'income');--> statement-breakpoint
CREATE TYPE "public"."category_nature" AS ENUM('fixed', 'variable');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('VND', 'USD');--> statement-breakpoint
CREATE TYPE "public"."rule_match_type" AS ENUM('contains', 'regex');--> statement-breakpoint
CREATE TYPE "public"."transaction_kind" AS ENUM('expense', 'income', 'transfer', 'refund', 'opening', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'cleared', 'reconciled');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "account_type" NOT NULL,
	"currency" "currency" DEFAULT 'VND' NOT NULL,
	"institution" text,
	"last4" text,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"color" text,
	"note" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"name" text NOT NULL,
	"kind" "category_kind" NOT NULL,
	"nature" "category_nature",
	"bucket" "category_bucket",
	"icon" text,
	"plaid" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"system" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"filename" text,
	"row_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "postings" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"account_id" text,
	"category_id" text,
	"amount" bigint NOT NULL,
	"currency" "currency" NOT NULL,
	"base_amount" bigint NOT NULL,
	"memo" text,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "postings_one_target" CHECK (("postings"."account_id" is null) <> ("postings"."category_id" is null))
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" text PRIMARY KEY NOT NULL,
	"pattern" text NOT NULL,
	"match_type" "rule_match_type" DEFAULT 'contains' NOT NULL,
	"category_id" text NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"description" text NOT NULL,
	"note" text,
	"kind" "transaction_kind" NOT NULL,
	"status" "transaction_status" DEFAULT 'cleared' NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"import_batch_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "postings" ADD CONSTRAINT "postings_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "postings_transaction_idx" ON "postings" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "postings_account_idx" ON "postings" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "postings_category_idx" ON "postings" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "transactions_date_idx" ON "transactions" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_external_id_idx" ON "transactions" USING btree ("external_id");