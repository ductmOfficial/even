import {
  addMonths,
  buildExpense,
  buildIncome,
  buildRefund,
  buildTransfer,
  daysInMonth,
  monthRange,
  todayIso,
  UNCATEGORIZED_ID,
  type TransactionDraft,
} from "@even/domain";

import { createAccount } from "./accounts";
import type { Db } from "./client";
import { importDrafts } from "./imports";

/** Deterministic PRNG so demo data (and screenshots) are identical on every run. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoOptions {
  months?: number;
  today?: string;
  seed?: number;
}

/**
 * Fills an empty ledger with fictional data: a few accounts, two people, salary in USD,
 * shared rent and everyday spending. Never contains real user data.
 */
export async function seedDemo(db: Db, options: DemoOptions = {}): Promise<number> {
  const today = options.today ?? todayIso();
  const months = options.months ?? 6;
  const rand = mulberry32(options.seed ?? 42);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)] as T;
  const between = (min: number, max: number, step = 1000) =>
    Math.round((min + rand() * (max - min)) / step) * step;

  const firstMonth = addMonths(today.slice(0, 7), -(months - 1));
  const openingDate = monthRange(addMonths(firstMonth, -1)).to;

  const debit = await createAccount(db, {
    name: "Demo Bank 1234",
    type: "bank",
    institution: "Demo Bank",
    last4: "1234",
    openingBalance: 85_000_000,
    openingDate,
  });
  const card = await createAccount(db, {
    name: "Demo Credit",
    type: "credit_card",
    institution: "Demo Bank",
    aliases: ["credit"],
  });
  const wallet = await createAccount(db, { name: "Ví điện tử", type: "ewallet", aliases: ["vi"] });
  const cash = await createAccount(db, {
    name: "Tiền mặt",
    type: "cash",
    aliases: ["cash", "tm"],
    openingBalance: 3_000_000,
    openingDate,
  });
  const paypal = await createAccount(db, {
    name: "PayPal",
    type: "foreign",
    currency: "USD",
    openingBalance: 120_000,
    openingDate,
    rate: 26_000,
  });
  const partner = await createAccount(db, { name: "An (demo)", type: "person" });
  const roommate = await createAccount(db, { name: "Bình (demo)", type: "person" });

  const drafts: TransactionDraft[] = [];
  const vnd = (accountId: string) => ({ accountId, currency: "VND" as const });

  for (let i = 0; i < months; i++) {
    const month = addMonths(firstMonth, i);
    const [y, m] = month.split("-").map(Number) as [number, number];
    const lastDay = month === today.slice(0, 7) ? Number(today.slice(8, 10)) : daysInMonth(y, m);
    const day = (d: number) => `${month}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
    const rate = 25_900 + Math.round(rand() * 500);

    // Salary in USD, then withdrawn to the bank.
    drafts.push(
      buildIncome({
        date: day(1),
        description: "Lương - Demo Corp",
        accountId: paypal,
        currency: "USD",
        rate,
        amount: 250_000,
        categoryId: "income.salary",
      }),
    );
    if (lastDay >= 3) {
      drafts.push(
        buildTransfer({
          date: day(3),
          description: "Rút PayPal về ngân hàng",
          from: { accountId: paypal, currency: "USD", rate },
          to: vnd(debit),
          amount: 200_000,
          toAmount: (200_000 * (rate - 150)) / 100,
        }),
      );
    }

    // Shared rent and utilities.
    drafts.push(
      buildExpense({
        date: day(1),
        description: "Tiền thuê nhà",
        ...vnd(debit),
        amount: 9_000_000,
        categoryId: "housing.rent",
        shares: [{ personAccountId: roommate, amount: 3_000_000 }],
      }),
      buildExpense({
        date: day(5),
        description: "EVN tiền điện",
        ...vnd(debit),
        amount: between(900_000, 1_600_000),
        categoryId: "housing.electricity",
        shares: [{ personAccountId: roommate, amount: 400_000 }],
      }),
      buildExpense({
        date: day(6),
        description: "Viettel internet",
        ...vnd(debit),
        amount: 250_000,
        categoryId: "housing.internet",
      }),
      buildExpense({
        date: day(8),
        description: "Netflix",
        ...vnd(card),
        amount: 260_000,
        categoryId: "entertainment.streaming",
      }),
    );
    if (lastDay >= 10) {
      drafts.push(
        buildTransfer({
          date: day(10),
          description: "Bình trả tiền nhà",
          from: vnd(roommate),
          to: vnd(debit),
          amount: 3_400_000,
        }),
        buildTransfer({
          date: day(10),
          description: "Nạp ví điện tử",
          from: vnd(debit),
          to: vnd(wallet),
          amount: 2_000_000,
        }),
      );
    }

    // Everyday spending.
    for (let d = 1; d <= lastDay; d++) {
      if (rand() < 0.45) {
        drafts.push(
          buildExpense({
            date: day(d),
            description: `Market - ${pick(["Kingfood", "Winmart", "Co.op", "Bách Hóa Xanh"])}`,
            ...vnd(rand() < 0.6 ? card : debit),
            amount: between(60_000, 650_000),
            categoryId: "food.groceries",
            shares: rand() < 0.3 ? [{ personAccountId: partner, amount: 50_000 }] : undefined,
          }),
        );
      }
      if (rand() < 0.35) {
        drafts.push(
          buildExpense({
            date: day(d),
            description: pick(["Grab Food", "ShopeeFood", "Be Food"]),
            ...vnd(wallet),
            amount: between(45_000, 220_000),
            categoryId: "food.delivery",
          }),
        );
      }
      if (rand() < 0.25) {
        drafts.push(
          buildExpense({
            date: day(d),
            description: pick(["Highlands Coffee", "Phúc Long", "Cà phê vỉa hè"]),
            ...vnd(rand() < 0.5 ? cash : wallet),
            amount: between(25_000, 85_000),
            categoryId: "food.coffee",
          }),
        );
      }
      if (rand() < 0.12) {
        drafts.push(
          buildExpense({
            date: day(d),
            description: "Shopee",
            ...vnd(card),
            amount: between(90_000, 1_200_000),
            categoryId: pick(["shopping.household", "shopping.clothing", "family.kids_supplies"]),
          }),
        );
      }
      if (rand() < 0.06) {
        drafts.push(
          buildExpense({
            date: day(d),
            description: pick(["Chuyển khoản QR 0912xxx", "POS 8812 HCM", "Thanh toán hóa đơn"]),
            ...vnd(debit),
            amount: between(50_000, 900_000),
            categoryId: UNCATEGORIZED_ID,
            needsReview: true,
          }),
        );
      }
    }

    if (lastDay >= 25) {
      drafts.push(
        buildRefund({
          date: day(25),
          description: "Hoàn tiền thẻ tín dụng",
          ...vnd(card),
          amount: between(150_000, 400_000),
          categoryId: "income.cashback",
        }),
        buildTransfer({
          date: day(25),
          description: "Thanh toán thẻ tín dụng",
          from: vnd(debit),
          to: vnd(card),
          amount: between(5_000_000, 8_000_000, 100_000),
        }),
      );
    }
  }

  const result = await importDrafts(
    db,
    drafts.map((draft, i) => ({ draft, externalId: `demo:${String(i)}` })),
    { source: "demo" },
  );
  return result.inserted;
}
