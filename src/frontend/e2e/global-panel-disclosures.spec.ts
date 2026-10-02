import { expect, test } from "@playwright/test";

test("legacy panel disclosures inherit global shuffle, fill, detach, and return controls", async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => window.localStorage.removeItem("vaa1.panel-section-order.global.DownloadPanel"));
  await page.goto("/dashboard?activeProject=bond-cop30-helsinki&workspace=default");
  await page.getByRole("button", { name: /Select video NO_TIME_TO_DIE_Trailer_UK/ }).click();

  const tab = page.locator(".lm_tab").filter({ hasText: /^Downloads$/ }).last();
  await expect(tab).toBeVisible({ timeout: 60_000 });
  await tab.evaluate((element: HTMLElement) => element.click());
  const stack = tab.locator("xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' lm_stack ')][1]");
  const leaf = stack.locator('[data-vaa1-panel-leaf]:visible');
  const sections = leaf.locator('details[data-vaa1-global-disclosure-id]');
  await expect.poll(() => sections.count(), { timeout: 60_000 }).toBeGreaterThan(3);

  const topLevelSections = sections.filter({ has: page.locator(":scope > summary > [data-vaa1-global-disclosure-controls]") });
  const count = await topLevelSections.count();
  for (let index = 0; index < count; index += 1) await expect(topLevelSections.nth(index)).not.toHaveAttribute("open", "");

  const visualTitles = await topLevelSections.evaluateAll((elements) => elements
    .map((element) => ({
      title: (element.querySelector(":scope > summary")?.textContent || "").replace(/[↕⛶↗]/g, "").trim(),
      y: element.getBoundingClientRect().y,
    }))
    .sort((left, right) => left.y - right.y)
    .map((item) => item.title));
  expect(visualTitles).toEqual([...visualTitles].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" })));

  const first = topLevelSections.nth(0);
  const controls = first.locator(':scope > summary > [data-vaa1-global-disclosure-controls]');
  const summaryBounds = await first.locator(":scope > summary").boundingBox();
  const controlsBounds = await controls.boundingBox();
  expect(summaryBounds && controlsBounds && controlsBounds.x > summaryBounds.x + summaryBounds.width / 2).toBe(true);
  await controls.getByRole("button", { name: "Drag to reorder" }).hover();
  await expect(controls.getByRole("tooltip", { name: "Drag to reorder" })).toBeVisible();

  await controls.getByRole("button", { name: "Fill panel" }).click();
  await expect(first).toHaveAttribute("open", "");
  await expect(first).toHaveAttribute("data-vaa1-global-filled", "true");
  const leafBounds = await leaf.boundingBox();
  const filledBounds = await first.boundingBox();
  expect(leafBounds && filledBounds && Math.abs(leafBounds.height - filledBounds.height) < 8).toBe(true);
  await first.getByRole("button", { name: "Return" }).click();
  await expect(first).not.toHaveAttribute("data-vaa1-global-filled", "true");

  const popupPromise = context.waitForEvent("page");
  await first.getByRole("button", { name: "Detach to another screen" }).click();
  const popup = await popupPromise;
  await expect(page.getByText(/is open in a separate window/)).toBeVisible();
  await popup.close();
  await expect(leaf).toBeVisible();
  await expect(first).toBeVisible();
});
