from __future__ import annotations

from datetime import datetime, timezone
import math
from typing import Any, Dict, Iterable, List, Optional, Tuple


SCHEMA = "vaa1.agent_persistence_scene_cut.v1"
DEFAULT_SCENE_CUT_WINDOW_SECONDS = 1.5
DEFAULT_SIMILARITY_THRESHOLD = 0.70
DEFAULT_AMBIGUITY_MARGIN = 0.05


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _safe_text(value: Any, fallback: str = "") -> str:
    text = str(value or "").strip()
    return text or fallback


def _number_vector(value: Any) -> Optional[List[float]]:
    if value is None:
        return None
    if isinstance(value, dict):
        value = value.get("vector") or value.get("values") or value.get("embedding")
    if not isinstance(value, (list, tuple)):
        return None
    vector: List[float] = []
    for item in value:
        try:
            vector.append(float(item))
        except (TypeError, ValueError):
            return None
    return vector if vector else None


def cosine_similarity(left: Any, right: Any) -> Optional[float]:
    left_vector = _number_vector(left)
    right_vector = _number_vector(right)
    if not left_vector or not right_vector or len(left_vector) != len(right_vector):
        return None
    dot = sum(a * b for a, b in zip(left_vector, right_vector))
    left_norm = math.sqrt(sum(a * a for a in left_vector))
    right_norm = math.sqrt(sum(b * b for b in right_vector))
    if left_norm == 0 or right_norm == 0:
        return None
    return max(0.0, min(1.0, dot / (left_norm * right_norm)))


def bhattacharyya_similarity(left: Any, right: Any) -> Optional[float]:
    left_hist = _number_vector(left)
    right_hist = _number_vector(right)
    if not left_hist or not right_hist or len(left_hist) != len(right_hist):
        return None
    left_sum = sum(value for value in left_hist if value >= 0)
    right_sum = sum(value for value in right_hist if value >= 0)
    if left_sum <= 0 or right_sum <= 0:
        return None
    coefficient = sum(
        math.sqrt(max(0.0, a) * max(0.0, b))
        for a, b in zip(left_hist, right_hist)
    ) / math.sqrt(left_sum * right_sum)
    distance = math.sqrt(max(0.0, 1.0 - min(1.0, coefficient)))
    return max(0.0, min(1.0, 1.0 - distance))


def _feature_value(features: Dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in features:
            return features[key]
    return None


def compute_feature_similarity(
    departed_features: Optional[Dict[str, Any]],
    arrived_features: Optional[Dict[str, Any]],
    *,
    face_weight: float = 0.7,
    clothing_weight: float = 0.3,
) -> Dict[str, Any]:
    departed = departed_features or {}
    arrived = arrived_features or {}
    face_score = cosine_similarity(
        _feature_value(departed, "face", "face_embedding", "face_embedding_vector"),
        _feature_value(arrived, "face", "face_embedding", "face_embedding_vector"),
    )
    clothing_score = bhattacharyya_similarity(
        _feature_value(departed, "clothing", "torso_histogram", "torso_color_histogram"),
        _feature_value(arrived, "clothing", "torso_histogram", "torso_color_histogram"),
    )

    weighted = 0.0
    weights = 0.0
    if face_score is not None:
        weighted += face_score * face_weight
        weights += face_weight
    if clothing_score is not None:
        weighted += clothing_score * clothing_weight
        weights += clothing_weight

    return {
        "combined_score": round(weighted / weights, 4) if weights else 0.0,
        "face_similarity": round(face_score, 4) if face_score is not None else None,
        "clothing_similarity": round(clothing_score, 4) if clothing_score is not None else None,
        "weights": {
            "face": face_weight if face_score is not None else 0.0,
            "clothing": clothing_weight if clothing_score is not None else 0.0,
        },
        "has_comparable_features": weights > 0,
    }


def _track_id(track: Dict[str, Any]) -> str:
    return _safe_text(track.get("track_id") or track.get("trackId") or track.get("id"), "unknown_track")


def _track_time(track: Dict[str, Any], *keys: str) -> Optional[float]:
    for key in keys:
        if key in track:
            return _safe_float(track.get(key))
    span = track.get("time_span") or track.get("time") or {}
    for key in keys:
        if key in span:
            return _safe_float(span.get(key))
    return None


def departed_tracks_near_cut(
    tracks: Iterable[Dict[str, Any]],
    cut_time: float,
    *,
    window_seconds: float = DEFAULT_SCENE_CUT_WINDOW_SECONDS,
) -> List[Dict[str, Any]]:
    lower = cut_time - window_seconds
    return [
        track
        for track in tracks or []
        if (end_time := _track_time(track, "end", "end_time", "end_seconds")) is not None
        and lower <= end_time <= cut_time
    ]


def arrived_tracks_near_cut(
    tracks: Iterable[Dict[str, Any]],
    cut_time: float,
    *,
    window_seconds: float = DEFAULT_SCENE_CUT_WINDOW_SECONDS,
) -> List[Dict[str, Any]]:
    upper = cut_time + window_seconds
    return [
        track
        for track in tracks or []
        if (start_time := _track_time(track, "start", "start_time", "start_seconds")) is not None
        and cut_time <= start_time <= upper
    ]


def _candidate_record(
    departed_track: Dict[str, Any],
    arrived_track: Dict[str, Any],
    similarity: Dict[str, Any],
    *,
    scene_cut: Dict[str, Any],
    threshold: float,
    ambiguity_margin: float,
    status: str,
    rank: int,
) -> Dict[str, Any]:
    return {
        "candidate_id": (
            f"agent_persistence:{_safe_text(scene_cut.get('cut_id') or scene_cut.get('id'), 'cut')}:"
            f"{_track_id(departed_track)}:{_track_id(arrived_track)}"
        ),
        "feature_type": "agent_persistence_scene_cut",
        "status": status,
        "rank": rank,
        "old_track_id": _track_id(departed_track),
        "new_track_id": _track_id(arrived_track),
        "agent_label": _safe_text(
            departed_track.get("agent_label")
            or departed_track.get("narrative_agent_label")
            or departed_track.get("identity_label")
            or departed_track.get("label")
            or departed_track.get("display_label"),
            _track_id(departed_track),
        ),
        "confidence": similarity["combined_score"],
        "threshold": threshold,
        "ambiguity_margin": ambiguity_margin,
        "similarity": similarity,
        "resolution": (
            "Agent Persistence Established"
            if status == "accepted"
            else "Agent Persistence Review Candidate"
        ),
        "scene_cut": {
            "cut_id": scene_cut.get("cut_id") or scene_cut.get("id"),
            "time": scene_cut.get("time") or scene_cut.get("timestamp") or scene_cut.get("start"),
            "pre_segment_id": scene_cut.get("pre_segment_id"),
            "post_segment_id": scene_cut.get("post_segment_id"),
        },
        "traceback": {
            "departed_track_ref": departed_track.get("evidence_id") or _track_id(departed_track),
            "arrived_track_ref": arrived_track.get("evidence_id") or _track_id(arrived_track),
            "departed_feature_cloud_ref": departed_track.get("feature_cloud_ref"),
            "arrived_feature_cloud_ref": arrived_track.get("feature_cloud_ref"),
            "scene_cut_ref": scene_cut.get("cut_id") or scene_cut.get("id"),
            "source_frame_refs": [
                ref
                for ref in [
                    departed_track.get("frame_ref") or departed_track.get("last_frame_ref"),
                    arrived_track.get("frame_ref") or arrived_track.get("first_frame_ref"),
                ]
                if ref
            ],
            "source_bbox_refs": [
                ref
                for ref in [
                    departed_track.get("bbox_ref"),
                    arrived_track.get("bbox_ref"),
                ]
                if ref
            ],
        },
    }


def cross_scene_persistence_check(
    pre_cut_tracks: Iterable[Dict[str, Any]],
    post_cut_tracks: Iterable[Dict[str, Any]],
    *,
    scene_cut: Optional[Dict[str, Any]] = None,
    similarity_threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
    ambiguity_margin: float = DEFAULT_AMBIGUITY_MARGIN,
) -> Dict[str, Any]:
    cut = scene_cut or {}
    candidates: List[Dict[str, Any]] = []
    for departed_track in pre_cut_tracks or []:
        ranked: List[Tuple[Dict[str, Any], Dict[str, Any]]] = []
        for arrived_track in post_cut_tracks or []:
            similarity = compute_feature_similarity(
                departed_track.get("features"),
                arrived_track.get("features"),
            )
            if similarity["has_comparable_features"]:
                ranked.append((arrived_track, similarity))
        ranked.sort(key=lambda item: item[1]["combined_score"], reverse=True)
        if not ranked:
            continue

        best_track, best_similarity = ranked[0]
        next_score = ranked[1][1]["combined_score"] if len(ranked) > 1 else 0.0
        above_threshold = best_similarity["combined_score"] >= similarity_threshold
        ambiguous = above_threshold and len(ranked) > 1 and (
            best_similarity["combined_score"] - next_score
        ) < ambiguity_margin
        status = "accepted" if above_threshold and not ambiguous else "review_candidate"
        candidates.append(
            _candidate_record(
                departed_track,
                best_track,
                best_similarity,
                scene_cut=cut,
                threshold=similarity_threshold,
                ambiguity_margin=ambiguity_margin,
                status=status,
                rank=1,
            )
        )
        for rank, (arrived_track, similarity) in enumerate(ranked[1:], start=2):
            if similarity["combined_score"] >= max(0.0, similarity_threshold - ambiguity_margin):
                candidates.append(
                    _candidate_record(
                        departed_track,
                        arrived_track,
                        similarity,
                        scene_cut=cut,
                        threshold=similarity_threshold,
                        ambiguity_margin=ambiguity_margin,
                        status="review_candidate",
                        rank=rank,
                    )
                )

    accepted = [candidate for candidate in candidates if candidate["status"] == "accepted"]
    return {
        "schema": SCHEMA,
        "status": "ready",
        "scene_cut": cut,
        "similarity_threshold": similarity_threshold,
        "ambiguity_margin": ambiguity_margin,
        "candidates": candidates,
        "matches": accepted,
        "summary": {
            "candidate_count": len(candidates),
            "accepted_count": len(accepted),
            "review_candidate_count": len(candidates) - len(accepted),
        },
        "governance": {
            "anti_drift_rule_preserved_for_continuous_tracking": True,
            "runs_only_near_confirmed_scene_cut": True,
            "ambiguous_matches_require_review": True,
            "master_schema_traceback_required": True,
            "does_not_assert_natural_person_identity": True,
        },
        "provenance": {
            "created_at": _now_iso(),
            "created_by": "agent_persistence_manager",
        },
    }


def build_agent_persistence_feature_event(
    analysis_id: str,
    candidate: Dict[str, Any],
) -> Dict[str, Any]:
    cut_time = _safe_float((candidate.get("scene_cut") or {}).get("time"), 0.0)
    confidence = _safe_float(candidate.get("confidence"), 0.0)
    return {
        "event_id": candidate.get("candidate_id"),
        "feature_type": "agent_persistence_scene_cut",
        "time_span": {"start": cut_time, "end": cut_time},
        "participants_involved": [
            item
            for item in [
                candidate.get("agent_label"),
                candidate.get("old_track_id"),
                candidate.get("new_track_id"),
            ]
            if item
        ],
        "confidence": {"score": confidence},
        "feature_payload": {
            "agent_label": candidate.get("agent_label"),
            "old_track_id": candidate.get("old_track_id"),
            "new_track_id": candidate.get("new_track_id"),
            "resolution": candidate.get("resolution"),
            "scene_cut": candidate.get("scene_cut"),
            "similarity": candidate.get("similarity"),
            "threshold": candidate.get("threshold"),
            "status": candidate.get("status"),
        },
        "evidence_refs": [
            {
                "evidence_id": candidate.get("candidate_id"),
                "evidence_kind": "agent_persistence_scene_cut",
                "authority_level": 35 if candidate.get("status") == "accepted" else 25,
            }
        ],
        "proliferation_support": {
            "candidate_target_labels": ["Identification"],
            "may_surface_as": "candidate_agent_profile",
            "analysis_id": analysis_id,
        },
        "traceback": candidate.get("traceback") or {},
    }
