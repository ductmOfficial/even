import { describe, expect, it } from "vitest";

import { accountStatementTokens, creditCardStatementTokens } from "./fixtures";
import { parseStatement } from "./index";
import { splitCardDescription } from "./tcb-credit-card";
import { parseDmy, parseOriginal, parseVnd } from "./tokens";

const account = () =>
  accountStatementTokens({
    account: "1234567890",
    name: "NGUYEN VAN A",
    from: "01/09/2026",
    to: "30/09/2026",
    opening: "1,000,000",
    closing: "10,600,000",
    rows: [
      {
        date: "03/09/2026",
        counterparty: ["CUA HANG", "BANH MI B"],
        bank: ["NGAN HANG TMCP", "NGOAI THUONG", "(VIETCOMBANK)"],
        details: "NGUYEN VAN A chuyen tien",
        reference: "FT26000000000001",
        debit: "50,000",
        balance: "950,000",
      },
      {
        date: "05/09/2026",
        bank: "TECHCOMBANK",
        details: ["Thanh toan loi nhuan Sinh loi tu", "dong thang 8 ID", "XYZ.ALL.", "INT"],
        credit: "12,345",
        balance: "962,345",
      },
      {
        date: "05/09/2026",
        counterparty: "CONG TY C",
        bank: "TECHCOMBANK",
        details: "Luong thang 8",
        reference: "FT26000000000002\\BNK",
        credit: "20,000,000",
        balance: "20,962,345",
      },
      {
        date: "07/09/2026",
        details: ["Rut tien tai ATM TCB bang SDT", "Ngay:06/09/2026. Ma", "GD:000001"],
        reference: "FT26000000000003\\BNK",
        debit: "1,000,000",
        balance: "19,962,345",
      },
      {
        date: "08/09/2026",
        counterparty: "CHU NHA D",
        bank: ["NGAN HANG TMCP", "CONG THUONG"],
        details: "Tien nha",
        reference: "FT26000000000004",
        debit: "9,362,345",
        balance: "10,600,000",
      },
    ],
    perPage: 3,
  });

const card = () =>
  creditCardStatementTokens({
    account: "1111222233334444",
    holder: "NGUYEN VAN A",
    statementDate: "18/09/2026",
    limit: "50,000,000",
    summary: ["-2,000,000", "1,326,173", "2,000,000", "-1,326,173", "66,309", "17:00 15/10/2026"],
    rows: [
      {
        date: "20/08/2026",
        post: "21/08/2026",
        original: "200,000.00 VND",
        debit: "200,000",
        description: [
          "Giao dịch thanh toán/Purchase - Số",
          "Thẻ/Card No: 4000...0001",
          "SHOP ONLINE HA NOI VN",
        ],
      },
      {
        date: "01/09/2026",
        post: "02/09/2026",
        original: "2,000,000.00 VND",
        credit: "2,000,000",
        description: ["Thanh toan no the tin dung - Sotien", "2000000 VND - Ngay 01/09/2026"],
      },
      {
        date: "05/09/2026",
        post: "07/09/2026",
        original: "40.00 USD",
        debit: "1,050,000",
        description: [
          "Giao dịch thanh toán/Purchase - Số",
          "Thẻ/Card No: 4000...0001",
          "HOTEL BOOKING INTERNET SG",
        ],
      },
      {
        post: "07/09/2026",
        original: "1,050,000.00 VND",
        debit: "26,173",
        description: [
          "Priority Visa Signature - PHI GIAO DICH",
          "NOI TE O NUOC NGOAI - Số Thẻ/Card No:",
          "4000...0001",
          "HOTEL BOOKING INTERNET SG",
        ],
      },
      {
        date: "08/09/2026",
        post: "09/09/2026",
        original: "50,000.00 VND",
        debit: "50,000",
        description: ["Giao dịch thanh toán/Purchase - Số", "Thẻ/Card No: 5000...0002", "CHO B VN"],
      },
    ],
    perPage: 3,
  });

describe("text helpers", () => {
  it("reads dates and amounts", () => {
    expect(parseDmy("05/09/2026")).toBe("2026-09-05");
    expect(parseDmy("5/9/2026")).toBeNull();
    expect(parseVnd("1,234,567,890")).toBe(1_234_567_890);
    expect(parseVnd("-12,345,678")).toBe(-12_345_678);
    expect(parseVnd("82000")).toBeNull();
    expect(parseOriginal("40.00 USD")).toEqual({ amount: 40, currency: "USD" });
  });

  it("splits a card description", () => {
    expect(
      splitCardDescription("Giao dịch thanh toán/Purchase - Số Thẻ/Card No: 4000...0001 SHOP VN"),
    ).toEqual({ kind: "Giao dịch thanh toán/Purchase", cardLast4: "0001", merchant: "SHOP VN" });
  });
});

describe("Techcombank account statement", () => {
  const statement = parseStatement(account());

  it("reads the header and balances", () => {
    expect(statement).toMatchObject({
      kind: "tcb-account",
      accountNumber: "1234567890",
      holder: "NGUYEN VAN A",
      periodFrom: "2026-09-01",
      periodTo: "2026-09-30",
      openingBalance: 1_000_000,
      reportedOpeningBalance: null,
      closingBalance: 10_600_000,
      balanced: true,
      warnings: [],
    });
  });

  it("joins wrapped cells into one line per transaction, across pages", () => {
    expect(statement.lines).toHaveLength(5);
    expect(statement.lines[0]).toMatchObject({
      date: "2026-09-03",
      amount: -50_000,
      balance: 950_000,
      counterparty: "CUA HANG BANH MI B",
      counterpartyBank: "NGAN HANG TMCP NGOAI THUONG (VIETCOMBANK)",
      description: "NGUYEN VAN A chuyen tien",
      reference: "FT26000000000001",
    });
    expect(statement.lines[1]).toMatchObject({
      amount: 12_345,
      reference: null,
      description: "Thanh toan loi nhuan Sinh loi tu dong thang 8 ID XYZ.ALL. INT",
    });
    expect(statement.lines[3]).toMatchObject({
      date: "2026-09-07",
      reference: "FT26000000000003\\BNK",
      description: "Rut tien tai ATM TCB bang SDT Ngay:06/09/2026. Ma GD:000001",
    });
    expect(statement.lines[4]).toMatchObject({ amount: -9_362_345, counterparty: "CHU NHA D" });
  });

  it("starts from the available balance when money was set aside to earn interest", () => {
    const tokens = account().map((tok) =>
      tok.text === "1,000,000" && tok.y === 349.8 ? { ...tok, text: "400,000" } : tok,
    );
    const s = parseStatement(tokens);
    expect(s).toMatchObject({
      openingBalance: 1_000_000,
      reportedOpeningBalance: 400_000,
      balanced: true,
    });
  });

  it("flags a running balance that does not follow", () => {
    const tokens = account().map((tok) =>
      tok.text === "962,345" ? { ...tok, text: "962,346" } : tok,
    );
    const s = parseStatement(tokens);
    expect(s.balanced).toBe(false);
    expect(s.warnings.join("\n")).toMatch(/Dòng 2 .*không nối tiếp/);
  });
});

describe("Techcombank credit card statement", () => {
  const statement = parseStatement(card());

  it("reads the summary", () => {
    expect(statement).toMatchObject({
      kind: "tcb-credit-card",
      accountNumber: "1111222233334444",
      holder: "NGUYEN VAN A",
      periodFrom: "2026-08-19",
      periodTo: "2026-09-18",
      openingBalance: -2_000_000,
      closingBalance: -1_326_173,
      balanced: true,
      creditCard: {
        statementDate: "2026-09-18",
        dueDate: "2026-10-15",
        creditLimit: 50_000_000,
        minimumPayment: 66_309,
        totalDebit: 1_326_173,
        totalCredit: 2_000_000,
        interestRate: 24.96,
        cardLast4: ["0001", "0002"],
      },
    });
  });

  it("reads purchases, payments, foreign amounts and fees without a transaction date", () => {
    expect(statement.lines.map((l) => l.amount)).toEqual([
      -200_000, 2_000_000, -1_050_000, -26_173, -50_000,
    ]);
    expect(statement.lines[0]).toMatchObject({
      date: "2026-08-20",
      postDate: "2026-08-21",
      cardLast4: "0001",
      counterparty: "SHOP ONLINE HA NOI VN",
      original: null,
    });
    expect(statement.lines[2]?.original).toEqual({ amount: 40, currency: "USD" });
    expect(statement.lines[3]).toMatchObject({
      date: "2026-09-07",
      postDate: "2026-09-07",
      cardLast4: "0001",
      counterparty: "HOTEL BOOKING INTERNET SG",
    });
    expect(statement.lines[1]?.cardLast4).toBeNull();
  });
});

describe("parseStatement", () => {
  it("rejects other documents", () => {
    expect(() => parseStatement([{ page: 1, x0: 0, x1: 10, y: 0, text: "Hello" }])).toThrow(
      /Chưa hỗ trợ/,
    );
  });
});
