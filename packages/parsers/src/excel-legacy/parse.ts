import { excelSerialToIso, normalizeText } from "@even/domain";
import { read, type CellObject, type WorkSheet } from "@e965/xlsx";

/** One expense line from a monthly sheet (columns A–G of "Jan", "Feb"…). */
export interface LegacyRow {
  sheet: string;
  /** 1-based row number in the sheet, for error messages. */
  row: number;
  date: string;
  description: string;
  legacyCategory: string | null;
  /** VND. Positive = money spent, negative = cashback/refund (the sheet's convention). */
  amount: number;
  /** Free text from the Note column that is not a payment source. */
  note: string | null;
  /** Normalised payment source detected from the Note column. */
  source: LegacySourceKey;
}

import { sourceFromNumber, sourceFromText, type LegacySourceKey } from "./sources";

export * from "./sources";

export interface LegacySheetSummary {
  name: string;
  count: number;
  /** Net amount (spent − refunds), VND. */
  total: number;
}

export interface LegacyWorkbook {
  rows: LegacyRow[];
  sheets: LegacySheetSummary[];
  warnings: string[];
}

function cell(ws: WorkSheet, address: string): CellObject | undefined {
  return ws[address] as CellObject | undefined;
}

function text(c: CellObject | undefined): string | null {
  if (c?.v === undefined) return null;
  const value = (c.v instanceof Date ? c.v.toISOString() : String(c.v)).trim();
  return value === "" ? null : value;
}

function detectSource(note: CellObject | undefined): {
  source: LegacySourceKey;
  note: string | null;
} {
  if (note?.t === "n" && typeof note.v === "number") {
    return { source: sourceFromNumber(note.v) ?? "unknown", note: null };
  }
  const raw = text(note);
  if (!raw) return { source: "unknown", note: null };
  const source = sourceFromText(normalizeText(raw));
  return source ? { source, note: null } : { source: "unknown", note: raw };
}

/** A monthly sheet has "Name" in B1, "Category" in C1 and "Value" in F1. */
function isMonthlySheet(ws: WorkSheet): boolean {
  return (
    text(cell(ws, "B1"))?.toLowerCase() === "name" &&
    text(cell(ws, "C1"))?.toLowerCase() === "category" &&
    text(cell(ws, "F1"))?.toLowerCase() === "value"
  );
}

function lastRow(ws: WorkSheet): number {
  const ref = ws["!ref"];
  const m = ref ? /:[A-Z]+(\d+)$/.exec(ref) : null;
  return m ? Number(m[1]) : 0;
}

/**
 * Reads the old "Finance 2026" workbook. Only the cached values are used, so formulas
 * (e.g. `=G41*0.7`) come through as the numbers Excel last computed.
 */
export function parseLegacyWorkbook(data: ArrayBuffer | Uint8Array): LegacyWorkbook {
  const wb = read(data, { type: "array", cellDates: false, cellFormula: false });
  const rows: LegacyRow[] = [];
  const sheets: LegacySheetSummary[] = [];
  const warnings: string[] = [];

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws || !isMonthlySheet(ws)) continue;
    const summary: LegacySheetSummary = { name, count: 0, total: 0 };
    const end = lastRow(ws);

    for (let r = 2; r <= end; r++) {
      const description = text(cell(ws, `B${String(r)}`));
      const value = cell(ws, `F${String(r)}`);
      if (!description && value?.v === undefined) continue;
      if (!description) {
        warnings.push(`${name}!B${String(r)}: thiếu mô tả, bỏ qua`);
        continue;
      }
      if (value?.t !== "n" || typeof value.v !== "number") {
        warnings.push(`${name}!F${String(r)}: "${description}" không có số tiền, bỏ qua`);
        continue;
      }
      const amount = Math.round(value.v);
      if (amount === 0) continue;
      const dateCell = cell(ws, `A${String(r)}`);
      if (dateCell?.t !== "n" || typeof dateCell.v !== "number") {
        warnings.push(`${name}!A${String(r)}: "${description}" không có ngày, bỏ qua`);
        continue;
      }
      const { source, note } = detectSource(cell(ws, `G${String(r)}`));
      rows.push({
        sheet: name,
        row: r,
        date: excelSerialToIso(dateCell.v),
        description,
        legacyCategory: text(cell(ws, `C${String(r)}`)),
        amount,
        note,
        source,
      });
      summary.count++;
      summary.total += amount;
    }
    sheets.push(summary);
  }
  if (sheets.length === 0) {
    warnings.push("Không tìm thấy sheet tháng nào (cần cột Name / Category / Value ở dòng 1).");
  }
  return { rows, sheets, warnings };
}
