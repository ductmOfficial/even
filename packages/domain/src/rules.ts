import { normalizeText } from "./text";

export type RuleMatchType = "contains" | "regex";

export interface RuleLike {
  id: string;
  pattern: string;
  matchType: RuleMatchType;
  categoryId: string;
  priority: number;
  enabled: boolean;
}

export interface RuleSeed {
  id: string;
  pattern: string;
  matchType: RuleMatchType;
  categoryId: string;
  priority: number;
}

/**
 * Starter rules for common Vietnamese merchants. `contains` patterns use `|` for alternatives
 * and are matched without diacritics, so "ca phe" also matches "Cà phê".
 */
export const DEFAULT_RULES: readonly RuleSeed[] = [
  {
    id: "rule.groceries",
    pattern: "kingfood|bhx|bach hoa xanh|coop|winmart|lotte mart|go!|emart|aeon|market",
    matchType: "contains",
    categoryId: "food.groceries",
    priority: 10,
  },
  {
    id: "rule.delivery",
    pattern: "grab food|grabfood|be food|befood|shopeefood|shopee food|baemin",
    matchType: "contains",
    categoryId: "food.delivery",
    priority: 5,
  },
  {
    id: "rule.coffee",
    pattern: "starbuck|highlands|phuc long|katinat|cong ca phe|coffee|cafe|ca phe",
    matchType: "contains",
    categoryId: "food.coffee",
    priority: 10,
  },
  {
    id: "rule.eatout",
    pattern: "eat out|nha hang|banh mi|pho |restaurant",
    matchType: "contains",
    categoryId: "food.restaurants",
    priority: 20,
  },
  {
    id: "rule.pharmacy",
    pattern: "pharmacity|long chau|an khang|nha thuoc",
    matchType: "contains",
    categoryId: "medical.pharmacy",
    priority: 10,
  },
  {
    id: "rule.hospital",
    pattern: "benh vien|bv |aih|vinmec|fv |dhyd|phong kham|clinic",
    matchType: "contains",
    categoryId: "medical.treatment",
    priority: 15,
  },
  {
    id: "rule.streaming",
    pattern: "netflix|spotify|youtube premium|apple tv|fpt play",
    matchType: "contains",
    categoryId: "entertainment.streaming",
    priority: 10,
  },
  {
    id: "rule.software",
    pattern: "google one|icloud|chatgpt|openai|github|jetbrains|figma",
    matchType: "contains",
    categoryId: "services.software",
    priority: 10,
  },
  {
    id: "rule.taxi",
    pattern: "grab|xanh sm|be group|gojek",
    matchType: "contains",
    categoryId: "transport.taxi",
    priority: 50,
  },
  {
    id: "rule.fuel",
    pattern: "petrolimex|xang|pvoil",
    matchType: "contains",
    categoryId: "transport.fuel",
    priority: 10,
  },
  {
    id: "rule.electricity",
    pattern: "evn|tien dien",
    matchType: "contains",
    categoryId: "housing.electricity",
    priority: 10,
  },
  {
    id: "rule.water",
    pattern: "tien nuoc|sawaco|cap nuoc",
    matchType: "contains",
    categoryId: "housing.water",
    priority: 10,
  },
  {
    id: "rule.internet",
    pattern: "viettel|vnpt|fpt telecom|mobifone|vinaphone",
    matchType: "contains",
    categoryId: "housing.internet",
    priority: 20,
  },
  {
    id: "rule.rent",
    pattern: "rent fee|tien nha|tien thue",
    matchType: "contains",
    categoryId: "housing.rent",
    priority: 10,
  },
  {
    id: "rule.online",
    pattern: "shopee|tiktok shop|lazada|tiki",
    matchType: "contains",
    categoryId: "shopping.online",
    priority: 60,
  },
  {
    id: "rule.insurance",
    pattern: "bao hiem|insurance|prudential|manulife|aia|pti",
    matchType: "contains",
    categoryId: "services.insurance",
    priority: 30,
  },
  {
    id: "rule.bankfee",
    pattern: "phi duy tri|phi thuong nien|annual fee|sms banking",
    matchType: "contains",
    categoryId: "services.bank_fees",
    priority: 10,
  },
];

const regexCache = new Map<string, RegExp | null>();

function compile(rule: Pick<RuleLike, "pattern" | "matchType">): RegExp | null {
  const key = `${rule.matchType}:${rule.pattern}`;
  if (regexCache.has(key)) return regexCache.get(key) ?? null;
  let re: RegExp | null;
  try {
    if (rule.matchType === "regex") {
      re = new RegExp(rule.pattern, "i");
    } else {
      const alternatives = normalizeText(rule.pattern)
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/[.*+?^${}()[\]\\]/g, "\\$&"));
      re = alternatives.length ? new RegExp(alternatives.join("|")) : null;
    }
  } catch {
    re = null;
  }
  regexCache.set(key, re);
  return re;
}

export function isValidRulePattern(pattern: string, matchType: RuleMatchType): boolean {
  return pattern.trim() !== "" && compile({ pattern, matchType }) !== null;
}

/** Returns the enabled rule with the lowest priority number that matches the description. */
export function matchRule<T extends RuleLike>(description: string, rules: readonly T[]): T | null {
  const normalized = normalizeText(description);
  const sorted = [...rules].filter((r) => r.enabled).sort((a, b) => a.priority - b.priority);
  for (const rule of sorted) {
    const re = compile(rule);
    if (!re) continue;
    const subject = rule.matchType === "regex" ? description : normalized;
    if (re.test(subject)) return rule;
  }
  return null;
}
