import { expect, test } from "@playwright/test";

const ID = "clock-acceptance-5324d4dd643a453bb188c33657a6b227";
const CORRECTIONS = `/api/local-analysis/${ID}/download/annotation_corrections?project_id=source-clock-acceptance&context_analysis_id=${ID}`;
const MARKER = "M3 interval continuity marker";

test.use({ storageState: "/tmp/datascene-m3-storage-state.json" });

test("M3 interval survives restart and guarded undo appends history", async ({ page, request }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/dashboard?activeProject=source-clock-acceptance");
  await page.locator(`[role="button"][data-analysis-id="${ID}"]`).click();
  await page.locator(".lm_tab").filter({ hasText: /^Transcript$/ }).evaluate((tab: HTMLElement) => tab.click());
  const transcript = page.locator("main:visible").filter({ hasText: "Transcript governance" }).last();
  const clock = page.locator('[data-source-clock-browser="true"]:visible').last();
  await clock.getByLabel("Browse source time").fill("1:11.000");
  await clock.getByRole("button", { name: "Go", exact: true }).click();
  await expect(transcript.getByText(/inside transcript interval 1:11\.000–1:12\.250/)).toBeVisible({ timeout: 90_000 });
  for (const word of MARKER.split(" ")) {
    await expect(transcript.getByRole("button", { name: word, exact: true })).toBeAttached();
  }

  const before = await (await request.get(CORRECTIONS)).json();
  const historyBefore = before.correction_undo_history?.length || 0;
  await page.getByRole("button", { name: "Undo last correction", exact: true }).click();

  await expect.poll(async () => {
    const saved = await (await request.get(CORRECTIONS)).json();
    return saved.manual_transcript_entries?.some((entry: any) => entry.text === MARKER) ?? false;
  }, { timeout: 30_000 }).toBe(false);
  const after = await (await request.get(CORRECTIONS)).json();
  expect(after.correction_undo_history).toHaveLength(historyBefore + 1);
  expect(after.correction_undo_history.at(-1)?.action).toBe("restore_correction_members");
  expect(after.correction_generation).not.toBe(before.correction_generation);

  await page.screenshot({ path: "../../docs/audits/source_clock_2026-09-29/m3-02-post-restart-undo.png", fullPage: true });
});
