import { expect, test } from "@playwright/test";

const BOND_ID = "81920e95-a0b2-4173-bc23-86db7909a0a9";

test("restored Bond OCR artifact surfaces in the OCR panel", async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => window.localStorage.removeItem("vaa1.workspace.layout"));
  await page.goto("/dashboard?catalogue=projects-20260831");

  await page.locator(`[role="button"][data-analysis-id="${BOND_ID}"]`).click();
  await page.locator(".lm_tab").filter({ hasText: "OCR" }).click();

  await expect(page.getByText(/\d+ surfaced \/ 71 raw/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("No OCR Results")).toHaveCount(0);
  await expect(page.getByText("MARK", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("TRADE", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Console Error")).toHaveCount(0);
});
