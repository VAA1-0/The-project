from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


TRIANGULATION_AUTHORITIES = [
    "analyst_confirmed_identity",
    "metadata_reference",
    "visual_sample_cloud",
    "audio_sample_cloud",
    "manual_annotation",
    "automatic_detection",
]


PROLIFERATION_LEVELS = {
    "blocked": 0.0,
    "local_candidate": 0.5,
    "media_candidate": 0.6,
    "media_array_candidate": 0.67,
    "analyst_confirmed": 0.9,
}


IDENTITY_DEPENDENT_LABELS = {
    "Interaction": {
        "allowed_updates": ["participant_identity_refs", "traceback_refs", "review_priority"],
        "forbidden_updates": ["time_interval", "geometry", "interaction_type_confirmation"],
    },
    "Movement": {
        "allowed_updates": ["actor_identity_refs", "traceback_refs", "review_priority"],
        "forbidden_updates": ["time_interval", "geometry", "movement_path_confirmation"],
    },
    "Action": {
        "allowed_updates": ["actor_identity_refs", "traceback_refs", "review_priority"],
        "forbidden_updates": ["time_interval", "geometry", "action_type_confirmation"],
    },
    "Role": {
        "allowed_updates": ["candidate_role_links", "identity_refs", "traceback_refs"],
        "forbidden_updates": ["role_confirmation_without_role_evidence"],
    },
    "Scene": {
        "allowed_updates": ["participant_identity_refs", "traceback_refs"],
        "forbidden_updates": ["scene_type_confirmation_without_scene_evidence"],
    },
    "Situation": {
        "allowed_updates": ["participant_identity_refs", "traceback_refs", "review_priority"],
        "forbidden_updates": ["situation_type_confirmation_without_situation_evidence"],
    },
    "Expression": {
        "allowed_updates": ["subject_identity_refs", "traceback_refs", "review_priority"],
        "forbidden_updates": ["emotion_confirmation_without_expression_evidence"],
    },
    "Audio": {
        "allowed_updates": ["speaker_identity_refs", "audio_sample_cloud_refs", "traceback_refs"],
        "forbidden_updates": ["speaker_confirmation_without_audio_evidence"],
    },
    "OCR": {
        "allowed_updates": ["mentioned_identity_refs", "traceback_refs"],
        "forbidden_updates": ["identity_confirmation_from_text_match_alone"],
    },
    "ReportClaim": {
        "allowed_updates": ["claim_support_refs", "identity_refs", "traceback_refs"],
        "forbidden_updates": ["claim_confirmation_without_claim_evidence"],
    },
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_float(value: Any, fallback: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _clamp_score(value: Any, fallback: float = 0.0) -> float:
    return min(1.0, max(0.0, _safe_float(value, fallback)))


def _label(value: Any, fallback: str = "") -> str:
    text = str(value or "").strip()
    return text or fallback


def _mean(values: Iterable[float]) -> float:
    items = [value for value in values if value is not None]
    return sum(items) / len(items) if items else 0.0


def _collect_cloud_score(
    clouds_payload: Optional[Dict[str, Any]],
    identity_label: str,
    *,
    label_field: str = "entity_label",
) -> Dict[str, Any]:
    clouds = (clouds_payload or {}).get("clouds") or []
    matching = [
        cloud
        for cloud in clouds
        if _label(cloud.get(label_field)).lower() == identity_label.lower()
    ]
    if not matching:
        return {"score": 0.0, "sample_count": 0, "evidence_ids": []}

    sample_counts = []
    confidence_scores = []
    evidence_ids: List[str] = []
    for cloud in matching:
        summary = cloud.get("cloud_summary") or {}
        samples = cloud.get("samples") or []
        sample_counts.append(int(summary.get("sample_count") or len(samples) or 0))
        confidence_scores.append(_clamp_score(summary.get("average_confidence"), 0.0))
        if cloud.get("cloud_id"):
            evidence_ids.append(str(cloud["cloud_id"]))
        for sample in samples:
            if sample.get("sample_id"):
                evidence_ids.append(str(sample["sample_id"]))

    return {
        "score": _mean(confidence_scores),
        "sample_count": sum(sample_counts),
        "evidence_ids": evidence_ids,
    }


def _metadata_score(source_media_metadata: Optional[Dict[str, Any]], identity_label: str) -> Dict[str, Any]:
    annotations = (source_media_metadata or {}).get("user_annotations") or {}
    reference_people = annotations.get("reference_people") or []
    reference_speakers = annotations.get("reference_speakers") or []
    expected_names = annotations.get("expected_identities") or []
    narrative_profiles = annotations.get("narrative_agent_profiles") or []
    character_definitions = annotations.get("character_definitions") or []
    character_roles = annotations.get("character_roles") or []
    persons = annotations.get("persons") or []

    evidence_ids: List[str] = []
    score = 0.0

    for index, person in enumerate(reference_people):
        if not isinstance(person, dict):
            continue
        if _label(person.get("identity_label") or person.get("name")).lower() == identity_label.lower():
            score = max(score, 0.9)
            evidence_ids.append(f"metadata:reference_people:{index}")

    for index, speaker in enumerate(reference_speakers):
        if not isinstance(speaker, dict):
            continue
        if _label(speaker.get("identity_label")).lower() == identity_label.lower():
            score = max(score, 0.85)
            evidence_ids.append(f"metadata:reference_speakers:{index}")

    for index, name in enumerate(expected_names):
        if _label(name).lower() == identity_label.lower():
            score = max(score, 0.7)
            evidence_ids.append(f"metadata:expected_identities:{index}")

    for index, profile in enumerate(narrative_profiles):
        if not isinstance(profile, dict):
            continue
        profile_label = _label(profile.get("narrative_agent_name") or profile.get("identity_label"))
        if profile_label.lower() == identity_label.lower():
            score = max(score, 0.88)
            evidence_ids.append(f"metadata:narrative_agent_profiles:{index}")

    for index, definition in enumerate(character_definitions):
        if isinstance(definition, dict):
            character_label = _label(definition.get("character_name") or definition.get("name"))
        else:
            character_label = _label(str(definition).split(":", 1)[0].split("(", 1)[0])
        if character_label.lower() == identity_label.lower():
            score = max(score, 0.82)
            evidence_ids.append(f"metadata:character_definitions:{index}")

    for index, role in enumerate(character_roles):
        role_label = _label(str(role).split(":", 1)[0].split("(", 1)[0])
        if role_label.lower() == identity_label.lower():
            score = max(score, 0.82)
            evidence_ids.append(f"metadata:character_roles:{index}")

    for index, person in enumerate(persons):
        person_label = (
            _label(person.get("identity_label") or person.get("name"))
            if isinstance(person, dict)
            else _label(person)
        )
        if person_label.lower() == identity_label.lower():
            score = max(score, 0.78)
            evidence_ids.append(f"metadata:persons:{index}")

    return {"score": score, "evidence_ids": evidence_ids}


def _identity_labels_from_metadata(source_media_metadata: Optional[Dict[str, Any]]) -> List[str]:
    annotations = (source_media_metadata or {}).get("user_annotations") or {}
    labels: List[str] = []
    for person in annotations.get("reference_people") or []:
        if isinstance(person, dict):
            labels.append(_label(person.get("identity_label") or person.get("name")))
    for speaker in annotations.get("reference_speakers") or []:
        if isinstance(speaker, dict):
            labels.append(_label(speaker.get("identity_label")))
    for name in annotations.get("expected_identities") or []:
        labels.append(_label(name))
    for profile in annotations.get("narrative_agent_profiles") or []:
        if isinstance(profile, dict):
            labels.append(_label(profile.get("narrative_agent_name") or profile.get("identity_label")))
    for definition in annotations.get("character_definitions") or []:
        if isinstance(definition, dict):
            labels.append(_label(definition.get("character_name") or definition.get("name")))
        else:
            labels.append(_label(str(definition).split(":", 1)[0].split("(", 1)[0]))
    for role in annotations.get("character_roles") or []:
        labels.append(_label(str(role).split(":", 1)[0].split("(", 1)[0]))
    for person in annotations.get("persons") or []:
        labels.append(
            _label(person.get("identity_label") or person.get("name"))
            if isinstance(person, dict)
            else _label(person)
        )
    return [label for label in labels if label]


def _identity_labels_from_clouds(clouds_payload: Optional[Dict[str, Any]]) -> List[str]:
    return [
        _label(cloud.get("entity_label"))
        for cloud in (clouds_payload or {}).get("clouds") or []
        if isinstance(cloud, dict) and _label(cloud.get("entity_label"))
    ]


def _identity_labels_from_manual_annotations(
    manual_annotations: Optional[Iterable[Dict[str, Any]]],
) -> List[str]:
    labels: List[str] = []
    for annotation in manual_annotations or []:
        if not isinstance(annotation, dict):
            continue
        labels.append(
            _label(
                annotation.get("identity_affirmation")
                or (annotation.get("attributes") or {}).get("identity_label")
            )
        )
    return [label for label in labels if label]


def collect_identity_labels(
    *,
    source_media_metadata: Optional[Dict[str, Any]] = None,
    visual_sample_clouds: Optional[Dict[str, Any]] = None,
    audio_sample_clouds: Optional[Dict[str, Any]] = None,
    manual_annotations: Optional[Iterable[Dict[str, Any]]] = None,
) -> List[str]:
    labels = [
        *_identity_labels_from_metadata(source_media_metadata),
        *_identity_labels_from_clouds(visual_sample_clouds),
        *_identity_labels_from_clouds(audio_sample_clouds),
        *_identity_labels_from_manual_annotations(manual_annotations),
    ]
    unique: Dict[str, str] = {}
    for label in labels:
        key = label.lower()
        unique.setdefault(key, label)
    return sorted(unique.values(), key=str.lower)


def resolve_identity_triangulation(
    analysis_id: str,
    *,
    identity_label: str,
    source_media_metadata: Optional[Dict[str, Any]] = None,
    visual_sample_clouds: Optional[Dict[str, Any]] = None,
    audio_sample_clouds: Optional[Dict[str, Any]] = None,
    manual_annotations: Optional[Iterable[Dict[str, Any]]] = None,
    reviewed_by: str = "system",
) -> Dict[str, Any]:
    """Patch audio recognition with metadata and visual identification evidence.

    The result is a candidate proliferation record. It can recommend propagation,
    but it does not itself confirm identity unless analyst-confirmed evidence is
    present.
    """

    identity = _label(identity_label, "unknown_identity")
    metadata = _metadata_score(source_media_metadata, identity)
    visual = _collect_cloud_score(visual_sample_clouds, identity)
    audio = _collect_cloud_score(audio_sample_clouds, identity)

    manual_hits = []
    for annotation in manual_annotations or []:
        if not isinstance(annotation, dict):
            continue
        annotation_identity = _label(
            annotation.get("identity_affirmation")
            or (annotation.get("attributes") or {}).get("identity_label")
        )
        if annotation_identity.lower() == identity.lower():
            manual_hits.append(annotation)

    manual_confirmed = any(
        (item.get("attributes") or {}).get("identity_status") == "confirmed"
        or item.get("review_state") == "confirmed"
        for item in manual_hits
    )
    manual_score = 0.95 if manual_confirmed else (0.7 if manual_hits else 0.0)

    evidence_vector = {
        "metadata": metadata,
        "visual": visual,
        "audio": audio,
        "manual": {
            "score": manual_score,
            "sample_count": len(manual_hits),
            "evidence_ids": [
                str(item.get("annotation_id") or item.get("id") or item.get("track_id"))
                for item in manual_hits
                if item.get("annotation_id") or item.get("id") or item.get("track_id")
            ],
        },
    }
    modality_count = sum(
        1
        for key in ["metadata", "visual", "audio", "manual"]
        if evidence_vector[key].get("score", 0.0) > 0
    )

    weighted_score = (
        metadata["score"] * 0.20
        + visual["score"] * 0.25
        + audio["score"] * 0.25
        + manual_score * 0.30
    )
    triangulation_score = min(1.0, weighted_score + min(0.12, modality_count * 0.03))
    metadata_audio_agent_candidate = (
        metadata["score"] >= 0.78
        and audio["score"] >= 0.68
        and audio.get("sample_count", 0) > 0
        and modality_count >= 2
    )

    if manual_confirmed and triangulation_score >= PROLIFERATION_LEVELS["analyst_confirmed"]:
        level = "analyst_confirmed"
    elif triangulation_score >= PROLIFERATION_LEVELS["media_array_candidate"] and modality_count >= 3:
        level = "media_array_candidate"
    elif (
        triangulation_score >= PROLIFERATION_LEVELS["media_candidate"]
        and modality_count >= 2
    ) or metadata_audio_agent_candidate:
        level = "media_candidate"
    elif triangulation_score >= PROLIFERATION_LEVELS["local_candidate"]:
        level = "local_candidate"
    else:
        level = "blocked"

    should_proliferate = level in {"media_candidate", "media_array_candidate", "analyst_confirmed"}
    now = _now_iso()

    return {
        "schema": "vaa1.identity_triangulation.v1",
        "analysis_id": analysis_id,
        "identity_label": identity,
        "status": "ready_for_proliferation" if should_proliferate else "insufficient_evidence",
        "triangulation_score": round(triangulation_score, 4),
        "modality_count": modality_count,
        "proliferation_level": level,
        "should_proliferate": should_proliferate,
        "authority_order": TRIANGULATION_AUTHORITIES,
        "evidence_vector": evidence_vector,
        "proliferation_policy": {
            "may_auto_apply_as_candidate": should_proliferate,
            "may_auto_confirm": manual_confirmed,
            "requires_analyst_review": not manual_confirmed,
            "propagate_as": "confirmed_identity" if manual_confirmed else "candidate_identity",
            "scope": "media_array" if level == "media_array_candidate" else "single_media",
        },
        "provenance": {
            "created_at": now,
            "updated_at": now,
            "created_by": reviewed_by,
            "updated_by": reviewed_by,
        },
    }


def build_identity_dependent_proliferation_plan(
    triangulation_record: Dict[str, Any],
    *,
    target_labels: Optional[Iterable[str]] = None,
) -> Dict[str, Any]:
    """Create label-enrichment instructions from a confirmed/candidate identity.

    The plan describes what dependent labels may inherit from identity evidence.
    It never changes their own time, geometry, or modality-specific proof.
    """

    identity = _label(triangulation_record.get("identity_label"), "unknown_identity")
    propagate_as = (
        triangulation_record.get("proliferation_policy", {}).get("propagate_as")
        or "candidate_identity"
    )
    should_proliferate = bool(triangulation_record.get("should_proliferate"))
    requested = list(target_labels or IDENTITY_DEPENDENT_LABELS.keys())
    instructions = []

    for label in requested:
        policy = IDENTITY_DEPENDENT_LABELS.get(label)
        if policy is None:
            instructions.append(
                {
                    "label": label,
                    "status": "blocked",
                    "reason": "unsupported_dependent_label",
                    "allowed_updates": [],
                    "forbidden_updates": ["all"],
                }
            )
            continue

        instructions.append(
            {
                "label": label,
                "status": "ready" if should_proliferate else "blocked",
                "identity_label": identity,
                "propagate_as": propagate_as,
                "allowed_updates": policy["allowed_updates"],
                "forbidden_updates": policy["forbidden_updates"],
                "must_preserve": [
                    "time_interval",
                    "geometry",
                    "source_modality",
                    "original_detection_id",
                    "review_state",
                    "provenance",
                ],
            }
        )

    return {
        "schema": "vaa1.identity_dependent_proliferation_plan.v1",
        "analysis_id": triangulation_record.get("analysis_id"),
        "identity_label": identity,
        "source_triangulation_schema": triangulation_record.get("schema"),
        "source_proliferation_level": triangulation_record.get("proliferation_level"),
        "status": "ready" if should_proliferate else "blocked",
        "instructions": instructions,
    }


def build_identity_triangulation_bundle(
    analysis_id: str,
    *,
    source_media_metadata: Optional[Dict[str, Any]] = None,
    visual_sample_clouds: Optional[Dict[str, Any]] = None,
    audio_sample_clouds: Optional[Dict[str, Any]] = None,
    manual_annotations: Optional[Iterable[Dict[str, Any]]] = None,
    reviewed_by: str = "system",
) -> Dict[str, Any]:
    labels = collect_identity_labels(
        source_media_metadata=source_media_metadata,
        visual_sample_clouds=visual_sample_clouds,
        audio_sample_clouds=audio_sample_clouds,
        manual_annotations=manual_annotations,
    )

    records = [
        resolve_identity_triangulation(
            analysis_id,
            identity_label=label,
            source_media_metadata=source_media_metadata,
            visual_sample_clouds=visual_sample_clouds,
            audio_sample_clouds=audio_sample_clouds,
            manual_annotations=manual_annotations,
            reviewed_by=reviewed_by,
        )
        for label in labels
    ]
    plans = [build_identity_dependent_proliferation_plan(record) for record in records]

    return {
        "schema": "vaa1.identity_triangulation_bundle.v1",
        "analysis_id": analysis_id,
        "status": "ready",
        "identity_count": len(labels),
        "proliferation_ready_count": sum(
            1 for record in records if record.get("should_proliferate")
        ),
        "identity_labels": labels,
        "triangulations": records,
        "dependent_proliferation_plans": plans,
        "provenance": {
            "created_at": _now_iso(),
            "created_by": reviewed_by,
        },
    }


def write_identity_triangulation_bundle(
    analysis_id: str,
    output_json_path: str | Path,
    *,
    source_media_metadata: Optional[Dict[str, Any]] = None,
    visual_sample_clouds: Optional[Dict[str, Any]] = None,
    audio_sample_clouds: Optional[Dict[str, Any]] = None,
    manual_annotations: Optional[Iterable[Dict[str, Any]]] = None,
    reviewed_by: str = "system",
) -> Dict[str, Any]:
    payload = build_identity_triangulation_bundle(
        analysis_id,
        source_media_metadata=source_media_metadata,
        visual_sample_clouds=visual_sample_clouds,
        audio_sample_clouds=audio_sample_clouds,
        manual_annotations=manual_annotations,
        reviewed_by=reviewed_by,
    )
    path = Path(output_json_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    return payload
