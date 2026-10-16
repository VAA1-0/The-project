import { expect, test } from "@playwright/test";
import path from "node:path";

test("opens the Helsinki Galaxy Song analysis with its customer-facing identity", async ({ page }) => {
  test.setTimeout(180_000);
  const bundle = path.resolve(
    process.cwd(),
    "../../outputs/runtime/project-bundles/helsinki-galaxy-song-boundary-repair.zip",
  );
  await page.goto("/dashboard?activeProject=bond-cop30-helsinki&workspace=default");
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Saved project opened successfully with 1 analyses");
    await dialog.accept();
  });
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByText("File", { exact: true }).click();
  await page.getByText("Open Saved Work...", { exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(bundle);
  await expect(page).toHaveURL(/activeProject=bond-cop30-helsinki/, { timeout: 180_000 });
  await expect(page.getByText("Galaxy Song", { exact: false }).first()).toBeVisible({ timeout: 60_000 });
});
