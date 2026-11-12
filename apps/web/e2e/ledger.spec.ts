import { utils, write } from "@e965/xlsx";
import { expect, test, type Page } from "@playwright/test";

// Every test gets a fresh browser context, so a fresh IndexedDB and an empty ledger.

async function openApp(page: Page, path = "/") {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

async function createAccount(page: Page, name: string, last4: string, balance: string) {
  await page.goto("/accounts");
  await page.getByRole("button", { name: "Thêm tài khoản" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tên", { exact: true }).fill(name);
  await dialog.getByLabel("Số cuối thẻ/tài khoản").fill(last4);
  await dialog.getByLabel("Số dư hiện tại").fill(balance);
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã tạo")).toBeVisible();
}

test("adds an expense with quick entry and updates the balance", async ({ page }) => {
  await openApp(page);
  await createAccount(page, "TCB 4321", "4321", "10tr");

  await page.keyboard.press("n");
  const dialog = page.getByRole("dialog", { name: "Thêm giao dịch" });
  await dialog.getByLabel("Nhập nhanh").fill("Highlands 65k 4321");
  await dialog.getByLabel("Nhập nhanh").press("Enter");
  // The rule engine suggests the category from the description.
  await expect(dialog.getByRole("combobox", { name: "Danh mục" })).toHaveValue(/Cà phê/);
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã thêm giao dịch")).toBeVisible();

  await page.getByRole("link", { name: "Tài khoản" }).click();
  await expect(page.getByRole("link", { name: /TCB 4321/ })).toContainText("9.935.000");
});

test("splits an expense and settles the debt", async ({ page }) => {
  await openApp(page);
  await createAccount(page, "VCB", "1234", "5tr");
  await page.goto("/people");
  await page.getByRole("button", { name: "Thêm người" }).click();
  await page.getByRole("dialog").getByLabel("Tên", { exact: true }).fill("An");
  await page.getByRole("dialog").getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByRole("link", { name: "An", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Thêm giao dịch" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Thêm giao dịch" });
  await dialog.getByLabel("Nhập nhanh").fill("Tiền nhà 7,5tr 1234");
  await dialog.getByLabel("Nhập nhanh").press("Enter");
  await dialog.getByRole("button", { name: "Thêm người" }).click();
  await dialog.getByRole("button", { name: "Chia đều" }).click();
  await expect(dialog.getByText("Phần của bạn")).toContainText("3.750.000");
  await dialog.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByText("Đã thêm giao dịch")).toBeVisible();

  await expect(page.getByText("nợ bạn", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Quyết toán" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Ghi nhận" }).click();
  await expect(page.getByText("đã xong", { exact: true })).toBeVisible();
});

test("imports the legacy Excel workbook into the review queue", async ({ page }) => {
  const wb = utils.book_new();
  utils.book_append_sheet(
    wb,
    utils.aoa_to_sheet([
      [" ", "Name", "Category", "Category Group", "Invest Category", "Value", "Note"],
      [46053, "Market - Kingfood", "Ăn uống ở nhà", "", "", 320000, "Credit"],
      [46040, "Grab Food", "Ăn uống bên ngoài", "", "", 124350, 4321],
      [46041, "Quà cho mẹ", "Chăm sóc người thân (cha mẹ, con cái)", "", "", 500000, null],
    ]),
    "Jan",
  );
  const buffer = Buffer.from(write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer);

  await openApp(page, "/import");
  await page.locator("input[type=file]").setInputFiles({
    name: "finance.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });
  await expect(page.getByText("3 giao dịch")).toBeVisible();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.getByText("Đã import 3 giao dịch").first()).toBeVisible();

  await page.getByRole("link", { name: "Mở hàng chờ duyệt →" }).click();
  await expect(page.getByRole("heading", { name: "Duyệt giao dịch" })).toBeVisible();
  await expect(page.getByRole("row", { name: /Quà cho mẹ/ })).toBeVisible();

  // Re-importing the same file adds nothing.
  await page.goto("/import");
  await page
    .locator("input[type=file]")
    .setInputFiles({ name: "finance.xlsx", mimeType: "application/octet-stream", buffer });
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.getByText(/Đã import 0 giao dịch/).first()).toBeVisible();
});

test("data survives a reload", async ({ page }) => {
  await openApp(page);
  await createAccount(page, "Tiền mặt", "", "1tr");
  await page.reload();
  await expect(page.getByRole("link", { name: /Tiền mặt/ })).toContainText("1.000.000");
});
