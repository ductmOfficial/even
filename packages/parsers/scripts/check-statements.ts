/**
 * Dry-run of the statement parser on real PDFs, without writing anything:
 *   pnpm --filter @even/parsers check:statements <file.pdf | folder> …
 * Prints, per statement, the account, the period, the number of lines, the money in and out,
 * and whether the balances add up. Transaction details are not printed.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

import { parseStatement, readPdfTokens } from "../src/statements";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: check-statements <file.pdf | folder> …");
  process.exit(1);
}
const files = args.flatMap((p) =>
  statSync(p).isDirectory()
    ? readdirSync(p)
        .filter((f) => f.toLowerCase().endsWith(".pdf"))
        .sort()
        .map((f) => join(p, f))
    : [p],
);

const fmt = (n: number) => n.toLocaleString("vi-VN");
let failed = 0;
const rows = [];
for (const file of files) {
  try {
    const s = parseStatement(await readPdfTokens(new Uint8Array(readFileSync(file)), pdfjs));
    const money = (sign: 1 | -1) =>
      s.lines.filter((l) => l.amount * sign > 0).reduce((t, l) => t + Math.abs(l.amount), 0);
    if (!s.balanced) failed++;
    rows.push({
      file: file.split("/").at(-1),
      kind: s.kind,
      account: `…${s.accountNumber.slice(-4)}`,
      period: `${s.periodFrom} → ${s.periodTo}`,
      lines: s.lines.length,
      in: fmt(money(1)),
      out: fmt(money(-1)),
      balanced: s.balanced ? "yes" : "NO",
    });
    for (const w of s.warnings) console.warn(`${file}: ${w}`);
  } catch (error) {
    failed++;
    console.error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
console.table(rows);
process.exit(failed ? 1 : 0);
