import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

const videoService = read("lib/video-service.ts");
const videoPanel = read("app/V2components/components/panels/VideoPanel.tsx");
const meaningPlotPanel = read("app/V2components/components/panels/MeaningPlotPanel.tsx");
const masterSchemaPanel = read("app/V2components/components/panels/MasterSchemaPanel.tsx");
const secondOrderAffirmations = read("app/V2components/components/panels/SecondOrderLabelAffirmations.tsx");
const sceneGovernance = read("lib/scene-governance.ts");
const annotationCorrections = read("lib/annotation-corrections.ts");

test("VideoService builds a single mature evidence view from corrected and Master Schema data", () => {
  assert.match(
    videoService,
    /function buildMasterSchemaResolvedEvidenceView\(/,
    "VideoService must build one resolved mature evidence surface",
  );

  assert.match(
    videoService,
    /records\.push\(\.\.\.masterSchemaObjectRecords\(masterSchema\)\);[\s\S]*records\.push\(\.\.\.masterSchemaNarrativeAgentRecords\(masterSchema\)\);[\s\S]*records\.push\(\.\.\.manualAnnotationNarrativeAgentRecords\(nativeAnnotations\)\);/,
    "Master Schema and manual mature subject records must enter the resolved view before raw panel records",
  );

  assert.match(
    videoService,
    /records\.push\(\.\.\.agentPersistenceTrackRecords\(secondOrderLabelProliferation\)\);[\s\S]*transcript\.forEach/,
    "agent persistence labels must enter the resolved evidence view before raw panel records",
  );

  assert.match(
    videoService,
    /buildMasterSchemaResolvedEvidenceView\(\{[\s\S]*objects:\s*mergedProfiledObjects,[\s\S]*nativeAnnotations,[\s\S]*corrections,[\s\S]*secondOrderLabelProliferation:[\s\S]*masterSchema:\s*status\.vaa1_annotation_master_schema,/,
    "resolved mature evidence must be built from corrected objects, native annotations, second-order candidates, and Master Schema",
  );

  assert.match(
    videoService,
    /evidenceProliferationMatches:\s*status\.evidence_proliferation_matches \|\| \[\]/,
    "completed proliferation matches must be carried into frontend analysis data",
  );

  assert.match(
    videoService,
    /records\.push\(\.\.\.evidenceProliferationMatchRecords\(evidenceProliferationMatches\)\);[\s\S]*transcript\.forEach/,
    "proliferation match summaries must enter resolved evidence before raw panel records",
  );

  assert.match(
    videoService,
    /masterSchemaMaturityAudit\(\s*status\.vaa1_annotation_master_schema/,
    "metadata indicators must expose the current Master Schema maturity audit",
  );
});

test("Meaning and Master Schema panels consume mature subject authority instead of raw unknown participants first", () => {
  assert.match(
    meaningPlotPanel,
    /masterSchemaNarrativeAgentProfiles\(analysisData\?\.masterSchemaResolvedEvidence\?\.records\)/,
    "Meaning / Plot Characters By Scene must consult Master Schema resolved subjects",
  );

  assert.match(
    meaningPlotPanel,
    /sourceMetadataNarrativeAgentProfiles/,
    "Meaning / Plot must fall back to Source Media narrative agent profiles",
  );

  assert.match(
    meaningPlotPanel,
    /sceneCardNarrativeAgentProfiles/,
    "Meaning / Plot must fall back to Scene Card subject evidence",
  );

  assert.match(
    meaningPlotPanel,
    /participantRows/,
    "second-order participants should remain only a final fallback source",
  );

  assert.match(
    meaningPlotPanel,
    /unknown_speaker|unknown participant|unknown/,
    "Meaning / Plot must explicitly handle unknown participant values instead of silently presenting them as mature subjects",
  );

  assert.match(
    masterSchemaPanel,
    /masterSchemaResolvedEvidence/,
    "Master Schema panel must display the same resolved evidence surface used by downstream panels",
  );

  assert.match(
    masterSchemaPanel,
    /data-vaa1-proliferation-match-navigation="true"/,
    "Master Schema must expose persisted proliferation matches as navigable candidate evidence",
  );

  assert.match(
    masterSchemaPanel,
    /outputs_are_candidates_until_supported_by_evidence/,
    "proliferation match UI must preserve candidate-not-confirmed governance language",
  );
});

test("scene governance and second-order persistence are routed to user-visible, traceable surfaces", () => {
  assert.match(
    sceneGovernance,
    /masterSchemaTemporalSegmentsFromAnalysis/,
    "scene browsing must prefer Master Schema temporal segments",
  );

  assert.match(
    sceneGovernance,
    /matureSceneSegmentsFromAnalysis/,
    "scene governance must expose one mature scene segment selection helper",
  );

  assert.match(
    secondOrderAffirmations,
    /agent_persistence_labels/,
    "agent persistence candidates must be visible in second-order affirmations",
  );

  assert.match(
    secondOrderAffirmations,
    /bbox_roi_overlay/,
    "agent persistence candidates must declare BBox/ROI overlay as a target surface",
  );

  assert.match(
    secondOrderAffirmations,
    /master_schema/,
    "agent persistence candidates must declare Master Schema as a target surface",
  );

  assert.match(
    videoService,
    /function agentPersistenceTrackRecords\([\s\S]*agent_persistence_labels[\s\S]*departed_track_id[\s\S]*arrived_track_id[\s\S]*category:\s*"narrative_agent_profile"[\s\S]*maturityRoute:\s*"second_order\.agent_persistence_scene_cut"/,
    "agent persistence labels must become track-scoped mature subject records with source traceability",
  );

  assert.match(
    secondOrderAffirmations,
    /label\.evidence\?\.departed_track_id[\s\S]*label\.evidence\?\.arrived_track_id/,
    "BBox/ROI persistence chips must filter against backend evidence track ids",
  );
});

test("BBox/ROI overlays consume mature Master Schema and persistence indicators before raw labels", () => {
  assert.match(
    videoPanel,
    /masterSchemaResolvedEvidence/,
    "VideoPanel overlays must consult Master Schema resolved evidence before raw detected object labels",
  );

  assert.match(
    videoPanel,
    /annotationCorrections|manual_visual_annotations/,
    "VideoPanel overlays must consult analyst corrections/manual visual annotations",
  );

  assert.match(
    videoPanel,
    /agent_persistence_labels|agentPersistence|Constellational Match/,
    "VideoPanel overlays must surface scene-cut agent persistence indicators",
  );

  assert.match(
    videoPanel,
    /traceback|evidence_refs|source_bbox_refs|source_frame_refs/,
    "VideoPanel overlays must expose or route to traceback/source evidence for governed labels",
  );

  assert.match(
    videoPanel,
    /buildManualTrackMatureAuthority[\s\S]*manualTrackMatureAuthority/,
    "manual BBox identity corrections must persist as mature track authority, not only timestamp-local geometry",
  );

  assert.match(
    videoPanel,
    /manualTrackAuthority[\s\S]*resolveManualGeometryAtTime/,
    "VideoPanel must separate persistent mature track labels from timestamp-scoped manual geometry",
  );

  assert.match(
    videoPanel,
    /objectTrackTargetIds[\s\S]*duplicateTrackIds/,
    "collapsed object overlays must retain every represented track id for mature label lookup",
  );

  assert.match(
    videoPanel,
    /manualTrackMatureAuthority[\s\S]*targetIds[\s\S]*manualTrackAuthority/,
    "manual mature identity authority must be checked across all grouped object track ids",
  );
});

test("proliferation candidate decisions are canonical, source-linked, and gated", () => {
  assert.match(
    annotationCorrections,
    /export function requireSavedProliferationDecision\(/,
    "proliferation candidate decisions must have a canonical-save guard",
  );

  assert.match(
    videoPanel,
    /const sourceTracebackRefs = \[[\s\S]*candidate\.evidence_refs[\s\S]*sourceEvidence\.traceback/,
    "proliferation decisions must retain source evidence traceback references",
  );

  assert.match(
    videoPanel,
    /projectionTargets = candidate\.projection_targets\?\.length[\s\S]*\["master_schema", "video_panel", "bbox_roi_overlay", "meaning_network"\]/,
    "proliferation decisions must carry default governed projection targets",
  );

  assert.match(
    videoPanel,
    /proliferates_to:[\s\S]*decision === "confirmed"[\s\S]*\? projectionTargets[\s\S]*: \[\]/,
    "only confirmed proliferation candidates may proliferate to mature surfaces",
  );

  assert.match(
    videoPanel,
    /source_verification_status:[\s\S]*source_time_resolved[\s\S]*source_anchor_missing/,
    "proliferation decisions must disclose whether source anchors were resolved",
  );

  assert.match(
    videoPanel,
    /requireSavedProliferationDecision\([\s\S]*savedCorrections,[\s\S]*nextDecision\.decision_id/,
    "VideoPanel must verify the backend returned the saved proliferation decision before updating local projections",
  );

  assert.match(
    videoPanel,
    /if \(decision === "confirmed" && appliedLabel\)[\s\S]*buildCorrectionRule/,
    "label override creation must remain gated to confirmed proliferation candidates only",
  );
});
