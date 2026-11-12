/**
 * Default category tree, adapted from Plaid's Personal Finance Category (PFC) taxonomy
 * (primary → detailed), localised for Vietnam, plus a "Gia đình & con cái" primary that PFC lacks.
 * Seeded ids are stable keys ("food.groceries") so rules and imports can reference them.
 * Users can add deeper levels; the tree has no depth limit.
 */
export type CategoryKind = "expense" | "income";
/** Fixed costs repeat with a stable amount (rent); variable costs move month to month. */
export type CategoryNature = "fixed" | "variable";
/** 50/30/20 bucket. */
export type CategoryBucket = "need" | "want" | "save";

export interface CategorySeed {
  id: string;
  parentId: string | null;
  name: string;
  kind: CategoryKind;
  nature: CategoryNature | null;
  bucket: CategoryBucket | null;
  icon: string | null;
  plaid: string | null;
  sort: number;
  system: boolean;
}

interface Node {
  key: string;
  name: string;
  icon?: string;
  plaid?: string;
  nature?: CategoryNature;
  bucket?: CategoryBucket;
  children?: Node[];
}

const EXPENSE: Node[] = [
  {
    key: "food",
    name: "Ăn uống",
    icon: "utensils",
    plaid: "FOOD_AND_DRINK",
    nature: "variable",
    bucket: "need",
    children: [
      { key: "groceries", name: "Siêu thị & chợ", plaid: "FOOD_AND_DRINK_GROCERIES" },
      {
        key: "restaurants",
        name: "Nhà hàng & quán ăn",
        plaid: "FOOD_AND_DRINK_RESTAURANT",
        bucket: "want",
      },
      { key: "coffee", name: "Cà phê & đồ uống", plaid: "FOOD_AND_DRINK_COFFEE", bucket: "want" },
      { key: "delivery", name: "Giao đồ ăn", plaid: "FOOD_AND_DRINK_FAST_FOOD", bucket: "want" },
    ],
  },
  {
    key: "housing",
    name: "Nhà ở",
    icon: "home",
    plaid: "RENT_AND_UTILITIES",
    nature: "fixed",
    bucket: "need",
    children: [
      { key: "rent", name: "Tiền thuê nhà", plaid: "RENT_AND_UTILITIES_RENT" },
      { key: "electricity", name: "Điện", plaid: "RENT_AND_UTILITIES_GAS_AND_ELECTRICITY" },
      { key: "water", name: "Nước", plaid: "RENT_AND_UTILITIES_WATER" },
      {
        key: "internet",
        name: "Internet & điện thoại",
        plaid: "RENT_AND_UTILITIES_INTERNET_AND_CABLE",
      },
      {
        key: "service_fee",
        name: "Phí quản lý & dịch vụ",
        plaid: "RENT_AND_UTILITIES_OTHER_UTILITIES",
      },
      {
        key: "repair",
        name: "Sửa chữa & bảo trì",
        plaid: "HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE",
        nature: "variable",
      },
    ],
  },
  {
    key: "transport",
    name: "Di chuyển",
    icon: "car",
    plaid: "TRANSPORTATION",
    nature: "variable",
    bucket: "need",
    children: [
      { key: "fuel", name: "Xăng", plaid: "TRANSPORTATION_GAS" },
      { key: "parking", name: "Gửi xe & phí đường", plaid: "TRANSPORTATION_PARKING" },
      { key: "taxi", name: "Taxi & xe công nghệ", plaid: "TRANSPORTATION_TAXIS_AND_RIDE_SHARES" },
      { key: "public", name: "Phương tiện công cộng", plaid: "TRANSPORTATION_PUBLIC_TRANSIT" },
      { key: "maintenance", name: "Bảo dưỡng xe", plaid: "GENERAL_SERVICES_AUTOMOTIVE" },
    ],
  },
  {
    key: "shopping",
    name: "Mua sắm",
    icon: "shopping-bag",
    plaid: "GENERAL_MERCHANDISE",
    nature: "variable",
    bucket: "want",
    children: [
      {
        key: "clothing",
        name: "Quần áo & phụ kiện",
        plaid: "GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES",
      },
      {
        key: "household",
        name: "Đồ gia dụng",
        plaid: "HOME_IMPROVEMENT_FURNITURE",
        bucket: "need",
      },
      { key: "electronics", name: "Điện tử", plaid: "GENERAL_MERCHANDISE_ELECTRONICS" },
      {
        key: "online",
        name: "Mua sắm online khác",
        plaid: "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES",
      },
    ],
  },
  {
    key: "entertainment",
    name: "Giải trí",
    icon: "film",
    plaid: "ENTERTAINMENT",
    nature: "variable",
    bucket: "want",
    children: [
      {
        key: "streaming",
        name: "Phim & nhạc online",
        plaid: "ENTERTAINMENT_TV_AND_MOVIES",
        nature: "fixed",
      },
      {
        key: "events",
        name: "Sự kiện & vé",
        plaid: "ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS",
      },
      { key: "games", name: "Trò chơi", plaid: "ENTERTAINMENT_VIDEO_GAMES" },
    ],
  },
  {
    key: "travel",
    name: "Du lịch",
    icon: "plane",
    plaid: "TRAVEL",
    nature: "variable",
    bucket: "want",
    children: [
      { key: "flights", name: "Vé máy bay", plaid: "TRAVEL_FLIGHTS" },
      { key: "lodging", name: "Khách sạn & lưu trú", plaid: "TRAVEL_LODGING" },
      { key: "tours", name: "Tour & hoạt động", plaid: "TRAVEL_OTHER_TRAVEL" },
    ],
  },
  {
    key: "medical",
    name: "Y tế",
    icon: "heart-pulse",
    plaid: "MEDICAL",
    nature: "variable",
    bucket: "need",
    children: [
      { key: "checkup", name: "Khám sức khỏe định kỳ", plaid: "MEDICAL_PRIMARY_CARE" },
      { key: "treatment", name: "Khám & chữa bệnh", plaid: "MEDICAL_OTHER_MEDICAL" },
      { key: "pharmacy", name: "Thuốc & nhà thuốc", plaid: "MEDICAL_PHARMACIES_AND_SUPPLEMENTS" },
      {
        key: "supplements",
        name: "Thực phẩm chức năng",
        plaid: "MEDICAL_PHARMACIES_AND_SUPPLEMENTS",
        bucket: "want",
      },
    ],
  },
  {
    key: "personal_care",
    name: "Chăm sóc cá nhân",
    icon: "sparkles",
    plaid: "PERSONAL_CARE",
    nature: "variable",
    bucket: "want",
    children: [
      { key: "beauty", name: "Làm đẹp & spa", plaid: "PERSONAL_CARE_HAIR_AND_BEAUTY" },
      { key: "fitness", name: "Thể thao & gym", plaid: "PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS" },
    ],
  },
  {
    key: "family",
    name: "Gia đình & con cái",
    icon: "baby",
    nature: "variable",
    bucket: "need",
    children: [
      { key: "kids_supplies", name: "Đồ dùng cho con" },
      { key: "childcare", name: "Chăm sóc con" },
      { key: "parents", name: "Chăm sóc cha mẹ" },
      { key: "occasions", name: "Hiếu hỉ & sự kiện gia đình", bucket: "want" },
    ],
  },
  {
    key: "education",
    name: "Giáo dục",
    icon: "graduation-cap",
    nature: "variable",
    bucket: "need",
    children: [
      { key: "tuition", name: "Học phí", nature: "fixed" },
      { key: "books_courses", name: "Sách & khóa học" },
      { key: "conferences", name: "Hội thảo & sự kiện", bucket: "want" },
    ],
  },
  {
    key: "services",
    name: "Dịch vụ",
    icon: "briefcase",
    plaid: "GENERAL_SERVICES",
    nature: "fixed",
    bucket: "need",
    children: [
      {
        key: "software",
        name: "Phần mềm & subscription",
        plaid: "GENERAL_SERVICES_OTHER_GENERAL_SERVICES",
        bucket: "want",
      },
      { key: "insurance", name: "Bảo hiểm", plaid: "GENERAL_SERVICES_INSURANCE" },
      { key: "bank_fees", name: "Phí ngân hàng", plaid: "BANK_FEES", nature: "variable" },
      {
        key: "government",
        name: "Phí hành chính & thuế",
        plaid: "GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT",
        nature: "variable",
      },
    ],
  },
  {
    key: "giving",
    name: "Quà tặng & từ thiện",
    icon: "gift",
    plaid: "GOVERNMENT_AND_NON_PROFIT",
    nature: "variable",
    bucket: "want",
    children: [
      { key: "gifts", name: "Quà tặng", plaid: "GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES" },
      { key: "charity", name: "Từ thiện", plaid: "GOVERNMENT_AND_NON_PROFIT_DONATIONS" },
      {
        key: "community",
        name: "Đóng góp cộng đồng",
        plaid: "GOVERNMENT_AND_NON_PROFIT_DONATIONS",
      },
    ],
  },
  {
    key: "other",
    name: "Khác",
    icon: "circle-help",
    nature: "variable",
    children: [{ key: "uncategorized", name: "Chưa phân loại" }],
  },
];

const INCOME: Node[] = [
  {
    key: "income",
    name: "Thu nhập",
    icon: "wallet",
    plaid: "INCOME",
    children: [
      { key: "salary", name: "Lương", plaid: "INCOME_WAGES" },
      { key: "freelance", name: "Freelance & hợp đồng", plaid: "INCOME_OTHER_INCOME" },
      { key: "rental", name: "Cho thuê", plaid: "INCOME_RENTAL" },
      { key: "interest", name: "Lãi tiết kiệm", plaid: "INCOME_INTEREST_EARNED" },
      { key: "dividends", name: "Cổ tức", plaid: "INCOME_DIVIDENDS" },
      { key: "cashback", name: "Hoàn tiền & cashback", plaid: "INCOME_OTHER_INCOME" },
      { key: "gifts_received", name: "Được tặng", plaid: "INCOME_OTHER_INCOME" },
      { key: "other_income", name: "Thu nhập khác", plaid: "INCOME_OTHER_INCOME" },
    ],
  },
];

export const UNCATEGORIZED_ID = "other.uncategorized";

function flatten(nodes: Node[], kind: CategoryKind): CategorySeed[] {
  const out: CategorySeed[] = [];
  nodes.forEach((primary, i) => {
    out.push({
      id: primary.key,
      parentId: null,
      name: primary.name,
      kind,
      nature: primary.nature ?? null,
      bucket: primary.bucket ?? null,
      icon: primary.icon ?? null,
      plaid: primary.plaid ?? null,
      sort: i,
      system: primary.key === "other",
    });
    primary.children?.forEach((child, j) => {
      const id = `${primary.key}.${child.key}`;
      out.push({
        id,
        parentId: primary.key,
        name: child.name,
        kind,
        nature: child.nature ?? primary.nature ?? null,
        bucket: child.bucket ?? primary.bucket ?? null,
        icon: child.icon ?? null,
        plaid: child.plaid ?? primary.plaid ?? null,
        sort: j,
        system: id === UNCATEGORIZED_ID,
      });
    });
  });
  return out;
}

export const DEFAULT_CATEGORIES: readonly CategorySeed[] = [
  ...flatten(EXPENSE, "expense"),
  ...flatten(INCOME, "income"),
];

export interface CategoryLike {
  id: string;
  parentId: string | null;
  name: string;
}

export interface CategoryTreeNode<T extends CategoryLike> {
  category: T;
  depth: number;
  children: CategoryTreeNode<T>[];
}

/** Builds a tree from a flat list; orphans become roots. */
export function buildCategoryTree<T extends CategoryLike & { sort?: number }>(
  items: readonly T[],
): CategoryTreeNode<T>[] {
  const nodes = new Map<string, CategoryTreeNode<T>>();
  for (const c of items) nodes.set(c.id, { category: c, depth: 0, children: [] });
  const roots: CategoryTreeNode<T>[] = [];
  for (const node of nodes.values()) {
    const parent = node.category.parentId ? nodes.get(node.category.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  const sortAndDepth = (list: CategoryTreeNode<T>[], depth: number) => {
    list.sort((a, b) => (a.category.sort ?? 0) - (b.category.sort ?? 0));
    for (const n of list) {
      n.depth = depth;
      sortAndDepth(n.children, depth + 1);
    }
  };
  sortAndDepth(roots, 0);
  return roots;
}

/** Depth-first flat list of a tree, handy for selects. */
export function flattenTree<T extends CategoryLike>(
  roots: CategoryTreeNode<T>[],
): CategoryTreeNode<T>[] {
  const out: CategoryTreeNode<T>[] = [];
  const walk = (list: CategoryTreeNode<T>[]) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(roots);
  return out;
}

/** Full path name: "Ăn uống › Siêu thị & chợ". */
export function categoryPath(id: string, byId: ReadonlyMap<string, CategoryLike>): string {
  const parts: string[] = [];
  let current = byId.get(id);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    parts.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return parts.join(" › ");
}

/** Root ancestor id, used to roll detailed totals up to primary categories. */
export function rootCategoryId(id: string, byId: ReadonlyMap<string, CategoryLike>): string {
  let current = byId.get(id);
  const seen = new Set<string>();
  while (current?.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = byId.get(current.parentId);
    if (!parent) break;
    current = parent;
  }
  return current?.id ?? id;
}

/** Sums totals per category up through every ancestor. */
export function rollUp(
  totals: ReadonlyMap<string, number>,
  byId: ReadonlyMap<string, CategoryLike>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, value] of totals) {
    let current = byId.get(id);
    const seen = new Set<string>();
    if (!current) out.set(id, (out.get(id) ?? 0) + value);
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      out.set(current.id, (out.get(current.id) ?? 0) + value);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
  }
  return out;
}
