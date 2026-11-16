import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { accountStatementPdf } from "./statement-pdf";

test("imports a statement, reconciles it and locks the period", async ({ page }) => {
  const pdf = await accountStatementPdf({
    account: "1234567890",
    name: "NGUYEN VAN A",
    from: "01/09/2026",
    to: "30/09/2026",
    opening: 5_000_000,
    rows: [
      {
        date: "03/09/2026",
        counterparty: "HIGHLANDS COFFEE",
        details: "Highlands Coffee",
        reference: "FT26000000000001",
        debit: 65_000,
        balance: 4_935_000,
      },
      {
        date: "05/09/2026",
        details: "Thanh toan loi nhuan Sinh loi tu dong",
        credit: 12_345,
        balance: 4_947_345,
      },
      {
        date: "08/09/2026",
        counterparty: "CHU NHA",
        details: "Tien nha thang 9",
        reference: "FT26000000000002",
        debit: 3_000_000,
        balance: 1_947_345,
      },
    ],
  });

  await page.goto("/reconcile");
  await expect(page.getByRole("heading", { level: 1, name: "Đối soát sao kê" })).toBeVisible();
  await page.locator("input[type=file]").setInputFiles({
    name: "statement.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await expect(page.getByText("Số dư khớp từng dòng")).toBeVisible();
  await page.getByRole("button", { name: "Lưu 1 sao kê" }).click();
  await expect(page.getByText(/Đã lưu 1 sao kê, 3 dòng/)).toBeVisible();

  // The new account starts from the statement's opening balance, so after applying every line
  // the balances match.
  await expect(page.getByText("Dòng chưa có trong sổ (3)")).toBeVisible();
  await expect(page.getByText("Tiền lãi")).toBeVisible();
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    violations.map(
      (v) =>
        `${v.id}: ${v.nodes.map((n) => `${n.target.join(" ")} ${n.failureSummary ?? ""}`).join(" | ")}`,
    ),
  ).toEqual([]);
  await page.screenshot({ path: "test-results/reconcile.png", fullPage: true });
  await page.getByRole("button", { name: "Áp dụng đối chiếu" }).click();
  await expect(page.getByText(/Đã đối chiếu, thêm 3 giao dịch/)).toBeVisible();
  await expect(page.getByText("Khớp", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Chốt kỳ đến 30\/09\/2026/ }).click();
  await expect(page.getByText(/Đã chốt đến 30\/09\/2026/)).toBeVisible();

  // A locked period refuses new transactions on the account.
  await page.keyboard.press("n");
  const dialog = page.getByRole("dialog", { name: "Thêm giao dịch" });
  await dialog.getByLabel("Nhập nhanh").fill("Banh mi 30k 7890");
  await dialog.getByLabel("Nhập nhanh").press("Enter");
  await dialog.getByLabel("Ngày").fill("2026-09-15");
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText(/thuộc kỳ đã chốt/)).toBeVisible();
});

test("sets the opening balance of an account kept from a spreadsheet", async ({ page }) => {
  // An account with spending but no balance, as the Excel import leaves it.
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Thêm tài khoản" }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Tên", { exact: true }).fill("Bank");
  await form.getByLabel("Số cuối thẻ/tài khoản").fill("7890");
  await form.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã tạo")).toBeVisible();

  const pdf = await accountStatementPdf({
    account: "1234567890",
    name: "NGUYEN VAN A",
    from: "01/09/2026",
    to: "30/09/2026",
    opening: 5_000_000,
    rows: [
      {
        date: "03/09/2026",
        counterparty: "HIGHLANDS COFFEE",
        details: "Highlands Coffee",
        reference: "FT26000000000001",
        debit: 65_000,
        balance: 4_935_000,
      },
    ],
  });
  await page.goto("/reconcile");
  await page.locator("input[type=file]").setInputFiles({
    name: "statement.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await page.getByRole("button", { name: "Tài khoản cho statement.pdf" }).click();
  await page.getByRole("option", { name: "Bank" }).click();
  await page.getByRole("button", { name: "Lưu 1 sao kê" }).click();

  await expect(page.getByText("Đây là sao kê đầu tiên của tài khoản")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ghi chênh lệch vào Sinh lời" })).toHaveCount(0);
  await page.getByRole("button", { name: "Ghi số dư đầu kỳ" }).click();
  await expect(page.getByText("Đã ghi số dư đầu kỳ theo sao kê")).toBeVisible();
  await expect(page.getByText("Đây là sao kê đầu tiên của tài khoản")).toHaveCount(0);

  await page.getByRole("button", { name: "Áp dụng đối chiếu" }).click();
  await expect(page.getByText("Khớp", { exact: true })).toBeVisible();
});
