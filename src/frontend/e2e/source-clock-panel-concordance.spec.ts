import { expect, test } from "@playwright/test";

async function openSurface(page: import("@playwright/test").Page, tabLabel: string, menu: "Lenses" | "Window", item: string) {
  let tab = page.locator(".lm_tab").filter({ hasText: new RegExp(`^${tabLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).last();
  if ((await tab.count()) === 0 || !(await tab.last().isVisible())) {
    await page.getByRole("button", { name: menu, exact: true }).click();
    await page.getByRole("button", { name: item, exact: true }).click();
    tab = page.locator(".lm_tab").filter({ hasText: new RegExp(`^${tabLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) }).last();
  }
  await expect(tab).toBeVisible();
  await tab.evaluate((element: HTMLElement) => element.click());
  return tab.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' lm_stack ')][1]");
}

test("Transcript concordance navigation moves the global clock and Video frame", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/dashboard?activeProject=bond-cop30-helsinki&workspace=default");
  await page.getByRole("button", { name: /Select video NO_TIME_TO_DIE_Trailer_UK/ }).click();
  const tab = page.locator(".lm_tab").filter({ hasText: /^Transcript$/ });
  await tab.evaluate((element: HTMLElement) => element.click());
  const stack = tab.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' lm_stack ')][1]");
  const browser = stack.locator('[data-source-clock-browser="true"]:visible');
  await browser.getByLabel("Browse source time").fill("1:08.200");
  await browser.getByRole("button", { name: "Go", exact: true }).click();

  const rail = stack.locator('[data-panel-source-clock-concordance="Transcript"]:visible');
  await expect(rail.locator('[data-source-clock-concordance-primary="on-beat"]')).toContainText("If you feel yourself losing control");
  await rail.getByRole("button", { name: "Next Transcript evidence" }).click();

  await expect(rail).toContainText("Transcript · 1:14.960");
  await expect(rail.locator('[data-source-clock-concordance-primary="on-beat"]')).toContainText("Control");
  await expect.poll(async () => {
    const times = await page.locator("video").evaluateAll(elements => elements.map(element => (element as HTMLVideoElement).currentTime));
    return times.some(time => Math.abs(time - 74.96) < 0.1);
  }).toBe(true);
});

test("all on-beat detections surface and Meaning Plot follows associated graph nodes", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/dashboard?activeProject=bond-cop30-helsinki&workspace=default");
  await page.getByRole("button", { name: /Select video NO_TIME_TO_DIE_Trailer_UK/ }).click();

  const searchStack = await openSurface(page, "Search", "Lenses", "Search");
  const searchBrowser = searchStack.locator('[data-source-clock-browser="true"]:visible');
  await expect(searchBrowser).toContainText("global · revision bound", { timeout: 30_000 });
  await searchBrowser.getByLabel("Browse source time").fill("1:08.200");
  await searchBrowser.getByRole("button", { name: "Go", exact: true }).click();
  const searchRail = searchStack.locator('[data-panel-source-clock-concordance="Search"]:visible');
  const searchOnBeat = searchRail.locator('[data-source-clock-on-beat-detection]');
  await expect(searchOnBeat.first()).toBeVisible();
  expect(await searchOnBeat.count()).toBeGreaterThan(1);
  await expect(searchRail.locator('[data-source-clock-concordance-primary="on-beat"]')).not.toContainText("additional on-beat");

  const meaningStack = await openSurface(page, "Meaning / Plot", "Window", "Meaning / Plot");
  const graphConcordance = meaningStack.locator('[data-vaa1-meaning-network-cursor-concordance="true"]:visible');
  await expect(graphConcordance).toContainText("1:08.200", { timeout: 90_000 });
  await expect(graphConcordance.locator('[data-vaa1-meaning-network-cursor-node]').first()).toBeVisible();
  await expect(meaningStack.locator('[data-vaa1-meaning-network-active-at-cursor="true"]').first()).toBeVisible();
  const graphViewport = meaningStack.locator('[data-vaa1-meaning-network-scrollable-graph="true"]:visible');
  await expect.poll(() => graphViewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
});

test("Scene Cards, Quant and POS resolve the same beat without contradictory surfacing", async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/dashboard?activeProject=bond-cop30-helsinki&workspace=default");
  await page.getByRole("button", { name: /Select video NO_TIME_TO_DIE_Trailer_UK/ }).click();

  const quantStack = await openSurface(page, "Quant", "Lenses", "Quantitative Analysis");
  const quantBrowser = quantStack.locator('[data-source-clock-browser="true"]:visible');
  await expect(quantBrowser).toContainText("global · revision bound", { timeout: 60_000 });
  await quantBrowser.getByLabel("Browse source time").fill("1:08.200");
  await quantBrowser.getByRole("button", { name: "Go", exact: true }).click();
  const quantHits = quantStack.locator('[data-panel-source-clock-concordance="Quant"] [data-source-clock-on-beat-detection]');
  await expect(quantHits.first()).toBeVisible();
  const quantKeys = await quantHits.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-source-clock-on-beat-detection")));
  expect(new Set(quantKeys).size).toBe(quantKeys.length);
  expect(quantKeys.length).toBeLessThan(19);

  const posStack = await openSurface(page, "POS", "Lenses", "POS analysis Lens");
  const posRail = posStack.locator('[data-panel-source-clock-concordance="POS"]:visible');
  await expect(posRail.locator('[data-source-clock-on-beat-detection]').first()).toBeVisible();
  await expect(posRail).toContainText("POS occurrence linked to transcript interval");
  await expect(posRail).not.toContainText("aggregate-only");

  const sceneStack = await openSurface(page, "Scene Cards", "Lenses", "Scene Cards");
  const sceneRail = sceneStack.locator('[data-panel-source-clock-concordance="Scene Cards"]:visible');
  await expect(sceneRail).toContainText("Scene Card 003");
  const sceneThree = sceneStack.locator('[data-scene-card-id]').filter({ hasText: "Scene Card 003" });
  await expect(sceneThree).toHaveClass(/border-lime-500/);
  await expect(sceneThree).toContainText("0:48.000");
});
