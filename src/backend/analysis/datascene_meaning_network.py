from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


SCHEMA = "vaa1.datascene_meaning_network.v1"
DESIGN_SCHEMA = "VAA1 Datascene Meaning Network Schema"

RAW_PERSON_OVERLOAD_THRESHOLD = 20
UNRESOLVED_PERSON_RATIO_THRESHOLD = 0.75


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_text(value: Any, fallback: str = "") -> str:
    text = str(value or "").strip()
    return text or fallback


def _safe_float(value: Any, fallback: Optional[float] = None) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _first_present(item: Dict[str, Any], keys: Iterable[str]) -> Any:
    for key in keys:
        value = item.get(key)
        if value is not None:
            return value
    return None


def _as_items(value: Any) -> List[Dict[str, Any]]:
    if isinstance(value, dict):
        for key in ("segments", "scene_cards", "cards", "scenes", "tracked_objects", "items"):
            nested = value.get(key)
            if isinstance(nested, list):
                return [item for item in nested if isinstance(item, dict)]
        return [value]
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    return []


def _interval(item: Dict[str, Any]) -> Dict[str, Optional[float]]:
    start = _safe_float(
        _first_present(
            item,
            ("start", "start_time", "start_seconds", "time_start", "timestamp", "timestamp_seconds"),
        )
    )
    end = _safe_float(
        _first_present(item, ("end", "end_time", "end_seconds", "time_end"))
    )
    if end is None:
        end = start
    return {"start": start, "end": end}


def _overlaps(left: Dict[str, Optional[float]], right: Dict[str, Optional[float]]) -> bool:
    left_start = left.get("start")
    right_start = right.get("start")
    if left_start is None or right_start is None:
        return False
    left_end = left.get("end") if left.get("end") is not None else left_start
    right_end = right.get("end") if right.get("end") is not None else right_start
    return max(left_start, right_start) <= min(left_end, right_end)


def _within_scene(scene: Dict[str, Optional[float]], item: Dict[str, Optional[float]]) -> bool:
    scene_start = scene.get("start")
    scene_end = scene.get("end")
    item_start = item.get("start")
    if scene_start is None or item_start is None:
        return False
    if scene_end is None:
        scene_end = scene_start
    item_end = item.get("end") if item.get("end") is not None else item_start
    return max(scene_start, item_start) <= min(scene_end, item_end)


def _evidence_ref(
    evidence_id: str,
    source_type: str,
    interval: Dict[str, Optional[float]],
    *,
    confidence: Optional[float] = None,
) -> Dict[str, Any]:
    ref: Dict[str, Any] = {
        "evidence_id": evidence_id,
        "source_type": source_type,
        "time_range": interval,
        "traceback_record_id": f"traceback:{evidence_id}",
    }
    if confidence is not None:
        ref["confidence"] = confidence
    return ref


def _one_click_jumps(
    target_id: str,
    interval: Dict[str, Optional[float]],
    *,
    source_type: str,
) -> List[Dict[str, Any]]:
    start = interval.get("start")
    if start is None:
        return []
    panel = "Transcript" if source_type == "transcript" else "VideoPanel"
    return [
        {
            "label": "Jump to source",
            "target_panel": panel,
            "target_time": start,
            "target_node_id": target_id,
        }
    ]


def _maturity(level: str, authority: str, confidence: Optional[float] = None) -> Dict[str, Any]:
    payload = {
        "level": level,
        "authority": authority,
        "manual_override": authority == "analyst",
    }
    if confidence is not None:
        payload["confidence"] = confidence
    return payload


def _node(
    node_id: str,
    node_type: str,
    label: str,
    *,
    description: str = "",
    attributes: Optional[Dict[str, Any]] = None,
    maturity: Optional[Dict[str, Any]] = None,
    evidence_refs: Optional[List[Dict[str, Any]]] = None,
    display_group: str = "",
) -> Dict[str, Any]:
    return {
        "node_id": node_id,
        "node_type": node_type,
        "label": label,
        "description": description,
        "attributes": attributes or {},
        "maturity": maturity or _maturity("candidate", "schema_rule", 0.5),
        "evidence_refs": evidence_refs or [],
        "ui": {
            "display_group": display_group or node_type,
            "quick_confirm_enabled": node_type in {"narrative_agent", "character", "speaker"},
            "copy_paste_enabled": node_type in {"continuity_anchor", "narrative_agent", "character"},
            "update_enabled": True,
            "source_navigation_enabled": bool(evidence_refs),
            "node_marker": {
                "marker_id": f"marker:{node_id}",
                "kind": "node",
                "coordinate_system": "media_time",
                "time_range": (evidence_refs or [{}])[0].get("time_range"),
                "source_jumps": _one_click_jumps(
                    node_id,
                    (evidence_refs or [{}])[0].get("time_range") or {},
                    source_type=(evidence_refs or [{}])[0].get("source_type") or node_type,
                ),
              },
        },
    }


def _edge(
    edge_id: str,
    source_node_id: str,
    target_node_id: str,
    edge_type: str,
    *,
    weight: float = 0.5,
    maturity: Optional[Dict[str, Any]] = None,
    evidence_refs: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    return {
        "edge_id": edge_id,
        "source_node_id": source_node_id,
        "target_node_id": target_node_id,
        "edge_type": edge_type,
        "directionality": "directed",
        "weight": weight,
        "maturity": maturity or _maturity("candidate", "schema_rule", weight),
        "evidence_refs": evidence_refs or [],
        "ui": {
            "quick_confirm_enabled": edge_type in {"co_occurs_with", "appears_with", "spoken_by", "tracks_same_entity_as"},
            "copy_paste_enabled": edge_type in {"co_occurs_with", "appears_with", "tracks_same_entity_as", "copy_of_anchor"},
            "update_enabled": True,
            "source_navigation_enabled": bool(evidence_refs),
            "edge_marker": {
                "marker_id": f"marker:{edge_id}",
                "kind": "edge",
                "coordinate_system": "media_time",
                "time_range": (evidence_refs or [{}])[0].get("time_range"),
                "source_jumps": _one_click_jumps(
                    edge_id,
                    (evidence_refs or [{}])[0].get("time_range") or {},
                    source_type=(evidence_refs or [{}])[0].get("source_type") or edge_type,
                ),
            },
        },
        "traceback_record_ids": [
            str(ref.get("traceback_record_id"))
            for ref in evidence_refs or []
            if ref.get("traceback_record_id")
        ],
    }


def _scene_segments(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    results = status.get("results") if isinstance(status.get("results"), dict) else {}
    visual = results.get("visual_analysis") if isinstance(results.get("visual_analysis"), dict) else {}
    sources = [
        visual.get("scene_segments"),
        (status.get("summary") or {}).get("scene_segments") if isinstance(status.get("summary"), dict) else None,
        status.get("mise_en_scene_scene_cards"),
    ]
    for source in sources:
        items = _as_items(source)
        if items:
            return items
    return []


def _tracked_persons(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    results = status.get("results") if isinstance(status.get("results"), dict) else {}
    visual = results.get("visual_analysis") if isinstance(results.get("visual_analysis"), dict) else {}
    people = []
    for item in _as_items(visual.get("tracked_objects")):
        label = _safe_text(
            item.get("label")
            or item.get("class_name")
            or item.get("class")
            or item.get("displayLabel")
        ).lower()
        if label == "person" or "person" in label:
            people.append(item)
    return people


def _transcript_segments(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    results = status.get("results") if isinstance(status.get("results"), dict) else {}
    sources = [
        status.get("transcript"),
        status.get("linked_transcript"),
        results.get("transcript") if isinstance(results, dict) else None,
        (status.get("audio_analysis") or {}).get("transcript") if isinstance(status.get("audio_analysis"), dict) else None,
    ]
    for source in sources:
        items = _as_items(source)
        if items:
            return items
    return []


def _manual_agent_labels(status: Dict[str, Any]) -> List[str]:
    corrections = status.get("annotation_corrections") if isinstance(status.get("annotation_corrections"), dict) else {}
    labels = []
    for item in corrections.get("manual_visual_annotations") or []:
        if not isinstance(item, dict):
            continue
        label = _safe_text(
            item.get("identity_affirmation")
            or item.get("custom_label")
            or item.get("label")
        )
        if label and label.lower() not in {"person", "unknown", "unknown speaker"}:
            labels.append(label)
    metadata = status.get("source_media_annotations") or {}
    for profile in metadata.get("narrative_agent_profiles") or []:
        if isinstance(profile, dict):
            label = _safe_text(profile.get("narrative_agent_name") or profile.get("current_label"))
            if label:
                labels.append(label)
    return labels


def build_datascene_meaning_network(
    analysis_id: str,
    status: Dict[str, Any],
    *,
    transcript: Optional[Any] = None,
    visual_analysis: Optional[Dict[str, Any]] = None,
    scene_cards: Optional[Any] = None,
) -> Dict[str, Any]:
    network_status = dict(status)
    if transcript is not None:
        network_status["transcript"] = transcript
    if visual_analysis is not None:
        results = dict(network_status.get("results") or {})
        results["visual_analysis"] = visual_analysis
        network_status["results"] = results
    if scene_cards is not None:
        network_status["mise_en_scene_scene_cards"] = scene_cards

    scenes = _scene_segments(network_status)
    persons = _tracked_persons(network_status)
    transcripts = _transcript_segments(network_status)
    manual_labels = _manual_agent_labels(network_status)
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    confirmations: List[Dict[str, Any]] = []
    continuity_anchors: List[Dict[str, Any]] = []
    traceback_index: List[Dict[str, Any]] = []

    if not scenes:
        max_end = 0.0
        for item in [*persons, *transcripts]:
            interval = _interval(item)
            end = interval.get("end") if interval.get("end") is not None else interval.get("start")
            if end is not None:
                max_end = max(max_end, float(end))
        scenes = [{"scene_id": "scene:full", "start": 0.0, "end": max_end, "label": "Full media window"}]

    for scene_index, scene in enumerate(scenes):
        interval = _interval(scene)
        scene_id = _safe_text(scene.get("scene_id") or scene.get("id"), f"scene:{scene_index + 1}")
        scene_node_id = f"scene:{scene_id}"
        nodes.append(
            _node(
                scene_node_id,
                "scene",
                _safe_text(scene.get("label") or scene.get("title"), f"Scene {scene_index + 1}"),
                attributes={"time_range": interval, "scene_index": scene_index},
                maturity=_maturity("machine_inferred", "schema_rule", 0.65),
                evidence_refs=[_evidence_ref(scene_node_id, "scene", interval, confidence=0.65)],
                display_group="scene_timeline",
            )
        )

        scene_persons = [
            person for person in persons if _within_scene(interval, _interval(person))
        ]
        scene_transcripts = [
            transcript for transcript in transcripts if _within_scene(interval, _interval(transcript))
        ]
        for person_index, person in enumerate(scene_persons[:20]):
            person_interval = _interval(person)
            track_id = _safe_text(person.get("track_id") or person.get("id"), str(person_index + 1))
            person_node_id = f"person:{scene_id}:{track_id}"
            label = _safe_text(
                person.get("agent_label")
                or person.get("identity")
                or person.get("label")
                or person.get("class_name"),
                f"Person candidate {track_id}",
            )
            raw_like = label.lower() in {"person", "person track", "unknown"}
            nodes.append(
                _node(
                    person_node_id,
                    "character" if not raw_like else "evidence_fragment",
                    label,
                    description="Scene-bounded person evidence. Raw person labels require transcript/manual confirmation before Narrative Agent use.",
                    attributes={
                        "scene_id": scene_id,
                        "track_id": track_id,
                        "raw_detection_overload_sensitive": raw_like,
                    },
                    maturity=_maturity("candidate", "detector", _safe_float(person.get("confidence"), 0.45)),
                    evidence_refs=[_evidence_ref(person_node_id, "object_detection", person_interval, confidence=_safe_float(person.get("confidence"), 0.45))],
                    display_group="characters_in_scene",
                )
            )
            edges.append(
                _edge(
                    f"edge:{person_node_id}:belongs:{scene_node_id}",
                    person_node_id,
                    scene_node_id,
                    "belongs_to_scene",
                    weight=0.65,
                    evidence_refs=[_evidence_ref(person_node_id, "object_detection", person_interval, confidence=0.65)],
                )
            )

        for transcript_index, transcript in enumerate(scene_transcripts[:30]):
            transcript_interval = _interval(transcript)
            transcript_id = _safe_text(transcript.get("id"), f"{scene_id}:transcript:{transcript_index + 1}")
            transcript_node_id = f"transcript:{transcript_id}"
            speaker = _safe_text(transcript.get("speaker") or transcript.get("speaker_label"), "Unknown speaker")
            text = _safe_text(transcript.get("text") or transcript.get("transcript_text"), "Transcript segment")
            nodes.append(
                _node(
                    transcript_node_id,
                    "speaker",
                    speaker,
                    description=text[:180],
                    attributes={"scene_id": scene_id, "text_excerpt": text[:240]},
                    maturity=_maturity("machine_inferred", "model", 0.6),
                    evidence_refs=[_evidence_ref(transcript_node_id, "transcript", transcript_interval, confidence=0.6)],
                    display_group="scene_speakers",
                )
            )
            edges.append(
                _edge(
                    f"edge:{transcript_node_id}:belongs:{scene_node_id}",
                    transcript_node_id,
                    scene_node_id,
                    "belongs_to_scene",
                    weight=0.65,
                    evidence_refs=[_evidence_ref(transcript_node_id, "transcript", transcript_interval, confidence=0.65)],
                )
            )

        for person_index, person in enumerate(scene_persons[:12]):
            person_interval = _interval(person)
            track_id = _safe_text(person.get("track_id") or person.get("id"), str(person_index + 1))
            person_node_id = f"person:{scene_id}:{track_id}"
            overlaps = [
                transcript for transcript in scene_transcripts if _overlaps(person_interval, _interval(transcript))
            ]
            for transcript_index, transcript in enumerate(overlaps[:5]):
                transcript_id = _safe_text(transcript.get("id"), f"{scene_id}:transcript:{transcript_index + 1}")
                transcript_node_id = f"transcript:{transcript_id}"
                edge_id = f"edge:{person_node_id}:co_occurs:{transcript_node_id}"
                edges.append(
                    _edge(
                        edge_id,
                        person_node_id,
                        transcript_node_id,
                        "co_occurs_with",
                        weight=0.55,
                        maturity=_maturity("candidate", "schema_rule", 0.55),
                        evidence_refs=[
                            _evidence_ref(person_node_id, "object_detection", person_interval, confidence=0.55),
                            _evidence_ref(transcript_node_id, "transcript", _interval(transcript), confidence=0.55),
                        ],
                    )
                )
                continuity_anchors.append(
                    {
                        "anchor_id": f"anchor:scene-person-transcript:{scene_id}:{track_id}:{transcript_index + 1}",
                        "anchor_type": "character_continuity",
                        "label": "Scene-bounded person/transcript candidate",
                        "applies_to_node_ids": [person_node_id, transcript_node_id],
                        "copy_paste_contract": {
                            "copy_enabled": True,
                            "paste_to_selected_nodes": True,
                            "paste_to_scene_coordinate": True,
                            "apply_forward": False,
                            "apply_backward": False,
                            "create_linked_duplicate": True,
                            "detach_from_chain": True,
                            "preserve_source_traceback": True,
                        },
                        "maturity": _maturity("candidate", "schema_rule", 0.55),
                        "evidence_refs": [
                            _evidence_ref(person_node_id, "object_detection", person_interval, confidence=0.55),
                            _evidence_ref(transcript_node_id, "transcript", _interval(transcript), confidence=0.55),
                        ],
                    }
                )

    unresolved_persons = [
        person for person in persons
        if _safe_text(person.get("agent_label") or person.get("identity") or person.get("label") or person.get("class_name")).lower() in {"person", "unknown", ""}
    ]
    unresolved_ratio = len(unresolved_persons) / max(1, len(persons))
    diagnostics: List[Dict[str, Any]] = []
    if len(persons) >= RAW_PERSON_OVERLOAD_THRESHOLD and unresolved_ratio >= UNRESOLVED_PERSON_RATIO_THRESHOLD:
        diagnostic_id = "diagnostic:raw-person-overload"
        diagnostic = _node(
            diagnostic_id,
            "claim",
            "Raw person detection overload",
            description=(
                "Many raw person detections are present without enough Narrative Agent maturity. "
                "The analyst should review likely alternatives before interpretive proliferation."
            ),
            attributes={
                "raw_person_count": len(persons),
                "unresolved_person_count": len(unresolved_persons),
                "unresolved_ratio": round(unresolved_ratio, 4),
                "secondary_protocol_question": "Why are there many raw person detections but no mature Narrative Agent recognition?",
                "probable_alternatives": [
                    "same_agent_fragmented_across_tracks",
                    "crowded_scene_multiple_agents",
                    "detector_overfiring_or_duplicate_tracks",
                    "scene_boundary_too_broad",
                    "speaker_agent_link_missing",
                    "metadata_or_manual_agent_labels_not_connected",
                    "visual_profile_comparison_needed",
                ],
                "minimum_next_step": "Compare scene-bounded person evidence with transcript segments before Meaning / Plot or Character Path proliferation.",
            },
            maturity=_maturity("candidate", "schema_rule", 0.7),
            evidence_refs=[],
            display_group="diagnostics",
        )
        nodes.append(diagnostic)
        diagnostics.append(diagnostic)

    confirmations.append(
        {
            "confirmation_id": "confirmation:scene-person-transcript-review",
            "confirmation_type": "character_presence",
            "target_ids": [
                anchor["anchor_id"] for anchor in continuity_anchors[:100]
            ],
            "maturity_result": _maturity("candidate", "schema_rule", 0.55),
            "proliferation_scope": [
                "master_schema",
                "scene_browser",
                "video_panel",
                "transcript_panel",
                "meaning_network_panel",
                "bbox_roi_panel",
                "narrative_agent_panel",
                "traceback_drawer",
            ],
            "notes": "Scene-bounded person/transcript candidates require analyst confirmation before Narrative Agent maturity uplift.",
        }
    )

    return {
        "schema": SCHEMA,
        "design_schema": DESIGN_SCHEMA,
        "analysis_id": analysis_id,
        "created_at": _now_iso(),
        "meaning_network": {
            "network_id": f"meaning-network:{analysis_id}",
            "project_id": analysis_id,
            "media_scope": {
                "media_ids": [analysis_id],
                "scene_ids": [
                    _safe_text(scene.get("scene_id") or scene.get("id"), f"scene:{index + 1}")
                    for index, scene in enumerate(scenes)
                ],
            },
            "nodes": nodes,
            "edges": edges,
            "confirmations": confirmations,
            "continuity_anchors": continuity_anchors,
            "taxonomy_backbone": {
                "sfl": {
                    "ideational": ["actor", "object", "action", "event", "situation"],
                    "interpersonal": ["speaker", "addressivity", "role", "relation"],
                    "textual": ["sequence", "continuity", "contrast", "framing"],
                },
                "scene_timeline": ["scene", "character", "speaker", "co_presence"],
            },
            "traceback_index": traceback_index,
            "proliferation_rules": [
                {
                    "rule_id": "rule:raw-persons-do-not-proliferate-as-agents",
                    "source_node_types": ["evidence_fragment"],
                    "target_node_types": ["narrative_agent", "character"],
                    "requires_confirmation": True,
                    "principle": "Raw person detections must be linked to transcript, manual annotation, metadata, or visual/audio profile support before Narrative Agent use.",
                }
            ],
            "ui_contract": {
                "primary_panel_name": "Datascene Meaning Network",
                "scene_timeline_enabled": True,
                "characters_in_scene_enabled": True,
                "quick_confirm_scene_presence": True,
                "show_raw_detection_overload_diagnostics": True,
                "source_navigation_required": True,
                "node_marker_update_required": True,
                "edge_marker_update_required": True,
                "required_affordances": [
                    "add_node",
                    "add_edge",
                    "quick_confirm",
                    "copy_anchor",
                    "paste_anchor",
                    "apply_anchor_forward",
                    "apply_anchor_backward",
                    "merge_nodes",
                    "split_node",
                    "rename_node",
                    "reject_candidate",
                    "open_traceback_drawer",
                    "jump_to_video_time",
                    "filter_by_sfl_layer",
                    "filter_by_maturity",
                    "export_graph",
                ],
                "recommended_quick_add_buttons": [
                    "+ Character",
                    "+ Narrative Agent",
                    "+ Object",
                    "+ Situation",
                    "+ Location/Time",
                    "+ Framing",
                    "+ Expression",
                    "+ Emotion",
                    "+ Rhythm",
                    "+ SFL Judgement",
                    "+ Claim",
                    "+ Theme",
                    "+ Continuity Anchor",
                ],
                "fast_manual_operations": {
                    "quick_confirm_node": {
                        "enabled": True,
                        "maturity_result": "analyst_confirmed",
                        "must_proliferate_to": [
                            "master_schema",
                            "meaning_network_panel",
                            "video_panel",
                            "transcript_panel",
                            "bbox_roi_panel",
                            "narrative_agent_panel",
                            "traceback_drawer",
                        ],
                    },
                    "quick_add_node": {
                        "enabled": True,
                        "default_maturity": "analyst_reviewed",
                        "source_anchor_required": True,
                    },
                    "copy_paste_known_node_to_coordinate": {
                        "enabled": True,
                        "creates_edge_type": "copy_of_anchor",
                        "preserve_source_traceback": True,
                    },
                    "update_node_or_edge_marker": {
                        "enabled": True,
                        "requires_traceback_update": True,
                    },
                },
            },
        },
        "summary": {
            "scene_count": len(scenes),
            "raw_person_count": len(persons),
            "transcript_segment_count": len(transcripts),
            "manual_agent_label_count": len(manual_labels),
            "node_count": len(nodes),
            "edge_count": len(edges),
            "continuity_anchor_count": len(continuity_anchors),
            "raw_detection_overload": bool(diagnostics),
        },
        "workflow_notes": [
            "Meaning Network is used here as the scene timeline and co-presence layer for mature proliferation.",
            "Raw person detections are not Narrative Agents until supported by transcript, manual labels, metadata, or profile comparison.",
            "Scene-bounded person/transcript candidates are visible review anchors for analyst confirmation.",
        ],
    }


def write_datascene_meaning_network_artifact(
    analysis_id: str,
    status: Dict[str, Any],
    output_json_path: Path,
    *,
    transcript: Optional[Any] = None,
    visual_analysis: Optional[Dict[str, Any]] = None,
    scene_cards: Optional[Any] = None,
) -> Dict[str, Any]:
    payload = build_datascene_meaning_network(
        analysis_id,
        status,
        transcript=transcript,
        visual_analysis=visual_analysis,
        scene_cards=scene_cards,
    )
    output_json_path.parent.mkdir(parents=True, exist_ok=True)
    output_json_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return payload
