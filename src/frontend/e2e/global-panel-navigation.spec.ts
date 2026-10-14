import { expect, test } from "@playwright/test";

test("global panel controls save and refresh without remounting the working leaf", async ({ page }) => {
  await page.goto("/dashboard");
  const leaf = page.locator('[data-vaa1-panel-leaf="true"]:visible').first();
  await expect(leaf).toBeVisible();
  const controls = leaf.locator('[data-vaa1-global-panel-navigation="true"]');
  await expect(controls).toBeVisible();
  await expect(controls.getByRole("button", { name: "Save panel" })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Refresh panel" })).toBeVisible();

  await leaf.evaluate((node) => {
    (node as HTMLElement).dataset.renderedPanelIdentity = "preserve-me";
  });

  await controls.getByRole("button", { name: "Save panel" }).click();
  await expect(controls.getByText("Saved", { exact: true })).toBeVisible();
  await expect(leaf).toHaveAttribute("data-rendered-panel-identity", "preserve-me");

  await controls.getByRole("button", { name: "Refresh panel" }).click();
  await expect(controls.getByText("Updated", { exact: true })).toBeVisible();
  await expect(leaf).toHaveAttribute("data-rendered-panel-identity", "preserve-me");
});
