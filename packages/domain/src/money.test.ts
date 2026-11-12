import { describe, expect, it } from "vitest";

import { formatMoney, fromMinor, parseAmount, toBase, toMinor } from "./money";

describe("parseAmount", () => {
  it.each([
    ["120k", 120_000],
    ["120K", 120_000],
    ["1.5tr", 1_500_000],
    ["1,5tr", 1_500_000],
    ["2 tỷ", 2_000_000_000],
    ["120.000", 120_000],
    ["1.234.567", 1_234_567],
    ["120,000", 120_000],
    ["50000đ", 50_000],
    ["-30k", -30_000],
    ["1tr2", null],
    ["abc", null],
    ["", null],
  ])("%s → %s", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it("treats a single separator as decimal for USD", () => {
    expect(parseAmount("12.5", "USD")).toBe(12.5);
    expect(parseAmount("1,234.56", "USD")).toBe(1234.56);
    expect(parseAmount("$40", "USD")).toBe(40);
  });
});

describe("conversion", () => {
  it("converts between major and minor units", () => {
    expect(toMinor(12.34, "USD")).toBe(1234);
    expect(fromMinor(1234, "USD")).toBe(12.34);
    expect(toMinor(1000, "VND")).toBe(1000);
  });

  it("converts USD cents to VND with a rate", () => {
    expect(toBase(100_000, "USD", 26_300)).toBe(26_300_000);
    expect(toBase(5_000, "VND", 26_300)).toBe(5_000);
  });
});

describe("formatMoney", () => {
  it("formats VND with Vietnamese grouping", () => {
    expect(formatMoney(1_234_567).replace(/\s/g, " ")).toBe("1.234.567 ₫");
  });

  it("adds a plus sign when asked", () => {
    expect(formatMoney(5_000, "VND", { signed: true }).startsWith("+")).toBe(true);
  });

  it("formats USD from cents", () => {
    expect(formatMoney(1234, "USD")).toBe("$12.34");
  });
});
