# VAA1 Parallel Annotation Workspace Design (2026-04-13)

## 1. Purpose

This note defines the next-stage annotation workspace architecture for VAA1.

The core principle is:

- **CVAT remains the visual annotation engine**
- **VAA1 remains the multimodal interpretation engine**
- **the analyst works inside one synchronized VAA1-controlled workspace**

The goal is not to replace CVAT. The goal is to place CVAT inside a larger VAA1 analyst environment where video, audio, transcript, Time Bank, metadata, automated detections, and schema mapping can be reviewed in parallel.

---

## 2. Problem Statement

The current integration has reached an important milestone:

- VAA1 can create and open CVAT tasks
- CVAT annotations can now be ingested back into a first VAA1 master-schema slice

However, three critical gaps remain:

1. **VAA1 annotations do not surface back into CVAT**
2. **CVAT does not support practical audio annotation because it does not play sound**
3. **VAA1 taxonomy and analyst guidance do not yet surface inside the annotation environment**

As a result, the analyst still experiences:

- one screen for CVAT visual annotation
- another conceptual system for VAA1 multimodal interpretation
- a split between visual marks and audio/transcript evidence

This creates avoidable friction and weakens the learning loop for VAA1.

---

## 3. Architectural Direction

### 3.1. Recommended Model

The recommended architecture is a **parallel annotation workspace**:

- **VAA1 player pane**
  - plays video with audio
  - shows VAA1 timeline cues
  - shows automated detections
  - anchors transcript, audio, and Time Bank evidence

- **CVAT pane**
  - allows visual object / track annotation
  - remains responsible for frame-by-frame or track-based visual markup

- **VAA1 interpretation side panels**
  - metadata and taxonomy
  - transcript and audio evidence
  - Time Bank
  - object/expression/OCR analysis
  - ingest/sync status
  - master-schema mapping visibility

This means the analyst stays in **one VAA1-owned working environment** while CVAT functions as one specialized subsystem inside it.

### 3.2. System Roles

- **CVAT**
  - manual visual annotation engine
  - object/track geometry editing
  - low-level visual markup

- **VAA1**
  - media playback with audio
  - multimodal evidence synthesis
  - taxonomy and governance
  - transcript/audio annotation
  - Time Bank grounding
  - master-schema ownership
  - AI learning and provenance

---

## 4. Why This Architecture Is Better

### 4.1. Audio Can Stay Where Audio Works

CVAT does not offer the kind of synchronized audio annotation environment VAA1 needs.

Therefore:

- audio annotation should live in VAA1
- transcript correction should live in VAA1
- audio cues should be anchored in VAA1 / Time Bank

This is not a weakness. It is a correct division of labor.

### 4.2. Visual Annotation Can Stay Where Visual Annotation Works

CVAT is well-suited to:

- manual box drawing
- object track manipulation
- frame-precise geometry editing

So VAA1 should not rebuild all of CVAT’s visual tooling. It should embed or place it beside the VAA1 player.

### 4.3. Multimodal Meaning Belongs to VAA1

The VAA1 master schema already points toward:

- genre annotations
- track annotations
- object annotations
- temporal segments
- expression layers
- review layers

That is a richer interpretive structure than CVAT alone is designed to manage.

Therefore:

- CVAT should contribute evidence
- VAA1 should own interpretation

---

## 5. Existing Codebase Reality

This architecture matches the current codebase surprisingly well.

### 5.1. VAA1 Already Has the Parallel Evidence Panels

The current VAA1 workspace already includes:

- [VideoPanel.tsx](/Users/admin/Desktop/VAA1/VAA1%20on%20Python%201.0/The-project/src/frontend/app/V2components/components/panels/VideoPanel.tsx)
- [SpeechToTextPanel.tsx](/Users/admin/Desktop/VAA1/VAA1%20on%20Python%201.0/The-project/src/frontend/app/V2components/components/panels/SpeechToTextPanel.tsx)
- [TimeBankPanel.tsx](/Users/admin/Desktop/VAA1/VAA1%20on%20Python%201.0/The-project/src/frontend/app/V2components/components/panels/TimeBankPanel.tsx)
- [SourceMediaMetadataPanel.tsx](/Users/admin/Desktop/VAA1/VAA1%20on%20Python%201.0/The-project/src/frontend/app/V2components/components/panels/SourceMediaMetadataPanel.tsx)
- [OBJDetectionPanel.tsx](/Users/admin/Desktop/VAA1/VAA1%20on%20Python%201.0/The-project/src/frontend/app/V2components/components/panels/OBJDetectionPanel.tsx)
- [OCRPanel.tsx](/Users/admin/Desktop/VAA1/VAA1%20on%20Python%201.0/The-project/src/frontend/app/V2components/components/panels/OCRPanel.tsx)
- [ExpressionPanel.tsx](/Users/admin/Desktop/VAA1/VAA1%20on%20Python%201.0/The-project/src/frontend/app/V2components/components/panels/ExpressionPanel.tsx)

### 5.2. CVAT Already Exists as a Dedicated Annotation Route

Current CVAT annotation is isolated in:

- [AnnotatePage.tsx](/Users/admin/Desktop/VAA1/VAA1%20on%20Python%201.0/The-project/src/frontend/components/AnnotatePage.tsx)
- [CvatCanvas.tsx](/Users/admin/Desktop/VAA1/VAA1%20on%20Python%201.0/The-project/src/frontend/cvat-api/components/CvatCanvas.tsx)

### 5.3. First CVAT-to-VAA1 Ingest Slice Already Exists

The backend now supports:

- shared taxonomy persistence
- CVAT job ingestion into a first VAA1 master-schema file

Implemented in:

- [api_server.py](/Users/admin/Desktop/VAA1/VAA1%20on%20Python%201.0/The-project/api_server.py)

This means the conceptual bridge is no longer hypothetical.

---

## 6. Target Analyst Experience

The analyst should experience annotation as one synchronized session:

1. open analysis in VAA1
2. see the VAA1 player with audio and transcript
3. open the **Visual Annotation** pane
4. CVAT appears beside the VAA1 player
5. analyst can:
   - listen to audio in VAA1
   - see transcript in VAA1
   - see automated detections in VAA1
   - add manual visual marks in CVAT
6. click **Sync CVAT to VAA1**
7. VAA1 shows:
   - raw CVAT evidence imported
   - mapped object and track counts
   - effect on the VAA1 master schema

This would finally let the analyst see how annotation work enters the VAA1 interpretation backbone.

---

## 7. Minimum Viable UI Slice

The first UI slice should be intentionally modest.

### Slice 1

Add a **parallel annotation mode** inside VAA1 with:

- existing VAA1 `VideoPanel`
- embedded or adjacent `CvatCanvas`
- one sync action
- one sync status card

### Slice 1 visible outputs

- current linked CVAT task/job
- current VAA1 ingest status
- object annotation count
- track annotation count
- last synced timestamp

This is enough to create the first credible unified analyst workflow.

---

## 8. Suggested Layout

### Option A: Side-by-side

- left: VAA1 video/audio player
- right: CVAT canvas
- bottom/right stack: transcript, Time Bank, metadata, detections

### Option B: Main + secondary

- center: VAA1 player
- right stack tab: CVAT visual annotation
- lower tabs: transcript, Time Bank, source metadata, object review

### Recommendation

For the first slice, **Option A** is stronger because:

- it makes the parallel architecture immediately visible
- it directly solves the “CVAT has no sound” problem in practice
- it reduces mental context switching

---

## 9. Sync Logic

The first operational sync model should be explicit, not hidden.

### Phase 1

- analyst annotates visually in CVAT
- analyst clicks `Sync CVAT to VAA1`
- VAA1 imports raw CVAT job data
- VAA1 maps it into the master schema
- VAA1 displays sync counts and status

### Phase 2

- optional auto-sync after successful CVAT save

### Phase 3

- selective VAA1-to-CVAT projection for supported labels/attributes

The key is to avoid pretending bidirectional semantic sync is solved before the representational rules are defined.

---

## 10. Audio Annotation Principle

Audio annotation should not be forced into CVAT.

Instead:

- VAA1 should host:
  - transcript editing
  - time-anchored audio annotation
  - prosody-based cue review
  - later voice/event tagging

- Time Bank should anchor:
  - transcript segments
  - audio events
  - visual segments
  - synced CVAT evidence

This gives VAA1 a real path toward learning audio detection without waiting for CVAT to become an audio annotation platform.

---

## 11. Taxonomy Principle

The VAA1 taxonomy should remain governed in VAA1 first.

That means:

- shared taxonomy lives in VAA1 backend
- analyst guidance lives in VAA1
- canonical mapping lives in VAA1

Only the subset that is useful and representable in CVAT should later be projected into:

- CVAT task labels
- CVAT attributes
- CVAT review presets

So the future direction is:

- **VAA1 governs**
- **CVAT executes visual annotation**

---

## 12. Immediate Sprint Implications

The next practical sprint steps should be:

1. add a VAA1-side sync status view for the new ingest endpoint
2. expose `Sync CVAT to VAA1` in the analyst workflow
3. prototype a side-by-side annotation workspace using:
   - `VideoPanel`
   - `CvatCanvas`
4. keep transcript/audio annotation on the VAA1 side
5. later design the controlled subset of VAA1 taxonomy that should appear inside CVAT

---

## 13. Conclusion

The better architecture is not “make CVAT do everything.”

The better architecture is:

- let **CVAT** do visual annotation
- let **VAA1** do synchronized multimodal interpretation
- let the analyst work inside one parallel workspace
- let the VAA1 master schema remain the canonical annotation record

This design is already supported by much of the current codebase. The next work is not conceptual invention so much as **UI unification and workflow exposure**.
