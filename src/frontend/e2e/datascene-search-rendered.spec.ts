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
  await expect(page.getByText(/analyses surfaced/)).toContainText("6 analyses surfaced");

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

  await expect(page.getByRole("button", { name: "Open" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Network" }).first()).toBeVisible();

  await expect(page.getByText("Unhandled Runtime Error")).toHaveCount(0);
  await expect(page.getByText("Console Error")).toHaveCount(0);
});

test("local saved-analysis fallbacks produce valid save bundles", async ({ request }) => {
  const analysisResponse = await request.get(
    "/api/local-analysis/a3a4cddb-6ff6-40b0-aa84-b4465e371451/bundle",
  );
  expect(analysisResponse.ok()).toBeTruthy();
  const analysisBundle = await analysisResponse.body();
  expect(analysisBundle.subarray(0, 4).toString("hex")).toBe("504b0304");

  const projectResponse = await request.post("/api/local-project-bundle", {
    data: {
      project_name: "vaa1_project",
      analysis_ids: ["a3a4cddb-6ff6-40b0-aa84-b4465e371451"],
      matrices: {},
    },
  });
  expect(projectResponse.ok()).toBeTruthy();
  const projectBundle = await projectResponse.body();
  expect(projectBundle.subarray(0, 4).toString("hex")).toBe("504b0304");
});
