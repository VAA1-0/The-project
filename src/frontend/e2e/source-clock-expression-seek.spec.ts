import { expect, test } from "@playwright/test";

test("an expression cue seeks the selected source through the clock publisher", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/dashboard?activeProject=bond-cop30-helsinki");
  await page.getByRole("button", { name: /Select video NO_TIME_TO_DIE_Trailer_UK/ }).click();
  await expect(page.getByRole("button", { name: "Expressions 49", exact: true })).toBeVisible({ timeout: 90_000 });
  await page.locator(".lm_tab").filter({ hasText: /^Expressions$/ }).evaluate((tab: HTMLElement) => tab.click());
  const cue = page.locator("main:visible").filter({ hasText: "Emotion timeline" }).last().locator("details").filter({ has: page.getByRole("button", { name: "Show in video", exact: true, includeHidden: true }) }).first();
  const summary = cue.locator("summary");
  const text = await summary.innerText();
  const timestamp = Number(text.match(/(\d+(?:\.\d+)?)s\s*·/i)?.[1]);
  expect(Number.isFinite(timestamp), `Expression cue timestamp: ${text}`).toBeTruthy();
  await summary.click();
  await cue.getByRole("button", { name: "Show in video", exact: true }).click();
  await expect.poll(async () => {
    const videos = await page.locator("video").evaluateAll(elements => elements.map(el => (el as HTMLVideoElement).currentTime));
    return videos.some(time => Math.abs(time - timestamp) < .1);
  }, { timeout: 30_000 }).toBe(true);
});

test("Expressions prioritizes a genuine on-beat expression and exposes its exchange", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/dashboard?activeProject=bond-cop30-helsinki&workspace=default");
  await page.getByRole("button", { name: /Select video NO_TIME_TO_DIE_Trailer_UK/ }).click();
  await expect(page.getByRole("button", { name: "Expressions 49", exact: true })).toBeVisible({ timeout: 90_000 });
  const tab = page.locator(".lm_tab").filter({ hasText: /^Expressions$/ });
  await tab.evaluate((element: HTMLElement) => element.click());
  const stack = tab.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' lm_stack ')][1]");
  const browser = stack.locator('[data-source-clock-browser="true"]:visible');
  // Saved Bond evidence forms a real expression exchange here:
  // 0:07 emphatic -> 0:08 reflective -> 0:09 tense.
  await browser.getByLabel("Browse source time").fill("0:08.000");
  await browser.getByRole("button", { name: "Go", exact: true }).click();
  const concordance = page.getByTestId("expression-source-clock-cursor");
  const primaryOnBeat = concordance.locator('[data-source-clock-concordance-primary="on-beat"]');
  await expect(primaryOnBeat).toContainText("On beat");
  await expect(primaryOnBeat).toContainText("0:08.000");
  await expect(primaryOnBeat).toContainText("reflective");
  await concordance.getByRole("button", { name: "Previous Expressions evidence" }).click();
  await expect.poll(async () => {
    const videos = await page.locator("video").evaluateAll(elements => elements.map(el => (el as HTMLVideoElement).currentTime));
    return videos.some(time => Math.abs(time - 7) < .1);
  }).toBe(true);
  await expect(concordance).toContainText("Expressions · 0:07.000");
  await expect(concordance.locator('[data-source-clock-concordance-primary="on-beat"]')).toContainText("emphatic");
  await concordance.getByRole("button", { name: "Next Expressions evidence" }).click();
  await expect.poll(async () => {
    const videos = await page.locator("video").evaluateAll(elements => elements.map(el => (el as HTMLVideoElement).currentTime));
    return videos.some(time => Math.abs(time - 8) < .1);
  }).toBe(true);
  await expect(concordance).toContainText("Expressions · 0:08.000");
  await expect(concordance.locator('[data-source-clock-concordance-primary="on-beat"]')).toContainText("reflective");
  await concordance.getByRole("button", { name: "Next Expressions evidence" }).click();
  await expect.poll(async () => {
    const videos = await page.locator("video").evaluateAll(elements => elements.map(el => (el as HTMLVideoElement).currentTime));
    return videos.some(time => Math.abs(time - 9) < .1);
  }).toBe(true);
  await expect(concordance).toContainText("Expressions · 0:09.000");
  await expect(concordance.locator('[data-source-clock-concordance-primary="on-beat"]')).toContainText("tense");
  await concordance.getByRole("button", { name: "Previous Expressions evidence" }).click();
  await expect.poll(async () => {
    const videos = await page.locator("video").evaluateAll(elements => elements.map(el => (el as HTMLVideoElement).currentTime));
    return videos.some(time => Math.abs(time - 8) < .1);
  }).toBe(true);
  await expect(concordance).toContainText("Expressions · 0:08.000");
  await concordance.getByRole("button", { name: "Concordance", exact: true }).click();
  await expect(concordance.locator('[data-source-clock-concordance-frame="true"]')).toBeVisible();
  await expect(concordance.locator('[data-source-clock-concordance-lane="before"]')).toContainText("emphatic");
  await expect(concordance.locator('[data-source-clock-concordance-lane="on-beat"]')).toContainText("reflective");
  await expect(concordance.locator('[data-source-clock-concordance-lane="after"]')).toContainText("tense");
  await expect(page.locator('[data-source-clock-relation="on-beat"]')).toHaveCount(1);
  await expect(page.locator('[data-source-clock-relation="before"]')).toHaveCount(1);
  await expect(page.locator('[data-source-clock-relation="after"]')).toHaveCount(1);
});
