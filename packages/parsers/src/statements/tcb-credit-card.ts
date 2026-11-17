import { addDays, addMonths } from "@even/domain";

import { cell, readTable, type Column } from "./table";
import {
  groupLines,
  lineText,
  parseDmy,
  parseOriginal,
  parseVnd,
  valueAfter,
  type PdfLine,
  type PdfToken,
} from "./tokens";
import type { ParsedStatement, StatementLine } from "./types";

/** Techcombank credit card statement ("Sao kê tài khoản thẻ tín dụng"). */
export function isTcbCreditCardStatement(tokens: readonly PdfToken[]): boolean {
  const text = tokens.map((t) => t.text).join(" ");
  return text.includes("Credit Card Account Statement") && /Techcombank|TC\d{3}/i.test(text);
}

const CARD = /Thẻ\/Card No:\s*\d{4}\.{3}(\d{4})/;

/** Splits "Giao dịch thanh toán/Purchase - Số Thẻ/Card No: 4000...1234 SHOPEE VN" into parts. */
export function splitCardDescription(text: string): {
  kind: string;
  cardLast4: string | null;
  merchant: string | null;
} {
  const card = CARD.exec(text);
  if (!card) return { kind: text, cardLast4: null, merchant: null };
  const before = text
    .slice(0, card.index)
    .replace(/\s*-\s*Số\s*$/, "")
    .trim();
  const after = text.slice(card.index + card[0].length).trim();
  return { kind: before, cardLast4: card[1] ?? null, merchant: after || null };
}

/** The six values under "Previous Balance … Payment due date". */
function summaryValues(lines: readonly PdfLine[]): string[] {
  const i = lines.findIndex((l) => lineText(l).includes("Previous Balance"));
  for (const line of lines.slice(i + 1, i + 4)) {
    const values = line.tokens.map((t) => t.text.trim());
    if (values.filter((v) => parseVnd(v) !== null).length >= 4) return values;
  }
  return [];
}

/** "18/09/2026" statement → "2026-08-19": the day after the same date a month earlier. */
/**
 * The first day of the billing cycle. The statement prints only its own date, so the cycle is
 * taken to start the day after the same date a month earlier, or on the earliest posting date on
 * the statement if that is sooner: Techcombank moves the statement date (18 September, then
 * 20 October), and the next statement then carries lines posted on 19 and 20 September.
 */
function cycleStart(statementDate: string, lines: readonly StatementLine[]): string {
  const [y = 0, m = 1] = addMonths(statementDate.slice(0, 7), -1).split("-").map(Number);
  const day = Math.min(Number(statementDate.slice(8)), new Date(Date.UTC(y, m, 0)).getUTCDate());
  const sameDayLastMonth = `${String(y)}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const posted = lines.map((l) => l.postDate ?? l.date).filter(Boolean);
  const earliest = posted.length ? posted.reduce((a, b) => (b < a ? b : a)) : null;
  const start = addDays(sameDayLastMonth, 1);
  return earliest && earliest < start ? earliest : start;
}

export function parseTcbCreditCardStatement(tokens: readonly PdfToken[]): ParsedStatement {
  const lines = groupLines(tokens);
  const warnings: string[] = [];
  const accountNumber = valueAfter(lines, /Số tài khoản thẻ tín dụng/, (t) => /^\d{6,}$/.test(t));
  const statementDateText = valueAfter(lines, /Ngày sao kê/, (t) => parseDmy(t) !== null);
  if (!accountNumber || !statementDateText) {
    throw new Error("Không đọc được số tài khoản thẻ hoặc ngày sao kê");
  }
  const statementDate = parseDmy(statementDateText) ?? "";
  const holder = valueAfter(lines, /^Ông\/Bà:?$/, (t) => t.length > 1);
  const limit = valueAfter(lines, /Hạn mức tín dụng/, (t) => parseVnd(t) !== null);
  const rate = valueAfter(lines, /Lãi suất thẻ/, (t) => /^[\d.]+%/.test(t));

  const summary = summaryValues(lines);
  const [prev, debit, credit, closing, minimum, due] = summary;
  const openingBalance = parseVnd(prev ?? "");
  const closingBalance = parseVnd(closing ?? "");
  if (openingBalance === null || closingBalance === null) {
    throw new Error("Không đọc được dư nợ kỳ trước hoặc dư nợ cuối kỳ");
  }
  const dueDate = /(\d{2}\/\d{2}\/\d{4})/.exec(due ?? "")?.[1];

  const rows = readTable(lines, {
    isHeader: (l) => lineText(l).includes("Transaction date") && lineText(l).includes("Post date"),
    columns: (header) => {
      const x = (re: RegExp) => (header.tokens.find((t) => re.test(t.text))?.x0 ?? NaN) - 5;
      const columns: Column[] = [
        { key: "date", from: -Infinity },
        { key: "post", from: x(/^Post date$/) },
        { key: "original", from: x(/^Original amount$/) },
        { key: "debit", from: x(/^Debit$/) },
        { key: "credit", from: x(/^Credit$/) },
        { key: "description", from: x(/^Transaction description$/) },
      ];
      return columns;
    },
    isTableEnd: (l) => /Total Debit in Period|End Of Statement/.test(lineText(l)),
    isPageEnd: (l) => /^TC\d{3}$/.test(lineText(l).trim()),
    // Fees have no transaction date, only a post date, so rows start at post dates.
    anchorColumn: "post",
  });

  const cards = new Set<string>();
  const statementLines: StatementLine[] = rows.map((row, index) => {
    const out = parseVnd(cell(row, "debit")) ?? 0;
    const into = parseVnd(cell(row, "credit")) ?? 0;
    const original = parseOriginal(cell(row, "original"));
    const text = cell(row, "description");
    const parts = splitCardDescription(text);
    if (parts.cardLast4) cards.add(parts.cardLast4);
    return {
      index,
      date: parseDmy(cell(row, "date")) ?? parseDmy(cell(row, "post")) ?? "",
      postDate: parseDmy(cell(row, "post")),
      amount: into - out,
      balance: null,
      description: text,
      counterparty: parts.merchant,
      counterpartyBank: null,
      reference: null,
      cardLast4: parts.cardLast4,
      original: original && original.currency !== "VND" ? original : null,
    };
  });

  const total = statementLines.reduce((s, l) => s + l.amount, 0);
  const balanced = openingBalance + total === closingBalance;
  if (!balanced) {
    warnings.push(
      `Dư nợ không khớp: kỳ trước + giao dịch = ${String(openingBalance + total)}, cuối kỳ = ${String(closingBalance)}`,
    );
  }
  return {
    kind: "tcb-credit-card",
    bank: "TCB",
    accountNumber,
    holder,
    currency: "VND",
    periodFrom: cycleStart(statementDate, statementLines),
    periodTo: statementDate,
    openingBalance,
    reportedOpeningBalance: null,
    closingBalance,
    lines: statementLines,
    creditCard: {
      statementDate,
      dueDate: dueDate ? parseDmy(dueDate) : null,
      creditLimit: limit ? parseVnd(limit) : null,
      minimumPayment: parseVnd(minimum ?? ""),
      totalDebit: parseVnd(debit ?? ""),
      totalCredit: parseVnd(credit ?? ""),
      interestRate: rate ? Number.parseFloat(rate) : null,
      cardLast4: [...cards],
    },
    balanced,
    warnings,
  };
}
