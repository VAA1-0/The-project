import { expect, test, type Page } from "@playwright/test";

async function openAudio(page: Page) {
  let tab = page.locator(".lm_tab").filter({ hasText: /^Audio$/ }).last();
  if ((await tab.count()) === 0) {
    await page.getByRole("button", { name: "Window", exact: true }).click();
    await page.getByRole("button", { name: "Audio", exact: true }).click();
    tab = page.locator(".lm_tab").filter({ hasText: /^Audio$/ }).last();
  }
  await tab.evaluate((element: HTMLElement) => element.click());
  return tab.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' lm_stack ')][1]");
}

test("Audio distinguishes missing binding, retrieval failure, and recovered ready state", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/dashboard?activeProject=research-test-2-20226-cop30-vids&workspace=default");
  let audioStack = await openAudio(page);
  await expect(audioStack.locator('[data-vaa1-panel-state="analysis-binding-unavailable"]')).toBeVisible();

  await page.route("**/api/status/*", (route) => route.fulfill({ status: 503, body: "Stage 4 injected status failure" }));
  await page.route("**/api/local-analysis/*", (route) => route.fulfill({ status: 503, body: "Stage 4 injected local-analysis failure" }));
  await page.getByRole("button", { name: /Select video CNN\.mp4/ }).click();
  await expect(audioStack.locator('[data-vaa1-panel-state="failed"]')).toContainText("Audio retrieval failed", { timeout: 60_000 });

  await page.unroute("**/api/status/*");
  await page.unroute("**/api/local-analysis/*");
  await page.reload();
  await page.getByRole("button", { name: /Select video CNN\.mp4/ }).click();
  audioStack = await openAudio(page);
  await expect(audioStack.locator('[data-vaa1-panel-state="ready"]')).toBeVisible({ timeout: 60_000 });
});
