/** One run of text on a PDF page, in top-left page coordinates (points). */
export interface PdfToken {
  /** 1-based page number. */
  page: number;
  x0: number;
  x1: number;
  /** Baseline, measured from the top of the page. */
  y: number;
  text: string;
}

/** Tokens that share a baseline (within `tolerance`), left to right. */
export interface PdfLine {
  page: number;
  y: number;
  tokens: PdfToken[];
}

export function groupLines(tokens: readonly PdfToken[], tolerance = 1.5): PdfLine[] {
  const sorted = [...tokens].sort((a, b) => a.page - b.page || a.y - b.y || a.x0 - b.x0);
  const lines: PdfLine[] = [];
  for (const t of sorted) {
    const last = lines.at(-1);
    if (last?.page === t.page && Math.abs(last.y - t.y) <= tolerance) last.tokens.push(t);
    else lines.push({ page: t.page, y: t.y, tokens: [t] });
  }
  for (const l of lines) l.tokens.sort((a, b) => a.x0 - b.x0);
  return lines;
}

export function lineText(line: PdfLine): string {
  return line.tokens.map((t) => t.text).join(" ");
}

const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** "05/09/2026" → "2026-09-05"; null when the text is not a date. */
export function parseDmy(text: string): string | null {
  const m = DATE.exec(text.trim());
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y ?? ""}-${mo ?? ""}-${d ?? ""}`;
}

/** "1,234,567,890" → 1234567890, "-12,345,678" → -12345678; null when not an amount. */
export function parseVnd(text: string): number | null {
  const t = text.trim();
  if (!/^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(t)) return null;
  return Math.round(Number(t.replace(/,/g, "")));
}

/** "12.99 USD" → { amount: 12.99, currency: "USD" }. */
export function parseOriginal(text: string): { amount: number; currency: string } | null {
  const m = /^(-?[\d,]+(?:\.\d+)?)\s+([A-Z]{3})$/.exec(text.trim());
  if (!m) return null;
  return { amount: Number((m[1] ?? "").replace(/,/g, "")), currency: m[2] ?? "" };
}

/** The first token on the same line, to the right of the token that matches `label`. */
export function valueAfter(
  lines: readonly PdfLine[],
  label: RegExp,
  accept: (text: string) => boolean = () => true,
): string | null {
  for (const line of lines) {
    const i = line.tokens.findIndex((t) => label.test(t.text));
    const labelToken = line.tokens[i];
    const match = labelToken ? label.exec(labelToken.text) : null;
    if (!labelToken || !match) continue;
    // The label itself may carry the value after it ("From: 01/09/2026").
    const inline = labelToken.text.slice(match.index + match[0].length).trim();
    if (inline && accept(inline)) return inline;
    const next = line.tokens.slice(i + 1).find((t) => accept(t.text.trim()));
    if (next) return next.text.trim();
  }
  return null;
}
