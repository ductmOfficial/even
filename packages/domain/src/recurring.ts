import {
  buildExpense,
  buildIncome,
  buildTransfer,
  type Share,
  type TransactionDraft,
} from "./ledger";
import { addMonths, daysInMonth } from "./period";

export const RECURRING_KINDS = ["expense", "income", "transfer"] as const;
export type RecurringKind = (typeof RECURRING_KINDS)[number];

export interface RecurringLike {
  id: string;
  name: string;
  kind: RecurringKind;
  /** Day of the month, 1–31; months without that day use their last day. */
  dayOfMonth: number;
  accountId: string;
  /** Transfers only: the receiving account (another account or a person). */
  toAccountId: string | null;
  /** Expense and income only. */
  categoryId: string | null;
  /** Total paid or received, VND, positive. */
  amount: number;
  /** Expenses only: parts other people owe you back. */
  shares: Share[];
  /** First month, "YYYY-MM". */
  startMonth: string;
  /** Last month, inclusive; null for no end. */
  endMonth: string | null;
  active: boolean;
}

/** The date a template falls on in a month ("2026-02" with day 31 → "2026-02-28"). */
export function dueDate(template: Pick<RecurringLike, "dayOfMonth">, month: string): string {
  const [y = 0, m = 1] = month.split("-").map(Number);
  const day = Math.min(template.dayOfMonth, daysInMonth(y, m));
  return `${month}-${String(day).padStart(2, "0")}`;
}

/** Months, in order, in which an active template is due on or before `today`. */
export function dueMonths(template: RecurringLike, today: string): string[] {
  if (!template.active) return [];
  const months: string[] = [];
  const last =
    template.endMonth && template.endMonth < today.slice(0, 7)
      ? template.endMonth
      : today.slice(0, 7);
  for (let month = template.startMonth; month <= last; month = addMonths(month, 1)) {
    if (dueDate(template, month) <= today) months.push(month);
  }
  return months;
}

/** Stable id of a template's occurrence, so generating twice adds nothing. */
export function occurrenceId(template: Pick<RecurringLike, "id">, month: string): string {
  return `recurring:${template.id}:${month}`;
}

/** The transaction a template stands for in a month. */
export function draftFromTemplate(template: RecurringLike, month: string): TransactionDraft {
  const date = dueDate(template, month);
  const side = { accountId: template.accountId, currency: "VND" as const };
  if (template.kind === "transfer") {
    if (!template.toAccountId) throw new Error(`"${template.name}" chưa chọn tài khoản nhận`);
    return buildTransfer({
      date,
      description: template.name,
      from: side,
      to: { accountId: template.toAccountId, currency: "VND" },
      amount: template.amount,
    });
  }
  if (!template.categoryId) throw new Error(`"${template.name}" chưa chọn danh mục`);
  const common = {
    ...side,
    date,
    description: template.name,
    amount: template.amount,
    categoryId: template.categoryId,
  };
  return template.kind === "income"
    ? buildIncome(common)
    : buildExpense({ ...common, shares: template.shares });
}
