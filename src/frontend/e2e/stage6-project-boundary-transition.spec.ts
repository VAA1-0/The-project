import { expect, test } from "@playwright/test";
import { stat } from "node:fs/promises";
import path from "node:path";

const SOURCE_PROJECT = "research-test-2-20226-cop30-vids";
const BOND_PROJECT = "bond-cop30-helsinki";
const BOND_BUNDLE = path.resolve(
  process.cwd(),
  "../../outputs/runtime/project-bundles/bond-cop30-helsinki-six-source-boundary-verified.zip",
);

test.describe.serial("Stage 6 customer project transition", () => {
  test("saves the active project with its project identity", async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(`/dashboard?activeProject=${SOURCE_PROJECT}&workspace=default`);
    await expect(page.getByText("CNN.mp4", { exact: true }).first()).toBeVisible();

    await page.getByText("File", { exact: true }).click();
    const downloadPromise = page.waitForEvent("download", { timeout: 300_000 });
    await page.getByText("Save Project", { exact: true }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe(`${SOURCE_PROJECT}_project_bundle.zip`);
    const downloadedPath = await download.path();
    expect(downloadedPath).toBeTruthy();
    expect((await stat(downloadedPath!)).size).toBeGreaterThan(1_000_000);
  });

  test("keeps the restored Bond catalogue in its own scope without source-project bleeding", async ({ page }) => {
    test.setTimeout(120_000);
    // The archive import itself is covered by isolated backend contract tests.
    // A rendered release gate must never re-import a production fixture into
    // the live saved-work catalogue on every run.
    expect((await stat(BOND_BUNDLE)).size).toBeGreaterThan(1_000_000);
    await page.goto(`/dashboard?activeProject=${BOND_PROJECT}&workspace=default`);
    await expect(
      page.getByText("NO_TIME_TO_DIE_Trailer_UK_-_James_Bond_007_720p_h264.mp4", {
        exact: true,
      }).first(),
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("CNN.mp4", { exact: true })).toHaveCount(0);

    const boundaryAudit = await page.evaluate(async ({ bondProject, sourceProject }) => {
      const [bondResponse, sourceResponse] = await Promise.all([
        fetch(`http://127.0.0.1:8000/api/analyses?limit=200&project_id=${encodeURIComponent(bondProject)}`),
        fetch(`http://127.0.0.1:8000/api/analyses?limit=200&project_id=${encodeURIComponent(sourceProject)}`),
      ]);
      const bond = await bondResponse.json();
      const source = await sourceResponse.json();
      return {
        bond: Object.values(bond.analyses || {}).map((item: any) => item.project_id),
        source: Object.values(source.analyses || {}).map((item: any) => item.project_id),
      };
    }, { bondProject: BOND_PROJECT, sourceProject: SOURCE_PROJECT });

    expect(new Set(boundaryAudit.bond)).toEqual(new Set([BOND_PROJECT]));
    expect(boundaryAudit.bond.every((projectId) => projectId === BOND_PROJECT)).toBe(true);
    expect(boundaryAudit.source.every((projectId) => projectId === SOURCE_PROJECT)).toBe(true);
  });

  test("surfaces the Bond analysis and its associated panels in the UI", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 2560, height: 1440 });
    const catalogue = await (await page.request.get(
      `http://127.0.0.1:8000/api/analyses?limit=200&project_id=${BOND_PROJECT}`,
    )).json();
    const entries = Object.entries(catalogue.analyses || {}) as Array<[string, any]>;
    const bondAnalysisId = entries.find(([, row]) => row.filename === "NO_TIME_TO_DIE_Trailer_UK_-_James_Bond_007_720p_h264.mp4")?.[0];
    expect(bondAnalysisId).toBeTruthy();
    await page.goto(
      `/dashboard?activeProject=${BOND_PROJECT}&workspace=default&analysis_id=${bondAnalysisId}`,
    );
    await expect(page.locator(".lm_goldenlayout")).toBeVisible();

    await expect(page.getByRole("button", { name: /Select video/ })).toHaveCount(entries.length);
    for (const expectedSource of [
      "brazil_complete.mp4",
      "english_brazil_short.mp4",
      "NO_TIME_TO_DIE_Trailer_UK",
      "Diamonds_Are_Forever_1971_James_Bond.mp4",
      "vaa1_working_checkpoint_2026-03-25.mp4",
      "Galaxy Song",
    ]) {
      await expect(page.getByText(expectedSource, { exact: false }).first()).toBeVisible();
    }

    await expect(page.getByText("NO_TIME_TO_DIE_Trailer_UK", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("No Video Selected")).toHaveCount(0, { timeout: 60_000 });
    await expect(page.locator(".lm_tab").filter({ hasText: /^Transcript$/ })).toHaveCount(1);
    await expect(page.locator(".lm_tab").filter({ hasText: /^Objects$/ })).toHaveCount(1);
    await expect(page.locator(".lm_tab").filter({ hasText: /^OCR$/ })).toHaveCount(1);
    await expect(page.getByText("CNN.mp4", { exact: true })).toHaveCount(0);
    await expect(page.getByText("PROJECT BOUNDARY VIOLATION", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Unhandled Runtime Error")).toHaveCount(0);
  });
});
