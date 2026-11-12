/**
 * Dry-run of the legacy import against a real workbook, without writing anything:
 *   pnpm --filter @even/parsers check:legacy "/path/to/Finance 2026.xlsx"
 * Prints per-sheet totals (compare them with the sheet's own SUMIF cells), the source and
 * category mapping, and how many rows will land in the review queue.
 */
import { readFileSync } from "node:fs";

import { validateTransaction } from "@even/domain";

import {
  buildLegacyImport,
  parseLegacyWorkbook,
  resolveRows,
  summarizeMapping,
  summarizeSources,
} from "../src/index";

const path = process.argv[2];
if (!path) {
  console.error("Usage: check-legacy <file.xlsx>");
  process.exit(1);
}

const book = parseLegacyWorkbook(readFileSync(path));
const planned = resolveRows(book.rows);
const sources = summarizeSources(book.rows);
const fmt = (n: number) => n.toLocaleString("vi-VN");

console.log("\nSheets");
console.table(book.sheets.map((s) => ({ sheet: s.name, rows: s.count, total: fmt(s.total) })));
console.log("Sources");
console.table(sources.map((s) => ({ ...s, total: fmt(s.total) })));
console.log("Category mapping");
console.table(
  summarizeMapping(planned).map((m) => ({
    from: m.legacyCategory ?? "(trống)",
    to: m.categoryId,
    confidence: m.confidence,
    rows: m.count,
    total: fmt(m.total),
  })),
);
const items = buildLegacyImport(
  planned,
  Object.fromEntries(sources.map((s) => [s.key, `account-${s.key}`])),
);
for (const item of items) validateTransaction(item.draft);
console.log(
  `Rows: ${String(items.length)} · to review: ${String(items.filter((i) => i.draft.needsReview).length)}`,
);
if (book.warnings.length) console.log("\nWarnings:\n- " + book.warnings.join("\n- "));
