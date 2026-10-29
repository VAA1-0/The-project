import { expect, test, type Locator, type Page } from "@playwright/test";

function tabFor(page: Page, label: string): Locator {
  return page.locator(".lm_tab").filter({ hasText: new RegExp(`^${label}$`) }).last();
}

async function openAudio(page: Page): Promise<Locator> {
  let tab = tabFor(page, "Audio");
  if ((await tab.count()) === 0 || !(await tab.isVisible())) {
    await page.getByRole("button", { name: "Window", exact: true }).click();
    await page.getByRole("button", { name: "Audio", exact: true }).click();
    tab = tabFor(page, "Audio");
  }
  await expect(tab).toBeVisible();
  await tab.evaluate((element: HTMLElement) => element.click());
  return tab.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' lm_stack ')][1]");
}

test("Audio explores Master Schema Narrative Agent families without exposing technical speaker buckets", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/dashboard?activeProject=bond-cop30-helsinki&workspace=default");
  await page.locator('[role="button"][data-analysis-id="81920e95-a0b2-4173-bc23-86db7909a0a9"]').click();

  await openAudio(page);
  const audioPanel = page.locator('[data-vaa1-panel="audio-workbench"]').last();
  await expect(audioPanel).toBeVisible({ timeout: 120_000 });
  await audioPanel.getByRole("button", { name: /Audio recognition governance · Narrative Agent family exploration/ }).click();
  const workbench = audioPanel.locator('[data-vaa1-audio-cluster-exploration="true"]');
  await expect(workbench).toBeVisible({ timeout: 60_000 });

  const families = workbench.locator('[data-vaa1-narrative-agent-audio-family]');
  await expect.poll(() => families.count()).toBeGreaterThan(2);
  await expect(workbench.locator('[data-vaa1-narrative-agent-audio-family="James Bond"]')).toHaveCount(1);
  for (const nonAgent of ["007", "Car", "Weapon", "Identity affirmed", "reassuring"]) {
    await expect(workbench.locator(`[data-vaa1-narrative-agent-audio-family="${nonAgent}"]`)).toHaveCount(0);
  }
  const nomi = workbench.locator('[data-vaa1-narrative-agent-audio-family="Nomi"]');
  await expect(nomi).toHaveCount(1);
  await workbench.locator('[data-vaa1-audio-family-destination-list="true"]').getByRole("button", { name: /Nomi/ }).click();
  await expect(nomi).toBeVisible();
  await expect(nomi).toContainText(/confirmed audio seed|constellational candidates/);
  await expect.poll(() => nomi.locator('[data-vaa1-narrative-agent-audio-candidate="true"]').count()).toBeGreaterThan(0);
  await expect.poll(() => nomi.getByRole("combobox", { name: /Confirm audio sample at/ }).count()).toBeGreaterThan(0);
  await expect.poll(() => nomi.locator('[data-vaa1-audio-candidate-transcript="true"]').count()).toBeGreaterThan(0);
  await expect(nomi.locator('[data-vaa1-audio-candidate-transcript="true"]').first()).not.toHaveText("No overlapping transcript line");
  await expect(nomi.locator('[data-vaa1-semantic-family-metrics="true"]')).toContainText("Cohesion");
  await expect(nomi.locator('[data-vaa1-semantic-representative="true"]')).toHaveCount(1);
  await expect(nomi.locator('[data-vaa1-semantic-uncertain="true"]')).toHaveCount(1);
  await expect(nomi.locator('[data-vaa1-nearest-competing-family="true"]')).toBeVisible();

  await workbench.locator('[data-vaa1-semantic-threshold-preview="true"] summary').click();
  const threshold = workbench.getByRole("slider", { name: "Narrative Agent semantic candidate threshold" });
  const baselineCandidateCount = await nomi.locator('[data-vaa1-narrative-agent-audio-candidate="true"]').count();
  await threshold.fill("0.95");
  await expect.poll(() => nomi.locator('[data-vaa1-narrative-agent-audio-candidate="true"]').count()).toBeLessThan(baselineCandidateCount);
  await expect(nomi.locator('[data-vaa1-semantic-excluded-sample="true"]')).not.toHaveCount(0);
  await expect(workbench).toContainText("Preview changes review membership only and never writes governed data");
  await threshold.fill("0.65");

  await expect(audioPanel).not.toContainText("SPEAKER_00");
  await expect(audioPanel).not.toContainText("SPEAKER_01");
  await expect(workbench.locator('[data-vaa1-technical-diarization-provenance="true"]')).toHaveCount(0);

  await nomi.locator('[data-vaa1-narrative-agent-audio-candidate="true"] button').first().click();
  await expect(audioPanel.locator('[data-vaa1-audio-active-evidence="true"]')).toBeVisible();

  const matureSeed = nomi.locator('[data-vaa1-narrative-agent-audio-candidate="true"][data-candidate-status="confirmed"]').first();
  await expect(matureSeed).toBeVisible();
  const savedIdentity = await matureSeed.getByRole("combobox", { name: /Confirm audio sample at/ }).inputValue();
  const savedStart = await matureSeed.getByRole("slider", { name: /Start boundary/ }).inputValue();
  const savedEnd = await matureSeed.getByRole("slider", { name: /End boundary/ }).inputValue();
  await page.reload();
  const reopenedPanel = await openAudio(page);
  const reopenedAudio = reopenedPanel.locator('[data-vaa1-panel="audio-workbench"]').last();
  await reopenedAudio.getByRole("button", { name: /Audio recognition governance · Narrative Agent family exploration/ }).click();
  await reopenedAudio.locator('[data-vaa1-audio-family-destination-list="true"]').getByRole("button", { name: /Nomi/ }).click();
  const reopenedNomi = reopenedAudio.locator('[data-vaa1-narrative-agent-audio-family="Nomi"]');
  const reopenedSeed = reopenedNomi.locator('[data-vaa1-narrative-agent-audio-candidate="true"][data-candidate-status="confirmed"]').first();
  await expect(reopenedSeed.getByRole("combobox", { name: /Confirm audio sample at/ })).toHaveValue(savedIdentity);
  await expect(reopenedSeed.getByRole("slider", { name: /Start boundary/ })).toHaveValue(savedStart);
  await expect(reopenedSeed.getByRole("slider", { name: /End boundary/ })).toHaveValue(savedEnd);
});
