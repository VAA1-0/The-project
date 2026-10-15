import { expect, test, type Locator, type Page } from "@playwright/test";

function tabFor(page: Page, label: string): Locator {
  return page.locator(".lm_tab").filter({ hasText: new RegExp(`^${label}$`) }).last();
}

async function activateTab(page: Page, label: string): Promise<Locator> {
  const tab = tabFor(page, label);
  await expect(tab).toBeVisible();
  await tab.evaluate((element: HTMLElement) => element.click());
  return tab.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' lm_stack ')][1]");
}

async function openAudio(page: Page): Promise<Locator> {
  let tab = tabFor(page, "Audio");
  if ((await tab.count()) === 0 || !(await tab.isVisible())) {
    await page.getByRole("button", { name: "Window", exact: true }).click();
    await page.getByRole("button", { name: "Audio", exact: true }).click();
    tab = tabFor(page, "Audio");
  }
  return activateTab(page, "Audio");
}

test("Stage 4 keeps Transcript and Audio evidence inspectable through Video, reopen, and source switch", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/dashboard?activeProject=research-test-2-20226-cop30-vids&workspace=default");
  await page.getByRole("button", { name: /Select video CNN\.mp4/ }).click();

  const transcriptStack = await activateTab(page, "Transcript");
  const transcriptClock = transcriptStack.locator('[data-source-clock-browser="true"]:visible');
  await expect(transcriptClock).toContainText("global · revision bound", { timeout: 60_000 });
  await transcriptClock.getByLabel("Browse source time").fill("0:03.780");
  await transcriptClock.getByRole("button", { name: "Go", exact: true }).click();
  const transcriptRow = transcriptStack.locator('[data-source-clock-nearest="true"]').last();
  await expect(transcriptRow).toBeVisible();
  await transcriptRow.click();
  await expect(transcriptRow).toHaveAttribute("data-vaa1-transcript-active-evidence", "true");

  const videoStack = await activateTab(page, "Video");
  await expect(videoStack.locator('[data-vaa1-focused-transcript-evidence="true"]')).toBeVisible();

  let audioStack = await openAudio(page);
  await audioStack.getByRole("button", { name: /Governed music, noise, and silence intervals/ }).click();
  const governedAudioRow = audioStack.locator('[data-vaa1-audio-evidence-row="true"]').first();
  await expect(governedAudioRow).toBeVisible({ timeout: 60_000 });
  await governedAudioRow.click();
  await expect(audioStack.locator('[data-vaa1-audio-active-evidence="true"]')).toBeVisible();
  await expect(governedAudioRow).toHaveAttribute("data-vaa1-audio-selected-row", "true");

  const audioSection = audioStack.locator('[data-vaa1-dynamic-panel-section="governed-sound-intervals"]');
  const popupPromise = page.context().waitForEvent("page");
  await audioSection.getByRole("button", { name: "Detach", exact: true }).click();
  const detachedAudio = await popupPromise;
  await expect(audioStack.locator('[data-vaa1-detached-section-placeholder="governed-sound-intervals"]')).toBeVisible();
  await expect(detachedAudio.locator('[data-vaa1-audio-selected-row="true"]')).toBeVisible();
  await detachedAudio.close();
  await expect(audioStack.locator('[data-vaa1-audio-selected-row="true"]')).toBeVisible();

  const videoAfterAudio = await activateTab(page, "Video");
  await expect(videoAfterAudio.locator('[data-vaa1-focused-audio-evidence="true"]')).toBeVisible();

  const audioTab = tabFor(page, "Audio");
  await audioTab.locator(".lm_close_tab").click();
  await expect(tabFor(page, "Audio")).toHaveCount(0);
  audioStack = await openAudio(page);
  await expect(audioStack.locator('[data-vaa1-audio-active-evidence="true"]')).toBeVisible();
  await audioStack.getByRole("button", { name: /Governed music, noise, and silence intervals/ }).click();
  await expect(audioStack.locator('[data-vaa1-audio-selected-row="true"]')).toBeVisible();

  const sourceButtons = page.getByRole("button", { name: /Select video/ });
  await expect.poll(() => sourceButtons.count()).toBeGreaterThan(1);
  await sourceButtons.nth(1).click();
  await expect(audioStack.locator('[data-vaa1-audio-active-evidence="true"]')).toHaveCount(0);
  await expect(audioStack.locator('[data-vaa1-audio-selected-row="true"]')).toHaveCount(0);
});
