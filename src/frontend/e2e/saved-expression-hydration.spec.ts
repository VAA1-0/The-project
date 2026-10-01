import { expect, test } from "@playwright/test";

test("expressions recover from a backend body timeout in both panel and video", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const url = String(args[0]);
      if (url.includes("/api/download/") && url.includes("/expression_json")) {
        // Successful headers followed by a timed-out response body.
        const response = new Response("[]", { status: 200 });
        response.blob = async () => { throw new DOMException("Body timed out", "TimeoutError"); };
        return response;
      }
      return originalFetch(...args);
    };
  });
  await page.goto("/dashboard?activeProject=bond-cop30-helsinki");
  await page.getByRole("button", { name: /Select video NO_TIME_TO_DIE_Trailer_UK/ }).click();
  await expect(page.getByRole("button", { name: "Expressions 49", exact: true })).toBeVisible({ timeout: 90_000 });
  await page.locator(".lm_tab").filter({ hasText: /^Expressions$/ }).evaluate((tab: HTMLElement) => tab.click());
  await expect(page.getByText(/49 source-linked expression detections/)).toBeVisible();
  await expect(page.getByText("No expression results", { exact: true })).toHaveCount(0);
  await expect(page.getByText("concerned", { exact: true }).first()).toBeVisible();
  await page.locator(".lm_tab").filter({ hasText: /^Expressions$/ }).locator(".lm_close_tab").click();
  await page.getByText("Lenses", { exact: true }).click();
  await page.getByText("Expression Lens", { exact: true }).click();
  await expect(page.getByText(/49 source-linked expression detections/)).toBeVisible();
  await page.screenshot({ path: "../../docs/audits/system_check_2026-09-16/expressions-hydrated.png" });
});
