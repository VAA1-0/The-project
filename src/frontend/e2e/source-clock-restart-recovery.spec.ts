import { expect, test } from "@playwright/test";

const ANALYSIS = process.env.VAA1_RESTART_CLOCK_ANALYSIS || "81920e95-a0b2-4173-bc23-86db7909a0a9";
const PROJECT = process.env.VAA1_RESTART_CLOCK_PROJECT || "bond-cop30-helsinki";

test("a transient backend clock failure clears after automatic verified recovery", async ({ page }) => {
  let clockRequests = 0;
  await page.route(`**/api/analysis/${ANALYSIS}/source-clock?*`, async (route) => {
    clockRequests += 1;
    if (clockRequests === 1) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "simulated restart" }) });
      return;
    }
    await route.continue();
  });

  await page.goto(`/dashboard?activeProject=${PROJECT}&workspace=default`);
  const card = page.locator(`[data-analysis-id="${ANALYSIS}"]`);
  await expect(card).toBeVisible({ timeout: 90_000 });
  await card.click();

  const issue = page.getByText("Source timing could not be verified. Navigation is paused.").first();
  await expect(issue).toBeVisible({ timeout: 20_000 });
  await expect(issue).toBeHidden({ timeout: 20_000 });
  await expect.poll(() => clockRequests, { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  await expect(page.locator('[data-source-clock-browser="true"]:visible').first()).toHaveAttribute("title", /clock-v1:/, { timeout: 20_000 });
});
