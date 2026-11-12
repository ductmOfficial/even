import type { Account, Category, TransactionWithPostings } from "@even/db";
import {
  buildExpense,
  buildTransfer,
  DEFAULT_CATEGORIES,
  type TransactionDraft,
} from "@even/domain";
import { describe, expect, it } from "vitest";

import type { Lookups } from "../data/queries";
import { toRow } from "../lib/transactions";
import { toDraft, toFormValues } from "./transaction-form";

const now = "2026-11-08T00:00:00Z";
const account = (
  id: string,
  type: Account["type"],
  currency: Account["currency"] = "VND",
): Account => ({
  id,
  name: id,
  type,
  currency,
  institution: null,
  last4: null,
  aliases: [],
  color: null,
  note: null,
  sort: 0,
  archived: false,
  createdAt: now,
  updatedAt: now,
});
const accounts = [
  account("tcb", "bank"),
  account("paypal", "foreign", "USD"),
  account("an", "person"),
];
const categories = DEFAULT_CATEGORIES.map((c) => ({
  ...c,
  archived: false,
  createdAt: now,
  updatedAt: now,
})) as Category[];
const accountById = new Map(accounts.map((a) => [a.id, a]));
const categoryById = new Map(categories.map((c) => [c.id, c]));
const lookups: Lookups = {
  accounts,
  accountById,
  categories,
  categoryById,
  isPerson: (id) => accountById.get(id)?.type === "person",
  categoryLabel: (id) => id,
  descendants: (id) => [id],
};

function stored(draft: TransactionDraft): TransactionWithPostings {
  return {
    id: "t1",
    date: draft.date,
    description: draft.description,
    note: draft.note ?? null,
    kind: draft.kind,
    status: "cleared",
    needsReview: false,
    source: "manual",
    externalId: null,
    importBatchId: null,
    createdAt: now,
    updatedAt: now,
    postings: draft.postings.map((p, i) => ({
      id: `p${String(i)}`,
      transactionId: "t1",
      accountId: p.accountId ?? null,
      categoryId: p.categoryId ?? null,
      amount: p.amount,
      currency: p.currency,
      baseAmount: p.baseAmount,
      memo: null,
      sort: i,
    })),
  };
}

describe("transaction form mapping", () => {
  it("round-trips a split expense through the form", () => {
    const draft = buildExpense({
      date: "2026-11-01",
      description: "Tiền nhà",
      accountId: "tcb",
      currency: "VND",
      amount: 7_500_000,
      categoryId: "housing.rent",
      shares: [{ personAccountId: "an", amount: 3_750_000 }],
    });
    const values = toFormValues(stored(draft), lookups);
    expect(values).toMatchObject({
      mode: "expense",
      amount: 7_500_000,
      shares: [{ personId: "an", amount: 3_750_000 }],
    });
    if (!values) throw new Error("not editable");
    expect(toDraft(values, lookups, 26_000).postings).toEqual(draft.postings);
  });

  it("round-trips a cross-currency transfer", () => {
    const draft = buildTransfer({
      date: "2026-11-01",
      description: "Rút PayPal",
      from: { accountId: "paypal", currency: "USD", rate: 26_000 },
      to: { accountId: "tcb", currency: "VND" },
      amount: 10_000,
      toAmount: 2_590_000,
    });
    const values = toFormValues(stored(draft), lookups);
    expect(values).toMatchObject({ mode: "transfer", amount: 10_000, toAmount: 2_590_000 });
    if (!values) throw new Error("not editable");
    expect(toDraft(values, lookups, 26_000).postings).toEqual(draft.postings);
  });

  it("shows your share as the row amount and lists people", () => {
    const draft = buildExpense({
      date: "2026-11-01",
      description: "Chợ",
      accountId: "tcb",
      currency: "VND",
      amount: 1_000_000,
      categoryId: "food.groceries",
      shares: [{ personAccountId: "an", amount: 400_000 }],
    });
    const row = toRow(stored(draft), lookups);
    expect(row).toMatchObject({ amount: -600_000, people: ["an"], accountLabel: "tcb" });
    expect(toRow(stored(draft), lookups, "tcb").amount).toBe(-1_000_000);
  });
});
