import type { AccountLike } from "./accounts";
import { parseAmount } from "./money";
import { addDays, todayIso } from "./period";
import { normalizeText } from "./text";

export interface QuickEntry {
  description: string;
  /** Major units (VND). */
  amount: number | null;
  accountId: string | null;
  date: string;
}

const RELATIVE_DAYS: Record<string, number> = {
  "hom nay": 0,
  homnay: 0,
  "hom qua": -1,
  homqua: -1,
  hqua: -1,
  "hom kia": -2,
};

/**
 * Parses a one-line entry such as "grab 120k 4321 hôm qua" or "Kingfood 1,2tr credit 5/11".
 * Tokens that look like an amount, an account (last 4 digits / alias / name) or a date are pulled
 * out; the rest becomes the description.
 */
export function parseQuickEntry(
  input: string,
  accounts: readonly AccountLike[],
  today: string = todayIso(),
): QuickEntry {
  // NFC keeps "hôm" at 3 code units so indices in the normalized copy line up with `text`.
  let text = ` ${input.normalize("NFC").trim()} `;
  let date = today;

  const normalized = ` ${normalizeText(text)} `;
  for (const [phrase, delta] of Object.entries(RELATIVE_DAYS)) {
    const idx = normalized.indexOf(` ${phrase} `);
    if (idx >= 0) {
      date = addDays(today, delta);
      text = `${text.slice(0, idx)} ${text.slice(idx + phrase.length + 1)}`;
      break;
    }
  }

  const tokens = text.split(/\s+/).filter(Boolean);
  const rest: string[] = [];
  let amount: number | null = null;
  let accountId: string | null = null;

  for (const token of tokens) {
    const dm = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(token);
    if (dm) {
      const year = dm[3] ? (dm[3].length === 2 ? `20${dm[3]}` : dm[3]) : today.slice(0, 4);
      date = `${year}-${dm[2]?.padStart(2, "0") ?? ""}-${dm[1]?.padStart(2, "0") ?? ""}`;
      continue;
    }
    if (accountId === null) {
      const t = normalizeText(token);
      const match = accounts.find(
        (a) =>
          a.last4?.toLowerCase() === t ||
          (a.aliases?.some((alias) => normalizeText(alias) === t) ?? false),
      );
      if (match) {
        accountId = match.id;
        continue;
      }
    }
    if (amount === null && /\d/.test(token)) {
      const parsed = parseAmount(token);
      if (parsed !== null && parsed > 0) {
        amount = parsed;
        continue;
      }
    }
    rest.push(token);
  }

  return { description: rest.join(" "), amount, accountId, date };
}
