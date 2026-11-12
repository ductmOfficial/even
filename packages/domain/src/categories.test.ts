import { describe, expect, it } from "vitest";

import {
  buildCategoryTree,
  categoryPath,
  DEFAULT_CATEGORIES,
  flattenTree,
  rollUp,
  rootCategoryId,
  UNCATEGORIZED_ID,
} from "./categories";

const byId = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c]));

describe("default categories", () => {
  it("has unique ids and valid parents", () => {
    expect(new Set(DEFAULT_CATEGORIES.map((c) => c.id)).size).toBe(DEFAULT_CATEGORIES.length);
    for (const c of DEFAULT_CATEGORIES) {
      if (c.parentId) expect(byId.has(c.parentId)).toBe(true);
    }
    expect(byId.get(UNCATEGORIZED_ID)?.system).toBe(true);
  });

  it("inherits nature and bucket from the primary", () => {
    expect(byId.get("housing.rent")).toMatchObject({ nature: "fixed", bucket: "need" });
    expect(byId.get("food.coffee")).toMatchObject({ nature: "variable", bucket: "want" });
  });
});

describe("tree helpers", () => {
  it("builds a sorted tree with depth", () => {
    const tree = buildCategoryTree(DEFAULT_CATEGORIES);
    expect(tree[0]?.category.id).toBe("food");
    const flat = flattenTree(tree);
    expect(flat.find((n) => n.category.id === "food.groceries")?.depth).toBe(1);
    expect(flat).toHaveLength(DEFAULT_CATEGORIES.length);
  });

  it("supports deeper custom levels", () => {
    const items = [
      ...DEFAULT_CATEGORIES,
      { id: "custom", parentId: "food.groceries", name: "Rau củ", sort: 0 },
    ];
    const m = new Map(items.map((c) => [c.id, c]));
    expect(categoryPath("custom", m)).toBe("Ăn uống › Siêu thị & chợ › Rau củ");
    expect(rootCategoryId("custom", m)).toBe("food");
    const totals = rollUp(
      new Map([
        ["custom", 100],
        ["food.coffee", 50],
      ]),
      m,
    );
    expect(totals.get("food")).toBe(150);
    expect(totals.get("food.groceries")).toBe(100);
  });
});
