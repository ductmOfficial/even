import { describe, expect, it } from "vitest";

import { DEFAULT_RULES, isValidRulePattern, matchRule, type RuleLike } from "./rules";

const rules: RuleLike[] = DEFAULT_RULES.map((r) => ({ ...r, enabled: true }));

describe("matchRule", () => {
  it.each([
    ["Market - Kingfood", "food.groceries"],
    ["Grab Food", "food.delivery"],
    ["Grab bike", "transport.taxi"],
    ["Starbuck cashback", "food.coffee"],
    ["Cà phê sáng", "food.coffee"],
    ["Pharmacity", "medical.pharmacy"],
    ["Shopee", "shopping.online"],
    ["Netflix", "entertainment.streaming"],
  ])("%s → %s", (description, categoryId) => {
    expect(matchRule(description, rules)?.categoryId).toBe(categoryId);
  });

  it("returns null when nothing matches", () => {
    expect(matchRule("Chuyển tiền cho mẹ", rules)).toBeNull();
  });

  it("respects priority and enabled flag", () => {
    const custom: RuleLike[] = [
      {
        id: "a",
        pattern: "shopee",
        matchType: "contains",
        categoryId: "low",
        priority: 100,
        enabled: true,
      },
      {
        id: "b",
        pattern: "shopee",
        matchType: "contains",
        categoryId: "high",
        priority: 1,
        enabled: false,
      },
    ];
    expect(matchRule("Shopee", custom)?.categoryId).toBe("low");
  });

  it("supports regex rules", () => {
    const custom: RuleLike[] = [
      {
        id: "r",
        pattern: "^TT\\s+\\d+",
        matchType: "regex",
        categoryId: "x",
        priority: 1,
        enabled: true,
      },
    ];
    expect(matchRule("TT 123 abc", custom)?.categoryId).toBe("x");
    expect(isValidRulePattern("(", "regex")).toBe(false);
    expect(isValidRulePattern("ok", "contains")).toBe(true);
  });
});
