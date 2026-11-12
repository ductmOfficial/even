/**
 * Money is stored as integers in the currency's minor unit (VND: đồng, USD: cent).
 * JS numbers hold integers exactly up to 2^53 (~9 triệu tỷ đồng), far beyond a household ledger,
 * so we keep plain `number` and guard every value with `assertMinor`. See ADR 0003.
 */
export const CURRENCIES = ["VND", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const BASE_CURRENCY: Currency = "VND";

const MINOR_DIGITS: Record<Currency, number> = { VND: 0, USD: 2 };

export function minorDigits(currency: Currency): number {
  return MINOR_DIGITS[currency];
}

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

export function assertMinor(value: number, label = "amount"): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer in minor units, got ${String(value)}`);
  }
}

/** 12.34 USD → 1234 */
export function toMinor(major: number, currency: Currency): number {
  return Math.round(major * 10 ** MINOR_DIGITS[currency]);
}

/** 1234 (USD) → 12.34 */
export function fromMinor(minor: number, currency: Currency): number {
  return minor / 10 ** MINOR_DIGITS[currency];
}

/**
 * Converts an amount to the base currency (VND).
 * `rate` is VND per 1 unit of `currency` (e.g. 26_300 for USD).
 */
export function toBase(minor: number, currency: Currency, rate: number): number {
  if (currency === BASE_CURRENCY) return minor;
  return Math.round(fromMinor(minor, currency) * rate);
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: Currency, compact: boolean): Intl.NumberFormat {
  const key = `${currency}:${String(compact)}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(currency === "VND" ? "vi-VN" : "en-US", {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : MINOR_DIGITS[currency],
    });
    formatters.set(key, f);
  }
  return f;
}

export interface FormatOptions {
  /** Shorten large numbers: 1.234.567 ₫ → 1,2 Tr ₫ */
  compact?: boolean;
  /** Always show a sign, e.g. +120.000 ₫ */
  signed?: boolean;
}

export function formatMoney(
  minor: number,
  currency: Currency = "VND",
  options: FormatOptions = {},
) {
  const text = formatter(currency, options.compact ?? false).format(fromMinor(minor, currency));
  if (options.signed && minor > 0) return `+${text}`;
  return text;
}

/** Plain grouped number without currency symbol: 1234567 → "1.234.567" */
export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits }).format(value);
}

const SUFFIXES: Record<string, number> = {
  k: 1e3,
  n: 1e3,
  ng: 1e3,
  nghin: 1e3,
  nghìn: 1e3,
  tr: 1e6,
  m: 1e6,
  trieu: 1e6,
  triệu: 1e6,
  ty: 1e9,
  tỷ: 1e9,
  tỉ: 1e9,
  b: 1e9,
};

/**
 * Parses amounts the way people type them in Vietnam, returning major units.
 * "120k" → 120000, "1.5tr" / "1,5tr" → 1500000, "120.000" → 120000, "12.5" (USD) → 12.5.
 * Returns null when the text is not an amount.
 */
export function parseAmount(input: string, currency: Currency = "VND"): number | null {
  const text = input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[₫đ$]|vnd|usd/g, "");
  const match = /^(-)?([\d.,]+)([a-zỳ-ỹà-ạăâđêôơư]*)$/u.exec(text);
  if (!match) return null;
  const [, minus, digits = "", suffix = ""] = match;
  const multiplier = suffix === "" ? 1 : SUFFIXES[suffix];
  if (multiplier === undefined) return null;

  let normalized: string;
  if (multiplier > 1 || currency !== "VND") {
    // With a suffix or for decimal currencies, a single , or . is the decimal separator.
    const separators = digits.match(/[.,]/g) ?? [];
    if (separators.length === 1) {
      normalized = digits.replace(",", ".");
    } else {
      // "1,234.56" or "1.234,56": the last separator is decimal.
      const last = Math.max(digits.lastIndexOf("."), digits.lastIndexOf(","));
      normalized =
        separators.length === 0
          ? digits
          : `${digits.slice(0, last).replace(/[.,]/g, "")}.${digits.slice(last + 1)}`;
    }
  } else {
    // VND has no decimals: every separator is a thousands separator.
    normalized = digits.replace(/[.,]/g, "");
  }
  if (normalized === "" || normalized === ".") return null;
  const value = Number(normalized) * multiplier;
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value * 10 ** MINOR_DIGITS[currency]) / 10 ** MINOR_DIGITS[currency];
  return minus ? -rounded : rounded;
}
