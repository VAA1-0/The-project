# VAA1 Constellational Constitution: Detection Substance and Triangulation Mitigation Report

Date: 2026-05-16  
Status: Architectural Review & Mitigation Directive  

## 1. Executive Summary

VAA1 relies on a "constellational constitution" to produce meaning: the triangulation of visual patterns, object recognition, OCR, audio prosody, transcript data, and source metadata. 

However, current analysis of the data maturation proliferation regime reveals severe procedural weaknesses. Raw detections are surfacing in obvious situations because the detection substance is currently failing to triangulate maturely. If these weaknesses remain hidden, the platform risks projecting false confidence based on disconnected, localized detections rather than true cross-modal intelligence.

## 2. Identified Procedural Weaknesses

### A. Linear Tracking vs. Un-Linear Timesphere Mapping
**The Vulnerability:** The current system tracks audio and visual samples in a highly linear fashion (relying on continuous `track_id` logic). 
**The Symptom:** If a known character (e.g., "James Bond" or "Ernst Stavro Blofeld") speaks or appears in Scene 1, the system cannot currently use that exact audio or visual sample to autonomously identify them in Scene 5. The "Anti-Drift" rule forcefully breaks continuity at scene cuts.

### B. Isolated Visual and Audio Sample Clouds
**The Vulnerability:** Audio and visual samples are generated, but they are not actively participating in the data maturation process. The backend lacks the deep-vector embedding comparisons necessary to map a voice profile or facial profile against unassigned phenomena across the entire analyzed array.
**The Symptom:** An unassigned voice or face remains "Unknown Person Track #" because the system is not actively polling the "Sample Clouds" to find a non-linear match.

### C. Unidirectional Top-Down Disconnect
**The Vulnerability:** The SFL/Dependency layer generates high-level semantic artifacts (e.g., Scene Cards, Narrative Agent Profiles), but this top-down data does not flow back downward to inform raw bounding box (BBox) and ROI identifications. 
**The Symptom:** The analyst sees a "Scene Card" that perfectly understands the context, but the underlying boxes in the video panel remain ignorant of that context.

## 3. Required Mitigation Strategies

To secure the constellational constitution, the following mitigations must be immediately scheduled into the backend processing and frontend proliferation regimes:

### Mitigation 1: Activate Deep Vector Embedding Triangulation
The backend Python matching engine must be upgraded to support **un-linear timesphere mapping**. 
- **Action:** When an audio or visual sample is verified (either by high-confidence detection or analyst confirmation), its embedding vector must be pooled.
- **Action:** All unidentified `person` tracks and audio diarization turns must actively poll this pool, regardless of spatial or temporal proximity.

### Mitigation 2: Establish the Bidirectional Semantic Loop
The system must allow top-down Narrative Agent Profiles and Scene Cards to act as active gravity wells for bottom-up detections.
- **Action:** If a Scene Card confirms a specific location and expected participants via SFL transcript analysis, the BBox candidate matcher must lower its confidence threshold requirement for those specific identities within that time boundary.

### Mitigation 3: Refine the "Anti-Drift" Thresholds
The current strict penalty for breaking a tracking ID is kneecapping the triangulation process.
- **Action:** Implement scene-boundary-aware matching. If a track breaks due to a confirmed camera transition or cut, the system should invoke an "Agent Persistence Check" using clothing color histograms and facial/sample embeddings to re-link the animate-object sample profile on the other side of the cut, rather than resetting to `person track #`.

### Mitigation 4: Implement Agent Persistence Check
The backend tracking paradigm must support semantic persistence across confirmed scene cuts. Continuous spatial tracking should remain strict inside a shot, but a scene cut should activate a separate semantic relinking routine rather than forcing a permanent agent/sample-profile reset. This is not a natural-person identity assertion; it is a governed match between animate-object sample profiles.

**Activation condition:** Run only when the standard tracker drops or spawns a person track within a configurable scene-cut window, initially 1.5 seconds before and after a confirmed `motionSceneBasis.sceneSegments` boundary.

**Pipeline:**
1. **Snapshot departed tracks:** collect person tracks ending inside the pre-cut window and preserve their last feature cloud.
2. **Snapshot arrived tracks:** collect new or unassigned person tracks beginning inside the post-cut window.
3. **Compare semantic features:** build a similarity matrix from facial embeddings and torso/clothing color histograms.
4. **Re-link with governance:** when the combined score crosses the scene-cut threshold, assign the prior agent/track chain to the arrived track and emit a second-order instruction such as `Agent sample profile persisted across scene cut`.

**Feature cloud requirements:**
- face embedding when available
- torso HSV color histogram as a non-frontal fallback
- source frame/time/bbox provenance
- cut boundary id and scene segment ids
- similarity components, weights, threshold, and selected/non-selected candidate scores

**Governance constraints:**
- This must not weaken the anti-drift rule for ordinary continuous tracking.
- The persisted agent/sample profile must surface as mature semantic evidence, not as raw detector certainty.
- BBox/ROI overlays must expose whether the agent label came from continuous tracking, manual confirmation, or constellational/scene-cut triangulation.
- The Master Schema must retain traceback from the re-linked agent/sample profile to the departed track, arrived track, feature-cloud comparison, and scene cut.
- If multiple candidate matches are close, the output must remain a review candidate rather than silently mutating the track id.

**Implementation guide:**
- Add an `AgentPersistenceManager` backend module near the second-order label proliferation or matching engine.
- Use existing VAA1 visual identity vectors where available before adding a new dependency. If a face provider such as DeepFace is introduced later, it should be optional and locked explicitly in `vaa1_core.lock.yml`.
- Use OpenCV histogram comparison for torso clothing support.
- Route accepted matches into `second_order_label_proliferation` with a dedicated instruction family, for example `agent_persistence_scene_cut`.
- Add tests that simulate a pre-cut track, a post-cut track, a positive match, a below-threshold non-match, and an ambiguous two-candidate case.

## 4. Immediate Development Mandate

We cannot afford to leave these pipelines disconnected. The next sprint must focus explicitly on the **Backend Sample Cloud Wiring**.

1. **Audit `multimodal_meaning_stage1.py`:** Ensure it exposes character identity vectors to the proliferation layer.
2. **Update `second_order_label_proliferation.py`:** Mandate that candidate matching queries the un-linear sample clouds before it falls back to raw tracker IDs.
3. **Frontend Exertion:** The frontend UI must visually distinguish between an identity gained via "Continuous Tracking" vs. an identity gained via "Constellational Triangulation."
4. **Build `AgentPersistenceManager`:** Add scene-cut semantic relinking for dropped/spawned animate-object/person tracks using feature-cloud comparison and Master Schema traceback.
5. **Acid-test BBox/ROI maturity surfacing:** Verify that the Video Panel still prefers user-confirmed and Master Schema mature agent/sample-profile labels over raw detector labels after the proliferation refactor.

---
*End of Report. Proceed to backend embedding integration.*
