# VAA1 Closest-Match Evidence Proliferation Note

Date: 2026-05-03

## 1. Purpose

This note records the upgrade from label-overlap evidence proliferation toward a
closest-match principle for analyst-assisted annotation propagation.

Schema companion:

- `docs/vaa1_detection_annotation_proliferation_intelligence_schema_note_2026-05-03.md`

The practical goal is simple:

- save analyst time
- start from a probable analyst indication
- find the most likely matching detections and evidence profiles
- surface candidates visibly in the UI
- preserve analyst authority
- avoid silently confirming uncertain identity matches

The governing rule remains:

Manual correction wins everywhere. Proliferated results are candidates until supported,
reviewed, corrected, or rejected.

## 2. Upgrade Summary

The proliferation matcher now treats a selected BBox/ROI indication as more than a text label.
The request can carry a small evidence profile:

- selected label
- source label
- category
- source track id, when available
- timestamp interval
- normalized BBox geometry
- modality

The backend now builds a closest-match profile for candidates. Candidate matching can draw from:

- manual visual annotations
- object detections
- transcript segments
- source metadata
- audio diarization turns
- audio sample clouds
- visual sample clouds
- source samples
- visual cues
- cinematic clues
- OCR and expression detections

Each returned candidate can carry:

- `match_probability`
- `closest_match.principle = "closest_match"`
- component scores for text, time, space, track, modality context, and sample-cloud support
- source timesphere
- seed timesphere

This gives the UI something analyst-facing to show, instead of hiding the method behind a
generic "candidate matching complete" message.

## 3. Timesphere / Coordinate Principle

The useful matching unit is a small coordinate/timesphere profile:

- time start
- time end
- time center
- BBox coordinates
- BBox center
- BBox area
- track id, when available
- modality
- provenance/source panel

This is not yet a full identity engine. It is a governed candidate matcher that can compare
nearby evidence profiles and rank likely matches.

## 4. Visual And Audio Sample State

Audio sample clouds already exist as a first working artifact. They can support speaker and
voice continuity through diarization turns, transcript text, voice-related fields, and sample
cloud summaries.

Visual sample clouds have a schema and identity-triangulation contract. The closest-match
upgrade wires visual sample cloud evidence into the proliferation matcher so visual samples can
support identity continuity alongside BBox geometry and detection tracks.

This is still early-stage. The current implementation can reason over declared sample metadata,
time windows, BBoxes, and confidence values. It does not yet perform a mature visual embedding
comparison across clothing, pose, lighting, or camera changes.

## 5. Anti-Drift Rule

For character-continuity proliferation from a `person` indication, the matcher should not
blindly spread the identified name to every detected person.

Current mitigation:

- same-track candidates are boosted
- spatially consistent BBoxes are boosted
- far-away `person` detections can be excluded
- all results remain candidates unless authority rules say otherwise

This is meant to keep the workflow useful in cases like a visible interview subject with many
nearby `person` detections.

## 6. Known Future Risk: Scene Change

Scene changes can break naive visual continuity.

The same character may appear:

- in different clothes
- in a different location
- with different lighting
- at a different camera distance
- during an action scene
- partially occluded
- blurred or in motion

A future mitigation layer should detect scene boundaries and treat cross-scene continuity as a
separate question from within-scene continuity. The matcher should avoid assuming that clothing,
background, or immediate spatial position is stable across scenes.

Future mitigation should include:

- scene-change-aware matching thresholds
- costume/wardrobe change tolerance
- face/body/audio/sample-cloud evidence weighting across scene boundaries
- lower confidence for cross-scene visual-only propagation
- stronger reliance on multi-modal support when location or clothing changes
- clear analyst-facing warnings for cross-scene identity candidates

## 7. Known Future Risk: Split Screens

Split-screen layouts can show the same character in multiple scenes or time contexts at once.

This creates a special problem:

- the same character may appear multiple times in one frame
- different screen regions may represent different scenes
- BBoxes may be spatially far apart but still refer to the same identity
- time may be shared in the video file while story time or scene context differs

Future mitigation should treat split-screen regions as separate visual sub-scenes. A candidate
may be valid in more than one region, but the matcher should preserve the region, scene, and
provenance separately instead of collapsing all appearances into one simple track.

## 8. Analyst-Facing UX Direction

The UI should make proliferation feel like a time-saving assistant, not an invisible automation.

The useful analyst flow is:

1. Mark or correct one probable indication.
2. Open Proliferate.
3. See likely candidates with probability and evidence source.
4. Review the nearest matches first.
5. Accept, correct, or reject candidates.

The UI should stay quiet and compact, but it must expose why a candidate appeared. Probability
without source evidence is not enough.

## 9. Bottom Line

The current upgrade moves VAA1 from label-only proliferation toward governed closest-match
evidence proliferation.

It is useful for saving analyst time in simple cases, especially when the same visible person is
detected many times in a short continuous sequence.

It is not yet enough for harder identity continuity across scene changes, costume changes,
different locations, or split-screen layouts. Those must be handled as explicit future
mitigation layers rather than treated as ordinary same-track propagation.
