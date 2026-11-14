import { groupLines, lineText, parseDmy, parseVnd, valueAfter, type PdfToken } from "./tokens";
import { cell, readTable, type Column } from "./table";
import type { ParsedStatement, StatementLine } from "./types";

const isHeader = (text: string) => text.includes("Transaction Date") && text.includes("Balance");

/** Techcombank current account statement ("Sổ phụ kiêm phiếu báo nợ/có"). */
export function isTcbAccountStatement(tokens: readonly PdfToken[]): boolean {
  const text = tokens.map((t) => t.text).join(" ");
  return text.includes("BANK STATEMENT/ DEBIT - CREDIT TRANSACTION") && /Techcombank/i.test(text);
}

function balanceOn(lines: ReturnType<typeof groupLines>, label: RegExp): number | null {
  const line = lines.find((l) => label.test(lineText(l)));
  if (!line) return null;
  const amounts = line.tokens.map((t) => parseVnd(t.text)).filter((v) => v !== null);
  return amounts.at(-1) ?? null;
}

export function parseTcbAccountStatement(tokens: readonly PdfToken[]): ParsedStatement {
  const lines = groupLines(tokens);
  const warnings: string[] = [];
  const accountNumber = valueAfter(lines, /Account no\.:/, (t) => /^\d{6,}$/.test(t));
  const periodFrom = valueAfter(lines, /From:/, (t) => parseDmy(t) !== null);
  const periodTo = valueAfter(lines, /To:/, (t) => parseDmy(t) !== null);
  if (!accountNumber || !periodFrom || !periodTo) {
    throw new Error("Không đọc được số tài khoản hoặc kỳ sao kê");
  }
  const holder = valueAfter(lines, /Account name:/, (t) => t.length > 1);
  const openingBalance = balanceOn(lines, /Opening balance/);
  const closingBalance = balanceOn(lines, /Ending balance/);
  if (openingBalance === null || closingBalance === null) {
    throw new Error("Không đọc được số dư đầu kỳ hoặc cuối kỳ");
  }

  // Text columns are left-aligned under their header; amounts are right-aligned, so they are
  // placed by their right edge.
  let amountStarts = { debit: Infinity, credit: Infinity, balance: Infinity };
  const rows = readTable(lines, {
    isHeader: (l) => isHeader(lineText(l)),
    columns: (header) => {
      const x = (re: RegExp) => header.tokens.find((t) => re.test(t.text))?.x0 ?? NaN;
      amountStarts = { debit: x(/^Debit$/), credit: x(/^Credit$/), balance: x(/^Balance$/) };
      const columns: Column[] = [
        { key: "date", from: 0 },
        { key: "counterparty", from: x(/^Remitter$/) - 30 },
        { key: "bank", from: x(/^Remitter Bank$/) - 20 },
        { key: "details", from: x(/^Details$/) - 40 },
        { key: "reference", from: x(/^Transaction No$/) - 20 },
      ];
      return columns;
    },
    columnOf: (token, columns) => {
      if (parseVnd(token.text) !== null && token.x1 > amountStarts.debit) {
        if (token.x1 < amountStarts.credit) return "debit";
        if (token.x1 < amountStarts.balance) return "credit";
        return "balance";
      }
      let key: string | undefined;
      for (const c of columns) if (token.x0 >= c.from) key = c.key;
      return key;
    },
    isTableEnd: (l) => /Total volume|Ending balance/.test(lineText(l)),
    isPageEnd: (l) => /Phiếu này được in|This document was generated/.test(lineText(l)),
    skip: (l) => lineText(l).includes("Opening balance"),
    anchorColumn: "date",
  });

  const statementLines: StatementLine[] = rows.map((row, index) => {
    const debit = parseVnd(cell(row, "debit")) ?? 0;
    const credit = parseVnd(cell(row, "credit")) ?? 0;
    if (debit && credit) warnings.push(`Dòng ${String(index + 1)} có cả ghi nợ và ghi có`);
    return {
      index,
      date: parseDmy(cell(row, "date")) ?? "",
      postDate: null,
      amount: credit - debit,
      balance: parseVnd(cell(row, "balance")),
      description: cell(row, "details"),
      counterparty: cell(row, "counterparty") || null,
      counterpartyBank: cell(row, "bank") || null,
      reference: cell(row, "reference").replace(/\s+/g, "") || null,
      cardLast4: null,
      original: null,
    };
  });

  // The running balance is the available balance. With "Sinh lời tự động" it includes money
  // set aside to earn interest, so it can differ from the printed opening balance; the lines
  // and running balances are what the account really did.
  const first = statementLines[0];
  const derivedOpening = first?.balance != null ? first.balance - first.amount : openingBalance;
  let chainBreaks = 0;
  statementLines.forEach((line, i) => {
    const before = i === 0 ? derivedOpening : statementLines[i - 1]?.balance;
    if (line.balance === null || before === null || before === undefined) return;
    if (before + line.amount !== line.balance) {
      chainBreaks++;
      warnings.push(`Dòng ${String(i + 1)} (${line.date}): số dư không nối tiếp dòng trước`);
    }
  });
  const total = statementLines.reduce((s, l) => s + l.amount, 0);
  const balanced = chainBreaks === 0 && derivedOpening + total === closingBalance;
  if (derivedOpening + total !== closingBalance) {
    warnings.push(
      `Số dư không khớp: đầu kỳ + giao dịch = ${String(derivedOpening + total)}, cuối kỳ = ${String(closingBalance)}`,
    );
  }
  return {
    kind: "tcb-account",
    bank: "TCB",
    accountNumber,
    holder,
    currency: "VND",
    periodFrom: parseDmy(periodFrom) ?? "",
    periodTo: parseDmy(periodTo) ?? "",
    openingBalance: derivedOpening,
    reportedOpeningBalance: derivedOpening === openingBalance ? null : openingBalance,
    closingBalance,
    lines: statementLines,
    creditCard: null,
    balanced,
    warnings,
  };
}
