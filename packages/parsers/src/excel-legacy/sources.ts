import type { AccountType } from "@even/domain";

/**
 * Where a legacy row was paid from, read from its Note column:
 *
 * - `card:<digits>`: a card or account tagged by its last 3–4 digits (a tag typed twice, such as
 *   `43214321`, counts once)
 * - `credit:<suffix>`: a credit card tagged "Credit", optionally followed by an owner's initial
 *   ("Credit K" → `credit:k`)
 * - `unknown`: no tag
 */
export type LegacySourceKey = `card:${string}` | `credit:${string}` | "unknown";

const CARD = /^(\d{3,4})\1?$/;
const CREDIT = /^credit(?: (\w{1,3}))?$/;

/** Reads a numeric Note cell. Longer numbers are statement totals, not a payment source. */
export function sourceFromNumber(value: number): LegacySourceKey | null {
  if (!Number.isInteger(value) || value < 0) return null;
  const m = CARD.exec(String(value));
  return m ? `card:${m[1] ?? ""}` : null;
}

/** Reads a normalised text Note. Returns null when the note is free text. */
export function sourceFromText(normalized: string): LegacySourceKey | null {
  const card = CARD.exec(normalized);
  if (card) return `card:${card[1] ?? ""}`;
  const credit = CREDIT.exec(normalized);
  if (credit) return `credit:${credit[1] ?? ""}`;
  return null;
}

export function sourceLabel(key: LegacySourceKey): string {
  if (key === "unknown") return "Không ghi nguồn";
  const [kind, tag = ""] = key.split(":");
  if (kind === "card") return `Thẻ/tài khoản đuôi ${tag}`;
  return tag
    ? `Thẻ tín dụng (ghi chú “Credit ${tag.toUpperCase()}”)`
    : "Thẻ tín dụng (ghi chú “Credit”)";
}

export interface SuggestedAccount {
  name: string;
  type: AccountType;
  last4?: string;
  aliases?: string[];
}

/** The account the import screen proposes to create when the user has none to map to. */
export function suggestAccount(key: LegacySourceKey): SuggestedAccount {
  if (key === "unknown") return { name: "Chưa rõ nguồn (Excel)", type: "cash" };
  const [kind, tag = ""] = key.split(":");
  if (kind === "card") return { name: `Thẻ ${tag}`, type: "bank", last4: tag };
  return tag
    ? { name: `Thẻ tín dụng ${tag.toUpperCase()}`, type: "credit_card", aliases: [`credit${tag}`] }
    : { name: "Thẻ tín dụng", type: "credit_card", aliases: ["credit"] };
}
