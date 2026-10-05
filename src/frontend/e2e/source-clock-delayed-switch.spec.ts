import { expect, test } from "@playwright/test";

const A = process.env.VAA1_CLOCK_A_ID || "clock-acceptance-db1f40f585954e1bbd0885c52bbfdfd1";
const B = process.env.VAA1_CLOCK_B_ID || "clock-acceptance-bdf5e416bdd54be4be30454aea9f6b09";
const PROJECT = "source-clock-acceptance";

const sourceClockUrl = (analysisId: string) =>
  `http://127.0.0.1:8000/api/analysis/${analysisId}/source-clock?project_id=${PROJECT}&context_analysis_id=${analysisId}`;

test("delayed A context cannot replace B during rendered A to B to A switching", async ({ page, request }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 2560, height: 1440 });

  const [aResponse, bResponse] = await Promise.all([
    request.get(sourceClockUrl(A)),
    request.get(sourceClockUrl(B)),
  ]);
  expect(aResponse.ok()).toBeTruthy();
  expect(bResponse.ok()).toBeTruthy();
  const aClock = await aResponse.json();
  const bClock = await bResponse.json();
  expect(aClock.source_fingerprint).not.toBe(bClock.source_fingerprint);
  expect(aClock.clock_revision).not.toBe(bClock.clock_revision);

  let delayed = false;
  await page.route(`**/api/analysis/${A}/source-clock?*`, async (route) => {
    if (!delayed) {
      delayed = true;
      await new Promise((resolve) => setTimeout(resolve, 2_500));
    }
    await route.continue();
  });

  await page.goto(`/dashboard?activeProject=${PROJECT}`);
  const cardA = page.locator(`[role="button"][data-analysis-id="${A}"]`);
  const cardB = page.locator(`[role="button"][data-analysis-id="${B}"]`);
  await expect(cardA).toBeVisible({ timeout: 90_000 });
  await expect(cardB).toBeVisible({ timeout: 90_000 });

  await cardA.click();
  await expect.poll(() => delayed, { timeout: 20_000 }).toBe(true);
  await page.screenshot({
    path: "../../docs/audits/source_clock_2026-09-29/m2-01-a-waiting.png",
    fullPage: true,
  });
  await cardB.click();

  const browsers = page.locator('[data-source-clock-browser="true"]');
  await expect(browsers.first()).toHaveAttribute("title", bClock.clock_revision, { timeout: 90_000 });
  await page.screenshot({
    path: "../../docs/audits/source_clock_2026-09-29/m2-02-b-bound.png",
    fullPage: true,
  });
  await page.waitForTimeout(3_000);
  await expect(browsers.first()).toHaveAttribute("title", bClock.clock_revision);
  await expect(cardB).toHaveClass(/ring-blue-900/);
  await page.screenshot({
    path: "../../docs/audits/source_clock_2026-09-29/m2-03-b-survives-late-a.png",
    fullPage: true,
  });

  const browser = browsers.first();
  await browser.getByLabel("Browse source time").fill("0:30.000");
  await browser.getByRole("button", { name: "Go", exact: true }).click();
  await expect.poll(async () => {
    const values = await browsers.locator('[data-source-clock-cursor="true"]').allTextContents();
    return values.length > 0 && values.every((value) => value.startsWith("0:30.000"));
  }).toBe(true);
  await page.screenshot({
    path: "../../docs/audits/source_clock_2026-09-29/m2-04-b-synchronized-30s.png",
    fullPage: true,
  });

  await cardA.click();
  await expect(browsers.first()).toHaveAttribute("title", aClock.clock_revision, { timeout: 90_000 });
  await expect(cardA).toHaveClass(/ring-blue-900/);

  await page.screenshot({
    path: "../../docs/audits/source_clock_2026-09-29/m2-05-a-reopened.png",
    fullPage: true,
  });
});
