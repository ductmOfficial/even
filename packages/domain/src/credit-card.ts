import { daysBetween } from "./reconcile";

export interface CardStatementLike {
  statementDate: string | null;
  dueDate: string | null;
  /** Negative when you owe the bank. */
  closingBalance: number;
  minimumPayment: number | null;
  creditLimit: number | null;
}

export interface CardStatus {
  /** What the last statement asks you to pay (positive), 0 when nothing is owed. */
  statementDue: number;
  /** Paid towards it since the statement date. */
  paid: number;
  /** Left to pay before the due date to avoid interest. */
  remaining: number;
  /** Left to pay to cover the minimum payment. */
  minimumRemaining: number;
  /** Days until the due date; negative once it has passed. Null without a due date. */
  daysLeft: number | null;
  state: "paid" | "due" | "overdue" | "none";
  /** Share of the credit limit in use now, 0 to 1. Null without a limit. */
  utilization: number | null;
}

/**
 * Where a credit card stands against its last statement: how much is still due, by when, and
 * how much of the limit is in use. `balance` is the card's ledger balance today (negative =
 * debt); `paidSince` is what was paid into the card after the statement date.
 */
export function cardStatus(
  statement: CardStatementLike,
  balance: number,
  paidSince: number,
  today: string,
): CardStatus {
  const statementDue = Math.max(0, -statement.closingBalance);
  const paid = Math.max(0, paidSince);
  const remaining = Math.max(0, statementDue - paid);
  const minimumRemaining = Math.max(0, (statement.minimumPayment ?? 0) - paid);
  const daysLeft = statement.dueDate
    ? (Date.parse(statement.dueDate) >= Date.parse(today) ? 1 : -1) *
      daysBetween(statement.dueDate, today)
    : null;
  const state =
    statementDue === 0
      ? "none"
      : remaining === 0
        ? "paid"
        : daysLeft !== null && daysLeft < 0
          ? "overdue"
          : "due";
  const utilization =
    statement.creditLimit && statement.creditLimit > 0
      ? Math.max(0, -balance) / statement.creditLimit
      : null;
  return { statementDue, paid, remaining, minimumRemaining, daysLeft, state, utilization };
}
