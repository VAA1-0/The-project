import { expect, test } from "@playwright/test";

test("Tools remains hydrated when project model preferences exceed browser quota", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (
        this === window.localStorage &&
        key.startsWith("vaa1.analysis.model-selections.v1.")
      ) {
        throw new DOMException(
          "Setting the value exceeded the quota.",
          "QuotaExceededError",
        );
      }
      return originalSetItem.call(this, key, value);
    };
  });

  await page.goto(
    "/dashboard?activeProject=bond-cop30-helsinki&workspace=default",
  );
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await page
    .locator("details")
    .filter({ hasText: "Analysis and morphology setup" })
    .last()
    .locator("summary")
    .click();

  await expect(
    page.getByText("3. Model choice matrix and licence record", { exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.locator('[data-vaa1-model-selection-storage-fallback="true"]'),
  ).toContainText("Tools panel remains operational");
  expect(pageErrors).toEqual([]);
});
