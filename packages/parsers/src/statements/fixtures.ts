/**
 * Fictional statements laid out like Techcombank's PDFs (positions taken from the real layout),
 * for tests. No real names, accounts or amounts.
 */
import type { PdfToken } from "./tokens";

type Cell = string | string[];

const t = (page: number, x0: number, y: number, text: string, width = text.length * 4.5) => ({
  page,
  x0,
  x1: x0 + width,
  y,
  text,
});

/** Right-aligned text ending at `x1`. */
const r = (page: number, x1: number, y: number, text: string) => {
  const width = text.length * 4.5;
  return { page, x0: x1 - width, x1, y, text };
};

/** A cell that wraps: lines spread evenly around the row's baseline. */
function wrapped(page: number, x0: number, y: number, cell: Cell): PdfToken[] {
  const lines = Array.isArray(cell) ? cell : [cell];
  const top = y - ((lines.length - 1) * 7) / 2;
  return lines.map((text, i) => t(page, x0, top + i * 7, text));
}

export interface AccountRowFixture {
  date: string;
  counterparty?: Cell;
  bank?: Cell;
  details: Cell;
  reference?: string;
  debit?: string;
  credit?: string;
  balance: string;
}

export function accountStatementTokens(options: {
  account: string;
  name: string;
  from: string;
  to: string;
  opening: string;
  closing: string;
  rows: AccountRowFixture[];
  /** Rows per page; the header repeats only on the first page, as in the real statement. */
  perPage?: number;
}): PdfToken[] {
  const perPage = options.perPage ?? 6;
  const tokens: PdfToken[] = [
    t(1, 23, 37, "NGÂN HÀNG TMCP KỸ THƯƠNG VIỆT NAM"),
    t(1, 112, 126, "BANK STATEMENT/ DEBIT - CREDIT TRANSACTION"),
    t(1, 318, 152, "Từ ngày/ From:"),
    t(1, 382, 152, options.from),
    t(1, 446, 152, "Đến ngày/ To:"),
    t(1, 504, 152, options.to),
    t(1, 465, 205, "Số tài khoản/ Account no.:"),
    t(1, 604, 205, options.account),
    t(1, 465, 237, "Tên tài khoản/ Account name:"),
    t(1, 604, 237, options.name),
    t(1, 26, 316, "Ngày giao dịch (1)"),
    t(1, 28.9, 325.4, "Transaction Date"),
    t(1, 142.7, 325.4, "Remitter"),
    t(1, 230, 325.4, "Remitter Bank"),
    t(1, 357.2, 325.4, "Details"),
    t(1, 449.5, 325.4, "Transaction No"),
    t(1, 570.8, 325.4, "Debit"),
    t(1, 663.2, 325.4, "Credit"),
    t(1, 758.3, 325.4, "Balance"),
    t(1, 302, 349.8, "Số dư đầu kỳ/ Opening balance"),
    r(1, 823, 349.8, options.opening),
  ];
  options.rows.forEach((row, i) => {
    const page = 1 + Math.floor(i / perPage);
    const y = (page === 1 ? 377 : 32) + (i % perPage) * 30;
    tokens.push(t(page, 75.4, y, row.date));
    if (row.counterparty) tokens.push(...wrapped(page, 120, y, row.counterparty));
    if (row.bank) tokens.push(...wrapped(page, 215, y, row.bank));
    tokens.push(...wrapped(page, 320, y, row.details));
    if (row.reference) tokens.push(t(page, 436, y, row.reference));
    if (row.debit) tokens.push(r(page, 625, y, row.debit));
    if (row.credit) tokens.push(r(page, 719, y, row.credit));
    tokens.push(r(page, 823, y, row.balance));
    if (i % perPage === perPage - 1 || i === options.rows.length - 1) {
      tokens.push(
        t(page, 269, 557, "Phiếu này được in từ dịch vụ ngân hàng điện tử của Techcombank"),
      );
      tokens.push(t(page, 21, 560, "01/01/2027"));
    }
  });
  const last = 1 + Math.floor((options.rows.length - 1) / perPage);
  const y = (last === 1 ? 377 : 32) + (((options.rows.length - 1) % perPage) + 1) * 30;
  tokens.push(t(last, 302, y, "Cộng doanh số/Total volume"), r(last, 625, y, "1"));
  tokens.push(
    t(last, 302, y + 20, "Số dư cuối kỳ/ Ending balance"),
    r(last, 823, y + 20, options.closing),
  );
  return tokens;
}

export interface CardRowFixture {
  date?: string;
  post: string;
  original: string;
  debit?: string;
  credit?: string;
  description: string[];
}

export function creditCardStatementTokens(options: {
  account: string;
  holder: string;
  statementDate: string;
  limit: string;
  summary: [string, string, string, string, string, string];
  rows: CardRowFixture[];
  perPage?: number;
}): PdfToken[] {
  const perPage = options.perPage ?? 5;
  const s = options.summary;
  const tokens: PdfToken[] = [
    t(1, 300, 40, "SAO KÊ TÀI KHOẢN THẺ TÍN DỤNG"),
    t(1, 300, 52, "Credit Card Account Statement"),
    t(1, 20, 70, "Ông/Bà:"),
    t(1, 160, 70, options.holder),
    t(1, 420, 70, "Ngày sao kê:"),
    t(1, 700, 70, options.statementDate),
    t(1, 420, 90, "Số tài khoản thẻ tín dụng:"),
    t(1, 700, 90, options.account),
    t(1, 420, 110, "Hạn mức tín dụng (VND):"),
    t(1, 700, 110, options.limit),
    t(1, 420, 130, "Lãi suất thẻ:"),
    t(1, 700, 130, "24.96%/năm"),
    t(1, 45.8, 329.8, "Previous Balance"),
    t(1, 165.2, 329.8, "Total Debit in Period"),
    t(1, 296.8, 329.8, "Total Credit in Period"),
    t(1, 428.8, 329.8, "Statement Balance"),
    t(1, 564.5, 329.8, "Minimum Payment"),
    t(1, 712.2, 329.8, "Payment due date"),
    t(1, 43, 350.8, s[0]),
    t(1, 171, 350.8, s[1]),
    t(1, 304, 350.8, s[2]),
    t(1, 430, 350.8, s[3]),
    t(1, 577, 350.8, s[4]),
    t(1, 695, 350.8, s[5]),
  ];
  const header = (page: number, y: number) => [
    t(page, 20, y, "Transaction date"),
    t(page, 123, y, "Post date"),
    t(page, 279, y, "Original amount"),
    t(page, 410, y, "Debit"),
    t(page, 516, y, "Credit"),
    t(page, 615, y, "Transaction description"),
  ];
  tokens.push(...header(1, 425.3));
  options.rows.forEach((row, i) => {
    const page = 1 + Math.floor(i / perPage);
    if (page > 1 && i % perPage === 0) tokens.push(...header(page, 40));
    const y = (page === 1 ? 461 : 80) + (i % perPage) * 49;
    if (row.date) tokens.push(t(page, 20, y, row.date));
    tokens.push(t(page, 123, y, row.post), t(page, 279, y, row.original));
    if (row.debit) tokens.push(t(page, 410, y, row.debit));
    if (row.credit) tokens.push(t(page, 516, y, row.credit));
    tokens.push(...wrapped(page, 615, y, row.description));
    if (i % perPage === perPage - 1) tokens.push(t(page, 764, 1149, "TC191"));
  });
  const last = 1 + Math.floor((options.rows.length - 1) / perPage);
  tokens.push(t(last, 174, 1050, "Total Debit in Period:"), t(last, 410, 1050, s[1]));
  return tokens;
}
