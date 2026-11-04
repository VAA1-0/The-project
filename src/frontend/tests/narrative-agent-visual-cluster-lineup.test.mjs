import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const panel = readFileSync(
  new URL("../app/V2components/components/panels/MasterSchemaPanel.tsx", import.meta.url),
  "utf8",
);
const projection = readFileSync(
  new URL("../app/V2components/components/NarrativeAgentThumbnailProjectionStrip.tsx", import.meta.url),
  "utf8",
);
const audio = readFileSync(
  new URL("../app/V2components/components/panels/AudioPanel.tsx", import.meta.url),
  "utf8",
);
const transcript = readFileSync(
  new URL("../app/V2components/components/panels/SpeechToTextPanel.tsx", import.meta.url),
  "utf8",
);
const meaning = readFileSync(
  new URL("../app/V2components/components/panels/MeaningPlotPanel.tsx", import.meta.url),
  "utf8",
);
const api = readFileSync(new URL("../lib/api-service.ts", import.meta.url), "utf8");
const videoService = readFileSync(new URL("../lib/video-service.ts", import.meta.url), "utf8");
const backend = readFileSync(new URL("../../../api_server.py", import.meta.url), "utf8");
const registry = readFileSync(new URL("../lib/narrative-agent-registry.ts", import.meta.url), "utf8");
const registryModule = { exports: {} };
new Function("exports", "module", "require", ts.transpileModule(registry, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText)(registryModule.exports, registryModule, () => ({}));
const { visualLineupNarrativeAgentLabels } = registryModule.exports;

test("Narrative Agent owns a compact multi-family visual cluster lineup", () => {
  assert.match(panel, /data-vaa1-narrative-agent-visual-cluster-lineup="true"/);
  assert.match(panel, /Visual Narrative Agent lineups/);
  assert.match(panel, /data-vaa1-narrative-agent-visual-lineup-row=/);
  assert.match(panel, /h-14 w-14/);
  assert.match(panel, /Explore visual lineups/);
  assert.match(panel, /Confirm all selected/);
});

test("lineup rows grow with thumbnail volume, collapse, and retain analyst ordering", () => {
  assert.match(panel, /data-vaa1-lineup-volume-layout="wrapping-grid"/);
  assert.match(panel, /grid-cols-\[repeat\(auto-fill,4rem\)\]/);
  assert.match(panel, /data-vaa1-narrative-agent-lineup-row-collapse="true"/);
  assert.match(panel, /data-vaa1-narrative-agent-lineup-row-drag-handle="true"/);
  assert.match(panel, /application\/x-datascene-narrative-agent-lineup-row/);
  assert.match(panel, /vaa1\.narrative-agent-visual-lineup:/);
  assert.match(panel, /setBrowserStorageItem\(lineupPreferenceKey/);
  assert.match(panel, /const displayRows = \[unresolvedRow, \.\.\.orderedLineupRows\]/);
  assert.match(panel, /setAssignments\(\{\}\);[\s\S]*setSelectedCandidateIds\(\{\}\);[\s\S]*automaticScanKey\.current = "";[\s\S]*\}, \[videoId\]\)/);
  assert.doesNotMatch(panel, /row\.key === unresolvedRow\.key \? "grid max-h-60[\s\S]*: "flex overflow-x-auto"/);
});

test("dropping visual candidates on a semantic family row is the canonical confirmation", () => {
  assert.match(panel, /draggable/);
  assert.match(panel, /application\/x-datascene-narrative-agent-candidate/);
  assert.match(panel, /analyst_drag_reassignment_between_visual_narrative_agent_lineups/);
  assert.match(panel, /raw_detector_evidence_preserved: true/);
  assert.match(panel, /duplicate_confirmation_suppressed: true/);
  assert.match(panel, /void persistAssignments\(candidateIds, droppedAssignments, "drag confirmation"\)/);
  assert.match(panel, /Dropping a candidate onto a Narrative Agent row confirms it immediately/);
});

test("visual lineup shows every governed Narrative Agent and keeps mature anchors exact", () => {
  assert.match(panel, /visualLineupNarrativeAgentLabels\(analysisData as AnalysisData\)\.map\(canonicalLabel\)/);
  assert.match(panel, /governedKeys\.has\(key\)/);
  assert.doesNotMatch(panel, /unique\.size < 8/);
  assert.match(panel, /memoryLabels\.includes\(canonicalRowLabel\)/);
  assert.doesNotMatch(panel, /memoryLabel\.includes\(rowLabel\)/);
  assert.match(panel, /matureEvidenceIds\.has\(stableEvidenceId\)/);
  assert.match(panel, /automaticScanKey/);
  assert.match(panel, /artifact_wide_candidate_harvest: true/);
  assert.doesNotMatch(panel, /Promise\.all\(lineupRows\.map/);
  assert.match(panel, /Surface the review labour immediately/);
  assert.match(panel, /unconfirmed visual candidates harvested/);
  assert.match(panel, /rawNarrativeAgentVisualCandidates/);
  assert.match(panel, /rawDetectedObjects/);
  assert.match(panel, /candidate_review_required/);
  assert.match(panel, /Manual\/native Identification boxes and untracked/);
  assert.match(panel, /Every measured occurrence must face lineup governance/);
  assert.match(panel, /start\.toFixed\(3\)/);
  assert.match(panel, /manual-visual-candidate:\$\{annotation\.id\}/);
  assert.match(panel, /source_annotation_id: annotation\.id/);
  assert.match(panel, /isUnresolvedNarrativeAgentLabel/);
  assert.doesNotMatch(panel, /`sample:\$\{object\.timestamp\}/);
});

test("visual lineup row admission is source-metadata or analyst authority only", () => {
  assert.match(registry, /export function visualLineupNarrativeAgentLabels/);
  assert.match(registry, /sourceMediaMetadata\?\.user_annotations/);
  assert.match(registry, /annotations\?\.narrative_agent_profiles/);
  assert.match(registry, /annotations\?\.character_definitions/);
  assert.match(registry, /annotations\?\.character_roles/);
  assert.match(registry, /annotations\?\.persons/);
  assert.match(registry, /entry\.category === "Identification" && entry\.subcategory === "Character"/);
  assert.match(registry, /record\.category === "narrative_agent_profile"/);
  assert.match(registry, /\["manual_annotation", "manual_correction"\]\.includes\(record\.authority\)/);
  const lineupAdmission = registry.slice(
    registry.indexOf("export function visualLineupNarrativeAgentLabels"),
    registry.indexOf("/** One analysis-scoped governed Narrative Agent list"),
  );
  assert.doesNotMatch(lineupAdmission, /record\.category === "expression"/);
  assert.doesNotMatch(lineupAdmission, /performance_expression/);
  assert.doesNotMatch(lineupAdmission, /raw_detection/);
  assert.doesNotMatch(lineupAdmission, /entityRegistry/);
});

test("visual lineup admission remains analysis-scoped across different videos", () => {
  const sourceMetadata = (persons = [], characterRoles = []) => ({
    metadata: { sourceMediaMetadata: { user_annotations: {
      persons,
      character_roles: characterRoles,
      character_definitions: [],
      narrative_agent_profiles: [],
      web_metadata_sources: [],
    } } },
    annotationCorrections: { manual_visual_annotations: [], proliferation_decisions: [] },
    masterSchemaResolvedEvidence: { records: [] },
    transcript: [], transcriptTimeline: [],
  });
  const noTimeToDie = sourceMetadata(["James Bond", "007"]);
  noTimeToDie.masterSchemaResolvedEvidence.records.push(
    { category: "expression", authority: "manual_annotation", label: "reflective" },
    { category: "expression", authority: "interpreted_detection", label: "reassuring" },
  );
  const diamonds = sourceMetadata([], [
    { character: "Tiffany Case, a diamond smuggler" },
    { character: "Ernst Stavro Blofeld" },
  ]);
  const yleNews = sourceMetadata([]);
  const analystAuthored = sourceMetadata([]);
  analystAuthored.annotationCorrections.manual_visual_annotations.push({
    category: "Identification", subcategory: "Character", identity_affirmation: "Sari Multala",
  });

  assert.deepEqual(visualLineupNarrativeAgentLabels(noTimeToDie), ["007", "James Bond"]);
  assert.deepEqual(visualLineupNarrativeAgentLabels(diamonds), ["Ernst Stavro Blofeld", "Tiffany Case"]);
  assert.deepEqual(visualLineupNarrativeAgentLabels(yleNews), []);
  assert.deepEqual(visualLineupNarrativeAgentLabels(analystAuthored), ["Sari Multala"]);
  assert.ok(!visualLineupNarrativeAgentLabels(noTimeToDie).includes("reflective"));
  assert.ok(!visualLineupNarrativeAgentLabels(noTimeToDie).includes("reassuring"));
  assert.ok(!visualLineupNarrativeAgentLabels(diamonds).includes("James Bond"));
});

test("visual lineup uses lightweight JPEG crops and leaves video playback to the video panel", () => {
  assert.match(panel, /data-vaa1-source-linked-jpeg-crop="true"/);
  assert.match(panel, /<img/);
  assert.match(panel, /loading="lazy"/);
  assert.match(panel, /data-vaa1-narrative-agent-thumbnail-lightbox="true"/);
  assert.match(panel, /Open in video/);
  assert.match(api, /objects\/source-crop/);
  const thumbnail = panel.slice(
    panel.indexOf("function NarrativeAgentFaceThumbnail"),
    panel.indexOf("function NarrativeAgentVisualClusterLineup"),
  );
  assert.doesNotMatch(thumbnail, /<video/);
  assert.match(thumbnail, /onClick=\{onOpen\}/);
  assert.match(thumbnail, /setIsInspecting\(false\); onOpen\(\)/);
  assert.match(panel, /onOpen=\{\(\) => openVideoAtTime\(videoId, start\)\}/);
});

test("audio Narrative Agent lineups provide playback and governed drag reassignment", () => {
  assert.match(audio, /audioLineupMembers/);
  assert.match(audio, /application\/x-datascene-narrative-agent-audio-candidate/);
  assert.match(audio, /<audio/);
  assert.match(audio, /Play or pause/);
  assert.match(audio, /member\.directSeed \? familyId/);
});

test("measured best matches receive provisional rows while unmeasured candidates stay unresolved", () => {
  assert.match(panel, /String\(candidate\.evidence_id \|\| candidate\.candidate_id\)/);
  assert.match(panel, /Unresolved \/ competing/);
  assert.match(panel, /measureNarrativeAgentFaces/);
  assert.match(panel, /const prospectiveRow = lineupRows\.find/);
  assert.match(panel, /Thresholds govern maturity/);
  assert.match(panel, /cosine_similarity_not_probability/);
  assert.match(panel, /assign them to a Narrative Agent family before confirmation/);
  assert.match(panel, /decision_id: `narrative-agent-visual-lineup:\$\{canonicalCandidateId\}\$\{revisesMatureConfirmation/);
});

test("mature confirmations remain revisable and Narrative Agent families remain governable", () => {
  assert.match(panel, /application\/x-datascene-narrative-agent-mature/);
  assert.match(panel, /data-vaa1-revisable-mature-narrative-agent="true"/);
  assert.match(panel, /prior_confirmation_preserved: true/);
  assert.match(panel, /operation: "create" \| "rename" \| "merge"/);
  assert.match(panel, /Add Narrative Agent row/);
  assert.match(panel, /Save title/);
  assert.match(panel, /Merge into…/);
  assert.match(panel, /narrative-agent-family-governance:/);
  assert.match(registry, /narrative-agent-family-governance:/);
  assert.match(registry, /Analyst-authored family governance is the final naming authority/);
});

test("confirmed Narrative Agent tracks outrank similarity and unresolved work is multi-row", () => {
  assert.match(panel, /confirmedNarrativeAgentRowForCandidate/);
  assert.match(panel, /exactOccurrenceOnly = false/);
  assert.match(panel, /exactConfirmedRow/);
  assert.match(panel, /user_confirmed_narrative_agent_track/);
  assert.match(panel, /const rowKey: string = authorityRow\?\.key \|\| prospectiveRow\?\.key/);
  assert.match(panel, /grid min-h-16 grid-cols-\[repeat\(auto-fill,4rem\)\]/);
});

test("canonical confirmations cannot leak back into unresolved review", () => {
  assert.match(panel, /narrativeAgentVisualIntervalAndGeometryMatch/);
  assert.match(panel, /decisionIds\.some\(\(id\) => stableCandidateIds\.has\(id\)\)/);
  assert.match(panel, /if \(exactConfirmedRow\) \{\s*delete next\[id\]/);
  assert.match(panel, /rowKey: authorityRow\?\.key \|\| unresolvedRow\.key/);
  assert.match(panel, /!confirmedNarrativeAgentRowForCandidate\(analysisData, lineupRows, candidate, true\)/);
  assert.match(panel, /narrativeAgentVisualTrackKey\(correlation\.target_id\)/);
  assert.match(panel, /narrativeAgentVisualTrackKey\(correlation\.target_label\)/);
  assert.match(panel, /confirmedManualVisualSlotsForRow\(analysisData, row\)/);
  assert.match(panel, /authority_source: "manual_visual_annotation"/);
});

test("a family merge cannot broadcast mature anchors into unrelated rows", () => {
  assert.match(panel, /Mature projection is identity authority/);
  assert.match(panel, /const canonicalRowLabel = normalizeAgentKey\(row\.label\)/);
  assert.match(panel, /const rowKeys = \[row\.label\]\.map\(normalizeAgentKey\)/);
  assert.doesNotMatch(panel, /const rowKeys = \[row\.label, \.\.\.row\.aliases, \.\.\.row\.sourceLabels\]/);
});

test("unresolved review supports larger crops and batch drag assignment", () => {
  assert.match(panel, /reviewSize=\{row\.key === unresolvedRow\.key\}/);
  assert.match(panel, /reviewSize \? "h-16 w-16" : "h-14 w-14"/);
  assert.match(panel, /application\/x-datascene-narrative-agent-candidate-batch/);
  assert.match(panel, /JSON\.stringify\(activeIds\)/);
  assert.match(panel, /application\/x-datascene-narrative-agent-candidate-batch/);
});

test("background facial comparison cannot erase an analyst drag assignment", () => {
  assert.match(panel, /analystStaged\?: boolean/);
  assert.match(panel, /if \(assignment\.analystStaged\) harvested\[id\] = assignment/);
  assert.match(panel, /if \(assignment\.analystStaged\) measured\[id\] = assignment/);
  assert.match(panel, /analystStaged: true/);
});

test("visual lineup receipts preserve the measured face method and evidence", () => {
  assert.match(panel, /face_model: "OpenCV YuNet \+ SFace"/);
  assert.match(panel, /face_embedding_sha256/);
  assert.match(panel, /facial_landmarks/);
  assert.match(panel, /cos \{assignment\.score\.toFixed\(3\)\}/);
});

test("only confirmed visual lineup decisions proliferate as mature thumbnail projections", () => {
  assert.match(projection, /decision\.decision !== "confirmed"/);
  assert.match(projection, /visual_narrative_agent_occurrence/);
  assert.match(projection, /data-vaa1-projection-authority="mature-user-confirmation"/);
  assert.match(panel, /thumbnail_projection_required: true/);
  assert.match(panel, /associated_audio_text_projection_required: true/);
  assert.match(panel, /function confirmedVisualLineupSlotsForRow/);
  assert.match(panel, /mature_user_confirmation/);
  assert.match(panel, /narrativeAgentVisualSlotsForRow/);
  assert.match(panel, /decision\.decision !== "confirmed"/);
  assert.match(panel, /startsWith\("narrative-agent-visual-lineup:"\)/);
  assert.match(panel, /confirmation_receipt/);
  assert.match(projection, /latestByCandidate/);
  assert.match(projection, /familyAliases/);
  assert.doesNotMatch(projection, /<video/);
  assert.match(projection, /objectSourceCropUrl/);
  assert.match(panel, /governedManualVisualAnnotations/);
  assert.match(panel, /narrative_agent_visual_lineup_confirmation/);
  assert.match(panel, /maturity_state: "mature"/);
  assert.match(panel, /partial_propagation_allowed: false/);
  assert.match(panel, /const latestByCandidate = new Map<string, ProliferationDecision>/);
  assert.match(panel, /source-time\/BBox identity that the analyst actually confirmed/);
  assert.match(panel, /upsertMasterSchemaPresenceIntervalForManualAnnotation/);
  assert.match(panel, /sourcePanel: "NarrativeAgentPanel"/);
});

test("a lineup commit crosses the existing dependent-projection boundary", () => {
  assert.match(api, /refreshAnnotationDependentSurfaces/);
  assert.match(api, /annotation-projections\/refresh/);
  assert.match(videoService, /saveAnnotationCorrections[\s\S]*refreshAnnotationDependentSurfaces\(id\)/);
  assert.match(backend, /def refresh_saved_annotation_projections/);
  assert.match(backend, /canonical_clock_corrections\(analysis_id, status\)/);
  assert.match(backend, /backfill_confirmed_narrative_agent_presence_intervals/);
  assert.match(backend, /placeholder_labels/);
  assert.match(backend, /write_identity_triangulation_artifact_for_status/);
  assert.match(backend, /build_active_speaker_synchrony_artifact/);
  assert.match(backend, /refresh_annotation_dependent_surfaces\(status\)/);
});

test("the same governed thumbnail projection hydrates graphs, audio, and transcript consumers", () => {
  assert.match(panel, /data-vaa1-narrative-agent-graph-visual-thumbnail-strip="true"/);
  assert.match(meaning, /NarrativeAgentThumbnailProjectionStrip/);
  assert.match(audio, /NarrativeAgentThumbnailProjectionStrip/);
  assert.match(transcript, /NarrativeAgentThumbnailProjectionStrip/);
  assert.match(panel, /"meaning_knowledge_graph"/);
  assert.match(panel, /"audio_panel"/);
  assert.match(panel, /"transcript_panel"/);
  assert.match(projection, /annotations\?: ManualVisualAnnotation\[\]/);
  assert.match(projection, /annotation\.category !== "Identification"/);
  assert.match(audio, /annotations=\{analysisData\?\.annotationCorrections\?\.manual_visual_annotations\}/);
  assert.match(transcript, /annotations=\{analysisData\?\.annotationCorrections\?\.manual_visual_annotations\}/);
  assert.match(meaning, /annotations=\{analysisData\?\.annotationCorrections\?\.manual_visual_annotations\}/);
});
