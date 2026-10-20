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
  assert.match(workbench, /Active-video Narrative Agent path/);
  assert.match(workbench, /openVideoAtTime\(row\.analysis_id/);
});

test("analysis scope shows only the active video before an explicit cross-video comparison", () => {
  assert.match(workbench, /data-vaa1-active-video-narrative-agent-path="true"/);
  assert.match(workbench, /const activeArtifact = artifacts\.find/);
  assert.match(workbench, /const activeOccurrences = occurrences\.filter\(\(row\) => row\.analysis_id === analysisId\)/);
  assert.match(workbench, /activeOccurrences\.map/);
  assert.doesNotMatch(workbench, /\{artifacts\.map\(\(artifact, artifactIndex\)/);
});

test("cross-video Narrative Agent paths live in a separate comparison matrix", () => {
  assert.match(workbench, /data-vaa1-narrative-agent-comparison="true"/);
  assert.match(workbench, /Narrative Agent comparison/);
  assert.match(workbench, /Narrative Agent paths across videos/);
  for (const column of ["Video", "Occurrences", "Mature", "Modalities", "Path span", "Action"]) {
    assert.match(workbench, new RegExp(column));
  }
  assert.match(workbench, /Open path/);
});

test("one Narrative Agent selection hydrates the complete panel in both directions", () => {
  assert.match(workbench, /eventBus\.emit\("narrativeAgentSelectionChanged"/);
  assert.match(workbench, /eventBus\.on\("narrativeAgentSelectionChanged", handler\)/);
  assert.match(workbench, /source: "continuity_workbench"/);
  assert.match(narrativeAgentPanel, /eventBus\.on\("narrativeAgentSelectionChanged", handler\)/);
  assert.match(narrativeAgentPanel, /normalizeAgentKey\(payload\.label \|\| ""\)/);
  assert.match(narrativeAgentPanel, /source: "character_evidence_graph"/);
});

test("canonical audio continuity hydrates Nomi path, audio memory, and speaker evidence", () => {
  assert.match(narrativeAgentPanel, /function narrativeAgentContinuityMembers/);
  assert.match(narrativeAgentPanel, /buildNarrativeAgentPathRows\(analysisData, canonicalClaims, videoId\)/);
  assert.match(narrativeAgentPanel, /source: "Canonical Narrative Agent continuity"/);
  assert.match(narrativeAgentPanel, /evidenceChips: \[`\$\{stringFrom\(member\.evidence_modality\)/);
  assert.match(narrativeAgentPanel, /audio_sample_slots: \[\.\.\.audioById\.values\(\)\]/);
  assert.match(narrativeAgentPanel, /data-vaa1-continuity-audio-occurrence="true"/);
  assert.match(narrativeAgentPanel, /Mature confirmed audio occurrence/);
});

test("audio match decisions show a calm durable receipt and additive batch selection", () => {
  assert.match(workbench, /audioDecisionReceipts/);
  assert.match(workbench, /Confirmed ✓/);
  assert.ok(workbench.includes('saved ${receipt.revision.slice(0, 8)}'));
  assert.match(workbench, /Select all eligible/);
  assert.match(workbench, /Clear selection/);
  assert.match(workbench, /\{selectedAudioMatches\.size\} selected/);
  assert.match(workbench, /Confirm selected \(\{selectedAudioMatches\.size\}\)/);
  assert.match(workbench, /new Set\(current\)/);
});

test("audio matching surfaces cumulative support and honest lip-sync measurement state", () => {
  assert.match(workbench, /Aggregate voice support/);
  assert.match(workbench, /independent probable match/);
  assert.match(workbench, /cumulative candidate probability/);
  assert.match(workbench, /Lip-sync \/ active speaker/);
  assert.match(workbench, /data-active-speaker-synchrony/);
});

test("confirmed Source Media roles hydrate as mature Narrative Agent authority", () => {
  assert.match(workbench, /data-vaa1-confirmed-metadata-roles/);
  assert.match(workbench, /Mature Source Media role/);
  assert.match(workbench, /100% confirmed/);
});

test("every source-timed confirmation navigates first and exposes mature proliferation beside navigation", () => {
  assert.match(workbench, /if \(options\.occurrence\?\.source_interval\)[\s\S]*openVideoAtTime/);
  assert.match(workbench, /confirmationNavigationUpdated/);
  assert.match(workbench, /data-vaa1-confirmation-navigation-receipt="true"/);
  assert.match(workbench, /Confirmed ✓ · mature/);
  assert.match(workbench, /Master Schema proliferation/);
  assert.match(workbench, /data-confirmation-modality=\{row\.evidence_modality \|\| "visual"\}/);
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
  assert.match(workbench, /confirmed body-movement evidence is immediately mature/i);
  assert.match(workbench, /sourceIntervals[\s\S]*interval\.start <= next \+ 0\.05[\s\S]*setStart\(matching\.start\.toFixed\(3\)\)/);
  assert.match(workbench, /Detected \$\{modalityLabels\[matching\.modality\]\} interval raised from the global-clock beat/);
  assert.match(workbench, /data-vaa1-correctable-suggested-start="true"/);
  assert.match(workbench, /data-vaa1-correctable-suggested-end="true"/);
  assert.match(narrativeAgentPanel, /analysisData\.audioDiarization\?\.speaker_turns/);
  assert.match(narrativeAgentPanel, /analysisData\.transcriptTimeline \|\| analysisData\.transcript/);
});

test("continuity review exposes membership, structure, undo, and collection decisions", () => {
  for (const control of ["Include", "Reject", "Defer", "Confirm legacy candidate collection", "Undo last decision", "Split", "Merge"]) {
    assert.match(workbench, new RegExp(control));
  }
  assert.match(workbench, /tracking is never identity authority/);
  assert.match(workbench, /Every explicit user confirmation is immediately mature Master Schema data/);
});

test("one save publishes the canonical revision through saloon-door refresh events", () => {
  assert.match(workbench, /analysisCorrectionsChanged/);
  assert.match(workbench, /narrativeAgentContinuityUpdated/);
  assert.match(workbench, /matureDataProliferated/);
  assert.match(workbench, /Save committed/);
  assert.match(api, /narrative-agent-continuity\/decisions/);
  assert.match(api, /narrative-agent-continuity\/evidence/);
});

test("continuity publishes one shared graph projection and constellational snapshot", () => {
  assert.match(workbench, /graphProjection: result\?\.continuity_projection\?\.graph_projection/);
  assert.match(workbench, /constellationalSnapshot: result\?\.continuity_projection\?\.constellational_snapshot/);
  assert.match(workbench, /analysisIds: artifacts\.map/);
});

test("Narrative Agent graph exposes governed editable relation tickets in panel", () => {
  assert.match(workbench, /data-vaa1-continuity-relation-tickets="true"/);
  assert.match(workbench, /Analyst account \/ corrected edge meaning/);
  for (const control of ["Confirm relation", "Revise and confirm", "Reject relation", "Defer relation"]) {
    assert.match(workbench, new RegExp(control));
  }
  assert.match(workbench, /operation,/);
  assert.match(workbench, /edge_id: ticket\.edge_id/);
  assert.match(workbench, /graphProjection: result\.continuity_projection\?\.graph_projection/);
});

test("mature presence proliferates participation without duplicate confirmation and dialogue probability remains visible", () => {
  assert.match(workbench, /Already mature · no reconfirmation/);
  assert.match(workbench, /data-vaa1-constellational-dialogue-candidates="true"/);
  assert.match(workbench, /constellational probability/);
  assert.match(workbench, /temporal_distance_seconds/);
});

test("source confirmation closes its editor and retains a verified save receipt", () => {
  assert.match(workbench, /await refresh\(\);[\s\S]*setEditorOpen\(false\)[\s\S]*Source confirmation committed/);
  assert.match(workbench, /data-vaa1-continuity-source-editor=\{editorOpen \? "open" : "closed"\}/);
  assert.match(workbench, /data-vaa1-source-confirmation-closed="true"/);
  assert.match(workbench, /Entry saved, mature, proliferated, and closed/);
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
