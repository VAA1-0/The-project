import { expect, test } from "@playwright/test";

const DEFAULT_DASHBOARD_TABS = [
  "Project",
  "Downloads",
  "Video",
  "Tools",
  "Transcript",
  "Objects",
  "OCR",
  "Expressions",
  "Master Schema",
  "Scene Cards",
  "POS",
  "Quant",
];

async function expectDashboardStable(page: import("@playwright/test").Page) {
  await expect(page).toHaveTitle(/VAA1 Platform/i);
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator(".lm_goldenlayout")).toBeVisible();

  for (const tabName of DEFAULT_DASHBOARD_TABS) {
    await expect(page.locator(".lm_tab").filter({ hasText: tabName })).toHaveCount(1);
  }

  await expect(page.getByText("Unhandled Runtime Error")).toHaveCount(0);
  await expect(page.getByText("Console Error")).toHaveCount(0);
  await expect(page.getByText("Encountered two children with the same key")).toHaveCount(0);
}

test("dashboard loads without fatal overlay", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/dashboard");

  await expectDashboardStable(page);

  const fatalConsoleErrors = consoleErrors.filter((message) => {
    return !message.includes("Failed to load resource");
  });
  expect(fatalConsoleErrors).toEqual([]);
});

test("dashboard exposes the default governed workspace tabs", async ({ page }) => {
  await page.goto("/dashboard");

  await expectDashboardStable(page);

  await expect(page.locator(".lm_header")).toHaveCount(6);
  await expect(page.locator(".lm_tab")).toHaveCount(DEFAULT_DASHBOARD_TABS.length);
});

test("dashboard remains stable after browser reload", async ({ page }) => {
  await page.goto("/dashboard");
  await expectDashboardStable(page);

  await page.reload();

  await expectDashboardStable(page);
});
