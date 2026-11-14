export type StatementKind = "tcb-account" | "tcb-credit-card";

/** One transaction as printed on a bank statement. */
export interface StatementLine {
  /** Position in the statement, 0-based. */
  index: number;
  /** Transaction date (ISO). */
  date: string;
  /** Posting date on a credit card statement (ISO). */
  postDate: string | null;
  /** Money into the account is positive, out of it negative (đồng). */
  amount: number;
  /** Running balance printed next to the line, when the statement has one. */
  balance: number | null;
  description: string;
  /** The other party: remitter or beneficiary, or the merchant on a card. */
  counterparty: string | null;
  counterpartyBank: string | null;
  /** The bank's transaction number (e.g. FT26000000000001). */
  reference: string | null;
  /** Card the purchase was made with ("1234"), on a credit card statement. */
  cardLast4: string | null;
  /** Amount in the original currency when it is not VND. */
  original: { amount: number; currency: string } | null;
}

export interface CreditCardSummary {
  statementDate: string;
  dueDate: string | null;
  creditLimit: number | null;
  minimumPayment: number | null;
  totalDebit: number | null;
  totalCredit: number | null;
  /** Annual interest rate in percent. */
  interestRate: number | null;
  cardLast4: string[];
}

export interface ParsedStatement {
  kind: StatementKind;
  bank: "TCB";
  accountNumber: string;
  holder: string | null;
  currency: "VND";
  periodFrom: string;
  periodTo: string;
  /**
   * Balance before the first line; negative on a credit card means debt. On an account with
   * "Sinh lời tự động", this is the available balance the running balances start from, which
   * includes the money set aside to earn interest.
   */
  openingBalance: number;
  /** The opening balance printed on the statement, when it differs from `openingBalance`. */
  reportedOpeningBalance: number | null;
  closingBalance: number;
  lines: StatementLine[];
  creditCard: CreditCardSummary | null;
  /**
   * Opening balance plus every line equals the closing balance, and every printed running
   * balance follows from the one before it.
   */
  balanced: boolean;
  warnings: string[];
}
