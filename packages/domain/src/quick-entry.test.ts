import { describe, expect, it } from "vitest";

import type { AccountLike } from "./accounts";
import { parseQuickEntry } from "./quick-entry";

const accounts: AccountLike[] = [
  { id: "tcb4321", name: "TCB 4321", type: "bank", currency: "VND", last4: "4321" },
  {
    id: "credit",
    name: "TCB Credit",
    type: "credit_card",
    currency: "VND",
    aliases: ["credit", "visa"],
  },
];

describe("parseQuickEntry", () => {
  it("extracts amount, account and description", () => {
    expect(parseQuickEntry("grab 120k 4321", accounts, "2026-11-08")).toEqual({
      description: "grab",
      amount: 120_000,
      accountId: "tcb4321",
      date: "2026-11-08",
    });
  });

  it("understands relative and explicit dates", () => {
    expect(parseQuickEntry("Kingfood 1,2tr credit hôm qua", accounts, "2026-11-08")).toMatchObject({
      description: "Kingfood",
      amount: 1_200_000,
      accountId: "credit",
      date: "2026-11-07",
    });
    expect(parseQuickEntry("Bún bò 45k 5/11", accounts, "2026-11-08").date).toBe("2026-11-05");
  });

  it("leaves unknown parts in the description", () => {
    expect(parseQuickEntry("Quà sinh nhật mẹ", accounts, "2026-11-08")).toMatchObject({
      description: "Quà sinh nhật mẹ",
      amount: null,
      accountId: null,
    });
  });
});
