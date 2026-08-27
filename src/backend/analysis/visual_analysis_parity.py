"""Evidence contract for the visual detection panels."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def _items(value: Any, *keys: str) -> list[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        for key in keys:
            if isinstance(value.get(key), list):
                return value[key]
    return []


def build_visual_analysis_parity(tracked_objects: Any, ocr_results: Any, expression_results: Any) -> dict[str, Any]:
    """Describe the exact visual rows available to the three dashboard consumers."""
    objects = _items(tracked_objects, "tracked_objects", "items", "records")
    ocr = _items(ocr_results, "ocr_results", "items", "records")
    expressions = _items(expression_results, "expression_results", "expressions", "items", "records")
    return {
        "schema": "vaa1.visual_analysis_parity.v1",
        "tracked_objects": {"row_count": len(objects), "available": bool(objects), "consumer_route": "panel.objects.detection_evidence"},
        "ocr": {"row_count": len(ocr), "available": bool(ocr), "consumer_route": "panel.objects.ocr_evidence"},
        "expressions": {"row_count": len(expressions), "available": bool(expressions), "consumer_route": "panel.expressions.detection_evidence"},
        "verified_at": datetime.now(timezone.utc).isoformat(),
    }
