import { expect, test } from "@playwright/test";

const BOND = "81920e95-a0b2-4173-bc23-86db7909a0a9";

test("Analysis Report opens for the governed active artifact and exposes both reading regimes", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/dashboard?activeProject=bond-cop30-helsinki&workspace=default");
  await page.locator(`[role="button"][data-analysis-id="${BOND}"]`).click();
  await page.getByRole("button", { name: "Window", exact: true }).click();
  await page.getByRole("button", { name: "Analysis Report", exact: true }).click();

  const report = page.locator('[data-vaa1-analysis-report="true"]:visible');
  await expect(report).toBeVisible({ timeout: 60_000 });
  await expect(report.getByText("Governed analysis report", { exact: true })).toBeVisible();
  await expect(report.getByRole("button", { name: "Fast scan", exact: true })).toBeVisible();
  await expect(report.getByRole("button", { name: "Evidence review", exact: true })).toBeVisible();

  await report.getByRole("button", { name: "Comparison matrix", exact: true }).click();
  await expect(report.locator('[data-vaa1-analysis-report-comparison="true"]')).toBeVisible();
  await expect(report.getByRole("columnheader", { name: "Confirmed", exact: true })).toBeVisible();
});
