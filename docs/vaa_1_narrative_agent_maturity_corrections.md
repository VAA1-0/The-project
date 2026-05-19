# VAA1 Schematic Corrections: Narrative Agents, Maturity Propagation, and Actionable Audio Evidence

## 1. Core semantic correction

VAA1 should not treat raw detections as the primary semantic unit.

The primary unit should be the **Narrative Agent**.

A raw detection such as `person`, `face`, `speaker`, `voice`, `body`, or `track` is only a low-level sensory substrate. It becomes valuable only when it contributes to a narratively meaningful question, such as:

- Who is this guy?
- Is this the same person as before?
- Is this a recurring figure?
- Is this a speaker, actor, narrator, witness, authority figure, intruder, interviewer, interviewee, bystander, protagonist, antagonist, or host?
- What is this agent doing in the situation?
- How does this agent relate to other agents, objects, places, dialogue, and scenes?

Therefore, VAA1 should shift from an **identification-first** model to a **Narrative Agent maturity model**.

Preferred vocabulary:

```json
{
  "narrative_agent_id": "na_0001",
  "agent_label": "Unknown recurring male figure",
  "agent_status": "candidate",
  "agent_question": "Who is this guy?",
  "source_modalities": ["visual", "audio", "transcript", "metadata"],
  "evidence_refs": [],
  "maturity_state": "unreviewed_candidate"
}
```

Avoid making `identity` the master concept. Identity is only one possible maturity outcome of a Narrative Agent.

Better hierarchy:

```text
Raw Detection
  ↓
Narrative Agent Candidate
  ↓
Continuity Candidate
  ↓
Role Candidate
  ↓
Named / Confirmed / Rejected / Merged / Split Narrative Agent
  ↓
Scene-, Episode-, and Report-Level Interpretive Use
```

## 2. Narrative Agent maturity states

Every Narrative Agent should have an explicit maturity state.

Recommended maturity states:

```json
{
  "maturity_states": [
    "raw_detection_seed",
    "narrative_agent_candidate",
    "continuity_candidate",
    "cross_modal_candidate",
    "role_candidate",
    "analyst_named",
    "analyst_confirmed",
    "merged_agent",
    "split_agent",
    "rejected_agent",
    "archived_agent"
  ]
}
```

Each maturity state must be treated as a real system state, not merely a label.

That means every maturity transition must trigger:

1. Backend ledger update.
2. Frontend state update.
3. Propagation to all associated panels.
4. Traceback update.
5. Evidence index update.
6. Candidate-family update.
7. Report-layer update where relevant.

## 3. Mandatory backend/frontend propagation rule

A maturity change is invalid unless it propagates everywhere.

Example:

If an analyst renames `Unknown speaker 3` as `Narrative Agent: Interviewer`, that change must immediately update:

- Audio panel
- Transcript panel
- Diarization panel
- Video panel
- Bounding box / ROI panel
- Scene card panel
- Mise-en-scène panel
- Evidence graph
- Narrative Agent registry
- Sample cloud
- Report writer
- Search index
- Any second-order labels using that agent

Canonical propagation contract:

```json
{
  "event_type": "narrative_agent_maturity_changed",
  "narrative_agent_id": "na_0001",
  "previous_state": "cross_modal_candidate",
  "new_state": "analyst_named",
  "changed_fields": {
    "agent_label": {
      "from": "Unknown recurring male figure",
      "to": "Interviewer"
    }
  },
  "source_of_change": "manual_analyst_action",
  "authority_level": "manual_correction",
  "must_propagate_to": [
    "backend_agent_registry",
    "frontend_global_state",
    "video_panel",
    "audio_panel",
    "transcript_panel",
    "diarization_panel",
    "bbox_roi_panel",
    "scene_card_panel",
    "mise_en_scene_panel",
    "evidence_graph",
    "sample_cloud",
    "report_writer",
    "search_index"
  ],
  "propagation_required": true,
  "partial_propagation_allowed": false
}
```

## 4. Manual analyst authority remains decisive

Manual analyst action is not a decorative annotation layer. It is the highest authority in the operational system.

If an analyst:

- renames an agent,
- merges two agents,
- splits one agent into two,
- drops a false sample,
- modifies an audio sample,
- replaces one evidence sample with another,
- rejects a role candidate,
- confirms a recurring figure,

then all automated outputs must subordinate themselves to that decision.

The old automated outputs may remain stored for traceback, but they must not override the analyst-confirmed state.

Authority order:

```json
{
  "authority_order": [
    "manual_correction",
    "manual_confirmation",
    "manual_annotation",
    "cross_modal_supported_candidate",
    "single_modality_candidate",
    "raw_detection"
  ]
}
```

### 4.1 Expression-owner person request rule

An expression bbox is not itself a person bbox.

If an analyst confirms a Narrative Agent from an expression cue and no mature person/object bbox is available for that expression owner, VAA1 must initiate an expression-owner person detection request. The resulting surface should be a synthesized `OBJ/person` bbox that covers the likely agent body/face region, carries provenance back to the source expression bbox, and displays the most mature available Narrative Agent definition.

Required UI behavior:

1. Keep the expression bbox as expression evidence.
2. Create or surface a distinct person/agent bbox for the expression owner.
3. Label that person/agent bbox with the mature Narrative Agent label, not the raw detector label.
4. Store `source_expression_key`, `source_expression_owner_request`, and `synthesized_person_detection` provenance.
5. Treat the synthesized person bbox as a candidate until analyst confirmation matures it.
6. Never relabel an expression bbox as the person object itself.

## 5. Audio sampling evidence must be actionable

Audio samples must not be passive evidence blobs.

They must be:

- actionable,
- verifiable,
- navigable,
- editable,
- droppable,
- modifiable,
- interchangeable,
- renamable,
- source-linked,
- maturity-aware,
- frontend/backend synchronized.

Recommended audio sample evidence object:

```json
{
  "audio_sample_id": "aud_sample_0001",
  "narrative_agent_id": "na_0001",
  "sample_label": "Possible interviewer voice sample",
  "sample_status": "candidate",
  "source_media_id": "media_0001",
  "source_audio_path": "original/source/path.wav",
  "time_interval": {
    "start_ms": 12400,
    "end_ms": 17800
  },
  "transcript_refs": ["transcript_segment_0042"],
  "diarization_refs": ["speaker_turn_0007"],
  "waveform_ref": "waveform_region_0001",
  "evidence_refs": ["evidence_0001"],
  "traceback_ref": "traceback_0001",
  "editable_actions": [
    "rename",
    "drop",
    "trim_start",
    "trim_end",
    "replace",
    "merge_with_other_sample",
    "split_sample",
    "assign_to_agent",
    "unassign_from_agent",
    "mark_as_reference",
    "mark_as_false_match"
  ],
  "verification_state": "unverified",
  "analyst_notes": [],
  "created_by": "system_candidate",
  "last_modified_by": null,
  "source_link_required": true
}
```

## 6. Audio sample actions and system consequences

| Analyst action | Backend consequence | Frontend consequence | Propagation consequence |
|---|---|---|---|
| Rename sample | Update sample ledger | Update all labels | Push to audio, transcript, agent registry |
| Drop sample | Mark inactive, preserve traceback | Hide from active cloud, show in history | Recalculate agent confidence/maturity |
| Modify trim | Update interval and waveform ref | Redraw waveform selection | Update transcript/diarization overlap |
| Replace sample | Link old/new samples | Show replacement chain | Recompute sample cloud |
| Merge samples | Create merged sample object | Show grouped sample | Update agent evidence score |
| Split sample | Create child samples | Show sample lineage | Update diarization and transcript refs |
| Assign to agent | Add agent ref | Attach visible agent label | Update all associated panels |
| Unassign from agent | Remove active ref, preserve history | Detach from current agent | Recompute agent maturity |
| Mark reference | Elevate authority level | Pin sample as reference | Update matching logic |
| Mark false match | Suppress future match | Show warning/history | Block repeated propagation |

## 7. Audio evidence source-linking rule

No audio sample may exist without a source link.

Minimum required links:

```json
{
  "required_source_links": [
    "source_media_id",
    "source_audio_path_or_media_pointer",
    "time_interval",
    "traceback_ref",
    "evidence_ref"
  ]
}
```

Recommended optional links:

```json
{
  "optional_source_links": [
    "transcript_segment_refs",
    "diarization_turn_refs",
    "video_frame_refs",
    "scene_refs",
    "narrative_agent_refs",
    "waveform_region_refs",
    "sample_cloud_refs"
  ]
}
```

## 8. Narrative Agent registry

VAA1 needs a central Narrative Agent registry.

This registry should be the shared source of truth for agent-level meaning.

```json
{
  "narrative_agent_registry": {
    "analysis_id": "analysis_0001",
    "agents": [
      {
        "narrative_agent_id": "na_0001",
        "current_label": "Interviewer",
        "previous_labels": ["Unknown speaker 3", "Unknown recurring male figure"],
        "maturity_state": "analyst_named",
        "role_candidates": ["interviewer", "host"],
        "confirmed_roles": [],
        "visual_evidence_refs": [],
        "audio_evidence_refs": [],
        "transcript_refs": [],
        "scene_refs": [],
        "sample_cloud_refs": [],
        "manual_actions": [],
        "proliferated_to": []
      }
    ]
  }
}
```

All panels should read from this registry rather than creating isolated local versions of “the person,” “the speaker,” or “the identity.”

## 9. Frontend implementation rule

Frontend panels must not maintain isolated truth states.

They may maintain local display state, but not competing semantic authority.

Correct frontend principle:

```text
Panel-local UI state is allowed.
Panel-local semantic truth is not allowed.
```

Every panel must subscribe to the central Narrative Agent state.

Required frontend event pattern:

```json
{
  "frontend_event": "agent_registry_updated",
  "affected_agent_ids": ["na_0001"],
  "affected_panels": [
    "video",
    "audio",
    "transcript",
    "diarization",
    "bbox_roi",
    "scene_card",
    "mise_en_scene",
    "report"
  ],
  "requires_rerender": true,
  "requires_reindex": true
}
```

## 10. Backend implementation rule

Backend modules must not create orphan candidates.

Every candidate must either:

1. attach to an existing Narrative Agent,
2. create a new Narrative Agent candidate,
3. remain explicitly unattached with a reason.

Correct backend pattern:

```json
{
  "candidate_id": "candidate_0001",
  "candidate_type": "speaker_turn",
  "attachment_state": "attached_to_narrative_agent",
  "narrative_agent_id": "na_0001",
  "attachment_confidence": 0.67,
  "attachment_reason": "audio sample cloud + transcript continuity",
  "can_be_detached_by_analyst": true
}
```

## 11. What must be corrected in the current feature architecture

### A. Replace identification-first vocabulary

Replace:

```text
identity_candidate
identity_refinement
identity_triangulation
speaker_identity
```

With:

```text
narrative_agent_candidate
narrative_agent_refinement
narrative_agent_triangulation
speaker_agent_link
```

Identity remains a field, not the master object.

### B. Make maturity real everywhere

Do not merely store maturity as a string.

Every maturity change must trigger propagation.

### C. Make audio sample clouds editable

Audio sample clouds must support active analyst correction.

A cloud is not just an embedding cluster. It is an editable evidence family.

### D. Make panels subordinate to shared registry

Panels should display, modify, and navigate shared state.
They should not invent separate semantic states.

### E. Preserve discarded evidence

Dropped, rejected, replaced, and false-match samples should remain in traceback history.
They should not remain active.

## 12. Corrected design principle

The corrected VAA1 principle is:

```text
Raw detections are not the epistemic center of VAA1.
They are low-level sensory inputs.
VAA1’s primary objects are traceable Narrative Agents, situations, actions, relations, scenes, and meanings.
Every interpretive object must remain linked to source evidence, editable by the analyst, and propagated consistently across backend, frontend, panels, reports, and evidence graphs.
```

## 13. Short implementation checklist

### Backend

- Add `narrative_agent_registry`.
- Replace identity-centered schemas with Narrative Agent schemas.
- Add maturity transition events.
- Require propagation audit logs.
- Require source links for all audio samples.
- Add editable sample actions.
- Preserve dropped/replaced samples as inactive evidence.
- Block orphan semantic candidates.

### Frontend

- Add global Narrative Agent store.
- Make all panels subscribe to agent registry updates.
- Add rename / merge / split / drop / replace controls.
- Add source-jump navigation for every audio sample.
- Add maturity badges.
- Add propagation status indicators.
- Add sample history view.

### Cross-panel propagation

- Video panel updates agent labels and visual tracks.
- Audio panel updates sample names, waveform regions, and source jumps.
- Transcript panel updates speaker-agent labels.
- Diarization panel updates turn-agent links.
- Scene card updates agent references.
- Mise-en-scène panel updates agent roles and spatial relations.
- Report writer updates all agent names and evidence links.
- Evidence graph updates all linked evidence families.

## 14. Visual pattern recognition protocol

Visual pattern recognition must follow the same logic as audio evidence.

It must not merely say:

```text
person detected
face detected
object detected
expression detected
movement detected
```

It must produce actionable Narrative Agent and scene-relevant interpretive evidence.

Correct visual-pattern question set:

```text
Who is this Narrative Agent?
Is this the same agent across shots or scenes?
What visual pattern stabilizes this agent?
What object, costume, posture, expression, or spatial relation supports the interpretation?
Does this visual pattern support a role, action, situation, relationship, or scene meaning?
Can the analyst verify, rename, drop, replace, merge, split, or correct this visual evidence?
Can every visual claim be traced back to source frames, timestamps, regions, and detections?
```

Recommended visual pattern evidence object:

```json
{
  "visual_pattern_id": "vis_pattern_0001",
  "narrative_agent_id": "na_0001",
  "pattern_label": "Recurring suited male figure",
  "pattern_status": "candidate",
  "pattern_type": "agent_continuity",
  "source_media_id": "media_0001",
  "source_video_path": "original/source/path.mp4",
  "time_interval": {
    "start_ms": 21400,
    "end_ms": 26700
  },
  "frame_refs": ["frame_002140", "frame_002300", "frame_002670"],
  "region_refs": ["bbox_0001", "roi_0003"],
  "visual_features": {
    "face_embedding_ref": "face_emb_0001",
    "clothing_histogram_ref": "cloth_hist_0001",
    "pose_ref": "pose_0001",
    "expression_ref": "expr_0001",
    "object_refs": ["object_0004"],
    "spatial_relation_refs": ["spatial_0002"]
  },
  "evidence_refs": ["evidence_0101"],
  "traceback_ref": "traceback_0101",
  "editable_actions": [
    "rename",
    "drop",
    "modify_region",
    "replace_region",
    "merge_with_other_pattern",
    "split_pattern",
    "assign_to_agent",
    "unassign_from_agent",
    "mark_as_reference",
    "mark_as_false_match",
    "promote_to_role_candidate",
    "link_to_scene",
    "link_to_object",
    "link_to_expression",
    "link_to_action"
  ],
  "verification_state": "unverified",
  "analyst_notes": [],
  "created_by": "visual_pattern_recognition",
  "last_modified_by": null,
  "source_link_required": true
}
```

## 15. Visual pattern maturity states

Visual evidence must have its own maturity process, but it must feed into the shared Narrative Agent maturity process.

Recommended visual pattern maturity states:

```json
{
  "visual_pattern_maturity_states": [
    "raw_visual_detection_seed",
    "visual_pattern_candidate",
    "visual_continuity_candidate",
    "cross_frame_supported_pattern",
    "cross_scene_supported_pattern",
    "cross_modal_supported_pattern",
    "analyst_named_visual_pattern",
    "analyst_confirmed_visual_pattern",
    "merged_visual_pattern",
    "split_visual_pattern",
    "rejected_visual_pattern",
    "archived_visual_pattern"
  ]
}
```

A visual pattern maturity change must trigger:

1. Master Schema update.
2. Narrative Agent registry update.
3. Backend evidence index update.
4. Frontend global state update.
5. Panel propagation.
6. Traceback update.
7. Scene and report-layer update where relevant.

## 16. Master Schema as mandatory maturity hub

All feature outputs must update the Master Schema.

No module should become a private semantic island.

The Master Schema is the operational hub that receives, normalizes, matures, and proliferates evidence and interpretation.

Required rule:

```text
Every feature output must either update the Master Schema directly or pass through a governed linker that updates the Master Schema.
```

The Master Schema must then proliferate maturity changes to:

- Narrative Agent registry
- video panel
- audio panel
- transcript panel
- diarization panel
- prosody panel
- visual pattern panel
- expression panel
- POS / SFL / dependency panel
- quantitative text panel
- bounding box / ROI panel
- scene card panel
- mise-en-scène panel
- evidence graph
- sample clouds
- report writer
- search index

Canonical Master Schema update event:

```json
{
  "event_type": "master_schema_updated",
  "analysis_id": "analysis_0001",
  "update_source": "visual_pattern_recognition",
  "update_authority": "system_candidate",
  "affected_entities": {
    "narrative_agent_ids": ["na_0001"],
    "visual_pattern_ids": ["vis_pattern_0001"],
    "audio_sample_ids": [],
    "transcript_segment_ids": [],
    "scene_ids": ["scene_0003"],
    "evidence_ids": ["evidence_0101"]
  },
  "maturity_changes": [
    {
      "entity_type": "visual_pattern",
      "entity_id": "vis_pattern_0001",
      "previous_state": "raw_visual_detection_seed",
      "new_state": "visual_pattern_candidate"
    }
  ],
  "proliferation_required": true,
  "partial_proliferation_allowed": false,
  "traceback_required": true,
  "frontend_sync_required": true
}
```

## 17. Master Schema source intake contract

Every data source must enter the Master Schema through a typed intake object.

Recommended intake types:

```json
{
  "master_schema_intake_types": [
    "audio_sample_evidence",
    "audio_prosody_evidence",
    "diarization_turn_evidence",
    "transcript_segment_evidence",
    "visual_pattern_evidence",
    "expression_evidence",
    "object_detection_evidence",
    "bbox_roi_evidence",
    "pos_sfl_dependency_evidence",
    "quantitative_text_evidence",
    "scene_card_evidence",
    "mise_en_scene_evidence",
    "manual_annotation_evidence",
    "manual_correction_evidence"
  ]
}
```

Each intake object must include:

```json
{
  "required_fields": [
    "analysis_id",
    "source_module",
    "source_media_id",
    "evidence_type",
    "evidence_id",
    "time_anchor",
    "source_locator",
    "payload",
    "confidence_or_support_level",
    "raw_or_corrected",
    "created_by",
    "traceback_ref",
    "maturity_state",
    "editable_actions"
  ]
}
```

## 18. Unified maturity proliferation rule

Maturity is not local.

If one source matures, all associated objects must reconsider their own maturity.

Examples:

```text
A visual pattern is confirmed → associated Narrative Agent maturity may rise.
An audio sample is dropped → speaker-agent link confidence must decrease.
A transcript segment is corrected → POS/SFL outputs must be recalculated or marked stale.
An expression is rejected → scene-card emotional interpretation must be downgraded.
A bbox is manually corrected → visual pattern geometry must update everywhere.
A Narrative Agent is renamed → all panels and reports must update the name.
```

Canonical maturity proliferation object:

```json
{
  "maturity_proliferation_event": {
    "origin_entity_type": "visual_pattern",
    "origin_entity_id": "vis_pattern_0001",
    "origin_change": {
      "from": "visual_pattern_candidate",
      "to": "analyst_confirmed_visual_pattern"
    },
    "downstream_recalculation_required": true,
    "affected_feature_families": [
      "narrative_agent_registry",
      "scene_card",
      "mise_en_scene",
      "expression_analysis",
      "bbox_roi_navigation",
      "report_writer",
      "evidence_graph"
    ],
    "stale_outputs_to_mark": [],
    "derived_outputs_to_refresh": [],
    "frontend_panels_to_rerender": [
      "video_panel",
      "visual_pattern_panel",
      "scene_card_panel",
      "mise_en_scene_panel",
      "report_panel"
    ]
  }
}
```

## 19. Visual pattern actions and system consequences

| Analyst action | Backend consequence | Frontend consequence | Master Schema consequence | Proliferation consequence |
|---|---|---|---|---|
| Rename visual pattern | Update pattern ledger | Update visible label | Update canonical label | Push to panels/reports |
| Drop visual pattern | Mark inactive, preserve traceback | Hide from active view, show history | Set inactive state | Recalculate agent/scene support |
| Modify region | Update bbox/ROI anchor | Redraw region | Replace active geometry | Update visual continuity and source jumps |
| Replace region | Link old/new region | Show replacement chain | Preserve lineage | Recompute visual pattern support |
| Merge patterns | Create merged pattern | Show grouped evidence | Update pattern family | Update agent maturity |
| Split pattern | Create child patterns | Show split lineage | Preserve parent-child relation | Update agent candidates |
| Assign to agent | Add Narrative Agent ref | Show agent label | Update agent registry link | Recalculate agent support |
| Unassign from agent | Remove active ref | Detach visually | Preserve historical link | Recalculate agent maturity |
| Mark reference | Elevate authority | Pin as reference sample | Update reference set | Improve future matching |
| Mark false match | Suppress match | Show warning/history | Add blocked relation | Prevent repeated propagation |
| Promote to role candidate | Create role candidate | Show role suggestion | Add role evidence | Update scene/mise-en-scène |
| Link to scene | Add scene ref | Show scene context | Update scene evidence | Update scene-card maturity |

## 20. Master Schema update map by feature family

| Feature family | Updates Master Schema with | Maturity effect | Must proliferate to |
|---|---|---|---|
| Audio samples | voice samples, source intervals, waveform refs | agent voice support | audio, transcript, diarization, agent registry |
| Audio prosody | pace, pause, emphasis, pitch/energy | delivery-pattern support | scene card, SFL, agent role, report |
| Diarization | speaker turns and turn boundaries | speaker-agent continuity | audio, transcript, agent registry |
| Transcript | utterances and corrected text | linguistic evidence | POS/SFL, scene card, report |
| POS/SFL/dependency | speech acts, modality, stance, process types | social-action support | scene card, narrative role, report |
| Quantitative text | salient terms, topics, concordances | thematic support | report, scene summaries, search |
| Visual pattern recognition | recurring visual entities, face/clothing/pose/object patterns | agent and scene continuity | video, bbox/ROI, agent registry, scene card |
| Expression detection | expression candidates and social functions | affective/social support | visual pattern, scene card, mise-en-scène |
| Object detection | props, tools, salient objects | action/situation support | scene card, role/action inference |
| BBox/ROI | region anchors and corrections | source-location authority | all visual panels and traceback |
| Mise-en-scène | spatial/social arrangement | interpretive scene support | report, scene card, visual pattern panel |
| Manual correction | authoritative replacement | top authority | everywhere |

## 21. Master Schema canonical object family

The Master Schema should contain at minimum:

```json
{
  "master_schema": {
    "analysis_id": "analysis_0001",
    "media_refs": [],
    "anchors": [],
    "evidence_objects": [],
    "narrative_agents": [],
    "audio_samples": [],
    "visual_patterns": [],
    "transcript_segments": [],
    "diarization_turns": [],
    "prosody_cues": [],
    "expression_cues": [],
    "object_cues": [],
    "bbox_roi_regions": [],
    "linguistic_cues": [],
    "quantitative_text_cues": [],
    "scene_cards": [],
    "mise_en_scene_cards": [],
    "maturity_events": [],
    "propagation_events": [],
    "manual_actions": [],
    "traceback_records": []
  }
}
```

## 22. Master Schema invariant

No evidence or interpretation may be active in VAA1 unless it is represented in the Master Schema.

Correct invariant:

```text
If it appears in a panel, report, graph, card, sample cloud, or search result, it must have a Master Schema object, source anchor, maturity state, and traceback reference.
```

Incorrect pattern:

```text
Feature module creates local output → panel displays it → Master Schema may or may not know about it.
```

Correct pattern:

```text
Feature module creates governed output → linker writes Master Schema intake → Master Schema updates maturity → propagation bus updates panels/features/reports.
```

## 23. Corrected architecture flow

```text
Raw Detectors / Feature Modules
        ↓
Governed Evidence Linkers
        ↓
Master Schema Intake
        ↓
Master Schema Maturity Engine
        ↓
Narrative Agent Registry + Evidence Graph
        ↓
Propagation Bus
        ↓
Frontend Panels + Reports + Search + Scene/Mise-en-Scène Features
```

## 24. Final correction

The system should not merely say:

```text
Person detected.
```

It should ask and support:

```text
Who is this Narrative Agent, what are they doing, what role do they play, how do they recur visually and acoustically, how do they relate to others, and what evidence supports or challenges that interpretation?
```

The Master Schema is the authority hub that makes this practical.

All audio, visual, linguistic, quantitative, scene, and manual evidence must enter the Master Schema; the Master Schema then controls maturity, propagation, synchronization, and panel-wide consistency.

That is the correct VAA1 direction.
