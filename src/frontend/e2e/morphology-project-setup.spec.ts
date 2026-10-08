import { expect, test } from "@playwright/test";

const PROJECT = "research-test-2-20226-cop30-vids";

test("COP30 project surfaces six sources and the complete three-slot morphology catalogue", async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto(`/dashboard?activeProject=${PROJECT}`);

  await expect(page.locator('[data-analysis-id]')).toHaveCount(6, { timeout: 90_000 });
  await expect(page.locator("#morphology-pack-policy")).toBeEnabled();
  await expect(page.locator("#morphology-pack-policy")).toContainText("English +3");
  await expect(page.locator("#morphology-language-0")).toBeEnabled();
  await expect(page.locator("#morphology-language-1")).toBeEnabled();
  await expect(page.locator("#morphology-language-2")).toBeEnabled();

  const response = await request.get("http://127.0.0.1:8000/api/morphology/catalog");
  expect(response.ok()).toBeTruthy();
  const catalog = (await response.json()).items;
  expect(catalog.length).toBeGreaterThanOrEqual(90);

  await page.locator("#morphology-language-0").click();
  expect(await page.getByRole("option").count()).toBeGreaterThanOrEqual(90);
  await page.getByRole("option", { name: "Finnish", exact: true }).click();

  await page.locator("#morphology-language-1").click();
  expect(await page.getByRole("option").count()).toBeGreaterThanOrEqual(90);
  await page.getByRole("option", { name: "German", exact: true }).click();

  await page.locator("#morphology-language-2").click();
  expect(await page.getByRole("option").count()).toBeGreaterThanOrEqual(90);
  await page.getByRole("option", { name: "Swedish", exact: true }).click();

  await expect(page.locator("#morphology-language-0")).toContainText("Finnish");
  await expect(page.locator("#morphology-language-1")).toContainText("German");
  await expect(page.locator("#morphology-language-2")).toContainText("Swedish");

  const stored = await page.evaluate(() => JSON.parse(
    localStorage.getItem("vaa1.analysis.morphology-configuration.v1.research-test-2-20226-cop30-vids") || "null",
  ));
  expect(stored).toMatchObject({ policy: "plus_3", languages: ["fi", "de", "sv"] });
});
