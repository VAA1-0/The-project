# VAA1 agent persistence operationalization note

Date: 2026-05-18

## Current Status
We have successfully established the foundational data schema and intermediate layer for Narrative Agent Identification across scene boundaries. 

The backend now reads cross-scene track linkage artifacts (`agent_persistence_scene_cut.json`) and gracefully wraps them in the `second_order_label_proliferation` plan without silently mutating any root tracking IDs. The frontend successfully decodes these as `AgentPersistenceLabel` items and displays them in the `SecondOrderLabelAffirmations` tray using the VAA1 principle of visual graduated affirmation (e.g., as "Review link" or "Link" badges).

## Next Steps for VAA1-Wide Operationalization

To fully operationalize this pipeline and make it practically actionable for analysts, the following specific implementations are required next:

### 1. Visual Integration in `VideoPanel.tsx` (BBox/ROI Editor)
The most critical context for an analyst is seeing these links *on the video*. 
- **Action**: Modify the overlay renderer in `VideoPanel.tsx` to intersect the current selected object track with `agent_persistence_labels`.
- **Requirement**: If Track A is selected and the proliferation plan shows a `strong_candidate` link to Track B across a scene cut, a visual badge or connecting hint must appear directly on or next to the BBox overlay tray. 

### 2. Analyst Confirmation & Master Schema Hook
Currently, the links are read-only chips. We need the "affirmation" half of the loop.
- **Action**: Add an interactive confirmation state to the `AgentPersistenceLabel` chips. 
- **Requirement**: When an analyst clicks "Confirm" on a persistence candidate, the frontend must mutate the `vaa1_annotation_master_schema.json` via `api-service.ts`. It should assert a new identity mapping (e.g., mapping Track B's identity target to Track A's identity target) while adhering to the "no silent mutation" rule (the provenance route must record "Analyst confirmed scene cut persistence").

### 3. Deepening the Pipeline Hook (`pipeline_video_frames.py`)
Right now, `agent_persistence_scene_cut.json` is picked up during status refreshes by `write_iterative_derived_artifacts_for_status`. 
- **Action**: Embed `AgentPersistenceManager` natively into the primary `FrameAnalysisPipeline`. 
- **Requirement**: As soon as scene segments and tracked objects are extracted, the backend should compute sample-profile similarity (e.g., DeepFace embeddings or color histograms) and generate the persistence artifact synchronously before the analysis run is marked `completed`.

### 4. Traceback and Provenance Validation
Analysts need to know *why* the system scored a persistence link at 85%.
- **Action**: Surface the `evidence` payload (e.g., `similarity_score`, `departed_track_id`, `arrived_track_id`) and the `traceback_relink` properties inside the Forensic / Traceback UI panels.
- **Requirement**: Clicking a persistence chip should open the Traceback inspector, explicitly showing the two track images/embeddings that were compared to generate the link.

### 5. Expand Proliferation to Cross-Video ("Whole Case") Scope
Currently, agent persistence is bounded to single-video scene cuts.
- **Action**: Expand `evidence_proliferation_matcher.py` to ingest and execute `AgentPersistenceManager` checks across multiple videos in the project workspace.
- **Requirement**: The system must allow analysts to select "Whole case" in the Proliferation Launcher, matching a known agent track in Video 1 against unassigned tracks in Video 2, surfaced in the same non-mutating candidate manner.

---

## Summary

By executing these steps, VAA1 will transition Agent Persistence from a **passive display layer** into an **active operational tool** that drastically accelerates narrative agent identification across complex, multi-scene, and multi-file projects, while rigorously maintaining human-in-the-loop governance.