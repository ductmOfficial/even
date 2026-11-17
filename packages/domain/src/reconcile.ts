import type { AccountType } from "./accounts";
import { UNCATEGORIZED_ID } from "./categories";
import {
  buildExpense,
  buildIncome,
  buildRefund,
  buildTransfer,
  type TransactionDraft,
} from "./ledger";
import { matchRule, type RuleLike } from "./rules";
import { normalizeText } from "./text";

/** A line printed on a bank statement, signed from the account's side (money in is positive). */
export interface BankLine {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  description: string;
  counterparty: string | null;
  reference: string | null;
}

/** What the ledger has for an account: one transaction's net movement on it. */
export interface LedgerMovement {
  transactionId: string;
  accountId: string;
  date: string;
  amount: number;
  description: string;
}

export interface LineMatch {
  lineId: string;
  transactionId: string;
  /** Days between the statement date and the ledger date. */
  dayDiff: number;
}

export interface MatchResult {
  matches: LineMatch[];
  /** On the statement, not in the ledger. */
  newLines: string[];
  /** In the ledger, not on the statement. */
  missing: string[];
}

const DAY = 86_400_000;
export function daysBetween(a: string, b: string): number {
  return Math.round(Math.abs(Date.parse(a) - Date.parse(b)) / DAY);
}

function words(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2),
  );
}

/** Share of words two descriptions have in common, 0 to 1. */
export function similarity(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
  if (x.size === 0 || y.size === 0) return 0;
  let common = 0;
  for (const w of x) if (y.has(w)) common++;
  return common / Math.min(x.size, y.size);
}

/**
 * Pairs statement lines with ledger movements of the same account and amount, at most
 * `maxDays` apart: closest dates first, then the most similar descriptions. Each line and each
 * movement is used once.
 */
export function matchStatementLines(
  lines: readonly BankLine[],
  movements: readonly LedgerMovement[],
  options: { maxDays?: number } = {},
): MatchResult {
  const maxDays = options.maxDays ?? 3;
  const candidates: { line: BankLine; movement: LedgerMovement; days: number; score: number }[] =
    [];
  for (const line of lines) {
    for (const movement of movements) {
      if (movement.accountId !== line.accountId || movement.amount !== line.amount) continue;
      const days = daysBetween(line.date, movement.date);
      if (days > maxDays) continue;
      const text = `${line.counterparty ?? ""} ${line.description}`;
      candidates.push({ line, movement, days, score: similarity(text, movement.description) });
    }
  }
  candidates.sort((a, b) => a.days - b.days || b.score - a.score);
  const usedLines = new Set<string>();
  const usedTx = new Set<string>();
  const matches: LineMatch[] = [];
  for (const c of candidates) {
    if (usedLines.has(c.line.id) || usedTx.has(c.movement.transactionId)) continue;
    usedLines.add(c.line.id);
    usedTx.add(c.movement.transactionId);
    matches.push({ lineId: c.line.id, transactionId: c.movement.transactionId, dayDiff: c.days });
  }
  return {
    matches,
    newLines: lines.filter((l) => !usedLines.has(l.id)).map((l) => l.id),
    missing: movements.filter((m) => !usedTx.has(m.transactionId)).map((m) => m.transactionId),
  };
}

/**
 * Finds the two sides of transfers between your own accounts among new statement lines:
 * opposite amounts on different accounts, at most `maxDays` apart, closest first.
 * Returns [outgoing line id, incoming line id] pairs.
 */
export function pairTransfers(
  lines: readonly BankLine[],
  options: { maxDays?: number } = {},
): [string, string][] {
  const maxDays = options.maxDays ?? 2;
  const outgoing = lines.filter((l) => l.amount < 0);
  const incoming = lines.filter((l) => l.amount > 0);
  const candidates: { out: BankLine; into: BankLine; days: number }[] = [];
  for (const out of outgoing) {
    for (const into of incoming) {
      if (into.accountId === out.accountId || into.amount !== -out.amount) continue;
      const days = daysBetween(out.date, into.date);
      if (days <= maxDays) candidates.push({ out, into, days });
    }
  }
  candidates.sort((a, b) => a.days - b.days);
  const used = new Set<string>();
  const pairs: [string, string][] = [];
  for (const c of candidates) {
    if (used.has(c.out.id) || used.has(c.into.id)) continue;
    used.add(c.out.id);
    used.add(c.into.id);
    pairs.push([c.out.id, c.into.id]);
  }
  return pairs;
}

export interface AccountRef {
  id: string;
  type: AccountType;
  name: string;
  aliases: readonly string[];
}

export type LineSuggestion =
  | {
      kind: "transfer";
      /** The other account, when it can be told; null leaves the line for review. */
      otherAccountId: string | null;
      reason: string;
    }
  | {
      kind: "expense" | "income" | "refund";
      categoryId: string;
      /** False when the category is a guess that needs a look. */
      confident: boolean;
      reason: string;
    };

const has = (text: string, pattern: RegExp) => pattern.test(text);

/**
 * Proposes how to record a statement line nobody entered by hand. Bank-specific wording
 * (interest from automatic savings, card payments, ATM withdrawals, e-wallet top-ups) is
 * recognised first, then the category rules.
 */
export function suggestForLine(
  line: Pick<BankLine, "amount" | "description" | "counterparty">,
  context: { rules: readonly RuleLike[]; accounts: readonly AccountRef[]; holderNames?: string[] },
): LineSuggestion {
  const text = normalizeText(`${line.counterparty ?? ""} ${line.description}`);
  const incoming = line.amount > 0;

  if (incoming && has(text, /loi nhuan sinh loi|tra lai so du|lai tien gui|interest/)) {
    return { kind: "income", categoryId: "income.interest", confident: true, reason: "Tiền lãi" };
  }
  if (incoming && has(text, /cashback|hoan tien/)) {
    return { kind: "income", categoryId: "income.cashback", confident: true, reason: "Hoàn tiền" };
  }
  if (has(text, /thanh toan no the tin dung|tt the tin dung|thanh toan the tin dung/)) {
    return { kind: "transfer", otherAccountId: null, reason: "Trả nợ thẻ tín dụng" };
  }
  if (!incoming && has(text, /rut tien/)) {
    const cash = context.accounts.find((a) => a.type === "cash");
    return { kind: "transfer", otherAccountId: cash?.id ?? null, reason: "Rút tiền mặt" };
  }
  const wallet = /nap vi (\w+)/.exec(text)?.[1];
  if (wallet) {
    const target = context.accounts.find(
      (a) =>
        a.type === "ewallet" &&
        [a.name, ...a.aliases].some((n) => normalizeText(n).includes(wallet)),
    );
    return { kind: "transfer", otherAccountId: target?.id ?? null, reason: `Nạp ví ${wallet}` };
  }
  // Money back from an e-wallet you track (a Momo withdrawal) is a transfer from that wallet.
  if (incoming) {
    const from = context.accounts.find(
      (a) =>
        a.type === "ewallet" &&
        [a.name, ...a.aliases].some((n) => {
          const name = normalizeText(n);
          return name.length >= 3 && text.includes(name);
        }),
    );
    if (from)
      return { kind: "transfer", otherAccountId: from.id, reason: `Rút từ ví ${from.name}` };
  }
  const holders = (context.holderNames ?? []).map(normalizeText).filter(Boolean);
  if (holders.some((h) => normalizeText(line.counterparty ?? "") === h)) {
    return { kind: "transfer", otherAccountId: null, reason: "Chuyển giữa tài khoản của bạn" };
  }

  const rule = matchRule(text, context.rules);
  if (incoming) {
    if (has(text, /merchandize return|tra lai hang|refund|hoan tra/)) {
      return {
        kind: "refund",
        categoryId: rule?.categoryId ?? UNCATEGORIZED_ID,
        confident: Boolean(rule),
        reason: "Trả hàng / hoàn tiền",
      };
    }
    return {
      kind: "income",
      categoryId: "income.other_income",
      confident: false,
      reason: "Tiền vào chưa rõ",
    };
  }
  return {
    kind: "expense",
    categoryId: rule?.categoryId ?? UNCATEGORIZED_ID,
    confident: Boolean(rule),
    reason: rule ? "Theo luật phân loại" : "Chưa có luật phù hợp",
  };
}

/**
 * Builds the transaction for a statement line from a suggestion. Transfers need the other
 * account; without one this returns null and the line waits for review.
 */
export function draftForLine(
  line: Pick<BankLine, "accountId" | "date" | "amount" | "description" | "counterparty">,
  suggestion: LineSuggestion,
): TransactionDraft | null {
  const description = [line.counterparty, line.description].filter(Boolean).join(" · ");
  const side = { accountId: line.accountId, currency: "VND" as const };
  const amount = Math.abs(line.amount);
  if (suggestion.kind === "transfer") {
    if (!suggestion.otherAccountId) return null;
    const other = { accountId: suggestion.otherAccountId, currency: "VND" as const };
    return buildTransfer({
      date: line.date,
      description,
      from: line.amount < 0 ? side : other,
      to: line.amount < 0 ? other : side,
      amount,
    });
  }
  const common = {
    ...side,
    date: line.date,
    description,
    amount,
    categoryId: suggestion.categoryId,
    needsReview: !suggestion.confident,
  };
  if (suggestion.kind === "expense") return buildExpense(common);
  if (suggestion.kind === "refund") return buildRefund(common);
  return buildIncome(common);
}
