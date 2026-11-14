import { parseDmy, type PdfLine, type PdfToken } from "./tokens";

export interface Column {
  key: string;
  /** Tokens starting at or right of `from` (and left of the next column) belong here. */
  from: number;
}

export interface TableRow {
  page: number;
  y: number;
  cells: Record<string, string[]>;
  /** Tokens per column, for callers that need positions. */
  tokens: Record<string, PdfToken[]>;
}

export interface TableOptions {
  /** Finds the header line on a page; table rows start below it. */
  isHeader: (line: PdfLine) => boolean;
  /** Builds the columns from the header line. */
  columns: (header: PdfLine) => Column[];
  /** Lines from which the table stops, on this page (footer) or for good (end of the list). */
  isPageEnd: (line: PdfLine) => boolean;
  isTableEnd: (line: PdfLine) => boolean;
  /** Lines inside the table to ignore (e.g. the opening balance). */
  skip?: (line: PdfLine) => boolean;
  /** The column whose dates start a row. */
  anchorColumn: string;
  /** Decides the column of a token; defaults to the last column whose `from` ≤ x0. */
  columnOf?: (token: PdfToken, columns: Column[]) => string | undefined;
}

function defaultColumnOf(token: PdfToken, columns: Column[]): string | undefined {
  let key: string | undefined;
  for (const c of columns) if (token.x0 >= c.from) key = c.key;
  return key;
}

/**
 * Reads a table whose cells wrap onto several lines. A row starts at each date in the anchor
 * column; every other line of the table belongs to the row whose anchor is nearest vertically,
 * since the bank centres wrapped cells on the row.
 */
export function readTable(lines: readonly PdfLine[], options: TableOptions): TableRow[] {
  const columnOf = options.columnOf ?? defaultColumnOf;
  const rows: TableRow[] = [];
  let columns: Column[] | null = null;
  const pages = [...new Set(lines.map((l) => l.page))];

  for (const page of pages) {
    const pageLines = lines.filter((l) => l.page === page);
    const headerIndex = pageLines.findIndex(options.isHeader);
    if (headerIndex >= 0) {
      const header = pageLines[headerIndex];
      if (header) columns = options.columns(header);
    }
    if (!columns) continue;
    const cols = columns;
    const body: PdfLine[] = [];
    let ended = false;
    for (const line of pageLines.slice(headerIndex + 1)) {
      if (options.isTableEnd(line)) {
        ended = true;
        break;
      }
      if (options.isPageEnd(line)) break;
      if (options.skip?.(line)) continue;
      body.push(line);
    }

    const placed = body.flatMap((line) =>
      line.tokens.map((token) => ({ token, column: columnOf(token, cols) })),
    );
    const anchors = placed.filter(
      (p) => p.column === options.anchorColumn && parseDmy(p.token.text) !== null,
    );
    const pageRows: TableRow[] = anchors.map((a) => ({
      page,
      y: a.token.y,
      cells: {},
      tokens: {},
    }));
    for (const p of placed) {
      if (!p.column || pageRows.length === 0) continue;
      let nearest = pageRows[0];
      for (const r of pageRows) {
        if (nearest && Math.abs(r.y - p.token.y) < Math.abs(nearest.y - p.token.y)) nearest = r;
      }
      if (!nearest) continue;
      (nearest.tokens[p.column] ??= []).push(p.token);
    }
    for (const r of pageRows) {
      for (const [key, tokens] of Object.entries(r.tokens)) {
        tokens.sort((a, b) => a.y - b.y || a.x0 - b.x0);
        r.cells[key] = tokens.map((t) => t.text.trim()).filter(Boolean);
      }
    }
    rows.push(...pageRows);
    if (ended) break;
  }
  return rows;
}

export function cell(row: TableRow, key: string): string {
  return (row.cells[key] ?? []).join(" ").replace(/\s+/g, " ").trim();
}
