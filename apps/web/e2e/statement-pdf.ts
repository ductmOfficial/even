import { PDFDocument, StandardFonts } from "pdf-lib";

export interface StatementRow {
  date: string;
  counterparty?: string;
  details: string;
  reference?: string;
  debit?: number;
  credit?: number;
  balance: number;
}

const vnd = (n: number) => n.toLocaleString("en-US");

/**
 * A fictional Techcombank account statement ("sổ phụ") with the real layout, in landscape, for
 * the browser tests. ASCII only: the built-in PDF fonts have no Vietnamese letters, and the
 * parser reads the English labels.
 */
export async function accountStatementPdf(options: {
  account: string;
  name: string;
  from: string;
  to: string;
  opening: number;
  rows: StatementRow[];
}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([842, 595]);
  const size = 7;
  // Positions are measured from the top, as on screen.
  const text = (x: number, top: number, value: string) => {
    page.drawText(value, { x, y: 595 - top, size, font });
  };
  const right = (x1: number, top: number, value: string) => {
    text(x1 - font.widthOfTextAtSize(value, size), top, value);
  };

  text(23, 37, "Techcombank");
  text(112, 126, "BANK STATEMENT/ DEBIT - CREDIT TRANSACTION");
  text(318, 152, "From:");
  text(382, 152, options.from);
  text(446, 152, "To:");
  text(504, 152, options.to);
  text(465, 205, "Account no.:");
  text(604, 205, options.account);
  text(465, 237, "Account name:");
  text(604, 237, options.name);
  const header: [number, string][] = [
    [28.9, "Transaction Date"],
    [142.7, "Remitter"],
    [230, "Remitter Bank"],
    [357.2, "Details"],
    [449.5, "Transaction No"],
    [570.8, "Debit"],
    [663.2, "Credit"],
    [758.3, "Balance"],
  ];
  for (const [x, label] of header) text(x, 325, label);
  text(302, 350, "Opening balance");
  right(823, 350, vnd(options.opening));

  let y = 377;
  for (const row of options.rows) {
    text(75.4, y, row.date);
    if (row.counterparty) text(120, y, row.counterparty);
    text(215, y, "TECHCOMBANK");
    text(320, y, row.details);
    if (row.reference) text(436, y, row.reference);
    if (row.debit) right(625, y, vnd(row.debit));
    if (row.credit) right(719, y, vnd(row.credit));
    right(823, y, vnd(row.balance));
    y += 30;
  }
  const closing = options.rows.at(-1)?.balance ?? options.opening;
  text(302, y, "Total volume");
  text(302, y + 20, "Ending balance");
  right(823, y + 20, vnd(closing));
  return Buffer.from(await doc.save());
}
