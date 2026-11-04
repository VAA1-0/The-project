import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync(
  new URL("../app/V2components/components/panels/OBJDetectionPanel.tsx", import.meta.url),
  "utf8",
);
const api = readFileSync(new URL("../lib/api-service.ts", import.meta.url), "utf8");
const sharedThumbnail = readFileSync(new URL("../app/V2components/components/SourceLinkedClusterThumbnail.tsx", import.meta.url), "utf8");

test("Objects owns compact semantic-family thumbnail lineups", () => {
  assert.match(panel, /data-vaa1-object-cluster-workbench="true"/);
  assert.match(panel, /data-vaa1-object-family-lineups="true"/);
  assert.match(panel, /data-vaa1-object-cluster-thumbnail="true"/);
  assert.match(panel, /objectSourceCropUrl/);
  assert.match(panel, /Representative: track/);
  assert.match(panel, /Boundary: track/);
  assert.match(panel, /Person tracks remain governed in Narrative Agent/);
  assert.match(panel, /data-vaa1-object-provider-lineage="true"/);
  assert.match(panel, /detectorProviders\.join/);
  assert.match(panel, /data-vaa1-object-provider-run-filter="true"/);
  assert.match(panel, /All active detector runs/);
  assert.match(panel, /data-vaa1-object-mature-filter-immunity="true"/);
  assert.match(panel, /Filtering changes the raw evidence view, never maturity/);
  assert.match(panel, /getObjectTrackRefs/);
  assert.match(panel, /data-vaa1-object-lineup-volume-layout="wrapping-grid"/);
  assert.match(panel, /grid-cols-\[repeat\(auto-fill,4rem\)\]/);
  assert.match(panel, /data-vaa1-object-cluster-selected=\{selected \? "true" : "false"\}/);
  assert.match(panel, /SourceLinkedClusterThumbnail/);
  assert.match(sharedThumbnail, /Open in video/);
  assert.match(sharedThumbnail, /data-vaa1-source-linked-cluster-thumbnail-lightbox/);
  assert.match(panel, /data-vaa1-object-lineup-row-collapse="true"/);
  assert.match(panel, /data-vaa1-object-lineup-row-drag-handle="true"/);
});

test("object families expose threshold, temporal distribution, drag reassignment and batch governance", () => {
  assert.match(panel, /data-vaa1-object-cluster-adjustment-bench="true"/);
  assert.match(panel, /data-vaa1-object-cluster-temporal-distribution="true"/);
  assert.match(panel, /data-vaa1-object-threshold-preview="non-writing"/);
  assert.match(panel, /application\/x-datascene-object-cluster-member/);
  assert.match(panel, /Confirm selected/);
  assert.match(panel, /Move selected/);
  assert.match(panel, /Split selected/);
  assert.match(panel, /Merge family/);
  assert.match(panel, /data-vaa1-object-bench-position="before-family-catalogue"/);
  assert.match(panel, /Confirm selected \(\$\{selectedObjectFamilyKeys\.length\}\)/);
  assert.match(panel, /application\/x-datascene-object-lineup-row/);
  assert.match(panel, /application\/x-datascene-object-cluster-member/);
  assert.match(panel, /Rename or merge this object-family row/);
  assert.match(panel, /Merge into confirmed family…/);
  assert.match(panel, /governed-object-family-merge-targets/);
  assert.match(panel, /governedObjectFamilyNames/);
  assert.match(panel, /action === "merge" && !governedObjectFamilyNames\.includes/);
  assert.match(panel, /data-vaa1-object-operation-receipt="true"/);
  assert.match(panel, /aria-live="assertive"/);
  assert.match(panel, /event\.key === "Enter"/);
  assert.match(panel, /event\.key === "Escape"/);
  assert.match(panel, /Enter saves · Esc cancels/);
  assert.match(panel, /setObjectActionMessage\(null\)/);
  assert.match(panel, /if \(saved\)/);
  assert.match(panel, /100% analyst confirmed · mature/);
  assert.match(panel, /border-emerald-700\/70 bg-emerald-950\/15/);
  assert.match(panel, /void persistObjectClusterOperation\(\{ action: "reassign"/);
});

test("genre and situation guide review without becoming object or ontology truth", () => {
  assert.match(panel, /data-vaa1-object-context-boundary="review-only"/);
  assert.match(panel, /Genre and situation are review context/);
  assert.match(panel, /review_context: objectReviewContext/);
  assert.match(api, /genre_and_situation_do_not_change_similarity/);
  assert.match(panel, /taxonomy_term_state: taxonomyTermState/);
  assert.match(panel, /analyst_proposed_local_term/);
  assert.match(panel, /ontology_effect: "none_until_separate_taxonomy_or_relation_governance"/);
});

test("confirmation writes mature Master Schema claims and preserved lineage", () => {
  assert.match(panel, /datascene\.governed_object_cluster\.v1/);
  assert.match(panel, /explicit_user_confirmation/);
  assert.match(panel, /applyScope: "track_family"/);
  assert.match(panel, /raw_detector_classes_are_provenance_only/);
  assert.match(panel, /object_cluster_lineage_id/);
  assert.match(panel, /data-vaa1-object-cluster-lineage="true"/);
  assert.match(panel, /"MasterSchema", "Objects", "VideoPanel", "SceneCards", "MeaningNetwork"/);
});

test("legacy numeric track collisions remain explicitly undetermined", () => {
  assert.match(panel, /hasAmbiguousLegacyTrackCollision/);
  assert.match(panel, /target_label/);
  assert.match(panel, /hasAmbiguousLegacyTrackCollision\(obj\) \? "Undetermined"/);
});

test("object saves use source-qualified evidence IDs instead of reused numeric track IDs", () => {
  assert.match(panel, /function getObjectEvidenceId/);
  assert.match(panel, /legacy-object-evidence/);
  assert.match(panel, /object-cluster-evidence:/);
  assert.match(panel, /targetId: member\.evidenceId/);
  assert.match(panel, /member_evidence_ids/);
  assert.match(panel, /Objects cluster readback label mismatch/);
  assert.match(panel, /Objects cluster readback evidence mismatch/);
});

test("redundant legacy rows can be dropped and restored without deleting evidence", () => {
  assert.match(panel, /datascene\.object_lineup_row_disposition\.v1/);
  assert.match(panel, /operation: "drop_row" \| "restore_row"/);
  assert.match(panel, /raw_evidence_preserved: true/);
  assert.match(panel, /mature_claims_preserved: true/);
  assert.match(panel, /semantic_effect: "lineup_projection_only"/);
  assert.match(panel, /reversible: true/);
  assert.match(panel, />Drop row<\/button>/);
  assert.match(panel, /data-vaa1-dropped-object-lineup-rows="true"/);
  assert.match(panel, />Restore row<\/button>/);
});

test("thumbnail URLs remain analysis-bound and source-coordinate bound", () => {
  assert.match(api, /objectSourceCropUrl/);
  assert.match(api, /objects\/source-crop/);
  assert.match(api, /timestamp: String\(timestamp\)/);
  assert.match(api, /encodeURIComponent\(analysisId\)/);
});

test("unmatched detections can create a governed evidence-bound lineup row", () => {
  assert.match(panel, /data-vaa1-new-object-family-row="true"/);
  assert.match(panel, /New object-family row title/);
  assert.match(panel, /Create row from selected/);
  assert.match(panel, /selectedUnmatchedObjectKeys/);
  assert.match(panel, /unmatchedObjectClusterMembers/);
  assert.match(panel, /action: "reassign"/);
});

test("Undetermined is a review queue and selected artefacts create named rows", () => {
  assert.match(panel, /Undetermined is a review queue, not a semantic object family/);
  assert.match(panel, /Name selected artefacts to create a row/);
  assert.match(panel, /Create row from selected/);
  assert.match(panel, /Name selected in workbench/);
  assert.match(panel, /event\.key === "Enter"/);
});
