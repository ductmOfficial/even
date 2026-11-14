import type { PdfToken } from "./tokens";

/** The parts of pdf.js this module uses, passed in so it runs in Node and in a browser worker. */
export interface PdfJs {
  getDocument: (src: { data: Uint8Array; verbosity?: number; isEvalSupported?: boolean }) => {
    promise: Promise<PdfDocument>;
  };
  Util: { transform: (a: number[], b: number[]) => number[] };
}

interface PdfDocument {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
}

interface PdfPage {
  getViewport: (o: { scale: number }) => { transform: number[] };
  getTextContent: () => Promise<{ items: unknown[] }>;
}

interface TextItem {
  str: string;
  transform: number[];
  width: number;
}

const isTextItem = (item: unknown): item is TextItem =>
  typeof item === "object" && item !== null && "str" in item && "transform" in item;

/**
 * Text runs of every page in top-left coordinates. Rotated pages (statements printed in
 * landscape) come out the way they are read.
 */
export async function readPdfTokens(data: Uint8Array, pdfjs: PdfJs): Promise<PdfToken[]> {
  const doc = await pdfjs.getDocument({ data, verbosity: 0, isEvalSupported: false }).promise;
  const tokens: PdfToken[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const { items } = await page.getTextContent();
      for (const item of items) {
        if (!isTextItem(item) || !item.str.trim()) continue;
        const [, , , , x, y] = pdfjs.Util.transform(viewport.transform, item.transform);
        if (x === undefined || y === undefined) continue;
        tokens.push({ page: n, x0: x, x1: x + item.width, y, text: item.str });
      }
    }
  } finally {
    await doc.destroy();
  }
  return tokens;
}
