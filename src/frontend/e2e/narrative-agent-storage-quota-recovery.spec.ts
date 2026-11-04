import { expect, test } from "@playwright/test";

test("Narrative Agent remains hydrated when continuity draft storage exceeds quota", async ({ page }) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (
        this === window.localStorage &&
        key.startsWith("vaa1.continuity-review.")
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
  await page
    .getByRole("button", { name: /Select video NO_TIME_TO_DIE_Trailer/ })
    .click();
  await page.getByRole("button", { name: "Lenses", exact: true }).click();
  await page
    .getByRole("button", { name: "Narrative Agent Leaf", exact: true })
    .click();

  await expect(
    page.locator('[data-narrative-agent-continuity-workbench="true"]:visible'),
  ).toBeVisible({ timeout: 45_000 });
  await expect(
    page.locator('[data-vaa1-continuity-storage-fallback="true"]:visible'),
  ).toContainText("Narrative Agent evidence remains hydrated");
  expect(pageErrors).toEqual([]);
});
