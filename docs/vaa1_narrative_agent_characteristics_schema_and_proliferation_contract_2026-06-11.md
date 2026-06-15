# VAA1 Narrative Agent Characteristics Schema And Proliferation Contract

Date: 2026-06-11

Purpose: make every Narrative Agent panel and schema addition improve agent understanding in a way that strengthens Mature Data Proliferation.

## Core Rule

A Narrative Agent addition is valid only when it helps mature at least one governed characteristic and makes future proliferation more accurate, more traceable, or easier for the analyst to reject.

Narrative Agents are not just character names. They are governed subjects built from source evidence, characteristic observations, continuity decisions, relations, roles, negative evidence, and traceback.

All Narrative Agent semantic evidence must abide by Master time: visual expression, vocal expression, transcript interpretation, scene presence, source samples, and proliferation hints use the same source-video clock. If an evidence row cannot be anchored to that clock, it remains source-pending and cannot mature.

```text
source evidence
  -> characteristic observation
  -> agent appearance
  -> continuity or conflict edge
  -> mature agent profile
  -> better proliferation candidates
```

## Agent Semantic Families

Each new field, row, chip, graph edge, or panel action should belong to one or more agent semantic families:

- persona and alias: names, aliases, speaker links, manual agent assertions, rejected agent assertions;
- visual appearance: face/body/wardrobe/object-adjacent appearance, BBox/ROI crops, image samples;
- voice and speech: speaker evidence, transcript anchors, prosody, audio sample windows;
- expression and affect: facial expression, tone, emotional state, performance intensity;
- gesture and action: movement, posture, handling, entering/leaving, conflict behavior;
- role and function: dramatic role, professional role, social role, operational role;
- relation: agent-to-agent, agent-to-object, agent-to-place, agent-to-institution relation;
- scene trajectory: presence by scene, entrance/exit, pursuit, disappearance, recurrence;
- object and prop association: recurring car, phone, weapon, document, costume, symbol;
- linguistic register: recurring phrases, modality, agency, command/request/response behavior;
- continuity and negative evidence: confirmed continuity, rejected continuity, conflict, absence, contradiction.

## Balanced Vocal-Affect Registry

Audio-affect evidence must not become a stress/emphasis machine.

Positive, negative, regulating, and ambivalent vocal registers enter the Narrative Agent semantics layer on equal footing:

- positive: warmth, reassurance, delight, tenderness, confidence, relief;
- negative: distress, anger, fear, contempt, grief, hostility;
- regulating: calm, composure, restraint, formal neutrality, reflection, measured delivery;
- ambivalent: irony, hesitation, uncertainty, mixed affect, masking, performative control.

Audio-only affect remains candidate evidence. It can mature only through source anchors, transcript/speaker context, visual expression or scene corroboration, and analyst confirmation.

## Schema Contract

### Narrative Agent Profile

The mature profile is the projection of governed evidence, not the editable truth source.

Fields:

- `agent_id`
- `canonical_label`
- `aliases`
- `profile_state`
- `authority`
- `maturity_state`
- `characteristic_refs`
- `appearance_refs`
- `continuity_edge_refs`
- `relation_refs`
- `negative_evidence_refs`
- `source_sample_refs`
- `traceback_refs`

### Agent Appearance Event

An appearance is a source-linked event. It may support an agent profile, but it must not become global agent authority by itself.

Fields:

- `appearance_id`
- `agent_id`
- `source_event_id`
- `source_panel`
- `time_range`
- `scene_id`
- `source_track_id`
- `bbox_event_id`
- `transcript_anchor_id`
- `audio_sample_refs`
- `visual_sample_refs`
- `appearance_state`
- `authority`
- `maturity_state`
- `traceback_refs`

States:

- `confirmed`
- `candidate`
- `conflicted`
- `rejected`
- `traceback_only`
- `missing_evidence`

### Characteristic Observation

A characteristic observation is the smallest governed unit of agent understanding.

Fields:

- `observation_id`
- `agent_id`
- `characteristic_family`
- `claim`
- `value`
- `source_event_id`
- `source_anchor_refs`
- `source_sample_refs`
- `visual_pattern_sample_refs`
- `audio_pattern_sample_refs`
- `transcript_interpretation_refs`
- `scene_presence_prose`
- `master_time_range`
- `confidence`
- `authority`
- `maturity_state`
- `valid_time_range`
- `valid_scene_range`
- `projection_targets`
- `negative_evidence_refs`
- `traceback_refs`

Examples:

- `Nomi appears in tactical clothing at 47-49s`
- `James Bond speaks in the 43-46s exchange`
- `police car recurs across scene boundary as candidate continuity`
- `same raw track conflicts with two manual agent assertions`

### Continuity Edge

A continuity edge connects evidence events, not raw detector assumptions.

Fields:

- `edge_id`
- `continuity_type`
- `from_event_id`
- `to_event_id`
- `agent_id`
- `evidence_refs`
- `supporting_characteristic_refs`
- `contradicting_characteristic_refs`
- `source_sample_refs`
- `edge_state`
- `decision_id`
- `authority`
- `traceback_refs`

States:

- `candidate_continuity`
- `confirmed_continuity`
- `rejected_continuity`
- `conflict`
- `deferred`
- `traceback_only`

### Proliferation Hint

A proliferation hint is a governed suggestion that a matured characteristic can help search or project elsewhere.

Fields:

- `hint_id`
- `source_characteristic_ref`
- `target_panel`
- `target_time_range`
- `target_scene_range`
- `match_basis`
- `required_evidence`
- `risk_notes`
- `decision_state`
- `traceback_refs`

Allowed `match_basis` values include:

- `manual_agent_assertion`
- `appearance_similarity`
- `voice_similarity`
- `role_relation_context`
- `object_association`
- `scene_cooccurrence`
- `transcript_speaker_link`
- `negative_evidence`

## Mature Data Proliferation Feedback

Narrative Agent characteristics should improve proliferation in five ways:

1. Better candidate generation:
   - mature appearance, voice, role, relation, and co-occurrence signals create stronger candidate edges than raw tracks alone.

2. Better rejection:
   - rejected appearances, false same-track agent assertions, scene absences, and contradiction evidence become negative evidence that prevents repeat mistakes.

3. Better source sampling:
   - high-value confirmations should create or attach source image crops, audio windows, transcript anchors, and sample-cloud refs.

4. Better panel projection:
   - BBox/ROI, Transcript, POS/Quant, Meaning Network, Scene Cards, Master Schema, and reports can project the same mature agent claim with traceback.

5. Better late-video coverage:
   - characteristic density and appearance coverage should be auditable across the full runtime so detections and confirmations do not quietly diminish toward the end.

## UI Duties

### Narrative Agent Panel

Must show:

- characteristic summary by family;
- confirmed, candidate, conflicted, rejected, and missing appearances;
- source evidence rows for every mature claim;
- simple scene-presence prose for each reviewable appearance;
- visual pattern sample status;
- audio pattern sample status;
- transcript interpretation status;
- Master time range for every visual, vocal, transcript, and scene-presence row;
- continuity and conflict edges;
- role/relation/action path;
- source sample readiness;
- negative evidence;
- traceback actions.

Must not:

- treat `track_id` as global agent authority;
- hide rejected candidates;
- merge appearances without a decision ledger;
- project a characteristic without source anchors.
- mature visual expression, vocal expression, transcript interpretation, or scene-presence evidence when their time anchors disagree with Master time.

### Meaning Network Graph

Must show how characteristics form continuity:

- which observations support an edge;
- which observations contradict an edge;
- what samples are available;
- whether the edge is candidate, confirmed, rejected, conflicted, or missing evidence.

### Data Maturation / Proliferation Governance

Must audit:

- characteristic families with low coverage;
- agents with many candidate appearances but few confirmations;
- raw-track conflicts;
- late-video evidence drop-off;
- source sampling gaps;
- mature projection targets without traceback.

## Acceptance Tests

The James Bond / Nomi case remains the canonical test:

1. `James Bond 43-46s` saves as a distinct appearance event and characteristic observation.
2. `Nomi 47-49s` saves as a distinct appearance event and characteristic observation.
3. Same raw track lineage creates a conflict edge, not an agent merge.
4. Narrative Agent profiles show the correct appearances under the correct agents.
5. Meaning Network shows the continuity/conflict edge with supporting and contradicting observations.
6. Mature label resolver uses manual local evidence first.
7. Rejected or contradicted continuity remains visible as negative evidence.
8. The two observations can create future proliferation hints only inside their valid time and scene ranges.

## Implementation Gate

Before adding new Narrative Agent fields or UI controls, answer:

- Which characteristic family does this mature?
- What source evidence supports it?
- What authority and maturity state does it carry?
- What can it safely proliferate to?
- What should it prevent from proliferating?
- How can the analyst inspect, reject, or trace it?

If those answers are missing, the addition belongs in design review, not production code.
