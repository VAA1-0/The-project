"""Governed, modality-neutral constellational cluster exploration.

This module does not promote identity or interpretation. It aggregates measured,
source-linked samples into reviewable clusters whose threshold, ranking and
human adjustments remain inspectable.
"""
from __future__ import annotations

from hashlib import sha256
import json
import math
from typing import Any, Dict, Iterable, List, Optional


SCHEMA = "vaa1.constellational_cluster_exploration.v1"
PIPELINE = [
    "sampling",
    "detection",
    "size_quality_filtering",
    "landmarks",
    "embeddings",
    "cosine_distance_clustering",
    "adjustable_thresholds",
    "ranking",
    "representative_sample_selection",
    "human_cluster_adjustment",
]

CLUSTER_FAMILIES = [
    "narrative_agent_identity",
    "face",
    "person",
    "object",
    "expression",
    "pose_gesture_movement",
    "speaker_voice_prosody",
    "sound_music_environment",
    "scene_shot_setting",
    "set_location_environment_recognition",
    "text_ocr_named_entity",
    "interaction_dialogue_copresence",
    "visual_concept",
    "narrative_interpretive_relation",
    "anomaly_contradiction_missingness",
]

VISUAL_CONCEPT_LAYERS = [
    "measured_visual_features",
    "recurring_visual_pattern",
    "concept_candidate",
    "analyst_confirmed_visual_concept",
    "interpretive_relation",
]

DETECTION_CLUSTER_TAXONOMY: Dict[str, Dict[str, Any]] = {
    "visual": {
        "label": "Visual detections",
        "families": [
            "object_and_object_track",
            "person_face_and_identity_candidate",
            "expression_and_micro_expression",
            "pose_gesture_and_body_movement",
            "scene_shot_and_transition",
            "set_location_and_environment",
            "spatial_tone_color_light_and_contrast",
            "adaptive_visual_change_and_motion",
            "ocr_region",
            "visual_sample_and_sample_cloud",
            "visual_concept_recurrence_candidate",
        ],
        "coordinate_contracts": ["source_time", "frame", "bbox_roi", "scene_interval"],
        "preview_kinds": ["thumbnail", "video_frame", "document_region"],
    },
    "audio": {
        "label": "Audio detections",
        "families": [
            "speech_activity_and_vad_interval",
            "speaker_turn_and_diarization_cluster",
            "voice_and_speaker_profile_candidate",
            "prosody_delivery_and_turn_structure",
            "music_noise_silence_and_sound_event",
            "foley_and_recurring_acoustic_event",
            "acoustic_environment",
            "audio_sample_and_sample_cloud",
            "waveform_energy_pitch_and_spectral_measurement",
        ],
        "coordinate_contracts": ["source_time", "audio_sample_window"],
        "preview_kinds": ["audio_waveform", "spectrogram", "text_excerpt"],
    },
    "textual": {
        "label": "Textual detections",
        "families": [
            "transcript_segment_and_word",
            "linked_transcript_anchor",
            "ocr_text",
            "token_lemma_and_pos",
            "quant_frequency_and_repetition",
            "named_entity_and_reference",
            "speaker_label_and_assignment",
            "language_and_morphology_signal",
            "phrase_keyword_and_lexical_pattern",
        ],
        "coordinate_contracts": ["source_time", "text_span", "document_region", "token_index"],
        "preview_kinds": ["text_excerpt", "document_region"],
    },
}

INTERPRETIVE_CLUSTER_FAMILIES_DEFERRED = [
    "symbolic_meaning",
    "theme",
    "narrative_function",
    "narrative_role",
    "ideology",
    "genre_interpretation",
    "lens_reading",
    "significance_claim",
]


def _number(value: Any, fallback: float = 0.0) -> float:
    try:
        parsed = float(value)
        return parsed if math.isfinite(parsed) else fallback
    except (TypeError, ValueError):
        return fallback


def _vector(value: Any) -> Optional[List[float]]:
    if not isinstance(value, list) or not value:
        return None
    result = [_number(item, math.nan) for item in value]
    if any(not math.isfinite(item) for item in result):
        return None
    magnitude = math.sqrt(sum(item * item for item in result))
    if magnitude <= 0:
        return None
    return [item / magnitude for item in result]


def cosine_distance(left: List[float], right: List[float]) -> float:
    if len(left) != len(right) or not left:
        return 1.0
    return max(0.0, min(2.0, 1.0 - sum(a * b for a, b in zip(left, right))))


def _stable_id(prefix: str, value: Any) -> str:
    digest = sha256(json.dumps(value, sort_keys=True, default=str).encode("utf-8")).hexdigest()[:16]
    return f"{prefix}:{digest}"


def _components(rows: List[Dict[str, Any]], threshold: float) -> List[List[Dict[str, Any]]]:
    unseen = set(range(len(rows)))
    groups: List[List[Dict[str, Any]]] = []
    while unseen:
        seed = min(unseen)
        unseen.remove(seed)
        stack = [seed]
        member_indexes = [seed]
        while stack:
            current = stack.pop()
            linked = [
                index for index in sorted(unseen)
                if cosine_distance(rows[current]["embedding"], rows[index]["embedding"]) <= threshold
            ]
            for index in linked:
                unseen.remove(index)
                stack.append(index)
                member_indexes.append(index)
        groups.append([rows[index] for index in sorted(member_indexes)])
    return groups


def _rank_cluster(members: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    centroid = [sum(row["embedding"][i] for row in members) for i in range(len(members[0]["embedding"]))]
    centroid = _vector(centroid) or members[0]["embedding"]
    ranked = []
    for row in members:
        similarity = 1.0 - cosine_distance(row["embedding"], centroid)
        rank_score = max(0.0, similarity) * (0.5 + 0.5 * row["quality"])
        ranked.append({**row, "centroid_similarity": round(similarity, 6), "rank_score": round(rank_score, 6)})
    return sorted(ranked, key=lambda row: (-row["rank_score"], row["sample_id"]))


def explore_constellational_clusters(
    samples: Iterable[Dict[str, Any]],
    *,
    cosine_distance_threshold: float = 0.25,
    minimum_quality: float = 0.0,
    minimum_size: float = 0.0,
    adjustments: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Aggregate source-linked embeddings into transparent review candidates."""
    threshold = max(0.0, min(2.0, _number(cosine_distance_threshold, 0.25)))
    quality_gate = max(0.0, min(1.0, _number(minimum_quality)))
    size_gate = max(0.0, _number(minimum_size))
    accepted: List[Dict[str, Any]] = []
    rejected: List[Dict[str, Any]] = []
    for index, raw in enumerate(samples):
        row = dict(raw) if isinstance(raw, dict) else {}
        sample_id = str(row.get("sample_id") or row.get("id") or f"sample:{index}")
        quality = max(0.0, min(1.0, _number(row.get("quality", row.get("confidence")))))
        size = max(0.0, _number(row.get("size", row.get("duration", row.get("area")))))
        embedding = _vector(row.get("embedding") or row.get("vector"))
        reasons = []
        if quality < quality_gate:
            reasons.append("below_minimum_quality")
        if size < size_gate:
            reasons.append("below_minimum_size")
        if embedding is None:
            reasons.append("missing_or_invalid_embedding")
        if not row.get("source_ref"):
            reasons.append("missing_source_ref")
        normalized = {
            "sample_id": sample_id,
            "modality": row.get("modality") or row.get("sample_type") or "unspecified",
            "cluster_family": row.get("cluster_family") or row.get("category") or "unspecified",
            "source_ref": row.get("source_ref"),
            "source_time": row.get("source_time") or row.get("time"),
            "preview_ref": row.get("preview_ref") or row.get("thumbnail_ref") or row.get("crop_ref"),
            "preview_kind": row.get("preview_kind") or (
                "thumbnail" if row.get("thumbnail_ref") or row.get("crop_ref") else None
            ),
            "landmarks": row.get("landmarks") or [],
            "quality": quality,
            "size": size,
            "embedding": embedding,
        }
        if reasons:
            rejected.append({**normalized, "embedding": None, "reasons": reasons})
        else:
            accepted.append(normalized)

    clusters = []
    for members in _components(accepted, threshold) if accepted else []:
        ranked = _rank_cluster(members)
        member_ids = [row["sample_id"] for row in ranked]
        labels: Dict[str, int] = {}
        for member in ranked:
            label = str(member.get("cluster_family") or "unspecified")
            labels[label] = labels.get(label, 0) + 1
        dominant_count = max(labels.values()) if labels else 0
        clusters.append({
            "cluster_id": _stable_id("cluster", member_ids),
            "member_count": len(ranked),
            "representative_sample_id": ranked[0]["sample_id"],
            "boundary_sample_id": ranked[-1]["sample_id"],
            "cohesion": round(sum(row["centroid_similarity"] for row in ranked) / len(ranked), 6),
            "semantic_purity": round(dominant_count / len(ranked), 6) if ranked else None,
            "family_distribution": labels,
            "source_time_coverage": {
                "source_linked": sum(1 for row in ranked if row.get("source_ref")),
                "source_timed": sum(1 for row in ranked if row.get("source_time") is not None),
                "total": len(ranked),
            },
            "members": ranked,
            "review_state": "candidate",
        })

    centroids: Dict[str, List[float]] = {}
    for cluster in clusters:
        vectors = [row["embedding"] for row in cluster["members"]]
        summed = [sum(vector[index] for vector in vectors) for index in range(len(vectors[0]))]
        centroids[cluster["cluster_id"]] = _vector(summed) or vectors[0]
    for cluster in clusters:
        competitors = [
            (other["cluster_id"], cosine_distance(centroids[cluster["cluster_id"]], centroids[other["cluster_id"]]))
            for other in clusters
            if other["cluster_id"] != cluster["cluster_id"]
        ]
        nearest = min(competitors, key=lambda item: item[1]) if competitors else None
        cluster["nearest_competing_cluster_id"] = nearest[0] if nearest else None
        cluster["nearest_competing_distance"] = round(nearest[1], 6) if nearest else None
        cluster["ambiguity_margin"] = round(nearest[1] - threshold, 6) if nearest else None

    adjustment_log = []
    cluster_by_id = {row["cluster_id"]: row for row in clusters}
    for adjustment in adjustments or []:
        action = str(adjustment.get("action") or "").strip().lower()
        target = str(adjustment.get("cluster_id") or "")
        sample_id = str(adjustment.get("sample_id") or "")
        applied = False
        if action == "set_representative" and target in cluster_by_id:
            cluster = cluster_by_id[target]
            if sample_id in [row["sample_id"] for row in cluster["members"]]:
                cluster["representative_sample_id"] = sample_id
                applied = True
        elif action in {"confirm", "reject", "defer"} and target in cluster_by_id:
            cluster_by_id[target]["review_state"] = action
            applied = True
        adjustment_log.append({**adjustment, "applied": applied})

    return {
        "schema": SCHEMA,
        "datascene_regime": "Mature Data Proliferation",
        "tooling_role": "cluster_exploration_review_projection",
        "canonical_inputs": [
            "source_samples",
            "audio_sample_clouds",
            "visual_sample_clouds",
            "evidence_proliferation_matcher",
            "master_schema",
        ],
        "canonical_decision_sink": "proliferation_decisions",
        "status": "reviewable_candidates" if clusters else "no_reviewable_clusters",
        "authority": "candidate_only_until_human_confirmation",
        "pipeline": PIPELINE,
        "parameters": {
            "cosine_distance_threshold": threshold,
            "minimum_quality": quality_gate,
            "minimum_size": size_gate,
        },
        "counts": {"input": len(accepted) + len(rejected), "accepted": len(accepted), "rejected": len(rejected), "clusters": len(clusters)},
        "clusters": clusters,
        "rejected_samples": rejected,
        "human_adjustments": adjustment_log,
        "preview_contract": {
            "source_linked_only": True,
            "panel_local_copies_forbidden": True,
            "supported_kinds": ["thumbnail", "video_frame", "audio_waveform", "spectrogram", "text_excerpt", "document_region"],
        },
        "cluster_families": CLUSTER_FAMILIES,
        "visual_concept_authority_ladder": VISUAL_CONCEPT_LAYERS,
        "detection_cluster_taxonomy": DETECTION_CLUSTER_TAXONOMY,
        "interpretive_cluster_families_deferred": INTERPRETIVE_CLUSTER_FAMILIES_DEFERRED,
    }
