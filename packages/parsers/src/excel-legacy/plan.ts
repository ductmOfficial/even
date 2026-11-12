import { buildExpense, buildRefund, normalizeText, type TransactionDraft } from "@even/domain";

import { resolveLegacyCategory, type MappingConfidence } from "./categories";
import type { LegacyRow } from "./parse";
import { sourceLabel, type LegacySourceKey } from "./sources";

export interface LegacySourceSummary {
  key: LegacySourceKey;
  label: string;
  count: number;
  total: number;
}

export function summarizeSources(rows: readonly LegacyRow[]): LegacySourceSummary[] {
  const map = new Map<LegacySourceKey, LegacySourceSummary>();
  for (const r of rows) {
    const s = map.get(r.source) ?? {
      key: r.source,
      label: sourceLabel(r.source),
      count: 0,
      total: 0,
    };
    s.count++;
    s.total += r.amount;
    map.set(r.source, s);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export interface LegacyMappingSummary {
  legacyCategory: string | null;
  categoryId: string;
  confidence: MappingConfidence;
  count: number;
  total: number;
}

export interface PlannedRow {
  row: LegacyRow;
  categoryId: string;
  confidence: MappingConfidence;
  reviewReason: string | null;
}

export function resolveRows(
  rows: readonly LegacyRow[],
  overrides: Readonly<Record<string, string>> = {},
): PlannedRow[] {
  return rows.map((row) => {
    const resolved = resolveLegacyCategory(row.legacyCategory, row.description, overrides);
    const reviewReason =
      resolved.reviewReason ??
      (row.amount < 0 ? "Số âm (hoàn tiền/cashback): kiểm tra lại cách ghi nhận" : null);
    return { row, categoryId: resolved.categoryId, confidence: resolved.confidence, reviewReason };
  });
}

/** Groups planned rows by (legacy category → new category) for the preview table. */
export function summarizeMapping(planned: readonly PlannedRow[]): LegacyMappingSummary[] {
  const map = new Map<string, LegacyMappingSummary>();
  for (const p of planned) {
    const key = `${p.row.legacyCategory ?? ""}→${p.categoryId}`;
    const s = map.get(key) ?? {
      legacyCategory: p.row.legacyCategory,
      categoryId: p.categoryId,
      confidence: p.confidence,
      count: 0,
      total: 0,
    };
    s.count++;
    s.total += p.row.amount;
    map.set(key, s);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export interface LegacyImportItem {
  draft: TransactionDraft;
  externalId: string;
}

/**
 * Turns planned rows into balanced transactions.
 * The external id ignores row numbers (rows move when the sheet is sorted) and counts identical
 * rows instead, so importing the same file twice inserts nothing new.
 */
export function buildLegacyImport(
  planned: readonly PlannedRow[],
  accountBySource: Readonly<Partial<Record<LegacySourceKey, string>>>,
): LegacyImportItem[] {
  const seen = new Map<string, number>();
  const items: LegacyImportItem[] = [];
  for (const p of planned) {
    const { row } = p;
    const accountId = accountBySource[row.source];
    if (!accountId) throw new Error(`Chưa chọn tài khoản cho nguồn "${row.source}"`);
    const base = `${row.sheet}|${row.date}|${String(row.amount)}|${normalizeText(row.description)}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);

    const common = {
      date: row.date,
      description: row.description,
      note: [row.note, p.reviewReason, row.legacyCategory ? `Excel: ${row.legacyCategory}` : null]
        .filter(Boolean)
        .join(" · "),
      accountId,
      currency: "VND" as const,
      categoryId: p.categoryId,
      needsReview: p.reviewReason !== null,
    };
    const draft =
      row.amount > 0
        ? buildExpense({ ...common, amount: row.amount })
        : buildRefund({ ...common, amount: -row.amount });
    items.push({ draft, externalId: `legacy-excel:${base}#${String(n)}` });
  }
  return items;
}
