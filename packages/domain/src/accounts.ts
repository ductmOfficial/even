import type { Currency } from "./money";

export const ACCOUNT_TYPES = [
  "bank",
  "credit_card",
  "ewallet",
  "cash",
  "foreign",
  "brokerage",
  "crypto",
  "savings",
  "person",
  "equity",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: "Tài khoản ngân hàng",
  credit_card: "Thẻ tín dụng",
  ewallet: "Ví điện tử",
  cash: "Tiền mặt",
  foreign: "Ngoại tệ",
  brokerage: "Chứng khoán",
  crypto: "Crypto",
  savings: "Tiết kiệm",
  person: "Người (công nợ)",
  equity: "Vốn / số dư đầu kỳ",
};

/** Types the user picks when creating a money account (people and equity are created elsewhere). */
export const MONEY_ACCOUNT_TYPES = ACCOUNT_TYPES.filter(
  (t): t is Exclude<AccountType, "person" | "equity"> => t !== "person" && t !== "equity",
);

export interface AccountLike {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  last4?: string | null;
  aliases?: readonly string[] | null;
}

/** Accounts that count towards net worth. Equity only balances opening entries. */
export function countsTowardNetWorth(type: AccountType): boolean {
  return type !== "equity";
}

export const OPENING_BALANCE_ACCOUNT_ID = "equity.opening";
