import { expect, test } from "@playwright/test";

test("all analytical panel families hydrate when durable browser storage is full", async ({ page }) => {
  test.setTimeout(150_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (this === window.localStorage) {
        throw new DOMException(
          `Setting ${key} exceeded the quota.`,
          "QuotaExceededError",
        );
      }
      return originalSetItem.call(this, key, value);
    };
  });

  await page.goto(
    "/dashboard?activeProject=bond-cop30-helsinki&workspace=default",
  );
  await page
    .getByRole("button", { name: /Select video NO_TIME_TO_DIE_Trailer/ })
    .click();

  for (const tab of [
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
  ]) {
    const locator = page.locator(".lm_tab").filter({ hasText: new RegExp(`^${tab}$`) });
    await expect(locator).toHaveCount(1);
    await locator.evaluate((element: HTMLElement) => element.click());
    await expect(locator).toHaveClass(/lm_active/);
  }

  await page.getByRole("button", { name: "Lenses", exact: true }).click();
  await page.getByRole("button", { name: "Narrative Agent Leaf", exact: true }).click();
  await expect(
    page.locator('[data-narrative-agent-continuity-workbench="true"]:visible'),
  ).toBeVisible({ timeout: 45_000 });

  await page.getByRole("button", { name: "Window", exact: true }).click();
  await page.getByRole("button", { name: "Analysis Report", exact: true }).click();
  await expect(page.locator(".lm_tab").filter({ hasText: /^Analysis Report$/ })).toBeVisible();

  await page.getByRole("button", { name: "Window", exact: true }).click();
  await page.getByRole("button", { name: "Time Bank", exact: true }).click();
  await expect(page.locator(".lm_tab").filter({ hasText: /^Time Bank$/ })).toBeVisible();

  expect(pageErrors).toEqual([]);
});
