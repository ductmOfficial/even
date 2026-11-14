import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { degrees, PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { readPdfTokens } from "./pdf";

/** A two-page PDF; the second page is stored portrait and rotated, as landscape statements are. */
async function samplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const first = doc.addPage([400, 300]);
  first.drawText("Transaction Date", { x: 20, y: 250, size: 10, font });
  first.drawText("1,000", { x: 300, y: 250, size: 10, font });
  const second = doc.addPage([300, 400]);
  second.setRotation(degrees(90));
  // In a page rotated 90° clockwise, text drawn rotated 90° reads left to right on screen.
  second.drawText("05/09/2026", { x: 50, y: 20, size: 10, font, rotate: degrees(90) });
  return doc.save();
}

describe("readPdfTokens", () => {
  it("returns text runs in reading coordinates, including rotated pages", async () => {
    const tokens = await readPdfTokens(await samplePdf(), pdfjs);
    expect(tokens.map((t) => [t.page, t.text])).toEqual([
      [1, "Transaction Date"],
      [1, "1,000"],
      [2, "05/09/2026"],
    ]);
    const [date, amount, rotated] = tokens;
    expect(date?.y).toBeCloseTo(50, 0);
    expect(amount?.x0).toBeCloseTo(300, 0);
    expect(amount?.x1).toBeGreaterThan(amount?.x0 ?? 0);
    // Rotated 90°: what was x on the stored page is now the distance from the top.
    expect(rotated?.x0).toBeCloseTo(20, 0);
    expect(rotated?.y).toBeCloseTo(50, 0);
  });
});
