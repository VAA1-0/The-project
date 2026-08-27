"""Governed Transcript/POS/Quant denominator and parity calculations."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any


def build_language_analysis_parity(
    transcript: dict[str, Any], pos: dict[str, Any], quant: dict[str, Any],
    linked_transcript: dict[str, Any] | None = None,
) -> dict[str, Any]:
    segments = [item for item in transcript.get("segments", []) if isinstance(item, dict)]
    transcript_text = " ".join(str(item.get("text") or "").strip() for item in segments).strip()
    transcript_words = re.findall(r"\b[\w’'-]+\b", transcript_text, flags=re.UNICODE)
    timed = [item for item in segments if item.get("start") is not None and item.get("end") is not None]

    pos_tokens = int(pos.get("token_count") or 0)
    taxonomy_review = pos.get("taxonomy_review") if isinstance(pos.get("taxonomy_review"), dict) else {}
    classified_tokens = int(
        taxonomy_review.get("displayed_taxonomy_token_count")
        if taxonomy_review.get("displayed_taxonomy_token_count") is not None
        else sum(int(value or 0) for value in (pos.get("pos_counts") or {}).values())
    )
    quant_info = quant.get("token_info") if isinstance(quant.get("token_info"), dict) else {}
    quant_tokens = quant_info.get("tokens") if isinstance(quant_info.get("tokens"), list) else []
    filtered_tokens = quant_info.get("tokens_filtered") if isinstance(quant_info.get("tokens_filtered"), list) else []
    all_unique = len(set(map(str, quant_tokens)))
    filtered_unique = len(set(map(str, filtered_tokens)))
    quant_count = len(quant_tokens)
    difference = abs(pos_tokens - quant_count)
    denominator = max(pos_tokens, quant_count, 1)
    parity = round(100 * (1 - difference / denominator), 1)
    ttr = float(quant_info.get("ttr") or 0)
    linked = linked_transcript if isinstance(linked_transcript, dict) else {}
    linked_anchors = linked.get("anchors") if isinstance(linked.get("anchors"), list) else []

    return {
        "schema": "vaa1.language_analysis_parity.v1",
        "transcript": {
            "segment_count": len(segments),
            "timed_segment_count": len(timed),
            "timed_coverage_percentage": round(100 * len(timed) / len(segments), 1) if segments else 100.0,
            "canonical_word_count": len(transcript_words),
            "language": transcript.get("language"),
        },
        "linked_transcript": {
            "anchor_count": len(linked_anchors),
            "available": bool(linked_anchors),
        },
        "pos": {
            "input_token_count": pos_tokens,
            "classified_occurrence_count": classified_tokens,
            "classification_coverage_percentage": round(100 * classified_tokens / pos_tokens, 1) if pos_tokens else 0.0,
            "unclassified_or_excluded_count": max(0, pos_tokens - classified_tokens),
            "analysis_mode": pos.get("analysis_mode"),
            "outside_category_counts": taxonomy_review.get("outside_category_counts") or {},
            "outside_category_examples": taxonomy_review.get("outside_category_examples") or {},
        },
        "quant": {
            "input_token_count": quant_count,
            "filtered_token_count": len(filtered_tokens),
            "all_token_unique_terms": all_unique,
            "filtered_unique_terms": filtered_unique,
            "type_token_ratio": ttr,
            "type_token_ratio_formula": "all_token_unique_terms / input_token_count",
            "type_token_ratio_recomputed": round(all_unique / quant_count, 6) if quant_count else 0.0,
            "sentence_count": int(((quant.get("stats_df") or [{}])[0]).get("Sentences") or 0),
            "reported_word_occurrences": int(((quant.get("stats_df") or [{}])[0]).get("Words") or 0),
        },
        "cross_panel": {
            "pos_quant_token_parity_percentage": parity,
            "token_difference": difference,
            "status": "aligned" if parity >= 99.0 else "review_available",
            "next_action": "Inspect tokenizer exclusions" if difference else "No action needed",
        },
        "verified_at": datetime.now(timezone.utc).isoformat(),
    }
