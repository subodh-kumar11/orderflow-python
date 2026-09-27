import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
async function create(page: Page, customer: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "New order", exact: true }).click();
  await page.getByLabel("Customer ID").fill(customer);
  await page.getByLabel("Product 1", { exact: true }).fill("canvas-tote");
  await page.getByLabel("Quantity 1", { exact: true }).fill("2");
  await page.getByLabel("Price 1", { exact: true }).fill("12.50");
  await page.getByRole("button", { name: "Create order", exact: true }).click();
  await expect(
    page.getByRole("complementary", { name: "Order details" }),
  ).toBeVisible();
}
test("create multiple items and complete the lifecycle", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New order", exact: true }).click();
  await page.getByLabel("Customer ID").fill("lifecycle-customer");
  await page.getByLabel("Product 1", { exact: true }).fill("book");
  await page.getByLabel("Price 1", { exact: true }).fill("12.50");
  await page.getByText("Add another item").click();
  await page.getByLabel("Product 2", { exact: true }).fill("pen");
  await page.getByLabel("Price 2", { exact: true }).fill("0.10");
  await page.getByLabel("Quantity 2", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Create order", exact: true }).click();
  const details = page.getByRole("complementary", { name: "Order details" });
  await expect(details).toContainText("$12.80");
  for (const status of ["processing", "shipped", "delivered"])
    await details.getByRole("button", { name: `Mark ${status}` }).click();
  await expect(details).toContainText("This order is delivered");
  await expect(details.getByText("Cancel order", { exact: true })).toHaveCount(
    0,
  );
});
test("cancel a pending order after confirmation", async ({ page }) => {
  await create(page, "cancel-customer");
  const details = page.getByRole("complementary", { name: "Order details" });
  await details
    .getByRole("button", { name: "Cancel order", exact: true })
    .click();
  await page.getByRole("button", { name: "Yes, cancel order" }).click();
  await expect(details).toContainText("This order is cancelled");
});
test("filters orders by status", async ({ page }) => {
  await create(page, "filter-customer");
  await page.getByLabel("Close order details").click();
  await page.getByRole("button", { name: /^Pending\s*\d*$/ }).click();
  await expect(page.locator("tbody tr").first()).toContainText("Pending");
  await expect(
    page.locator("tbody .badge").filter({ hasNotText: "Pending" }),
  ).toHaveCount(0);
});
test("searches without an AI key", async ({ page }) => {
  await create(page, "search-customer");
  await page.getByLabel("Close order details").click();
  await page
    .getByLabel("Search orders")
    .fill("pending orders for search-customer over 20");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator("tbody")).toContainText("search-customer");
  await expect(page.getByText("Rule-based", { exact: true })).toBeVisible();
});
test("shows server validation without losing form values", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New order", exact: true }).click();
  await page.getByLabel("Customer ID").fill("duplicate-test");
  await page.getByLabel("Product 1", { exact: true }).fill("book");
  await page.getByLabel("Price 1", { exact: true }).fill("1");
  await page.getByText("Add another item").click();
  await page.getByLabel("Product 2", { exact: true }).fill("book");
  await page.getByLabel("Price 2", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Create order", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("duplicate");
  await expect(page.getByLabel("Customer ID")).toHaveValue("duplicate-test");
});
test("mobile dashboard and interactive API documentation load", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Order overview." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.goto("/docs");
  await expect(
    page.getByRole("heading", { name: /OrderFlow API/ }),
  ).toBeVisible();
});
