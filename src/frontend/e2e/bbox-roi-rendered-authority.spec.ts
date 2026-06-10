import { expect, test, type Page } from "@playwright/test";
import {
  clientPointToNormalizedVideoPoint,
  getTrueVideoContentRect,
  projectNormalizedBoxToVideoContent,
  type DraftBox,
  type VideoContentRect,
} from "../lib/bbox-authority";

const FRAME = {
  width: 960,
  height: 620,
  intrinsicWidth: 1920,
  intrinsicHeight: 1080,
};

const MANUAL_BOX: DraftBox = {
  x: 0.105,
  y: 0.585,
  w: 0.315,
  h: 0.155,
};

function expectClose(actual: number, expected: number, label: string) {
  expect(Math.abs(actual - expected), label).toBeLessThanOrEqual(1);
}

function contentRectForFrame({
  width,
  height,
  intrinsicWidth = FRAME.intrinsicWidth,
  intrinsicHeight = FRAME.intrinsicHeight,
}: {
  width: number;
  height: number;
  intrinsicWidth?: number;
  intrinsicHeight?: number;
}): VideoContentRect {
  const rect = getTrueVideoContentRect({
    elementWidth: width,
    elementHeight: height,
    intrinsicWidth,
    intrinsicHeight,
  });
  if (!rect) {
    throw new Error("Expected a valid rendered video content rect");
  }
  return rect;
}

async function mountBBoxFixture(
  page: Page,
  {
    frameWidth = FRAME.width,
    frameHeight = FRAME.height,
    box = MANUAL_BOX,
  }: {
    frameWidth?: number;
    frameHeight?: number;
    box?: DraftBox;
  } = {},
) {
  const contentRect = contentRectForFrame({ width: frameWidth, height: frameHeight });

  await page.setContent(`
    <main>
      <div
        id="video-frame"
        data-vaa1-video-frame-fullscreen="true"
        style="position: relative; width: ${frameWidth}px; height: ${frameHeight}px; background: #020617; overflow: hidden;"
      >
        <div
          id="video-content"
          style="position: absolute; left: ${contentRect.x}px; top: ${contentRect.y}px; width: ${contentRect.width}px; height: ${contentRect.height}px; background: #111827;"
        >
          <div
            id="bbox"
            data-vaa1-bbox-roi-rendered-overlay="true"
            data-x="${box.x}"
            data-y="${box.y}"
            data-w="${box.w}"
            data-h="${box.h}"
            style="position: absolute; left: ${box.x * 100}%; top: ${box.y * 100}%; width: ${box.w * 100}%; height: ${box.h * 100}%; border: 2px solid #67e8f9; box-sizing: border-box; touch-action: none;"
          >
            <div
              id="resize-handle"
              data-vaa1-bbox-roi-move-handle="true"
              style="position: absolute; right: -6px; bottom: -6px; width: 14px; height: 14px; background: #67e8f9;"
            ></div>
          </div>
        </div>
      </div>
    </main>
    <script>
      const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
      const content = document.getElementById("video-content");
      const bbox = document.getElementById("bbox");
      const handle = document.getElementById("resize-handle");
      let drag = null;

      function readBox() {
        return {
          x: Number(bbox.dataset.x),
          y: Number(bbox.dataset.y),
          w: Number(bbox.dataset.w),
          h: Number(bbox.dataset.h),
        };
      }

      function writeBox(box) {
        bbox.dataset.x = String(box.x);
        bbox.dataset.y = String(box.y);
        bbox.dataset.w = String(box.w);
        bbox.dataset.h = String(box.h);
        bbox.style.left = (box.x * 100) + "%";
        bbox.style.top = (box.y * 100) + "%";
        bbox.style.width = (box.w * 100) + "%";
        bbox.style.height = (box.h * 100) + "%";
      }

      function point(event) {
        const rect = content.getBoundingClientRect();
        return {
          x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
          y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
        };
      }

      function begin(event, mode) {
        event.preventDefault();
        event.stopPropagation();
        bbox.setPointerCapture?.(event.pointerId);
        drag = { mode, startPoint: point(event), startBox: readBox() };
      }

      bbox.addEventListener("pointerdown", (event) => begin(event, "move"));
      handle.addEventListener("pointerdown", (event) => begin(event, "resize-se"));

      window.addEventListener("pointermove", (event) => {
        if (!drag) return;
        const current = point(event);
        const dx = current.x - drag.startPoint.x;
        const dy = current.y - drag.startPoint.y;
        const minSize = 0.004;
        if (drag.mode === "move") {
          writeBox({
            ...drag.startBox,
            x: clamp(drag.startBox.x + dx, 0, Math.max(0, 1 - drag.startBox.w)),
            y: clamp(drag.startBox.y + dy, 0, Math.max(0, 1 - drag.startBox.h)),
          });
          return;
        }
        const rawEndX = drag.startBox.x + drag.startBox.w + dx;
        const rawEndY = drag.startBox.y + drag.startBox.h + dy;
        const nextX = clamp(Math.min(drag.startBox.x, rawEndX), 0, 1 - minSize);
        const nextY = clamp(Math.min(drag.startBox.y, rawEndY), 0, 1 - minSize);
        writeBox({
          ...drag.startBox,
          x: nextX,
          y: nextY,
          w: clamp(Math.abs(rawEndX - drag.startBox.x), minSize, 1 - nextX),
          h: clamp(Math.abs(rawEndY - drag.startBox.y), minSize, 1 - nextY),
        });
      });

      window.addEventListener("pointerup", () => {
        drag = null;
      });
    </script>
  `);

  return contentRect;
}

async function measuredRects(page: Page) {
  return page.evaluate(() => {
    const frame = document.getElementById("video-frame")!.getBoundingClientRect();
    const content = document.getElementById("video-content")!.getBoundingClientRect();
    const bbox = document.getElementById("bbox")!.getBoundingClientRect();
    const box = document.getElementById("bbox") as HTMLElement;
    return {
      frame,
      content,
      bbox,
      box: {
        x: Number(box.dataset.x),
        y: Number(box.dataset.y),
        w: Number(box.dataset.w),
        h: Number(box.dataset.h),
      },
    };
  });
}

test("BBox/ROI overlay renders from normalized analyst geometry inside letterboxed video content", async ({
  page,
}) => {
  const contentRect = await mountBBoxFixture(page);
  const projection = projectNormalizedBoxToVideoContent(MANUAL_BOX, contentRect);
  const measured = await measuredRects(page);

  expectClose(measured.content.x - measured.frame.x, contentRect.x, "content x offset");
  expectClose(measured.content.y - measured.frame.y, contentRect.y, "content y offset");
  expectClose(measured.content.width, contentRect.width, "content width");
  expectClose(measured.content.height, contentRect.height, "content height");

  expectClose(measured.bbox.x - measured.content.x, projection.left, "bbox left");
  expectClose(measured.bbox.y - measured.content.y, projection.top, "bbox top");
  expectClose(measured.bbox.width, projection.width, "bbox width");
  expectClose(measured.bbox.height, projection.height, "bbox height");
});

test("BBox/ROI drag normalizes pointer movement through rendered video content", async ({
  page,
}) => {
  const contentRect = await mountBBoxFixture(page);
  const measured = await measuredRects(page);
  const startX = measured.bbox.x + measured.bbox.width / 2;
  const startY = measured.bbox.y + measured.bbox.height / 2;
  const dx = contentRect.width * 0.1;
  const dy = contentRect.height * 0.075;

  const expectedStart = clientPointToNormalizedVideoPoint({
    clientX: startX,
    clientY: startY,
    elementRect: { left: measured.content.x, top: measured.content.y },
    contentRect: { ...contentRect, x: 0, y: 0 },
  });
  expect(expectedStart).not.toBeNull();
  expectClose(expectedStart!.x, MANUAL_BOX.x + MANUAL_BOX.w / 2, "drag start x");
  expectClose(expectedStart!.y, MANUAL_BOX.y + MANUAL_BOX.h / 2, "drag start y");

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy);
  await page.mouse.up();

  const dragged = await measuredRects(page);
  expectClose(dragged.box.x, MANUAL_BOX.x + 0.1, "dragged normalized x");
  expectClose(dragged.box.y, MANUAL_BOX.y + 0.075, "dragged normalized y");
  expectClose(dragged.box.w, MANUAL_BOX.w, "dragged normalized width");
  expectClose(dragged.box.h, MANUAL_BOX.h, "dragged normalized height");
});

test("BBox/ROI overlay survives fullscreen-style resize with stable normalized geometry", async ({
  page,
}) => {
  await mountBBoxFixture(page, { frameWidth: 960, frameHeight: 620 });
  const before = await measuredRects(page);

  const fullscreenContentRect = await mountBBoxFixture(page, {
    frameWidth: 1440,
    frameHeight: 900,
  });
  const after = await measuredRects(page);
  const expectedAfter = projectNormalizedBoxToVideoContent(
    before.box,
    fullscreenContentRect,
  );

  expectClose(after.bbox.x - after.content.x, expectedAfter.left, "resized bbox left");
  expectClose(after.bbox.y - after.content.y, expectedAfter.top, "resized bbox top");
  expectClose(after.bbox.width, expectedAfter.width, "resized bbox width");
  expectClose(after.bbox.height, expectedAfter.height, "resized bbox height");
  expect(after.box).toEqual(before.box);
});

test("BBox/ROI resize handle changes dimensions without losing the source-video origin", async ({
  page,
}) => {
  const contentRect = await mountBBoxFixture(page);
  const measured = await measuredRects(page);
  const startX = measured.bbox.x + measured.bbox.width;
  const startY = measured.bbox.y + measured.bbox.height;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + contentRect.width * 0.08, startY + contentRect.height * 0.06);
  await page.mouse.up();

  const resized = await measuredRects(page);
  expectClose(resized.box.x, MANUAL_BOX.x, "resized normalized x");
  expectClose(resized.box.y, MANUAL_BOX.y, "resized normalized y");
  expectClose(resized.box.w, MANUAL_BOX.w + 0.08, "resized normalized width");
  expectClose(resized.box.h, MANUAL_BOX.h + 0.06, "resized normalized height");
});
