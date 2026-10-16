import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workbench = readFileSync(
  new URL("../app/V2components/components/NarrativeAgentContinuityWorkbench.tsx", import.meta.url),
  "utf8",
);
const narrativeAgentPanel = readFileSync(
  new URL("../app/V2components/components/panels/MasterSchemaPanel.tsx", import.meta.url),
  "utf8",
);
const api = readFileSync(new URL("../lib/api-service.ts", import.meta.url), "utf8");
const registry = readFileSync(new URL("../lib/narrative-agent-registry.ts", import.meta.url), "utf8");

test("Narrative Agent panel mounts an artifact-bound continuity graph", () => {
  assert.match(narrativeAgentPanel, /category === "Identification"[\s\S]*NarrativeAgentContinuityWorkbench/);
  assert.match(narrativeAgentPanel, /projectId=\{analysisData\.projectId\}/);
  assert.match(narrativeAgentPanel, /analysisId=\{videoId\}/);
  assert.match(workbench, /data-narrative-agent-continuity-workbench="true"/);
  assert.match(workbench, /<section className="mt-3 rounded border border-cyan-900\/40/);
  assert.match(workbench, /Navigable Narrative Agent continuity graph/);
  assert.match(workbench, /openVideoAtTime\(row\.analysis_id/);
});

test("source confirmation supports all governed modalities on the global clock", () => {
  for (const modality of ["scene_presence", "visual", "audio", "transcript_audio", "body_movement"]) {
    assert.match(workbench, new RegExp(`value="${modality}"`));
  }
  assert.match(workbench, /eventBus\.on\("videoTimeLineChanged"/);
  assert.match(workbench, /Confirm source input/);
  assert.match(workbench, /Normalized visual BBox coordinates/);
  assert.match(workbench, /confirmNarrativeAgentContinuityEvidence/);
  assert.match(workbench, /Movement type/);
  assert.match(workbench, /interpretation remains candidate-only until continuity membership is confirmed/i);
  assert.match(workbench, /sourceIntervals[\s\S]*interval\.start <= next \+ 0\.05[\s\S]*setStart\(matching\.start\.toFixed\(3\)\)/);
  assert.match(workbench, /Detected \$\{modalityLabels\[matching\.modality\]\} interval raised from the global-clock beat/);
  assert.match(workbench, /data-vaa1-correctable-suggested-start="true"/);
  assert.match(workbench, /data-vaa1-correctable-suggested-end="true"/);
  assert.match(narrativeAgentPanel, /analysisData\.audioDiarization\?\.speaker_turns/);
  assert.match(narrativeAgentPanel, /analysisData\.transcriptTimeline \|\| analysisData\.transcript/);
});

test("continuity review exposes membership, structure, undo, and collection decisions", () => {
  for (const control of ["Include", "Reject", "Defer", "Confirm collection", "Undo last decision", "Split", "Merge"]) {
    assert.match(workbench, new RegExp(control));
  }
  assert.match(workbench, /tracking is never identity authority/);
  assert.match(workbench, /The source confirmation and collection membership remain separate governed acts/);
});

test("one save publishes the canonical revision through saloon-door refresh events", () => {
  assert.match(workbench, /analysisCorrectionsChanged/);
  assert.match(workbench, /narrativeAgentContinuityUpdated/);
  assert.match(workbench, /matureDataProliferated/);
  assert.match(workbench, /Save committed/);
  assert.match(api, /narrative-agent-continuity\/decisions/);
  assert.match(api, /narrative-agent-continuity\/evidence/);
});

test("source confirmation closes its editor and retains a verified save receipt", () => {
  assert.match(workbench, /await refresh\(\);[\s\S]*setEditorOpen\(false\)[\s\S]*Source confirmation committed/);
  assert.match(workbench, /data-vaa1-continuity-source-editor=\{editorOpen \? "open" : "closed"\}/);
  assert.match(workbench, /data-vaa1-source-confirmation-closed="true"/);
  assert.match(workbench, /Entry saved and closed/);
  assert.match(workbench, /Add another source input/);
  assert.match(workbench, /result\.status === "unchanged" \? "Source confirmation already committed"/);
});

test("Narrative Agent chooser lists project-wide individual identities and remains open for new entries", () => {
  assert.match(workbench, /payload\?\.inventory\?\.confirmed_agents/);
  assert.match(workbench, /payload\?\.inventory\?\.confirmed_occurrences/);
  assert.match(workbench, /individualNarrativeAgentLabel\(value\)/);
  assert.match(workbench, /availableAgentLabels\.map/);
  assert.match(workbench, /data-vaa1-known-narrative-agent-select="true"/);
  assert.match(workbench, /Select any known agent/);
  assert.match(workbench, /data-vaa1-open-narrative-agent-entry="true"/);
  assert.match(workbench, /Or enter a new Narrative Agent/);
  assert.match(workbench, /replace\(\/\[\^\\p\{L\}\\p\{N\}\]\+\/gu, ""\)/);
  assert.match(workbench, /Includes Source Media Metadata identity confirmations/);
  assert.ok(registry.includes("(?:,|\\s+(?:and|with|versus|vs\\.?)\\s+)"));
  assert.ok(registry.includes("(?:person\\s+)?track"));
  assert.match(registry, /localeCompare\(label[\s\S]*sensitivity: "base"/);
});
