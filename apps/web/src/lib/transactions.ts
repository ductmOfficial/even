import type { TransactionWithPostings } from "@even/db";
import { summarize, type Currency } from "@even/domain";

import type { Lookups } from "../data/queries";

export interface TransactionRow {
  id: string;
  date: string;
  description: string;
  note: string | null;
  kind: TransactionWithPostings["kind"];
  needsReview: boolean;
  /** Signed VND effect: < 0 spending, > 0 income, 0 for transfers. */
  net: number;
  /** Amount shown in the list (minor units of `currency`). */
  amount: number;
  currency: Currency;
  categoryIds: string[];
  categoryLabel: string;
  accountLabel: string;
  people: string[];
  searchText: string;
}

/**
 * Turns a transaction into a list row. With `forAccountId`, the amount is that account's own
 * movement (in its currency), as on a bank statement.
 */
export function toRow(
  tx: TransactionWithPostings,
  lookups: Lookups,
  forAccountId?: string,
): TransactionRow {
  const s = summarize(tx.postings, lookups.isPerson);
  const name = (id: string) => lookups.accountById.get(id)?.name ?? "?";
  let amount = s.net;
  let currency: Currency = "VND";

  if (forAccountId) {
    const own = tx.postings.filter((p) => p.accountId === forAccountId);
    amount = own.reduce((sum, p) => sum + p.amount, 0);
    currency = own[0]?.currency ?? "VND";
  } else if (tx.kind === "transfer" || tx.kind === "opening") {
    const incoming = tx.postings.find((p) => p.accountId && p.amount > 0);
    amount = incoming ? incoming.amount : 0;
    currency = incoming?.currency ?? "VND";
  }

  let accountLabel: string;
  if (tx.kind === "transfer") {
    const from = tx.postings.find((p) => p.accountId && p.amount < 0)?.accountId;
    const to = tx.postings.find((p) => p.accountId && p.amount > 0)?.accountId;
    accountLabel = `${from ? name(from) : "?"} → ${to ? name(to) : "?"}`;
  } else {
    accountLabel = s.accountIds.map(name).join(", ");
  }

  const categoryLabel =
    tx.kind === "transfer"
      ? "Chuyển tiền"
      : tx.kind === "opening"
        ? "Số dư đầu kỳ"
        : [...new Set(s.categoryIds)]
            .map((id) => lookups.categoryById.get(id)?.name ?? id)
            .join(", ");
  const people = s.personIds.map(name);

  return {
    id: tx.id,
    date: tx.date,
    description: tx.description,
    note: tx.note,
    kind: tx.kind,
    needsReview: tx.needsReview,
    net: s.net,
    amount,
    currency,
    categoryIds: s.categoryIds,
    categoryLabel,
    accountLabel,
    people,
    searchText: `${tx.description} ${tx.note ?? ""} ${categoryLabel} ${accountLabel}`,
  };
}
