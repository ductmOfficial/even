import { normalizeText, UNCATEGORIZED_ID } from "@even/domain";

/**
 * Maps the hand-written "Danh mục chi tiêu" of the old Finance spreadsheet to the new tree.
 * A legacy category maps to a default (sometimes a primary category when it was too broad)
 * plus optional refinements matched against the row's description.
 */
interface Refinement {
  pattern: string;
  categoryId: string;
}

interface LegacyMapping {
  categoryId: string;
  /** The legacy category mixed several things; flag rows that no refinement matched. */
  broad?: boolean;
  /** The legacy category is really a transfer (savings, investing): needs a human decision. */
  transfer?: boolean;
  refine?: Refinement[];
}

const MEDICAL: Refinement[] = [
  { pattern: "pharmacity|long chau|an khang|nha thuoc", categoryId: "medical.pharmacy" },
  { pattern: "vnvc|vacxin|vaccine|tiem", categoryId: "medical.checkup" },
  { pattern: "aih|benh vien|bv |dhyd|vinmec|kham|phong kham", categoryId: "medical.treatment" },
];

export const LEGACY_CATEGORY_MAP: Readonly<Record<string, LegacyMapping>> = {
  "Ăn uống ở nhà": { categoryId: "food.groceries" },
  "Ăn uống bên ngoài": {
    categoryId: "food.restaurants",
    refine: [
      { pattern: "grab food|grabfood|be food|shopeefood|baemin", categoryId: "food.delivery" },
      {
        pattern: "starbuck|coffee|cafe|ca phe|americano|highlands|phuc long|katinat",
        categoryId: "food.coffee",
      },
    ],
  },
  "Đi lại (xăng xe, vé xe, bảo trì phương tiện)": {
    categoryId: "transport",
    broad: true,
    refine: [
      { pattern: "xang|petrolimex", categoryId: "transport.fuel" },
      { pattern: "grab|be |xanh sm|taxi", categoryId: "transport.taxi" },
      { pattern: "gui xe|parking|ve xe", categoryId: "transport.parking" },
    ],
  },
  "Mua sắm (quần áo, đồ gia dụng)": {
    categoryId: "shopping",
    broad: true,
    refine: [
      { pattern: "shopee|tiktok|lazada|tiki", categoryId: "shopping.online" },
      { pattern: "uniqlo|zara|h&m|quan ao|giay", categoryId: "shopping.clothing" },
      { pattern: "thebodyshop|body shop|my pham", categoryId: "personal_care.beauty" },
      { pattern: "kingfood|bhx|coop|winmart|aeon|market", categoryId: "food.groceries" },
    ],
  },
  "Giải trí (phim ảnh, ...)": {
    categoryId: "entertainment",
    broad: true,
    refine: [
      { pattern: "netflix|spotify|youtube|fpt play", categoryId: "entertainment.streaming" },
      { pattern: "cgv|lotte cinema|galaxy|bhd|ve", categoryId: "entertainment.events" },
    ],
  },
  "Du lịch": {
    categoryId: "travel",
    broad: true,
    refine: [
      {
        pattern: "ve may bay|vietjet|vietnam airlines|bamboo|flight",
        categoryId: "travel.flights",
      },
      { pattern: "khach san|hotel|resort|homestay|agoda|booking", categoryId: "travel.lodging" },
      { pattern: "food|an |eat", categoryId: "food.restaurants" },
    ],
  },
  "Tiền nhà (thuê/mua nhà, vay ngân hàng)": { categoryId: "housing.rent" },
  "Điện, nước, internet": {
    categoryId: "housing",
    broad: true,
    refine: [
      { pattern: "dien|evn", categoryId: "housing.electricity" },
      { pattern: "nuoc", categoryId: "housing.water" },
      { pattern: "internet|vnpt|viettel|fpt|vinaphone|mobifone", categoryId: "housing.internet" },
    ],
  },
  "Học phí (cho bản thân hoặc con cái)": {
    categoryId: "education.tuition",
    refine: [{ pattern: "khai sinh|giay to|cong chung|thue", categoryId: "services.government" }],
  },
  "Bảo hiểm (sức khỏe, nhân thọ, xe cộ)": { categoryId: "services.insurance" },
  "Quà tặng (sinh nhật, lễ tết)": { categoryId: "giving.gifts" },
  "Tiệc tùng, sự kiện gia đình": { categoryId: "family.occasions" },
  "Chăm sóc người thân (cha mẹ, con cái)": {
    categoryId: "family",
    broad: true,
    refine: [
      ...MEDICAL,
      { pattern: "tam be|cham soc be|giu tre|bao mau", categoryId: "family.childcare" },
      {
        pattern: "shopee|tiktok|lazada|concung|con cung|bibo|kids",
        categoryId: "family.kids_supplies",
      },
    ],
  },
  "Sách, khóa học": { categoryId: "education.books_courses" },
  "Tham gia hội thảo, sự kiện": { categoryId: "education.conferences" },
  "Công cụ làm việc, phần mềm": { categoryId: "services.software" },
  "Ủng hộ từ thiện": { categoryId: "giving.charity" },
  "Đóng góp cộng đồng": { categoryId: "giving.community" },
  "Khám sức khỏe định kỳ": { categoryId: "medical.checkup" },
  "Mua thực phẩm chức năng": { categoryId: "medical.supplements" },
  "Làm đẹp (spa, mỹ phẩm)": { categoryId: "personal_care.beauty" },
  "Chi phí chữa bệnh": {
    categoryId: "medical.treatment",
    refine: [{ pattern: "pharmacity|long chau|nha thuoc", categoryId: "medical.pharmacy" }],
  },
  "Quỹ khẩn cấp": { categoryId: UNCATEGORIZED_ID, transfer: true },
  "Tiết kiệm hưu trí": { categoryId: UNCATEGORIZED_ID, transfer: true },
  "Đầu tư (chứng khoán, vàng, bất động sản)": { categoryId: UNCATEGORIZED_ID, transfer: true },
};

/** Descriptions that usually mean money moved between own accounts, not spending. */
const TRANSFER_HINT = /\b(timo|transfer|chuyen khoan|chuyen tien|rut tien|nap tien|top ?up)\b/;

export type MappingConfidence = "exact" | "refined" | "broad" | "none";

export interface ResolvedCategory {
  categoryId: string;
  confidence: MappingConfidence;
  /** Why the row needs a human look, if it does. */
  reviewReason: string | null;
}

function matches(pattern: string, normalizedDescription: string): boolean {
  return pattern.split("|").some((p) => normalizedDescription.includes(p));
}

export function resolveLegacyCategory(
  legacyCategory: string | null,
  description: string,
  overrides: Readonly<Record<string, string>> = {},
): ResolvedCategory {
  const text = ` ${normalizeText(description)} `;
  const transferHint = TRANSFER_HINT.test(text) ? "Có thể là chuyển tiền giữa các tài khoản" : null;

  if (!legacyCategory || legacyCategory === "Unknown") {
    return {
      categoryId: UNCATEGORIZED_ID,
      confidence: "none",
      reviewReason: transferHint ?? "Chưa có danh mục",
    };
  }
  const override = overrides[legacyCategory];
  if (override) {
    return { categoryId: override, confidence: "exact", reviewReason: transferHint };
  }
  const mapping = LEGACY_CATEGORY_MAP[legacyCategory];
  if (!mapping) {
    return {
      categoryId: UNCATEGORIZED_ID,
      confidence: "none",
      reviewReason: `Danh mục cũ "${legacyCategory}" chưa được ánh xạ`,
    };
  }
  if (mapping.transfer) {
    return {
      categoryId: mapping.categoryId,
      confidence: "none",
      reviewReason: `"${legacyCategory}" là chuyển tiền sang tiết kiệm/đầu tư, không phải chi tiêu`,
    };
  }
  const refinement = mapping.refine?.find((r) => matches(r.pattern, text));
  if (refinement) {
    return { categoryId: refinement.categoryId, confidence: "refined", reviewReason: transferHint };
  }
  if (mapping.broad) {
    return {
      categoryId: mapping.categoryId,
      confidence: "broad",
      reviewReason:
        transferHint ?? `Danh mục cũ "${legacyCategory}" quá rộng, nên chọn mục chi tiết`,
    };
  }
  return { categoryId: mapping.categoryId, confidence: "exact", reviewReason: transferHint };
}
