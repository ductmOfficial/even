import { expect, test } from "@playwright/test";

test("adds a monthly rent shared with someone and records it", async ({ page }) => {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Thêm tài khoản" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tên", { exact: true }).fill("Bank");
  await dialog.getByLabel("Số cuối thẻ/tài khoản").fill("1111");
  await dialog.getByLabel("Số dư hiện tại").fill("10tr");
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã tạo")).toBeVisible();

  await page.goto("/people");
  await page.getByRole("button", { name: "Thêm người" }).click();
  await page.getByRole("dialog").getByLabel("Tên", { exact: true }).fill("An");
  await page.getByRole("dialog").getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByRole("link", { name: "An", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Định kỳ & lịch" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Định kỳ & lịch" })).toBeVisible();
  await expect(page.getByText("Chưa có khoản định kỳ")).toBeVisible();

  await page.getByRole("button", { name: "Thêm khoản định kỳ" }).click();
  dialog = page.getByRole("dialog", { name: "Thêm khoản định kỳ" });
  await dialog.getByLabel("Tên", { exact: true }).fill("Tiền nhà");
  await dialog.getByLabel("Ngày trong tháng").fill("1");
  await dialog.getByLabel("Số tiền", { exact: true }).fill("7,5tr");
  await dialog.getByRole("combobox", { name: "Danh mục" }).fill("thue nha");
  await page.getByRole("option", { name: /Tiền thuê nhà/ }).click();
  await dialog.getByRole("button", { name: "Thêm người" }).click();
  await dialog.getByRole("button", { name: "Chia đều" }).click();
  await expect(dialog.getByText("Phần của bạn")).toContainText("3.750.000");
  await dialog.getByRole("button", { name: "Thêm", exact: true }).click();
  await expect(page.getByText("Đã thêm khoản định kỳ")).toBeVisible();

  // Day 1 of this month has passed, so the rent is due and shows on the calendar.
  await expect(page.getByText("Chưa ghi nhận")).toBeVisible();
  await page.getByRole("button", { name: /Tạo giao dịch đến hôm nay \(1\)/ }).click();
  await expect(page.getByText("Đã tạo 1 giao dịch")).toBeVisible();
  await expect(page.getByRole("button", { name: /Tạo giao dịch đến hôm nay/ })).toBeDisabled();

  await page.goto("/people");
  await expect(page.getByText("nợ bạn", { exact: true })).toBeVisible();
  await page.goto("/accounts");
  await expect(page.getByRole("link", { name: /Bank/ })).toContainText("2.500.000");
});
