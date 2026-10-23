import { expect, test } from "@playwright/test";

const BOND_ID = "81920e95-a0b2-4173-bc23-86db7909a0a9";

async function openAnalysisSurface(page: import("@playwright/test").Page, tabLabel: string, item: string) {
  let tab = page.locator(".lm_tab").filter({ hasText: new RegExp(`^${tabLabel}$`) }).last();
  if ((await tab.count()) === 0 || !(await tab.isVisible())) {
    await page.getByRole("button", { name: "Lenses", exact: true }).click();
    await page.getByRole("button", { name: item, exact: true }).click();
    tab = page.locator(".lm_tab").filter({ hasText: new RegExp(`^${tabLabel}$`) }).last();
  }
  await expect(tab).toBeVisible();
  await tab.evaluate((element: HTMLElement) => element.click());
  return tab.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' lm_stack ')][1]");
}

test("saved POS and Quant hydrate without playable media and retain project membership", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 2560, height: 1440 });
  const summary = await (await request.get(
    `/api/local-analysis/${BOND_ID}?summary=1&project_id=bond-cop30-helsinki&context_analysis_id=${BOND_ID}`,
  )).json();
  expect(summary.project_id).toBe("bond-cop30-helsinki");
  await page.route(/\/download\/(source_video|video)(\?|$)/, route => route.abort());
  await page.goto("/dashboard?activeProject=bond-cop30-helsinki");
  await page.locator(`[role="button"][data-analysis-id="${BOND_ID}"]`).click();
  const pos = await openAnalysisSurface(page, "POS", "POS analysis Lens");
  await expect(pos.getByText("Loading saved language analysis…")).toHaveCount(0, { timeout: 90_000 });
  await pos.getByText("POS COUNTS", { exact: true }).click();
  await expect(pos.getByRole("img").last()).toBeVisible();
  await expect(pos.getByRole("button", { name: "196 tokens", exact: true })).toBeVisible();
  await expect(pos.getByText("No content available", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "../../docs/audits/system_check_2026-09-16/pos-hydrated.png" });
  const quant = await openAnalysisSurface(page, "Quant", "Quantitative Analysis");
  await expect(quant.getByText("235 words", { exact: true })).toBeVisible({ timeout: 60_000 });
  await quant.getByText("Corpus Sentence Word Stats", { exact: true }).click();
  await expect(quant.getByText("sentences: 34", { exact: true })).toBeVisible();
  await expect(quant.getByText("words: 235", { exact: true })).toBeVisible();
  await expect(page.getByText("Unassigned saved work", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "../../docs/audits/system_check_2026-09-16/quant-hydrated.png" });
});
