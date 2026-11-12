import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const pages = [
  "/",
  "/transactions",
  "/transactions?review=true",
  "/accounts",
  "/people",
  "/categories",
  "/categories?tab=rules",
  "/import",
  "/settings",
];

async function expectNoViolations(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    violations,
    `${where}\n${violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`).join("\n")}`,
  ).toEqual([]);
}

/** Fills the empty ledger with the built-in fictional demo data. */
async function seedDemo(page: Page) {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Tạo dữ liệu demo" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Tạo" }).click();
  await expect(page.getByText(/Đã tạo \d+ giao dịch demo/)).toBeVisible({ timeout: 30_000 });
}

for (const scheme of ["light", "dark"] as const) {
  test(`every screen has no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
    test.slow();
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await seedDemo(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
    for (const path of pages) {
      await page.goto(path);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator("[aria-hidden=true].animate-pulse")).toHaveCount(0);
      await expectNoViolations(page, path);
    }

    await page.goto("/transactions");
    await page.keyboard.press("n");
    await expect(page.getByRole("dialog", { name: "Thêm giao dịch" })).toBeVisible();
    await expectNoViolations(page, "add transaction dialog");
    await page.keyboard.press("Escape");

    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByRole("dialog", { name: "Tìm và chạy lệnh" })).toBeVisible();
    await expectNoViolations(page, "command palette");
  });
}

test("no screen scrolls sideways on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of pages) {
    await page.goto(path);
    await expect(page.locator("main h1")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBe(0);
  }
});

test("the theme setting overrides the system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/settings");
  await page.getByRole("button", { name: /Chế độ màu/ }).click();
  await page.getByRole("option", { name: "Tối" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
