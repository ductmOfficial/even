import { validateTransaction, UNCATEGORIZED_ID } from "@even/domain";
import { utils, write } from "@e965/xlsx";
import { describe, expect, it } from "vitest";

import { resolveLegacyCategory } from "./categories";
import { parseLegacyWorkbook } from "./parse";
import { buildLegacyImport, resolveRows, summarizeMapping, summarizeSources } from "./plan";
import { sourceFromNumber, sourceFromText, sourceLabel, suggestAccount } from "./sources";

/** Builds a small workbook shaped like the old Finance sheet (fictional data). */
function fixture(): Uint8Array {
  const wb = utils.book_new();
  const header = [" ", "Name", "Category", "Category Group", "Invest Category", "Value", "Note"];
  const jan = utils.aoa_to_sheet([
    header,
    [46053, "Market - Kingfood", "Ăn uống ở nhà", "", "", 320000, "Credit B"],
    [46040, "Grab Food", "Ăn uống bên ngoài", "", "", 124350, 4321],
    [46041, "Shopee", "Chăm sóc người thân (cha mẹ, con cái)", "", "", 99000, "Credit"],
    [46042, "Pharmacity", "Chăm sóc người thân (cha mẹ, con cái)", "", "", 87000, "Quà sinh nhật"],
    [46043, "Starbuck cashback", "Ăn uống bên ngoài", "", "", -660000, null],
    [46044, "Timo", "Mua sắm (quần áo, đồ gia dụng)", "", "", 1000000, 567567],
    [46045, "Không danh mục", null, "", "", 50000, 9504155],
    [46046, "Không tiền", "Du lịch", "", "", null, null],
    [null, null, null, null, null, null, null],
    [46047, "Grab Food", "Ăn uống bên ngoài", "", "", 124350, 4321],
  ]);
  utils.book_append_sheet(wb, jan, "Jan");
  utils.book_append_sheet(
    wb,
    utils.aoa_to_sheet([
      ["Name", "Group"],
      ["Ăn uống", "x"],
    ]),
    "Danh mục",
  );
  return write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

describe("parseLegacyWorkbook", () => {
  const book = parseLegacyWorkbook(fixture());

  it("reads monthly sheets only and skips invalid rows with warnings", () => {
    expect(book.sheets).toEqual([{ name: "Jan", count: 8, total: 1_144_700 }]);
    expect(book.warnings).toEqual(['Jan!F9: "Không tiền" không có số tiền, bỏ qua']);
  });

  it("converts dates and detects payment sources", () => {
    expect(book.rows[0]).toMatchObject({
      date: "2026-01-31",
      source: "credit:b",
      amount: 320_000,
    });
    expect(book.rows.map((r) => r.source)).toEqual([
      "credit:b",
      "card:4321",
      "credit:",
      "unknown",
      "unknown",
      "card:567",
      "unknown",
      "card:4321",
    ]);
    expect(book.rows[3]?.note).toBe("Quà sinh nhật");
    expect(summarizeSources(book.rows)[0]).toMatchObject({ key: "unknown", count: 3 });
  });
});

describe("resolveLegacyCategory", () => {
  it.each([
    ["Ăn uống ở nhà", "Market - Kingfood", "food.groceries", "exact"],
    ["Ăn uống bên ngoài", "Grab Food", "food.delivery", "refined"],
    ["Chăm sóc người thân (cha mẹ, con cái)", "Pharmacity", "medical.pharmacy", "refined"],
    ["Chăm sóc người thân (cha mẹ, con cái)", "Shopee", "family.kids_supplies", "refined"],
    ["Chăm sóc người thân (cha mẹ, con cái)", "Quà cho mẹ", "family", "broad"],
    ["Học phí (cho bản thân hoặc con cái)", "Khai sinh", "services.government", "refined"],
    [null, "x", UNCATEGORIZED_ID, "none"],
  ])("%s / %s → %s", (legacy, description, categoryId, confidence) => {
    expect(resolveLegacyCategory(legacy, description)).toMatchObject({ categoryId, confidence });
  });

  it("flags transfers and savings", () => {
    expect(resolveLegacyCategory("Mua sắm (quần áo, đồ gia dụng)", "Timo").reviewReason).toMatch(
      /chuyển tiền/,
    );
    expect(resolveLegacyCategory("Quỹ khẩn cấp", "Gửi quỹ").reviewReason).toMatch(/tiết kiệm/);
  });

  it("applies user overrides", () => {
    expect(
      resolveLegacyCategory("Du lịch", "Đà Lạt", { "Du lịch": "travel.tours" }).categoryId,
    ).toBe("travel.tours");
  });
});

describe("buildLegacyImport", () => {
  const book = parseLegacyWorkbook(fixture());
  const planned = resolveRows(book.rows);
  const accounts = {
    "credit:b": "acc-b",
    "card:4321": "acc-4321",
    "credit:": "acc-c",
    "card:567": "acc-567",
    unknown: "acc-u",
  };

  it("creates balanced expenses and refunds", () => {
    const items = buildLegacyImport(planned, accounts);
    expect(items).toHaveLength(8);
    for (const item of items) validateTransaction(item.draft);
    const refund = items[4];
    expect(refund?.draft.kind).toBe("refund");
    expect(refund?.draft.needsReview).toBe(true);
    expect(refund?.draft.postings.find((p) => p.categoryId)?.baseAmount).toBe(-660_000);
  });

  it("keeps the old category in the note and flags rows to review", () => {
    const items = buildLegacyImport(planned, accounts);
    expect(items[0]?.draft.note).toBe("Excel: Ăn uống ở nhà");
    expect(items[0]?.draft.needsReview).toBe(false);
    expect(items[5]?.draft.needsReview).toBe(true);
  });

  it("produces stable, unique external ids for identical rows", () => {
    const a = buildLegacyImport(planned, accounts).map((i) => i.externalId);
    const b = buildLegacyImport(planned, accounts).map((i) => i.externalId);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });

  it("requires an account for every source", () => {
    expect(() => buildLegacyImport(planned, { "card:4321": "x" })).toThrow(/Chưa chọn tài khoản/);
  });

  it("summarises the mapping for the preview", () => {
    const summary = summarizeMapping(planned);
    expect(summary.find((s) => s.categoryId === "food.delivery")).toMatchObject({ count: 2 });
  });
});

describe("payment sources", () => {
  it("reads card tags from numbers and text", () => {
    expect(sourceFromNumber(4321)).toBe("card:4321");
    expect(sourceFromNumber(567567)).toBe("card:567");
    expect(sourceFromNumber(9_504_155)).toBeNull();
    expect(sourceFromNumber(12.5)).toBeNull();
    expect(sourceFromText("4321")).toBe("card:4321");
  });

  it("reads credit card tags and leaves free text alone", () => {
    expect(sourceFromText("credit")).toBe("credit:");
    expect(sourceFromText("credit b")).toBe("credit:b");
    expect(sourceFromText("qua sinh nhat")).toBeNull();
  });

  it("labels sources and suggests accounts", () => {
    expect(sourceLabel("card:4321")).toBe("Thẻ/tài khoản đuôi 4321");
    expect(sourceLabel("credit:b")).toBe("Thẻ tín dụng (ghi chú “Credit B”)");
    expect(suggestAccount("card:4321")).toEqual({ name: "Thẻ 4321", type: "bank", last4: "4321" });
    expect(suggestAccount("credit:")).toMatchObject({ type: "credit_card", aliases: ["credit"] });
    expect(suggestAccount("credit:b")).toMatchObject({
      name: "Thẻ tín dụng B",
      aliases: ["creditb"],
    });
    expect(suggestAccount("unknown").type).toBe("cash");
  });
});
