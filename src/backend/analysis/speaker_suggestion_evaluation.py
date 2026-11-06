"""Evaluate review-only speaker suggestions against analyst-confirmed audio rows.

The evaluator never changes speaker authority.  It characterises how useful the
ranking is before an analyst applies the canonical correction.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Iterable, Mapping


SCHEMA = "vaa1.speaker_suggestion_evaluation.v1"
METHOD_VERSION = "cosine-nearest-confirmed-seed.1"


def _cosine(left: list[float], right: list[float]) -> float:
    if not left or len(left) != len(right):
        return float("-inf")
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if not left_norm or not right_norm:
        return float("-inf")
    return sum(a * b for a, b in zip(left, right)) / (left_norm * right_norm)


def confirmed_speaker_seeds(
    corrections: Mapping[str, Any], diarization: Mapping[str, Any]
) -> list[dict[str, Any]]:
    embeddings = {
        str(item.get("embedding_id") or item.get("turn_id") or ""): item
        for item in ((diarization.get("embedding_index") or {}).get("items") or [])
        if isinstance(item, dict)
    }
    seeds: list[dict[str, Any]] = []
    for decision in corrections.get("proliferation_decisions") or []:
        if not isinstance(decision, dict) or decision.get("decision") != "confirmed":
            continue
        candidate_id = str(decision.get("candidate_id") or "")
        marker = ":embedding:"
        if not candidate_id.startswith("narrative-agent-audio-family:") or marker not in candidate_id:
            continue
        embedding_id = "embedding:" + candidate_id.split(marker, 1)[1]
        embedding = embeddings.get(embedding_id)
        vector = embedding.get("vector") if embedding else None
        label = str(decision.get("applied_label") or "").strip()
        if not label or not isinstance(vector, list) or not vector:
            continue
        seeds.append({
            "seed_id": candidate_id,
            "embedding_id": embedding_id,
            "speaker_label": label,
            "vector": [float(value) for value in vector],
        })
    return seeds


def evaluate_speaker_suggestions(
    seeds: Iterable[Mapping[str, Any]], *, abstention_margins: Iterable[float] = (0.0, 0.0025, 0.005, 0.01, 0.02)
) -> dict[str, Any]:
    rows = [dict(seed) for seed in seeds]
    evaluations: list[dict[str, Any]] = []
    for held_out in rows:
        by_label: dict[str, dict[str, Any]] = {}
        for candidate in rows:
            if candidate["seed_id"] == held_out["seed_id"]:
                continue
            score = _cosine(held_out["vector"], candidate["vector"])
            label = str(candidate["speaker_label"])
            if label not in by_label or score > by_label[label]["score"]:
                by_label[label] = {"label": label, "score": score, "supporting_seed_id": candidate["seed_id"]}
        ranked = sorted(by_label.values(), key=lambda item: (-item["score"], item["label"]))
        top_two = ranked[:2]
        predicted = top_two[0]["label"] if top_two else None
        margin = (top_two[0]["score"] - top_two[1]["score"]) if len(top_two) == 2 else None
        evaluations.append({
            "held_out_seed_id": held_out["seed_id"],
            "actual_label": held_out["speaker_label"],
            "predicted_label": predicted,
            "correct": predicted == held_out["speaker_label"],
            "top_two": top_two,
            "winning_margin": margin,
        })

    threshold_results = []
    total = len(evaluations)
    for threshold in abstention_margins:
        answered = [row for row in evaluations if row["winning_margin"] is not None and row["winning_margin"] >= threshold]
        correct = sum(bool(row["correct"]) for row in answered)
        threshold_results.append({
            "minimum_margin": threshold,
            "answered": len(answered),
            "abstained": total - len(answered),
            "coverage": round(len(answered) / total, 6) if total else 0.0,
            "accuracy_when_answered": round(correct / len(answered), 6) if answered else None,
        })

    correct = sum(bool(row["correct"]) for row in evaluations)
    return {
        "schema": SCHEMA,
        "method": {"id": "leave_one_confirmed_seed_out", "version": METHOD_VERSION, "similarity": "cosine"},
        "authority_boundary": {
            "output_role": "review_only_speaker_suggestion",
            "automatic_maturation_allowed": False,
            "analyst_confirmation_is_canonical": True,
        },
        "population": {
            "eligible_confirmed_seeds": total,
            "distinct_speakers": len({row["actual_label"] for row in evaluations}),
            "excluded_count": 0,
        },
        "top_1": {"correct": correct, "total": total, "accuracy": round(correct / total, 6) if total else None},
        "abstention_curve": threshold_results,
        "rows": evaluations,
        "limitations": [
            "Leave-one-seed-out measures ranking utility within the saved corpus; it is not an independent external holdout.",
            "Repeated turns from one source may be acoustically dependent.",
            "Scores are similarities, not identity probabilities.",
        ],
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
    }
