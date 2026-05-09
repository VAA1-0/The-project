# VAA1 Detection / Annotation Proliferation Intelligence Schema Note

Date: 2026-05-03

## 1. Purpose

This note defines the schema-facing idea of detection / annotation proliferation intelligence in
VAA1.

Proliferation intelligence is the governed layer that helps an analyst turn one probable
annotation into nearby likely candidates across detections, transcript, metadata, audio, visual
sample evidence, and cinematic context.

It is not automatic truth.

The purpose is:

- save analyst time
- propagate from probable indications
- rank the closest similar evidence profiles
- expose probability and evidence basis in the UI
- prevent uncontrolled drift to unrelated people, objects, scenes, or speakers
- preserve direct manual annotation as the highest ordinary authority

## 2. Governing Authority Rule

The authority order for detection and annotation display should be:

1. manual correction
2. direct manual annotation
3. mature proliferated annotation
4. supported proliferated candidate
5. grouped detection
6. raw detection

Only direct manual annotation or manual correction may overrun the latest mature proliferated
annotation.

Proliferated output must never silently mutate source evidence. It should remain traceable as a
derived candidate until it is accepted, corrected, rejected, or superseded by the analyst.

## 3. Core Schema Object

Recommended schema id:

`vaa1.proliferation_intelligence.v1`

Recommended top-level fields:

```json
{
  "schema": "vaa1.proliferation_intelligence.v1",
  "analysis_id": "string",
  "request_id": "string",
  "created_at": "ISO-8601 datetime",
  "seed_evidence": {},
  "governance": {},
  "candidate_count": 0,
  "candidates": [],
  "ui_surface": {},
  "known_risks": []
}
```

## 4. Seed Evidence

The seed evidence is the analyst-indicated source from which proliferation begins.

Required or strongly recommended fields:

```json
{
  "overlay_key": "object-0-7.666",
  "modality": "object",
  "label": "Sari Multala",
  "source_label": "person",
  "category": "Identification",
  "source_track_id": "7",
  "source_target_type": "object",
  "interval": {
    "start": 7.666,
    "end": 7.766
  },
  "geometry": {
    "geometry_type": "bbox",
    "coordinate_system": "normalized",
    "bbox": {
      "x": 0.34,
      "y": 0.12,
      "width": 0.22,
      "height": 0.56
    }
  }
}
```

The seed should be enough to build a coordinate / timesphere profile without relying on label
text alone.

## 5. Coordinate / Timesphere Profile

Every seed and candidate should be representable as a timesphere:

```json
{
  "time": {
    "start": 7.666,
    "end": 7.766,
    "center": 7.716
  },
  "coordinate": {
    "bbox": {
      "x": 0.34,
      "y": 0.12,
      "width": 0.22,
      "height": 0.56
    },
    "center": {
      "x": 0.45,
      "y": 0.40
    },
    "area": 0.1232
  },
  "track": {
    "track_id": "7",
    "track_source": "objects_panel"
  },
  "modality": "objects_panel",
  "source_kind": "grouped_detection"
}
```

This profile lets VAA1 compare likely continuity using time, space, track, source panel, and
sample support.

## 6. Candidate Object

Each candidate should preserve both its own evidence and the seed evidence that produced it.

Recommended fields:

```json
{
  "candidate_id": "request-id:object:7",
  "evidence_id": "object:7",
  "analysis_id": "analysis-id",
  "label": "person",
  "category": "Object",
  "source_kind": "grouped_detection",
  "source_panel": "objects_panel",
  "time": {
    "start": 7.666,
    "end": 7.766
  },
  "geometry": {},
  "raw": {
    "track_id": 7,
    "confidence": 0.89
  },
  "match_probability": 0.83,
  "legacy_match_score": 0.72,
  "review_state": "candidate",
  "maturity_state": "supported_candidate",
  "closest_match": {
    "principle": "closest_match",
    "match_probability": 0.83,
    "components": {
      "text_semantic": 0.45,
      "time_proximity": 0.98,
      "spatial_consistency": 0.91,
      "track_continuity": 1.0,
      "contextual_modality": 0.72,
      "sample_cloud_support": 0.3
    },
    "weights": {},
    "source_timesphere": {},
    "seed_timesphere": {}
  },
  "provenance": {
    "request_id": "request-id",
    "source_evidence": {},
    "candidate_evidence_id": "object:7",
    "candidate_source_kind": "grouped_detection"
  }
}
```

## 7. Maturity States

Recommended maturity states:

- `candidate`: returned by the matcher, not yet strong enough to alter overlay authority.
- `supported_candidate`: enough probability or evidence support to show as a likely match.
- `mature_proliferated`: the latest mature derived annotation may surface on BBox overlays.
- `accepted`: analyst accepted the derived annotation.
- `corrected`: analyst changed the derived annotation.
- `rejected`: analyst rejected the derived annotation.
- `superseded`: newer evidence or manual annotation has replaced it.

Current UI behavior should treat high-probability closest matches as mature enough to surface,
but they must remain visually distinguishable from direct manual annotations.

## 8. Evidence Inputs

Proliferation intelligence may draw from:

- object detections and grouped tracks
- manual visual annotations
- correction records
- transcript segments
- source metadata
- OCR
- expression detections
- audio diarization turns
- audio detections and audio sample clouds
- visual sample clouds
- source samples
- visual cues
- cinematic clues
- Time Bank marks and scene context when available

The schema should not privilege visual BBox evidence alone. In identity cases, transcript,
metadata, voice continuity, visual sample support, and scene context may all raise or lower the
probability.

## 9. Anti-Drift Requirements

For `character_continuity` and person identity proliferation:

- same-track candidates may be boosted
- spatially nearby candidates may be boosted
- far-away same-frame people should not inherit the label without stronger support
- cross-scene propagation should require stronger multi-modal evidence
- split-screen regions should be treated as separate visual sub-scenes
- all candidate labels must preserve their source panel and probability

The tool should be simple and useful in ordinary cases: one visible interview subject, many
`person` detections, one known name. It should not become a silent identity spreader.

## 10. UI Surface Contract

The BBox UI should surface proliferation intelligence in the analyst's eyes:

- show closest candidates in the BBox action tray
- show match probability
- show the evidence source panel
- show candidate maturity or review state
- show why the match exists, at least through compact component hints
- allow direct manual annotation to overrun any proliferated state
- visually distinguish mature proliferated overlays from manual annotations

Recommended color/state distinction:

- manual annotation: manual authority color
- mature proliferated annotation: derived/proliferated color
- raw detection: detector color

## 11. Known Failure Modes

Scene changes may show the same character in different clothes, lighting, location, or camera
distance. Action scenes can break simple body or clothing continuity. This needs later
mitigation through scene-change-aware thresholds and stronger multi-modal support.

Split screens may show the same character multiple times in different scenes at one video time.
The schema must preserve region, scene, and provenance separately instead of collapsing all
appearances into one simple track.

Crowded scenes may contain many `person` detections. A single identity indication must not drift
to other visible people merely because the label `person` matches.

## 12. Related Documents

- `docs/vaa1_closest_match_evidence_proliferation_note_2026-05-03.md`
- `docs/schemas/vaa1_annotation_master_schema_v1.schema.json`
- `docs/schemas/vaa1.visual_sample_data_cloud.schema.json`
- `docs/schemas/vaa1.audio_sample_data_cloud.schema.json`
