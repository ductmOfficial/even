/// <reference lib="webworker" />
import { parseLegacyWorkbook } from "@even/parsers";

// Parsing a workbook can take a while on large files; keep it off the main thread.
// The file is read locally and never leaves the device.
self.onmessage = (event: MessageEvent<ArrayBuffer>) => {
  try {
    self.postMessage({ ok: true, workbook: parseLegacyWorkbook(event.data) });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
