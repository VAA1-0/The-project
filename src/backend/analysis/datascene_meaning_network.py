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


def _audio_event_intervals(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    results = status.get("results") if isinstance(status.get("results"), dict) else {}
    audio = results.get("audio_analysis") if isinstance(results.get("audio_analysis"), dict) else {}
    for payload in (
        status.get("audio_event_intervals"),
        audio.get("audio_event_intervals"),
        (audio.get("audio_prosody") or {}).get("audio_event_intervals")
        if isinstance(audio.get("audio_prosody"), dict)
        else None,
    ):
        if isinstance(payload, dict) and isinstance(payload.get("intervals"), list):
            return [item for item in payload["intervals"] if isinstance(item, dict)]
    return []


def _speaker_turns(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    results = status.get("results") if isinstance(status.get("results"), dict) else {}
    audio = results.get("audio_analysis") if isinstance(results.get("audio_analysis"), dict) else {}
    for payload in (status.get("audio_diarization"), audio.get("audio_diarization")):
        if isinstance(payload, dict) and isinstance(payload.get("speaker_turns"), list):
            return [item for item in payload["speaker_turns"] if isinstance(item, dict)]
    return []


def _confirmed_audio_annotations(status: Dict[str, Any]) -> List[Dict[str, Any]]:
    corrections = (
        status.get("annotation_corrections")
        if isinstance(status.get("annotation_corrections"), dict)
        else {}
    )
    return [
        item
        for item in corrections.get("manual_visual_annotations") or []
        if isinstance(item, dict)
        and item.get("category") == "Audio"
        and item.get("identity_affirmation")
    ]


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


def _time_from_source_anchors(item: Dict[str, Any]) -> Dict[str, Optional[float]]:
    for anchor in _as_items(item.get("source_anchors")):
        if anchor.get("anchor_type") != "media_time_interval":
            continue
        interval = anchor.get("interval") if isinstance(anchor.get("interval"), dict) else {}
        interval = interval or anchor
        resolved = _interval(interval)
        if resolved.get("start") is not None:
            return resolved
    return _interval(item.get("source_time") if isinstance(item.get("source_time"), dict) else item)


def _bbox_from_source_anchors(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    for anchor in _as_items(item.get("source_anchors")):
        if anchor.get("anchor_type") == "bbox":
            return anchor.get("bbox") if isinstance(anchor.get("bbox"), dict) else anchor
    return item.get("geometry") if isinstance(item.get("geometry"), dict) else None


def _matcher_evidence_ref(
    evidence_id: str,
    item: Dict[str, Any],
    *,
    source_type: str = "matcher",
    confidence: Optional[float] = None,
) -> Dict[str, Any]:
    ref = _evidence_ref(
        evidence_id,
        source_type,
        _time_from_source_anchors(item),
        confidence=confidence,
    )
    bbox = _bbox_from_source_anchors(item)
    if bbox:
        ref["bbox"] = bbox
    ref["source_refs"] = item.get("source_refs") or item.get("traceback_refs") or []
    return ref


def _projection_node_type(value: Any) -> str:
    node_type = _safe_text(value, "matcher_candidate").lower()
    if node_type in {"mature_anchor", "seed"}:
        return "matcher_anchor"
    if node_type in {"candidate", "pattern_candidate"}:
        return "matcher_candidate"
    return f"matcher_{node_type.replace(' ', '_')}"


def _project_matcher_topology_to_meaning_network(
    status: Dict[str, Any],
) -> Dict[str, List[Dict[str, Any]]]:
    """Project scanner/matcher topology into the Meaning Network graph.

    The projection is diagnostic: it exposes open-topology SOM nodes and edges
    as graph material while leaving promotion authority with governed decisions.
    """
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    anchors: List[Dict[str, Any]] = []
    confirmations: List[Dict[str, Any]] = []
    seen_nodes = set()
    seen_edges = set()

    def add_node(raw_node: Dict[str, Any], *, run_id: str, index: int) -> Optional[str]:
        raw_id = _safe_text(raw_node.get("node_id"), f"{run_id}:node:{index}")
        node_id = f"matcher:{raw_id}"
        if node_id in seen_nodes:
            return node_id
        confidence = _safe_float(
            raw_node.get("similarity_score")
            or raw_node.get("match_probability")
            or raw_node.get("confidence"),
            0.5,
        )
        evidence_ref = _matcher_evidence_ref(
            node_id,
            raw_node,
            source_type=_safe_text(raw_node.get("source_panel"), "matcher"),
            confidence=confidence,
        )
        source_time_resolved = evidence_ref.get("time_range", {}).get("start") is not None
        seen_nodes.add(node_id)
        nodes.append(
            _node(
                node_id,
                _projection_node_type(raw_node.get("node_type")),
                _safe_text(raw_node.get("label"), "Matcher candidate"),
                description=(
                    "Open-topology SOM matcher projection. Candidate support only; "
                    "confirm, defer, or reject before mature proliferation."
                ),
                attributes={
                    "run_id": run_id,
                    "cluster_id": raw_node.get("cluster_id"),
                    "source_panel": raw_node.get("source_panel"),
                    "source_kind": raw_node.get("source_kind"),
                    "source_verification_class": raw_node.get("source_verification_class"),
                    "review_required": raw_node.get("review_required", True),
                    "source_navigation": raw_node.get("source_navigation") or {},
                    "open_topology_som": True,
                    "fixed_grid": False,
                    "lane_id": "matcher",
                    "linked_data_principle": {
                        "node_is_traceable": True,
                        "source_time_resolved": source_time_resolved,
                        "bbox_resolved": bool(evidence_ref.get("bbox")),
                        "manual_correction_wins": True,
                    },
                },
                maturity=_maturity("candidate", "matcher_agent", confidence),
                evidence_refs=[evidence_ref],
                display_group="open_topology_som_matcher",
            )
        )
        return node_id

    def add_edge(raw_edge: Dict[str, Any], *, run_id: str, index: int) -> None:
        raw_id = _safe_text(raw_edge.get("edge_id"), f"{run_id}:edge:{index}")
        edge_id = f"matcher:{raw_id}"
        if edge_id in seen_edges:
            return
        source_node_id = f"matcher:{_safe_text(raw_edge.get('from_node') or raw_edge.get('source_node_id'))}"
        target_node_id = f"matcher:{_safe_text(raw_edge.get('to_node') or raw_edge.get('target_node_id'))}"
        if not source_node_id or not target_node_id:
            return
        seen_edges.add(edge_id)
        target_node = next(
            (
                item for item in nodes
                if item.get("node_id") == target_node_id
            ),
            None,
        )
        target_refs = target_node.get("evidence_refs") if isinstance(target_node, dict) else []
        edge_type = _safe_text(raw_edge.get("edge_type"), "traceable_similarity")
        weight = _safe_float(raw_edge.get("weight"), 0.5) or 0.5
        edge_refs = target_refs if target_refs else [
            _evidence_ref(
                edge_id,
                "matcher_edge",
                {"start": None, "end": None},
                confidence=weight,
            )
        ]
        edges.append(
            _edge(
                edge_id,
                source_node_id,
                target_node_id,
                edge_type,
                weight=weight,
                maturity=_maturity("candidate", "matcher_agent", weight),
                evidence_refs=edge_refs,
            )
        )
        edges[-1]["attributes"] = {
            "run_id": run_id,
            "match_basis": raw_edge.get("match_basis"),
            "review_required": raw_edge.get("review_required", True),
            "open_topology_som": True,
            "manual_confirmation_required_for_promotion": True,
        }

    def add_topology(topology: Dict[str, Any], *, run_id: str) -> None:
        if not isinstance(topology, dict):
            return
        for index, raw_node in enumerate(_as_items(topology.get("nodes"))):
            add_node(raw_node, run_id=run_id, index=index)
        for index, raw_edge in enumerate(_as_items(topology.get("edges"))):
            add_edge(raw_edge, run_id=run_id, index=index)
        for cluster in _as_items(topology.get("clusters")):
            anchors.append(
                {
                    "anchor_id": f"matcher-cluster:{_safe_text(cluster.get('cluster_id'), run_id)}",
                    "anchor_type": "open_topology_som_cluster",
                    "label": _safe_text(cluster.get("cluster_id"), "Matcher cluster"),
                    "applies_to_node_ids": [
                        f"matcher:{candidate_id}"
                        for candidate_id in cluster.get("candidate_ids") or []
                    ],
                    "copy_paste_contract": {
                        "copy_enabled": True,
                        "paste_to_selected_nodes": True,
                        "paste_to_scene_coordinate": True,
                        "create_linked_duplicate": True,
                        "detach_from_chain": True,
                        "preserve_source_traceback": True,
                    },
                    "maturity": _maturity("candidate", "matcher_agent", 0.5),
                    "evidence_refs": [],
                }
            )

    for index, match in enumerate(_as_items(status.get("evidence_proliferation_matches"))):
        add_topology(
            match.get("open_topology_som") if isinstance(match.get("open_topology_som"), dict) else {},
            run_id=_safe_text(match.get("request_id"), f"matcher-run:{index}"),
        )

    for index, run in enumerate(_as_items(status.get("open_topology_scanner_refreshes"))):
        for match_index, match in enumerate(_as_items(run.get("matches"))):
            add_topology(
                match.get("open_topology_som") if isinstance(match.get("open_topology_som"), dict) else {},
                run_id=_safe_text(match.get("request_id"), f"scanner-refresh:{index}:{match_index}"),
            )

    for index, pattern in enumerate(_as_items(status.get("multimodal_pattern_scanner_candidates"))):
        support = pattern.get("constellational_support") if isinstance(pattern.get("constellational_support"), dict) else {}
        seed_id = f"matcher:pattern-seed:{_safe_text(pattern.get('seed_id'), str(index))}"
        candidate_id = f"matcher:pattern-candidate:{_safe_text(pattern.get('candidate_id'), str(index))}"
        if seed_id not in seen_nodes:
            seen_nodes.add(seed_id)
            nodes.append(
                _node(
                    seed_id,
                    "matcher_anchor",
                    _safe_text(pattern.get("seed_label"), "Known pattern seed"),
                    attributes={
                        "open_topology_som": True,
                        "pattern_scanner_agent": True,
                        "lane_id": "matcher",
                    },
                    maturity=_maturity("candidate", "matcher_agent", _safe_float(support.get("confidence"), 0.5)),
                    display_group="open_topology_som_matcher",
                )
            )
        if candidate_id not in seen_nodes:
            seen_nodes.add(candidate_id)
            candidate_support = next(
                (
                    item for item in support.get("support") or []
                    if isinstance(item, dict) and item.get("support_type") == "visual_candidate_anchor"
                ),
                {},
            )
            nodes.append(
                _node(
                    candidate_id,
                    "matcher_candidate",
                    _safe_text(pattern.get("candidate_label") or candidate_support.get("label"), "Pattern candidate"),
                    attributes={
                        "open_topology_som": True,
                        "pattern_scanner_agent": True,
                        "lane_id": "matcher",
                        "support_panels": support.get("support_panels") or [],
                        "support_count": support.get("support_count"),
                        "modality_count": support.get("modality_count"),
                        "match_basis": support.get("match_basis") or [],
                    },
                    maturity=_maturity("candidate", "matcher_agent", _safe_float(support.get("confidence"), 0.5)),
                    evidence_refs=[
                        _matcher_evidence_ref(
                            candidate_id,
                            candidate_support,
                            source_type=_safe_text(candidate_support.get("source_panel"), "matcher"),
                            confidence=_safe_float(support.get("confidence"), 0.5),
                        )
                    ],
                    display_group="open_topology_som_matcher",
                )
            )
        edge_id = f"matcher:edge:{seed_id}:pattern:{candidate_id}"
        if edge_id not in seen_edges:
            seen_edges.add(edge_id)
            edges.append(
                _edge(
                    edge_id,
                    seed_id,
                    candidate_id,
                    "constellational_match_candidate",
                    weight=_safe_float(support.get("confidence"), 0.5) or 0.5,
                    maturity=_maturity("candidate", "matcher_agent", _safe_float(support.get("confidence"), 0.5)),
                    evidence_refs=[],
                )
            )

    if nodes or edges:
        confirmations.append(
            {
                "confirmation_id": "confirmation:open-topology-som-matcher-review",
                "confirmation_type": "matcher_topology_review",
                "target_ids": [node["node_id"] for node in nodes[:200]],
                "maturity_result": _maturity("candidate", "matcher_agent", 0.5),
                "proliferation_scope": [
                    "meaning_network_panel",
                    "data_maturation_panel",
                    "video_panel",
                    "traceback_drawer",
                    "narrative_agent_panel",
                    "master_schema",
                ],
                "notes": "Matcher/SOM projections are source-linked candidate topology. Promote only through analyst or governed decision ledger.",
            }
        )

    return {
        "nodes": nodes,
        "edges": edges,
        "continuity_anchors": anchors,
        "confirmations": confirmations,
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
    audio_events = _audio_event_intervals(network_status)
    speaker_turns = _speaker_turns(network_status)
    confirmed_audio = _confirmed_audio_annotations(network_status)
    manual_labels = _manual_agent_labels(network_status)
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    confirmations: List[Dict[str, Any]] = []
    continuity_anchors: List[Dict[str, Any]] = []
    traceback_index: List[Dict[str, Any]] = []
    projected_audio_event_ids: set[str] = set()
    projected_speaker_turn_ids: set[str] = set()
    projected_confirmed_audio_ids: set[str] = set()
    projected_person_source_ids: set[str] = set()
    projected_transcript_source_ids: set[str] = set()

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
        scene_audio_events = [
            event for event in audio_events if _within_scene(interval, _interval(event))
        ]
        scene_speaker_turns = [
            turn for turn in speaker_turns if _within_scene(interval, _interval(turn))
        ]
        scene_confirmed_audio = [
            item for item in confirmed_audio if _within_scene(interval, _interval(item))
        ]

        for audio_index, event in enumerate(scene_audio_events):
            event_interval = _interval(event)
            event_id = _safe_text(
                event.get("event_id") or event.get("segment_id"),
                f"{scene_id}:audio-event:{audio_index + 1}",
            )
            event_type = _safe_text(
                event.get("event_type") or event.get("event_label"),
                "audio event",
            )
            node_id = f"audio-event:{event_id}"
            if node_id in projected_audio_event_ids:
                continue
            projected_audio_event_ids.add(node_id)
            evidence = _evidence_ref(
                event_id,
                "audio_event_interval",
                event_interval,
                confidence=_safe_float(event.get("confidence"), 0.5),
            )
            nodes.append(
                _node(
                    node_id,
                    "audio_event",
                    event_type,
                    description="Measured music, noise, silence, or speech interval.",
                    attributes={"scene_id": scene_id, "audio_event_type": event_type},
                    maturity=_maturity(
                        "candidate",
                        "audio_measurement",
                        _safe_float(event.get("confidence"), 0.5),
                    ),
                    evidence_refs=[evidence],
                    display_group="scene_audio_events",
                )
            )
            edges.append(
                _edge(
                    f"edge:{node_id}:belongs:{scene_node_id}",
                    node_id,
                    scene_node_id,
                    "belongs_to_scene",
                    weight=0.65,
                    evidence_refs=[evidence],
                )
            )

        for turn_index, turn in enumerate(scene_speaker_turns):
            turn_interval = _interval(turn)
            turn_id = _safe_text(
                turn.get("turn_id"), f"{scene_id}:speaker-turn:{turn_index + 1}"
            )
            speaker = _safe_text(turn.get("speaker_label"), "Unresolved speaker")
            node_id = f"speaker-turn:{turn_id}"
            if node_id in projected_speaker_turn_ids:
                continue
            projected_speaker_turn_ids.add(node_id)
            evidence = _evidence_ref(
                turn_id,
                "speaker_diarization_turn",
                turn_interval,
                confidence=_safe_float(
                    turn.get("diarization_confidence") or turn.get("confidence"),
                    0.5,
                ),
            )
            nodes.append(
                _node(
                    node_id,
                    "speaker",
                    speaker,
                    description=_safe_text(turn.get("text"))[:180],
                    attributes={
                        "scene_id": scene_id,
                        "identity_status": "cluster_identity_unconfirmed",
                    },
                    maturity=_maturity("candidate", "audio_diarization", 0.5),
                    evidence_refs=[evidence],
                    display_group="scene_speakers",
                )
            )
            edges.append(
                _edge(
                    f"edge:{node_id}:belongs:{scene_node_id}",
                    node_id,
                    scene_node_id,
                    "speaks_in_scene",
                    weight=0.65,
                    evidence_refs=[evidence],
                )
            )

        for anchor_index, item in enumerate(scene_confirmed_audio):
            anchor_interval = _interval(item)
            anchor_id = _safe_text(
                item.get("id"), f"{scene_id}:confirmed-audio:{anchor_index + 1}"
            )
            label = _safe_text(
                item.get("identity_affirmation")
                or item.get("custom_label")
                or item.get("label"),
                "Confirmed Narrative Agent audio",
            )
            node_id = f"narrative-agent-audio:{anchor_id}"
            if node_id in projected_confirmed_audio_ids:
                continue
            projected_confirmed_audio_ids.add(node_id)
            evidence = _evidence_ref(
                anchor_id,
                "manual_audio_confirmation",
                anchor_interval,
                confidence=1.0,
            )
            nodes.append(
                _node(
                    node_id,
                    "narrative_agent",
                    label,
                    description=_safe_text(item.get("open_note"))[:180],
                    attributes={
                        "scene_id": scene_id,
                        "audio_identity_anchor": True,
                    },
                    maturity=_maturity("analyst_confirmed", "analyst", 1.0),
                    evidence_refs=[evidence],
                    display_group="narrative_agents",
                )
            )
            edges.append(
                _edge(
                    f"edge:{node_id}:belongs:{scene_node_id}",
                    node_id,
                    scene_node_id,
                    "speaks_in_scene",
                    weight=1.0,
                    maturity=_maturity("analyst_confirmed", "analyst", 1.0),
                    evidence_refs=[evidence],
                )
            )
        for person_index, person in enumerate(scene_persons):
            person_interval = _interval(person)
            track_id = _safe_text(person.get("track_id") or person.get("id"), str(person_index + 1))
            person_node_id = f"person:{scene_id}:{track_id}"
            projected_person_source_ids.add(track_id)
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

        for transcript_index, transcript in enumerate(scene_transcripts):
            transcript_interval = _interval(transcript)
            transcript_id = _safe_text(transcript.get("id"), f"{scene_id}:transcript:{transcript_index + 1}")
            transcript_node_id = f"transcript:{transcript_id}"
            projected_transcript_source_ids.add(transcript_id)
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

    # Evidence must remain visible even when scene segmentation is absent,
    # provisional, or lacks governed time bounds. Scene membership is an
    # optional relationship; it is not an admission gate for the network.
    for audio_index, event in enumerate(audio_events):
        event_id = _safe_text(
            event.get("event_id") or event.get("segment_id"),
            f"unscoped:audio-event:{audio_index + 1}",
        )
        node_id = f"audio-event:{event_id}"
        if node_id in projected_audio_event_ids:
            continue
        projected_audio_event_ids.add(node_id)
        event_interval = _interval(event)
        event_type = _safe_text(
            event.get("event_type") or event.get("event_label"),
            "audio event",
        )
        evidence = _evidence_ref(
            event_id,
            "audio_event_interval",
            event_interval,
            confidence=_safe_float(event.get("confidence"), 0.5),
        )
        nodes.append(
            _node(
                node_id,
                "audio_event",
                event_type,
                description="Measured music, noise, silence, or speech interval.",
                attributes={
                    "scene_id": None,
                    "scene_membership_status": "unresolved",
                    "audio_event_type": event_type,
                },
                maturity=_maturity(
                    "candidate",
                    "audio_measurement",
                    _safe_float(event.get("confidence"), 0.5),
                ),
                evidence_refs=[evidence],
                display_group="unscoped_audio_evidence",
            )
        )

    for turn_index, turn in enumerate(speaker_turns):
        turn_id = _safe_text(turn.get("turn_id"), f"unscoped:speaker-turn:{turn_index + 1}")
        node_id = f"speaker-turn:{turn_id}"
        if node_id in projected_speaker_turn_ids:
            continue
        projected_speaker_turn_ids.add(node_id)
        turn_interval = _interval(turn)
        evidence = _evidence_ref(
            turn_id,
            "speaker_diarization_turn",
            turn_interval,
            confidence=_safe_float(
                turn.get("diarization_confidence") or turn.get("confidence"),
                0.5,
            ),
        )
        nodes.append(
            _node(
                node_id,
                "speaker",
                _safe_text(turn.get("speaker_label"), "Unresolved speaker"),
                description=_safe_text(turn.get("text"))[:180],
                attributes={
                    "scene_id": None,
                    "scene_membership_status": "unresolved",
                    "identity_status": "cluster_identity_unconfirmed",
                },
                maturity=_maturity("candidate", "audio_diarization", 0.5),
                evidence_refs=[evidence],
                display_group="unscoped_speaker_evidence",
            )
        )

    for anchor_index, item in enumerate(confirmed_audio):
        anchor_id = _safe_text(item.get("id"), f"unscoped:confirmed-audio:{anchor_index + 1}")
        node_id = f"narrative-agent-audio:{anchor_id}"
        if node_id in projected_confirmed_audio_ids:
            continue
        projected_confirmed_audio_ids.add(node_id)
        evidence = _evidence_ref(
            anchor_id,
            "manual_audio_confirmation",
            _interval(item),
            confidence=1.0,
        )
        nodes.append(
            _node(
                node_id,
                "narrative_agent",
                _safe_text(
                    item.get("identity_affirmation")
                    or item.get("custom_label")
                    or item.get("label"),
                    "Confirmed Narrative Agent audio",
                ),
                description=_safe_text(item.get("open_note"))[:180],
                attributes={
                    "scene_id": None,
                    "scene_membership_status": "unresolved",
                    "audio_identity_anchor": True,
                },
                maturity=_maturity("analyst_confirmed", "analyst", 1.0),
                evidence_refs=[evidence],
                display_group="narrative_agents",
            )
        )

    for person_index, person in enumerate(persons):
        track_id = _safe_text(person.get("track_id") or person.get("id"), str(person_index + 1))
        if track_id in projected_person_source_ids:
            continue
        label = _safe_text(
            person.get("agent_label")
            or person.get("identity")
            or person.get("label")
            or person.get("class_name"),
            f"Person candidate {track_id}",
        )
        raw_like = label.lower() in {"person", "person track", "unknown"}
        interval = _interval(person)
        node_id = f"person:unscoped:{track_id}"
        nodes.append(
            _node(
                node_id,
                "character" if not raw_like else "evidence_fragment",
                label,
                description="Source-linked visual detection awaiting governed scene membership.",
                attributes={
                    "scene_id": None,
                    "scene_membership_status": "unresolved",
                    "track_id": track_id,
                    "raw_detection_overload_sensitive": raw_like,
                },
                maturity=_maturity(
                    "candidate",
                    "detector",
                    _safe_float(person.get("confidence"), 0.45),
                ),
                evidence_refs=[
                    _evidence_ref(
                        node_id,
                        "object_detection",
                        interval,
                        confidence=_safe_float(person.get("confidence"), 0.45),
                    )
                ],
                display_group="unscoped_visual_evidence",
            )
        )

    for transcript_index, transcript_item in enumerate(transcripts):
        transcript_id = _safe_text(
            transcript_item.get("id"),
            f"unscoped:transcript:{transcript_index + 1}",
        )
        if transcript_id in projected_transcript_source_ids:
            continue
        interval = _interval(transcript_item)
        node_id = f"transcript:{transcript_id}"
        text = _safe_text(
            transcript_item.get("text") or transcript_item.get("transcript_text"),
            "Transcript segment",
        )
        nodes.append(
            _node(
                node_id,
                "speaker",
                _safe_text(
                    transcript_item.get("speaker") or transcript_item.get("speaker_label"),
                    "Unknown speaker",
                ),
                description=text[:180],
                attributes={
                    "scene_id": None,
                    "scene_membership_status": "unresolved",
                    "text_excerpt": text[:240],
                },
                maturity=_maturity("machine_inferred", "model", 0.6),
                evidence_refs=[
                    _evidence_ref(node_id, "transcript", interval, confidence=0.6)
                ],
                display_group="unscoped_transcript_evidence",
            )
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

    matcher_projection = _project_matcher_topology_to_meaning_network(network_status)
    nodes.extend(matcher_projection["nodes"])
    edges.extend(matcher_projection["edges"])
    continuity_anchors.extend(matcher_projection["continuity_anchors"])
    confirmations.extend(matcher_projection["confirmations"])

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
