import { expect, test, type Page } from "@playwright/test";

type AgentNode = {
  id: string;
  label: string;
  kind: "agent" | "scene" | "source" | "cue" | "occurrence";
  time: number;
  end: number;
  left: number;
  top: number;
};

const FIXTURE_ANALYSES: Record<string, { title: string; agent: string; nodes: AgentNode[] }> = {
  no_time_to_die: {
    title: "NO_TIME_TO_DIE_Trailer_UK_-_James_Bond_007_720p_h264.mp4",
    agent: "James Bond",
    nodes: [
      { id: "bond-agent", label: "James Bond", kind: "agent", time: 30.53, end: 55.155, left: 48, top: 45 },
      { id: "bond-scene-2", label: "S2", kind: "scene", time: 24, end: 48, left: 24, top: 22 },
      { id: "bond-seen", label: "Seen", kind: "occurrence", time: 30.53, end: 35.53, left: 62, top: 68 },
    ],
  },
  brazil_complete: {
    title: "brazil_complete.mp4",
    agent: "Runner",
    nodes: [
      { id: "runner-agent", label: "Runner", kind: "agent", time: 12, end: 18, left: 52, top: 45 },
      { id: "runner-scene-1", label: "S1", kind: "scene", time: 10, end: 20, left: 30, top: 24 },
      { id: "runner-seen", label: "Seen", kind: "occurrence", time: 13.5, end: 16, left: 70, top: 70 },
    ],
  },
};

async function mountNarrativeAgentGraphFixture(page: Page) {
  await page.setContent(`
    <main style="font-family: system-ui; background: #050909; color: #d7f9ff; min-height: 100vh; padding: 16px;">
      <section
        id="panel"
        data-active-panel="Narrative Agent"
        data-vaa1-narrative-agent-character-paths="true"
        style="width: 920px; border: 1px solid rgba(34,211,238,.35); padding: 12px; background: #0c0d0f;"
      >
        <header style="display: flex; gap: 8px; align-items: center; margin-bottom: 10px;">
          <strong id="title"></strong>
          <button id="load-bond" type="button">No Time To Die</button>
          <button id="load-brazil" type="button">Brazil</button>
          <span id="active-video" data-vaa1-active-video-id="true"></span>
        </header>
        <div
          id="loading-detour"
          data-vaa1-narrative-agent-grey-detour="true"
          hidden
          style="height: 220px; background: #888;"
        >
          Loading master schema...
        </div>
        <div
          id="graph"
          data-vaa1-narrative-agent-operational-graph="true"
          data-vaa1-narrative-agent-graph-canvas="true"
          style="position: relative; height: 280px; border: 1px solid #1f2937; background: #070808; overflow: hidden;"
        ></div>
        <div
          id="selection"
          data-vaa1-narrative-agent-graph-selection-card="true"
          style="margin-top: 8px; display: flex; gap: 8px; align-items: center;"
        >
          <span id="selected-node">none</span>
          <span id="draft-range"></span>
          <button
            id="confirm-presence"
            type="button"
            data-vaa1-narrative-agent-graph-fast-confirm-presence="true"
          >
            Confirm presence
          </button>
        </div>
        <pre id="event-log" data-vaa1-narrative-agent-event-log="true"></pre>
      </section>
      <script>
        const analyses = ${JSON.stringify(FIXTURE_ANALYSES)};
        const graph = document.getElementById("graph");
        const panel = document.getElementById("panel");
        const title = document.getElementById("title");
        const activeVideo = document.getElementById("active-video");
        const selectedNodeText = document.getElementById("selected-node");
        const draftRange = document.getElementById("draft-range");
        const eventLog = document.getElementById("event-log");
        const savedCorrections = {};
        const events = [];
        let activeAnalysisId = "no_time_to_die";
        let selectedNode = null;
        let draft = null;
        let drag = null;

        window.__vaa1NarrativeAgentFixture = { savedCorrections, events };

        function formatSeconds(value) {
          return Number(value).toFixed(3);
        }

        function emit(name, payload) {
          events.push({ name, payload });
          eventLog.textContent = JSON.stringify(events, null, 2);
        }

        function setSelectedNode(node) {
          selectedNode = node;
          draft = draft || { start: node.time, end: Math.max(node.end, node.time + 0.05) };
          selectedNodeText.textContent = node.label;
          draftRange.textContent = formatSeconds(draft.start) + "-" + formatSeconds(draft.end);
          emit("narrativeAgentGraphNodeSelected", {
            videoId: activeAnalysisId,
            node_id: node.id,
            timestamp: node.time,
            focus_panel_changed: false,
          });
          emit("videoTimeLineChanged", {
            videoId: activeAnalysisId,
            timestamp: node.time,
          });
          panel.dataset.activePanel = "Narrative Agent";
          document.getElementById("loading-detour").hidden = true;
        }

        function render() {
          const analysis = analyses[activeAnalysisId];
          title.textContent = analysis.title;
          activeVideo.textContent = activeAnalysisId;
          graph.innerHTML = "";
          selectedNode = null;
          draft = null;
          selectedNodeText.textContent = "none";
          draftRange.textContent = "";
          for (const node of analysis.nodes) {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.vaa1NarrativeAgentGraphNode = node.kind;
            button.dataset.vaa1NarrativeAgentGraphNodeHandleLabel = "true";
            button.dataset.nodeId = node.id;
            button.textContent = node.label + " " + formatSeconds(node.time);
            button.style.position = "absolute";
            button.style.left = node.left + "%";
            button.style.top = node.top + "%";
            button.style.transform = "translate(-50%, -50%)";
            button.style.width = "92px";
            button.style.minHeight = "44px";
            button.style.border = "1px solid #22d3ee";
            button.style.borderRadius = "4px";
            button.style.background = "#083344";
            button.style.color = "#d7f9ff";
            button.style.cursor = "pointer";
            button.addEventListener("click", () => setSelectedNode(node));

            const start = document.createElement("span");
            start.dataset.vaa1NarrativeAgentGraphNodeStartHandle = "true";
            start.dataset.vaa1NarrativeAgentGraphStretchableNodeHandle = "start";
            start.title = "Drag presence start";
            start.style.position = "absolute";
            start.style.left = "-8px";
            start.style.top = "50%";
            start.style.transform = "translateY(-50%)";
            start.style.width = "10px";
            start.style.height = "26px";
            start.style.border = "1px solid #cffafe";
            start.style.borderRadius = "4px";
            start.style.background = "#67e8f9";
            start.style.cursor = "ew-resize";
            start.addEventListener("pointerdown", (event) => beginDrag(event, node, "start"));

            const end = document.createElement("span");
            end.dataset.vaa1NarrativeAgentGraphNodeEndHandle = "true";
            end.dataset.vaa1NarrativeAgentGraphStretchableNodeHandle = "end";
            end.title = "Drag presence end";
            end.style.position = "absolute";
            end.style.right = "-8px";
            end.style.top = "50%";
            end.style.transform = "translateY(-50%)";
            end.style.width = "10px";
            end.style.height = "26px";
            end.style.border = "1px solid #cffafe";
            end.style.borderRadius = "4px";
            end.style.background = "#67e8f9";
            end.style.cursor = "ew-resize";
            end.addEventListener("pointerdown", (event) => beginDrag(event, node, "end"));

            const bar = document.createElement("span");
            bar.dataset.vaa1NarrativeAgentGraphNodeDurationBar = "true";
            bar.style.position = "absolute";
            bar.style.left = "8px";
            bar.style.right = "8px";
            bar.style.bottom = "-4px";
            bar.style.height = "3px";
            bar.style.borderRadius = "4px";
            bar.style.background = "#67e8f9";

            button.append(start, end, bar);
            graph.append(button);
          }
        }

        function beginDrag(event, node, handle) {
          event.preventDefault();
          event.stopPropagation();
          setSelectedNode(node);
          const width = graph.getBoundingClientRect().width || 1;
          drag = {
            node,
            handle,
            originX: event.clientX,
            originStart: draft.start,
            originEnd: draft.end,
            secondsPerPixel: 60 / width,
          };
        }

        window.addEventListener("pointermove", (event) => {
          if (!drag) return;
          const deltaSeconds = (event.clientX - drag.originX) * drag.secondsPerPixel;
          const start = drag.handle === "start"
            ? Math.max(0, drag.originStart + deltaSeconds)
            : drag.originStart;
          const end = drag.handle === "end"
            ? Math.max(start + 0.05, drag.originEnd + deltaSeconds)
            : Math.max(start + 0.05, drag.originEnd);
          draft = { start, end };
          draftRange.textContent = formatSeconds(draft.start) + "-" + formatSeconds(draft.end);
          emit("narrativeAgentGraphNodeHandleDragged", {
            videoId: activeAnalysisId,
            node_id: drag.node.id,
            handle: drag.handle,
            start_timestamp: start,
            end_timestamp: end,
            focus_panel_changed: false,
          });
          emit("videoTimeLineChanged", {
            videoId: activeAnalysisId,
            timestamp: drag.handle === "start" ? start : end,
          });
          panel.dataset.activePanel = "Narrative Agent";
        });

        window.addEventListener("pointerup", () => {
          drag = null;
        });

        document.getElementById("confirm-presence").addEventListener("click", () => {
          if (!selectedNode || !draft) return;
          const current = savedCorrections[activeAnalysisId] || [];
          savedCorrections[activeAnalysisId] = [
            ...current,
            {
              analysis_id: activeAnalysisId,
              label: selectedNode.label,
              node_id: selectedNode.id,
              master_schema_surface: "narrative_agent_profile_annotations",
              start_seconds: draft.start,
              end_seconds: draft.end,
            },
          ];
          emit("narrativeAgentGraphPresenceConfirmed", {
            videoId: activeAnalysisId,
            node_id: selectedNode.id,
            start_timestamp: draft.start,
            end_timestamp: draft.end,
          });
          panel.dataset.activePanel = "Narrative Agent";
        });

        document.getElementById("load-bond").addEventListener("click", () => {
          activeAnalysisId = "no_time_to_die";
          render();
        });

        document.getElementById("load-brazil").addEventListener("click", () => {
          activeAnalysisId = "brazil_complete";
          render();
        });

        render();
      </script>
    </main>
  `);
}

async function dragHandle(page: Page, locator: ReturnType<Page["locator"]>, dx: number) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const startX = box!.x + box!.width / 2;
  const startY = box!.y + box!.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY, { steps: 6 });
  await page.mouse.up();
}

test("Narrative Agent graph nodes expose stretchable handles and stay in panel while dragging", async ({
  page,
}) => {
  await mountNarrativeAgentGraphFixture(page);

  const graph = page.locator('[data-vaa1-narrative-agent-operational-graph="true"]');
  await expect(graph).toBeVisible();
  await expect(page.locator('[data-vaa1-narrative-agent-graph-node-start-handle="true"]')).toHaveCount(3);
  await expect(page.locator('[data-vaa1-narrative-agent-graph-node-end-handle="true"]')).toHaveCount(3);
  await expect(page.locator('[data-vaa1-narrative-agent-graph-node-duration-bar="true"]')).toHaveCount(3);

  const agentNode = page.locator('[data-node-id="bond-agent"]');
  await agentNode.click();
  await expect(page.locator('[data-active-panel="Narrative Agent"]')).toBeVisible();
  await expect(page.locator('[data-vaa1-narrative-agent-grey-detour="true"]')).toBeHidden();

  await dragHandle(page, agentNode.locator('[data-vaa1-narrative-agent-graph-node-end-handle="true"]'), 120);

  await expect(page.locator("#event-log")).toContainText("narrativeAgentGraphNodeHandleDragged");
  await expect(page.locator("#event-log")).toContainText('"focus_panel_changed": false');
  await expect(page.locator('[data-active-panel="Narrative Agent"]')).toBeVisible();
  await expect(page.locator('[data-vaa1-narrative-agent-grey-detour="true"]')).toBeHidden();
  await expect(page.locator("#draft-range")).not.toContainText("30.530-55.155");
});

test("Narrative Agent graph handle confirmations are scoped per video and work on a second analysis", async ({
  page,
}) => {
  await mountNarrativeAgentGraphFixture(page);

  const bondNode = page.locator('[data-node-id="bond-agent"]');
  await bondNode.click();
  await dragHandle(page, bondNode.locator('[data-vaa1-narrative-agent-graph-node-start-handle="true"]'), -80);
  await page.locator('[data-vaa1-narrative-agent-graph-fast-confirm-presence="true"]').click();

  await page.getByRole("button", { name: "Brazil" }).click();
  await expect(page.locator('[data-vaa1-active-video-id="true"]')).toHaveText("brazil_complete");
  await expect(page.locator('[data-node-id="bond-agent"]')).toHaveCount(0);
  await expect(page.locator('[data-node-id="runner-agent"]')).toBeVisible();
  await expect(page.locator('[data-vaa1-narrative-agent-graph-node-start-handle="true"]')).toHaveCount(3);

  const runnerNode = page.locator('[data-node-id="runner-agent"]');
  await runnerNode.click();
  await dragHandle(page, runnerNode.locator('[data-vaa1-narrative-agent-graph-node-end-handle="true"]'), 90);
  await page.locator('[data-vaa1-narrative-agent-graph-fast-confirm-presence="true"]').click();

  const saved = await page.evaluate(() => (window as any).__vaa1NarrativeAgentFixture.savedCorrections);
  expect(saved.no_time_to_die).toHaveLength(1);
  expect(saved.brazil_complete).toHaveLength(1);
  expect(saved.no_time_to_die[0].analysis_id).toBe("no_time_to_die");
  expect(saved.brazil_complete[0].analysis_id).toBe("brazil_complete");
  expect(saved.no_time_to_die[0].label).toBe("James Bond");
  expect(saved.brazil_complete[0].label).toBe("Runner");
});
