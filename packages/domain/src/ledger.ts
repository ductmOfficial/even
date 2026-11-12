import { assertMinor, BASE_CURRENCY, toBase, type Currency } from "./money";

/**
 * Double-entry model (ADR 0002).
 *
 * Every transaction is a set of postings whose `baseAmount` (VND) sums to exactly 0.
 * A posting targets either an account (money moves in/out) or a category (it is income/expense).
 *
 * Sign convention:
 *  - account posting  > 0: money comes into the account; < 0: money leaves it.
 *    For a person account, > 0 means they owe you; < 0 means you owe them.
 *  - category posting > 0: expense (or reversal of income); < 0: income (or refund of expense).
 */
export const TRANSACTION_KINDS = [
  "expense",
  "income",
  "transfer",
  "refund",
  "opening",
  "adjustment",
] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export interface Posting {
  accountId?: string | null;
  categoryId?: string | null;
  /** Amount in the posting's own currency, minor units. */
  amount: number;
  currency: Currency;
  /** Amount converted to VND. This is what must balance. */
  baseAmount: number;
  memo?: string | null;
}

export interface TransactionDraft {
  date: string;
  description: string;
  note?: string | null;
  kind: TransactionKind;
  needsReview?: boolean;
  postings: Posting[];
}

export class LedgerError extends Error {
  override name = "LedgerError";
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateTransaction(draft: TransactionDraft): void {
  if (!ISO_DATE.test(draft.date)) throw new LedgerError(`Invalid date "${draft.date}"`);
  if (draft.postings.length < 2) throw new LedgerError("A transaction needs at least 2 postings");
  let sum = 0;
  for (const p of draft.postings) {
    const targets = Number(Boolean(p.accountId)) + Number(Boolean(p.categoryId));
    if (targets !== 1) throw new LedgerError("A posting targets exactly one account or category");
    assertMinor(p.amount, "posting.amount");
    assertMinor(p.baseAmount, "posting.baseAmount");
    if (p.currency === BASE_CURRENCY && p.amount !== p.baseAmount) {
      throw new LedgerError("VND postings must have amount === baseAmount");
    }
    if (Math.sign(p.amount) !== Math.sign(p.baseAmount)) {
      throw new LedgerError("amount and baseAmount must have the same sign");
    }
    sum += p.baseAmount;
  }
  if (sum !== 0) throw new LedgerError(`Postings are unbalanced by ${String(sum)} VND`);
}

export interface Share {
  /** Person account that owes (positive) part of the expense. */
  personAccountId: string;
  /** Share in the source account currency, minor units, positive. */
  amount: number;
}

interface MoneySide {
  accountId: string;
  currency: Currency;
  /** VND per unit of `currency`; ignored for VND. */
  rate?: number;
}

function accountPosting(side: MoneySide, amount: number): Posting {
  return {
    accountId: side.accountId,
    amount,
    currency: side.currency,
    baseAmount: toBase(amount, side.currency, side.rate ?? 1),
  };
}

/** Balances rounding drift from FX conversion onto the last posting. */
function balance(postings: Posting[]): Posting[] {
  const drift = postings.reduce((s, p) => s + p.baseAmount, 0);
  if (drift !== 0) {
    const last = postings.at(-1);
    if (last) last.baseAmount -= drift;
  }
  return postings;
}

export interface ExpenseInput extends MoneySide {
  date: string;
  description: string;
  note?: string | null;
  /** Total paid from the account, minor units, positive. */
  amount: number;
  categoryId: string;
  /** Parts of the payment other people owe you back. */
  shares?: Share[];
  needsReview?: boolean;
}

/** Paid `amount` from an account; your part is an expense, other people's parts become receivables. */
export function buildExpense(input: ExpenseInput): TransactionDraft {
  if (input.amount <= 0) throw new LedgerError("Expense amount must be positive");
  const shares = input.shares ?? [];
  const shared = shares.reduce((s, x) => s + x.amount, 0);
  if (shares.some((s) => s.amount <= 0)) throw new LedgerError("Shares must be positive");
  if (shared > input.amount) throw new LedgerError("Shares exceed the total");

  const own = input.amount - shared;
  const rate = input.rate ?? 1;
  const postings: Posting[] = [accountPosting(input, -input.amount)];
  for (const share of shares) {
    postings.push({
      accountId: share.personAccountId,
      amount: toBase(share.amount, input.currency, rate),
      currency: BASE_CURRENCY,
      baseAmount: toBase(share.amount, input.currency, rate),
    });
  }
  if (own > 0) {
    const base = toBase(own, input.currency, rate);
    postings.push({
      categoryId: input.categoryId,
      amount: base,
      currency: BASE_CURRENCY,
      baseAmount: base,
    });
  }
  return {
    date: input.date,
    description: input.description,
    note: input.note ?? null,
    kind: "expense",
    needsReview: input.needsReview ?? false,
    postings: balance(postings),
  };
}

export interface IncomeInput extends MoneySide {
  date: string;
  description: string;
  note?: string | null;
  amount: number;
  categoryId: string;
  needsReview?: boolean;
}

export function buildIncome(input: IncomeInput): TransactionDraft {
  if (input.amount <= 0) throw new LedgerError("Income amount must be positive");
  const account = accountPosting(input, input.amount);
  return {
    date: input.date,
    description: input.description,
    note: input.note ?? null,
    kind: "income",
    needsReview: input.needsReview ?? false,
    postings: balance([
      account,
      {
        categoryId: input.categoryId,
        amount: -account.baseAmount,
        currency: BASE_CURRENCY,
        baseAmount: -account.baseAmount,
      },
    ]),
  };
}

/** Money returned to an account for an earlier expense (cashback, refund, insurance claim). */
export function buildRefund(input: IncomeInput): TransactionDraft {
  return { ...buildIncome(input), kind: "refund" };
}

export interface TransferInput {
  date: string;
  description: string;
  note?: string | null;
  from: MoneySide;
  to: MoneySide;
  /** Amount leaving `from`, minor units of from.currency, positive. */
  amount: number;
  /** Amount arriving in `to` when currencies differ. Defaults to `amount`. */
  toAmount?: number;
}

/**
 * Moves money between two of your accounts (or settles with a person).
 * Cross-currency: the VND value is the VND side's amount, so the effective rate is the one the bank applied.
 */
export function buildTransfer(input: TransferInput): TransactionDraft {
  if (input.amount <= 0) throw new LedgerError("Transfer amount must be positive");
  if (input.from.accountId === input.to.accountId) {
    throw new LedgerError("Cannot transfer to the same account");
  }
  const sameCurrency = input.from.currency === input.to.currency;
  const toAmount = input.toAmount ?? (sameCurrency ? input.amount : undefined);
  if (toAmount === undefined || toAmount <= 0) {
    throw new LedgerError("Cross-currency transfers need the received amount");
  }
  // The VND value comes from whichever side is in VND (the real conversion rate),
  // otherwise from the `from` side's rate.
  let base: number;
  if (input.to.currency === BASE_CURRENCY) base = toAmount;
  else if (input.from.currency === BASE_CURRENCY) base = input.amount;
  else base = toBase(input.amount, input.from.currency, input.from.rate ?? 1);
  if (base <= 0) throw new LedgerError("Transfer value rounds to 0 VND");
  const out: Posting = {
    accountId: input.from.accountId,
    amount: -input.amount,
    currency: input.from.currency,
    baseAmount: -base,
  };
  const incoming: Posting = {
    accountId: input.to.accountId,
    amount: toAmount,
    currency: input.to.currency,
    baseAmount: base,
  };
  return {
    date: input.date,
    description: input.description,
    note: input.note ?? null,
    kind: "transfer",
    postings: [out, incoming],
  };
}

export interface OpeningInput extends MoneySide {
  date: string;
  amount: number;
  equityAccountId: string;
}

/** Sets an account's starting balance against the equity account. */
export function buildOpening(input: OpeningInput): TransactionDraft {
  const account = accountPosting(input, input.amount);
  return {
    date: input.date,
    description: "Số dư đầu kỳ",
    kind: "opening",
    postings: [
      account,
      {
        accountId: input.equityAccountId,
        amount: -account.baseAmount,
        currency: BASE_CURRENCY,
        baseAmount: -account.baseAmount,
      },
    ],
  };
}

export interface PostingLike {
  accountId?: string | null;
  categoryId?: string | null;
  amount: number;
  currency: Currency;
  baseAmount: number;
}

export interface TransactionSummary {
  /** Signed VND effect on your income statement: > 0 money in (income), < 0 money out (expense). */
  net: number;
  /** Category postings (expense/income lines). */
  categoryIds: string[];
  /** Accounts money moved from/to (excluding people). */
  accountIds: string[];
  /** People involved in a split or settlement. */
  personIds: string[];
}

/**
 * Summarises a transaction for list views.
 * `isPerson` tells which account ids are person accounts.
 */
export function summarize(
  postings: readonly PostingLike[],
  isPerson: (accountId: string) => boolean,
): TransactionSummary {
  const categoryIds: string[] = [];
  const accountIds: string[] = [];
  const personIds: string[] = [];
  let net = 0;
  for (const p of postings) {
    if (p.categoryId) {
      categoryIds.push(p.categoryId);
      net -= p.baseAmount;
    } else if (p.accountId) {
      (isPerson(p.accountId) ? personIds : accountIds).push(p.accountId);
    }
  }
  return { net, categoryIds, accountIds, personIds };
}
