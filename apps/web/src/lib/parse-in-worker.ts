import type { LegacyWorkbook } from "@even/parsers";

type Result = { ok: true; workbook: LegacyWorkbook } | { ok: false; error: string };

export async function parseWorkbookInWorker(file: File): Promise<LegacyWorkbook> {
  const buffer = await file.arrayBuffer();
  const worker = new Worker(new URL("../workers/import.worker.ts", import.meta.url), {
    type: "module",
  });
  try {
    const result = await new Promise<Result>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<Result>) => {
        resolve(e.data);
      };
      worker.onerror = (e) => {
        reject(new Error(e.message));
      };
      worker.postMessage(buffer, [buffer]);
    });
    if (!result.ok) throw new Error(result.error);
    return result.workbook;
  } finally {
    worker.terminate();
  }
}
