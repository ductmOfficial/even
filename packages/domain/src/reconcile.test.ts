import { describe, expect, it } from "vitest";

import { validateTransaction } from "./ledger";
import {
  daysBetween,
  draftForLine,
  matchStatementLines,
  pairTransfers,
  similarity,
  suggestForLine,
  type AccountRef,
  type BankLine,
} from "./reconcile";
import { DEFAULT_RULES } from "./rules";

const rules = DEFAULT_RULES.map((r) => ({ ...r, enabled: true }));
const accounts: AccountRef[] = [
  { id: "bank", type: "bank", name: "Bank", aliases: [] },
  { id: "card", type: "credit_card", name: "Card", aliases: [] },
  { id: "cash", type: "cash", name: "Tiền mặt", aliases: [] },
  { id: "wallet", type: "ewallet", name: "Ví ShopeePay", aliases: ["spay"] },
];

const line = (id: string, accountId: string, date: string, amount: number, description = "") =>
  ({
    id,
    accountId,
    date,
    amount,
    description,
    counterparty: null,
    reference: null,
  }) satisfies BankLine;

describe("helpers", () => {
  it("count days and compare descriptions", () => {
    expect(daysBetween("2026-09-30", "2026-10-02")).toBe(2);
    expect(similarity("SHOPEE - VIETNAM Hanoi VN", "Shopee")).toBe(1);
    expect(similarity("SHOPEE - VIETNAM Hanoi VN", "Shopee đơn hàng")).toBeCloseTo(1 / 3);
    expect(similarity("Coffee", "Kingfood")).toBe(0);
  });
});

describe("matchStatementLines", () => {
  it("pairs by amount and date, closest first, each side once", () => {
    const lines = [
      line("l1", "bank", "2026-09-03", -50_000, "Highlands Coffee"),
      line("l2", "bank", "2026-09-03", -50_000, "Kingfood"),
      line("l3", "bank", "2026-09-10", -1_000_000, "Rent"),
      line("l4", "bank", "2026-09-12", 200_000, "Refund"),
    ];
    const result = matchStatementLines(lines, [
      {
        transactionId: "t-king",
        accountId: "bank",
        date: "2026-09-02",
        amount: -50_000,
        description: "Kingfood",
      },
      {
        transactionId: "t-coffee",
        accountId: "bank",
        date: "2026-09-02",
        amount: -50_000,
        description: "Coffee",
      },
      {
        transactionId: "t-late",
        accountId: "bank",
        date: "2026-09-20",
        amount: -1_000_000,
        description: "Rent",
      },
      {
        transactionId: "t-card",
        accountId: "card",
        date: "2026-09-12",
        amount: 200_000,
        description: "Refund",
      },
      {
        transactionId: "t-cash",
        accountId: "bank",
        date: "2026-09-05",
        amount: -10_000,
        description: "Cash",
      },
    ]);
    expect(result.matches).toEqual([
      { lineId: "l1", transactionId: "t-coffee", dayDiff: 1 },
      { lineId: "l2", transactionId: "t-king", dayDiff: 1 },
    ]);
    expect(result.newLines).toEqual(["l3", "l4"]);
    expect(result.missing).toEqual(["t-late", "t-card", "t-cash"]);
  });
});

describe("pairTransfers", () => {
  it("pairs opposite amounts on different accounts within two days", () => {
    expect(
      pairTransfers([
        line("pay", "bank", "2026-09-30", -12_345_678),
        line("card-in", "card", "2026-09-30", 12_345_678),
        line("other", "bank", "2026-09-01", -5),
        line("far", "card", "2026-09-10", 5),
        line("same", "bank", "2026-09-30", 12_345_678),
      ]),
    ).toEqual([["pay", "card-in"]]);
  });
});

describe("suggestForLine", () => {
  const suggest = (amount: number, description: string, counterparty: string | null = null) =>
    suggestForLine(
      { amount, description, counterparty },
      { rules, accounts, holderNames: ["NGUYEN VAN A"] },
    );

  it("recognises bank wording", () => {
    expect(suggest(123_456, "Thanh toan loi nhuan Sinh loi tu dong thang 8")).toMatchObject({
      kind: "income",
      categoryId: "income.interest",
    });
    expect(suggest(101, "Tra lai so du tren tai khoan - thang 09/2026")).toMatchObject({
      categoryId: "income.interest",
    });
    expect(suggest(98_765, "VND_BNK_GL Earning cashback")).toMatchObject({
      categoryId: "income.cashback",
    });
    expect(suggest(12_345_678, "Thanh toan no the tin dung - Sotien 12345678 VND")).toEqual({
      kind: "transfer",
      otherAccountId: null,
      reason: "Trả nợ thẻ tín dụng",
    });
    expect(suggest(-1_000_000, "Rut tien tai ATM TCB bang SDT")).toMatchObject({
      kind: "transfer",
      otherAccountId: "cash",
    });
    expect(suggest(-82_000, "NAP VI SHOPEEPAY 0795000000")).toMatchObject({
      kind: "transfer",
      otherAccountId: "wallet",
    });
    expect(suggest(-1_000_000, "NGUYEN VAN A chuyen", "NGUYEN VAN A")).toMatchObject({
      kind: "transfer",
      otherAccountId: null,
    });
  });

  it("falls back to the category rules", () => {
    expect(suggest(-65_000, "Highlands Coffee HCM")).toMatchObject({
      kind: "expense",
      categoryId: "food.coffee",
      confident: true,
    });
    expect(suggest(-1, "Something")).toMatchObject({
      categoryId: "other.uncategorized",
      confident: false,
    });
    expect(suggest(510_000, "Trả lại hàng hóa/Merchandize return 9PAY*TikTok Shop")).toMatchObject({
      kind: "refund",
      categoryId: "shopping.online",
    });
    expect(suggest(300_000, "banh pia")).toMatchObject({ kind: "income", confident: false });
  });
});

describe("draftForLine", () => {
  it("builds balanced transactions, and none for a transfer without its other side", () => {
    const base = {
      accountId: "bank",
      date: "2026-09-03",
      counterparty: "CUA HANG",
      description: "Coffee",
    };
    const expense = draftForLine(
      { ...base, amount: -65_000 },
      { kind: "expense", categoryId: "food.coffee", confident: true, reason: "" },
    );
    const income = draftForLine(
      { ...base, amount: 101 },
      { kind: "income", categoryId: "income.interest", confident: false, reason: "" },
    );
    const atm = draftForLine(
      { ...base, amount: -1_000_000 },
      { kind: "transfer", otherAccountId: "cash", reason: "" },
    );
    for (const d of [expense, income, atm]) if (d) validateTransaction(d);
    expect(expense).toMatchObject({
      kind: "expense",
      description: "CUA HANG · Coffee",
      needsReview: false,
    });
    expect(income).toMatchObject({ kind: "income", needsReview: true });
    expect(atm?.postings.map((p) => [p.accountId, p.amount])).toEqual([
      ["bank", -1_000_000],
      ["cash", 1_000_000],
    ]);
    expect(
      draftForLine({ ...base, amount: 5 }, { kind: "transfer", otherAccountId: null, reason: "" }),
    ).toBeNull();
  });
});
