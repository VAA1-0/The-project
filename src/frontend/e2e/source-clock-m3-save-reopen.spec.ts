import { expect, test } from "@playwright/test";

const ID = "clock-acceptance-5324d4dd643a453bb188c33657a6b227";
const OTHER = "clock-acceptance-bdf5e416bdd54be4be30454aea9f6b09";
const A_REVISION = "clock-v1:090136e316575f653476b21e6baf01178e5bcd9a1b19d7e56bfe228c2d2e9e66";
const B_REVISION = "clock-v1:e20598f9dc29a2c1dc6ce51d791fe9c79193883e11af2dfb2e2fadc638f7aac1";
const CORRECTIONS = `/api/local-analysis/${ID}/download/annotation_corrections`;
const MARKER = "M3 interval continuity marker";

test("M3 interval correction saves, verifies, and survives close/reopen", async ({ page, request }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/dashboard?activeProject=source-clock-acceptance");
  await page.locator(`[role="button"][data-analysis-id="${ID}"]`).click();
  await page.locator(".lm_tab").filter({ hasText: /^Transcript$/ }).evaluate((tab: HTMLElement) => tab.click());

  const transcript = page.locator("main:visible").filter({ hasText: "Transcript governance" }).last();
  const addMarker = transcript.getByRole("button", { name: "Add marker", exact: true });
  await expect(addMarker).toBeEnabled({ timeout: 90_000 });
  await addMarker.click();
  const editor = transcript.getByText("New transcript marker", { exact: true }).locator("..").locator("..").locator("..");
  await editor.locator("input").nth(0).fill("71.000");
  await editor.locator("input").nth(1).fill("72.250");
  await editor.getByPlaceholder("Leave blank to mark as Unconfirmed").fill(MARKER);
  await editor.locator("select").nth(0).selectOption("confirmed");
  await editor.getByPlaceholder("Optional analyst note").fill("M3 save/reopen/restart/undo acceptance");
  await editor.getByRole("button", { name: "Save in panel", exact: true }).click();
  await expect.poll(async () => {
    const saved = await (await request.get(CORRECTIONS)).json();
    return saved.manual_transcript_entries?.some((entry: any) => entry.text === MARKER);
  }, { timeout: 30_000 }).toBe(true);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), `vaa1.annotation.corrections.history.${ID}`)).not.toBeNull();

  await page.locator(`[role="button"][data-analysis-id="${OTHER}"]`).click();
  await expect(page.locator('[data-source-clock-browser="true"]').first()).toHaveAttribute("title", B_REVISION, { timeout: 90_000 });
  await page.locator(`[role="button"][data-analysis-id="${ID}"]`).click();
  await expect(page.locator('[data-source-clock-browser="true"]').first()).toHaveAttribute("title", A_REVISION, { timeout: 90_000 });
  await page.locator(".lm_tab").filter({ hasText: /^Transcript$/ }).evaluate((tab: HTMLElement) => tab.click());
  const transcriptAfterReopen = page.locator("main:visible").filter({ hasText: "Transcript governance" }).last();
  const reopenedClock = page.locator('[data-source-clock-browser="true"]:visible').last();
  await reopenedClock.getByLabel("Browse source time").fill("1:11.000");
  await reopenedClock.getByRole("button", { name: "Go", exact: true }).click();
  await expect(transcriptAfterReopen.getByText(/inside transcript interval 1:11\.000–1:12\.250/)).toBeVisible({ timeout: 30_000 });
  for (const word of MARKER.split(" ")) {
    await expect(transcriptAfterReopen.getByRole("button", { name: word, exact: true })).toBeAttached();
  }

  await page.context().storageState({ path: "/tmp/datascene-m3-storage-state.json" });
  await page.screenshot({ path: "../../docs/audits/source_clock_2026-09-29/m3-01-saved-reopened.png", fullPage: true });
});
