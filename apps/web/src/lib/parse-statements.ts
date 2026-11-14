import type { ParsedStatement } from "@even/parsers";

export type StatementResult =
  | { name: string; ok: true; statement: ParsedStatement }
  | { name: string; ok: false; error: string };

/**
 * Reads PDF statements. pdf.js parses each file in its own Web Worker; the files are read
 * locally and never uploaded. pdf.js and the parser load only when a statement is opened.
 */
export async function parseStatements(files: readonly File[]): Promise<StatementResult[]> {
  const [pdfjs, { default: workerUrl }, { parseStatement, readPdfTokens }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    import("@even/parsers/statements"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const results: StatementResult[] = [];
  for (const file of files) {
    try {
      const tokens = await readPdfTokens(new Uint8Array(await file.arrayBuffer()), pdfjs);
      results.push({ name: file.name, ok: true, statement: parseStatement(tokens) });
    } catch (error) {
      results.push({
        name: file.name,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
