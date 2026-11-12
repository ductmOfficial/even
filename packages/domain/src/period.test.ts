import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  excelSerialToIso,
  monthRange,
  monthsBetween,
  todayIso,
} from "./period";

describe("period", () => {
  it("computes month ranges including leap years", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange("2028-02").to).toBe("2028-02-29");
  });

  it("adds months across years", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(monthsBetween("2025-11", "2026-02")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("uses Vietnam time for today", () => {
    // 2026-11-08 18:00 UTC is already 2026-11-09 in Saigon.
    expect(todayIso(new Date("2026-11-08T18:00:00Z"))).toBe("2026-11-09");
  });

  it("converts Excel serial dates", () => {
    expect(excelSerialToIso(46053)).toBe("2026-01-31");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
