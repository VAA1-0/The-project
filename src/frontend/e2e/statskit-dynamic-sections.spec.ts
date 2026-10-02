import { expect, test } from "@playwright/test";

test("StatsKit sections reorder, fill, detach, and return to their host", async ({ page, context }) => {
  test.setTimeout(120_000);
  page.on("pageerror", (error) => console.error("StatsKit page error:", error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => window.localStorage.setItem(
    "vaa1.panel-section-order.statskit",
    JSON.stringify(["relevance-scanner", "significance-workbench", "stats-metadata", "stats-workbench", "visualization"]),
  ));
  await page.goto("/dashboard?activeProject=bond-cop30-helsinki&workspace=default");
  await page.getByRole("button", { name: /Select video NO_TIME_TO_DIE_Trailer_UK/ }).click();
  await page.getByRole("button", { name: "Lenses", exact: true }).click();
  await page.getByRole("button", { name: "StatsKit", exact: true }).click();
  const tab = page.locator(".lm_tab").filter({ hasText: /^StatsKit$/ }).last();
  await tab.evaluate((element: HTMLElement) => element.click());
  const stack = tab.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' lm_stack ')][1]");
  const group = stack.locator('[data-vaa1-dynamic-panel-section-group="statskit"]:visible');
  await expect(group).toBeVisible({ timeout: 60_000 });
  const leaf = group.locator("xpath=ancestor::*[@data-vaa1-panel-leaf][1]");

  const titles = await group.locator("[data-vaa1-dynamic-panel-section] > header button:first-of-type > span:first-child > span:first-child").allTextContents();
  expect(titles).toEqual([...titles].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" })));
  const disclosures = group.locator('[data-vaa1-dynamic-panel-section] > header button[aria-expanded]');
  await expect(disclosures).toHaveCount(titles.length);
  for (let index = 0; index < titles.length; index += 1) {
    await expect(disclosures.nth(index)).toHaveAttribute("aria-expanded", "false");
    await expect(disclosures.nth(index)).toContainText("▸");
  }
  await expect(group.getByRole("button", { name: /Stats workbench table/ })).toContainText(/rows.*selected/);

  const visualization = group.locator('[data-vaa1-dynamic-panel-section="visualization"]');
  const relevance = group.locator('[data-vaa1-dynamic-panel-section="relevance-scanner"]');
  const dragHandle = visualization.locator('[data-vaa1-panel-section-drag-handle="visualization"]');
  await dragHandle.hover();
  await expect(visualization.getByRole("tooltip", { name: "Drag to reorder" })).toBeVisible();
  const titleBounds = await visualization.locator('header button[aria-expanded]').boundingBox();
  const controlsBounds = await visualization.locator('header nav[aria-label$="section controls"]').boundingBox();
  expect(titleBounds && controlsBounds && controlsBounds.x >= titleBounds.x + titleBounds.width).toBe(true);
  await dragHandle.dragTo(relevance.locator("header"));
  await expect.poll(async () => {
    const ids = await group.locator("[data-vaa1-dynamic-panel-section]").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-vaa1-dynamic-panel-section")));
    return ids.indexOf("visualization") + 1 === ids.indexOf("relevance-scanner");
  }).toBe(true);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("vaa1.panel-section-order.statskit"))).toContain("visualization");

  const workbench = group.locator('[data-vaa1-dynamic-panel-section="stats-workbench"]');
  await workbench.getByRole("button", { name: "Fill", exact: true }).click();
  const filledHost = leaf.locator('[data-vaa1-filled-section-host="stats-workbench"]');
  const filledVisualization = filledHost.locator('[data-vaa1-dynamic-panel-section="stats-workbench"]');
  await expect(filledHost).toBeVisible();
  await expect(filledVisualization).toHaveClass(/h-full/);
  const filledBody = filledVisualization.locator(":scope > div");
  await expect(filledBody).toHaveClass(/overflow-auto/);
  await expect(filledVisualization.locator('header button[aria-expanded]')).toHaveAttribute("aria-expanded", "true");
  const leafBounds = await leaf.boundingBox();
  const filledBounds = await filledHost.boundingBox();
  expect(leafBounds && filledBounds && Math.abs(leafBounds.height - filledBounds.height) < 8).toBe(true);
  await expect.poll(
    () => filledVisualization.locator('[data-vaa1-statskit-selectable-row="true"]').count(),
    { timeout: 60_000 },
  ).toBeGreaterThan(10);
  const scrollGeometry = await filledBody.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return { clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, scrollTop: element.scrollTop };
  });
  expect(scrollGeometry.scrollHeight).toBeGreaterThan(scrollGeometry.clientHeight);
  expect(scrollGeometry.scrollTop).toBeGreaterThan(0);
  await expect(filledVisualization.locator('[data-vaa1-statskit-selectable-row="true"]').last()).toBeVisible();
  await filledVisualization.getByRole("button", { name: "Return", exact: true }).click();
  await expect(filledHost).toHaveCount(0);
  await expect(workbench).toBeVisible();

  const popupPromise = context.waitForEvent("page");
  await visualization.getByRole("button", { name: "Detach", exact: true }).click();
  const popup = await popupPromise;
  await expect(group.locator('[data-vaa1-detached-section-placeholder="visualization"]')).toBeVisible();
  await popup.close();
  await expect(group.locator('[data-vaa1-dynamic-panel-section="visualization"]')).toBeVisible();
});
