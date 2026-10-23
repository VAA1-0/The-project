import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("vaa1.workspace.layout");
  });
});

test("Datascene Search surfaces saved analyses and source-linked records", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.locator(".lm_goldenlayout")).toBeVisible();
  await expect(page.getByText("brazil_complete.mp4")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("NO_TIME_TO_DIE_Trailer_UK")).toBeVisible();

  await page.getByRole("button", { name: "Lenses" }).click();
  await page.getByRole("button", { name: "Search" }).click();

  const searchPanel = page.locator("text=DATASCENE SEARCH").locator("..").locator("..").locator("..");
  await expect(page.locator(".lm_tab").filter({ hasText: "Search" })).toHaveCount(1);
  await expect(page.getByText("DATASCENE SEARCH")).toBeVisible();
  await expect
    .poll(async () => {
      const label = await searchPanel.getByText(/analyses surfaced/).textContent();
      return Number(label?.match(/(\d+)\s+analyses surfaced/)?.[1] || 0);
    })
    .toBeGreaterThanOrEqual(2);

  await page.locator("select").filter({ hasText: "brazil_complete.mp4" }).selectOption({
    label: "brazil_complete.mp4 [completed]",
  });

  await expect
    .poll(
      async () => {
        const label = await searchPanel.getByText(/indexed records/).textContent();
        return Number(label?.match(/(\d+)\s+indexed records/)?.[1] || 0);
      },
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
  const firstResult = page.locator('[data-datascene-search-result="true"]').first();
  await expect(firstResult).toBeVisible({
    timeout: 30_000,
  });
  await firstResult.locator("summary").evaluate((element: HTMLElement) => element.click());

  await expect(firstResult.getByRole("button", { name: "Open" })).toBeVisible();
  await expect(firstResult.getByRole("button", { name: "Network" })).toBeVisible();

  await expect(page.getByText("Unhandled Runtime Error")).toHaveCount(0);
  await expect(page.getByText("Console Error")).toHaveCount(0);
});

test("local saved-analysis fallbacks produce valid save bundles", async ({ request }) => {
  const analysisId = "81920e95-a0b2-4173-bc23-86db7909a0a9";
  const analysisResponse = await request.get(
    `/api/local-analysis/${analysisId}/bundle?project_id=bond-cop30-helsinki&context_analysis_id=${analysisId}`,
  );
  expect(analysisResponse.ok()).toBeTruthy();
  const analysisBundle = await analysisResponse.body();
  expect(analysisBundle.subarray(0, 4).toString("hex")).toBe("504b0304");

  const projectResponse = await request.post("/api/local-project-bundle", {
    data: {
      project_name: "vaa1_project",
      project_id: "bond-cop30-helsinki",
      context_analysis_id: analysisId,
      analysis_ids: [analysisId],
      matrices: {},
    },
  });
  expect(projectResponse.ok()).toBeTruthy();
  const projectBundle = await projectResponse.body();
  expect(projectBundle.subarray(0, 4).toString("hex")).toBe("504b0304");
});
