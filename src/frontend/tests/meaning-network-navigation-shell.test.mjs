import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync(
  new URL("../app/V2components/components/panels/MeaningPlotPanel.tsx", import.meta.url),
  "utf8",
);
const videoService = readFileSync(
  new URL("../lib/video-service.ts", import.meta.url),
  "utf8",
);

test("Meaning Network exposes grouped category navigation and structural breadcrumbs", () => {
  assert.match(panel, /data-vaa1-meaning-network-navigation-shell="true"/);
  assert.match(panel, /data-vaa1-meaning-network-grouped-lane-navigation="true"/);
  assert.match(panel, /Structural scope/);
  assert.match(panel, /Participants, actions and relations/);
  assert.match(panel, /Language and voice/);
  assert.match(panel, /Material, spatial and visual world/);
  assert.match(panel, /Sound world/);
  assert.match(panel, /Evidence and review/);
  assert.match(panel, /\["Act", "Sequence", "Scene", "Shot"\]/);
  assert.match(panel, /data-vaa1-meaning-network-embedded-lane-collapse/);
  assert.match(panel, /data-vaa1-meaning-network-embedded-lane-timeline/);
  assert.match(panel, /band\.lane\.lane_id === "scene"/);
  assert.match(panel, /"on_camera_agents", "off_camera_presence", "action_event"/);
  assert.match(panel, /meaning-network-title-view:/);
});

test("navigation state is restored per analysis and review overlays remain separate", () => {
  assert.match(panel, /vaa1:meaning-network-navigation:\$\{selectedVideoId\}/);
  assert.match(panel, /collapsedGroups/);
  assert.match(panel, /reviewOverlayVisible/);
  assert.match(panel, /selectedEdgeId/);
  assert.match(panel, /data-vaa1-meaning-network-review-overlay-toggle="true"/);
  assert.match(panel, /getBrowserStorageItem\(storageKey\)/);
  assert.match(panel, /setBrowserStorageItem\(`vaa1:meaning-network-navigation:/);
  assert.doesNotMatch(panel, /window\.localStorage\.setItem\(`vaa1:meaning-network-navigation:/);
});

test("edges are visible, directed, selectable and keyboard navigable", () => {
  assert.match(panel, /id="meaning-network-edge-arrow"/);
  assert.match(panel, /markerEnd="url\(#meaning-network-edge-arrow\)"/);
  assert.match(panel, /setSelectedMeaningNetworkEdgeId\(edge\.edge_id\)/);
  assert.match(panel, /event\.key !== "Enter" && event\.key !== " "/);
  assert.match(panel, /meaningNetworkEdgeKindLabel\(edge\.edge_type\)/);
  assert.match(panel, /Edges are navigable analytical relations, not decoration/);
});

test("eligible agent and object nodes reuse lightweight source-linked JPEG crops", () => {
  assert.match(panel, /function meaningNetworkNodeThumbnailUrl/);
  assert.match(panel, /apiService\.objectSourceCropUrl/);
  assert.match(panel, /data-vaa1-meaning-network-source-jpeg="true"/);
  assert.match(panel, /function meaningNetworkAgentColor/);
  assert.match(panel, /profile_key \|\| node\.attributes\?\.narrative_agent_id/);
});

test("mature Master Schema evidence is projected before bounded candidates", () => {
  assert.match(panel, /const mature = ordered\.filter/);
  assert.match(panel, /manual_correction", "manual_annotation", "mature_triangulated"/);
  assert.match(panel, /\.\.\.mature, \.\.\.candidates\.slice/);
  assert.match(panel, /manualAnnotation\?\.coordinates \|\| metadata\.bbox/);
  assert.match(panel, /evidenceRef\.bbox = sourceGeometry/);
  assert.match(panel, /score -= 110/);
  assert.match(panel, /score -= 96/);
  assert.match(panel, /Governed analyst evidence must never disappear behind a visual-density cap/);
  assert.match(panel, /candidates\.slice\(0, Math\.max\(0, laneLimit - governed\.length\)\)/);
  assert.match(panel, /\(\) => visibleMeaningNetworkNodes\.filter/);
});

test("all confirmed exploratory families enter through Master Schema before graph projection", () => {
  assert.match(videoService, /function governedClusterDecisionRecords/);
  assert.match(videoService, /records\.push\(\.\.\.governedClusterDecisionRecords\(corrections\)\)/);
  assert.match(videoService, /mappingStatus: "governed_cluster_confirmation"/);
  assert.match(videoService, /"member_of_governed_exploratory_family"/);
  assert.match(panel, /\.filter\(\(record\) => Boolean\(record\.label\)\)/);
});

test("theory-native scene markers and confirmed speech delivery remain explicit", () => {
  assert.match(panel, /\{ id: "burke", label: "Burke" \}/);
  assert.doesNotMatch(panel, /\{ id: "campbell", label: "Campbell" \}/);
  assert.match(panel, /burkean_dramatistic/);
  assert.match(panel, /data-vaa1-meaning-network-theory-scene-description="true"/);
  assert.match(panel, /function theorySceneProjection/);
  assert.match(panel, /Exposition", "Rising action", "Climax \/ reversal pressure", "Falling action", "Denouement \/ resolution/);
  assert.match(panel, /theory_projection_authority: governedReading \? "analyst_confirmed" : frameworkProjection\.authority/);
  assert.match(panel, /Exposition: "Foregrounds sequence\."/);
  assert.match(panel, /function analystFacingSceneConstellationFacts/);
  assert.match(panel, /Establishing protagonist/);
  assert.match(panel, /"Comic mythos", "Romantic mythos", "Tragic mythos", "Ironic mythos"/);
  assert.match(panel, /"Before", "Bets", "Becoming", "Beneath", "Between"/);
  assert.match(panel, /"Act", "Scene", "Agent", "Agency", "Purpose", "Pentadic ratios"/);
  assert.match(panel, /vaa1\.meaning_network_theory_scene_reading\.v1/);
  assert.match(panel, /Confirm reading/);
  assert.match(panel, /edge_type: "spoken_by"/);
  assert.match(panel, /edge_type: "prosody_of"/);
  assert.match(panel, /edge_type: "delivery_of"/);
  assert.match(panel, /addressee_status: "not_confirmed"/);
});

test("constellational speaker reiteration and object lanes use canonical governed joins", () => {
  assert.match(videoService, /resolveConstellationalTranscriptSpeakers\(/);
  assert.match(videoService, /governed_source_timed_speaking_identity/);
  assert.match(videoService, /active_speaker_synchrony/);
  assert.match(videoService, /intervalOverlapSeconds\([\s\S]*< 0\.12/);
  assert.match(panel, /speaker_resolution_status[^\n]*!== "resolved"/);
  assert.match(panel, /master_schema_objects/);
  assert.match(panel, /object\(\?:_detection\)\?/);
  assert.match(panel, /annotationCategory === "obj"[\s\S]*\? "object"/);
});

test("normalized Datascene scenes override imported detector numbering", () => {
  assert.match(panel, /governed_scene_index: scene\.scene_index/);
  assert.match(panel, /scene_index: index \+ 1/);
  assert.match(panel, /The governed, contiguous scene projection owns displayed numbering/);
});

test("unresolved transcript nodes support governed Narrative Agent speaker confirmation", () => {
  assert.match(panel, /!isUnknownAgentLabel\(governedSpeaker\)/);
  assert.match(panel, /transcript_text: segment\.text/);
  assert.match(panel, /data-vaa1-meaning-network-context-confirm-speaker="true"/);
  assert.match(panel, /data-vaa1-meaning-network-speaker-confirmation="true"/);
  assert.match(panel, /Who delivers this line\?/);
  assert.match(panel, /confirmTranscriptNarrativeAgent/);
  assert.match(panel, /speakerConfirmation: chosen/);
  assert.match(panel, /manual_narrative_agent_spoken_by_confirmation/);
  assert.match(panel, /"audio_diarization"/);
  assert.match(panel, /raw_detection_retained_as: "traceback_only"/);
  assert.match(panel, /speaker_resolution_authority: "constellational_inference"/);
  assert.match(panel, /visual_speech_synchrony/);
  assert.match(panel, /confirmed_prosody_speaker/);
  assert.match(panel, /speaker_resolution_status: "resolved"/);
  assert.match(panel, /"conflicting" : "ambiguous"/);
  assert.match(panel, /data-vaa1-speaker-resolution-audit="true"/);
  assert.doesNotMatch(panel, /speaker_resolution_score/);
  assert.match(panel, /supersededSpeakerRules/);
  assert.match(panel, /existingWithoutSupersededSpeaker/);
  assert.match(panel, /\["transcript", "prosody", "spoken_word", "speaker_assignment"\]/);
  assert.match(panel, /record\.category === "speaker_assignment"/);
});

test("visual and Foley corrections replace same-beat assignments through Master Schema", () => {
  assert.match(panel, /const correctMeaningNetworkDetection/);
  assert.match(panel, /vaa1\.meaning_network_detection_correction\.v1/);
  assert.match(panel, /data-vaa1-meaning-network-context-correct-visual="true"/);
  assert.match(panel, /data-vaa1-meaning-network-context-correct-foley="true"/);
  assert.match(panel, /sameBeatCorrection/);
  assert.match(panel, /supersededDetectionIds/);
});

test("the primary graph is packed around a navigable scene structural dossier", () => {
  assert.match(panel, /const packedLaneNodes = laneNodes\.filter/);
  assert.match(panel, /data-vaa1-meaning-network-scene-dossier="true"/);
  assert.match(panel, /Scene evidence details/);
  assert.match(panel, /What this scene establishes/);
  assert.match(panel, /Shot \/ mise-en-scène artefacts/);
  assert.match(panel, /activeSceneFrameworkProjection\.description/);
  assert.match(panel, /No governed shot assignment/);
});

test("a scene-scoped interaction highway keeps agents, actions and typed relations navigable", () => {
  assert.match(panel, /data-vaa1-meaning-network-interaction-highway="true"/);
  assert.match(panel, /Interaction evidence/);
  assert.match(panel, /No governed Narrative Agent presence in this scene/);
  assert.match(panel, /Co-presence is visible above but is not being promoted into an interaction claim/);
  assert.match(panel, /openMeaningNetworkEdgeInspector\(edge\)/);
  assert.match(videoService, /annotation_category: item\.category/);
});

test("the timed Datascene excludes untimed records and projects continuous Scene coverage", () => {
  assert.match(panel, /function contiguousMeaningSceneCoverage/);
  assert.match(panel, /governed_start: scene\.start/);
  assert.match(panel, /governed_end: scene\.end/);
  assert.match(panel, /!meaningNetworkEvidenceTimeRange\(node\.evidence_refs\)/);
  assert.match(panel, /meaningNetworkNodeOverlapsScene\(node, scene\)/);
  assert.match(panel, /Number\(scene\.end\) - Number\(scene\.start\) > 0\.001/);
  assert.match(panel, /governed_scene_index: scene\.scene_index/);
  assert.match(panel, /scene_index: index \+ 1/);
});

test("presence-bar resizing keeps its lane stable and commits clock plus Master Schema proliferation", () => {
  assert.match(panel, /scrollLeft: meaningNetworkGraphScrollRef\.current\?\.scrollLeft/);
  assert.match(panel, /scrollTop: meaningNetworkGraphScrollRef\.current\?\.scrollTop/);
  assert.match(panel, /viewport\.scrollLeft = meaningNetworkPresenceDrag\.scrollLeft/);
  assert.match(panel, /viewport\.scrollTop = meaningNetworkPresenceDrag\.scrollTop/);
  assert.doesNotMatch(panel, /onPointerLeave=\{endMeaningNetworkPresenceDrag\}/);
  assert.match(panel, /meaningNetworkPresenceClockCommitted/);
  assert.match(panel, /master_schema_proliferation_required: true/);
  assert.match(panel, /void persistMeaningNetworkPresenceInterval\(node, range\)/);
});
