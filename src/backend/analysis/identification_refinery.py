import json
import logging
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
RESULTS_DIR = PROJECT_ROOT / "outputs" / "api_results"


PERSON_LABELS = {"person", "person_primary"}


def get_master_schema_path(analysis_id: str, results_dir: Optional[str | Path] = None) -> Path:
    root = Path(results_dir) if results_dir is not None else RESULTS_DIR
    return root / analysis_id / "vaa1_annotation_master_schema.json"


def get_identity_candidate_path(
    analysis_id: str,
    results_dir: Optional[str | Path] = None,
) -> Path:
    root = Path(results_dir) if results_dir is not None else RESULTS_DIR
    return root / analysis_id / "identity_refinement_candidates.json"


def is_person_annotation(annotation: Dict[str, Any]) -> bool:
    mapped_label = annotation.get("label_mapping", {}).get("mapped_label")
    if mapped_label in PERSON_LABELS:
        return True

    raw_label = str(annotation.get("label") or annotation.get("raw_label") or "").lower()
    return raw_label in PERSON_LABELS


def iter_person_annotations(
    master_data: Dict[str, Any],
    collection_name: str,
) -> Iterable[Dict[str, Any]]:
    for annotation in master_data.get(collection_name, []):
        if isinstance(annotation, dict) and is_person_annotation(annotation):
            yield annotation


def build_identity_candidate(
    annotation: Dict[str, Any],
    *,
    annotation_type: str,
    index: int,
) -> Dict[str, Any]:
    track_id = annotation.get("track_id")
    annotation_id = annotation.get("annotation_id") or annotation.get("id")
    candidate_key = track_id if track_id is not None else annotation_id or index

    return {
        "candidate_id": f"{annotation_type}_{candidate_key}",
        "candidate_label": f"Unreviewed person {candidate_key}",
        "review_state": "unreviewed",
        "identity_status": "candidate",
        "confidence": None,
        "source": "identity_refinement_loop",
        "evidence": {
            "annotation_type": annotation_type,
            "annotation_id": annotation_id,
            "track_id": track_id,
            "label": annotation.get("label"),
            "label_mapping": annotation.get("label_mapping"),
            "time_start": annotation.get("time_start"),
            "time_end": annotation.get("time_end"),
            "frame": annotation.get("frame"),
            "bbox": annotation.get("bbox") or annotation.get("bounding_box"),
        },
        "future_modalities": {
            "visual_cues": "pending",
            "cinematic_cues": "pending",
            "speaker_diarization": "pending",
            "speaker_embedding": "pending",
            "reference_match": "pending",
        },
    }


def load_identity_candidate_ledger(
    analysis_id: str,
    *,
    output_json_path: Optional[str | Path] = None,
) -> Dict[str, Any]:
    path = Path(output_json_path) if output_json_path else get_identity_candidate_path(analysis_id)
    if not path.exists():
        return {
            "status": "missing",
            "message": "Identity candidate ledger not found",
            "output_json_path": str(path),
            "candidate_count": 0,
            "candidates": [],
        }

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def annotation_matches_candidate(
    annotation: Dict[str, Any],
    candidate: Dict[str, Any],
) -> bool:
    evidence = candidate.get("evidence") or {}
    track_id = evidence.get("track_id")
    annotation_id = evidence.get("annotation_id")
    if track_id is not None and str(annotation.get("track_id")) == str(track_id):
        return True
    if annotation_id is not None:
        return str(annotation.get("annotation_id") or annotation.get("id")) == str(annotation_id)
    return False


def promote_identity_candidate(
    analysis_id: str,
    *,
    candidate_id: str,
    identity_label: str,
    reviewer: str = "analyst",
    promoted_at: Optional[str] = None,
    master_json_path: Optional[str | Path] = None,
    output_json_path: Optional[str | Path] = None,
) -> Dict[str, Any]:
    master_path = Path(master_json_path) if master_json_path else get_master_schema_path(analysis_id)
    ledger_path = Path(output_json_path) if output_json_path else get_identity_candidate_path(analysis_id)

    if not identity_label.strip():
        return {"status": "error", "message": "Identity label is required"}
    if not master_path.exists():
        return {
            "status": "error",
            "message": "Master JSON not found",
            "master_json_path": str(master_path),
        }
    if not ledger_path.exists():
        return {
            "status": "error",
            "message": "Identity candidate ledger not found",
            "output_json_path": str(ledger_path),
        }

    with open(master_path, "r", encoding="utf-8") as f:
        master_data = json.load(f)
    with open(ledger_path, "r", encoding="utf-8") as f:
        ledger = json.load(f)

    candidates = ledger.get("candidates", [])
    candidate = next(
        (item for item in candidates if item.get("candidate_id") == candidate_id),
        None,
    )
    if candidate is None:
        return {"status": "error", "message": "Identity candidate not found"}

    evidence = candidate.get("evidence") or {}
    annotation_type = evidence.get("annotation_type")
    collection_name = (
        "track_annotations" if annotation_type == "track" else "object_annotations"
    )

    updated = False
    for annotation in master_data.get(collection_name, []):
        if not isinstance(annotation, dict) or not annotation_matches_candidate(annotation, candidate):
            continue
        annotation["identity_affirmation"] = identity_label.strip()
        attributes = annotation.setdefault("attributes", {})
        attributes["identity_status"] = "confirmed"
        attributes["identity_source"] = "analyst_promoted_candidate"
        attributes["identity_candidate_id"] = candidate_id
        attributes["identity_reviewer"] = reviewer
        if promoted_at:
            attributes["identity_promoted_at"] = promoted_at
        updated = True
        break

    if not updated:
        return {"status": "error", "message": "Matching annotation not found"}

    candidate["review_state"] = "promoted"
    candidate["identity_status"] = "confirmed"
    candidate["promoted_identity"] = identity_label.strip()
    candidate["promoted_by"] = reviewer
    if promoted_at:
        candidate["promoted_at"] = promoted_at
    ledger["candidate_count"] = len(candidates)
    ledger["promoted_count"] = sum(
        1 for item in candidates if item.get("review_state") == "promoted"
    )

    with open(master_path, "w", encoding="utf-8") as f:
        json.dump(master_data, f, indent=2, ensure_ascii=False)
    with open(ledger_path, "w", encoding="utf-8") as f:
        json.dump(ledger, f, indent=2, ensure_ascii=False)

    return {
        "status": "success",
        "candidate_id": candidate_id,
        "identity_label": identity_label.strip(),
        "master_json_path": str(master_path),
        "output_json_path": str(ledger_path),
    }


def refine_identities(
    analysis_id: str,
    *,
    master_json_path: Optional[str | Path] = None,
    output_json_path: Optional[str | Path] = None,
) -> Dict[str, Any]:
    """
    Iterative refinement loop that synthesizes visual, audio, and cinematic cues
    to identify and track persons/roles. Writes a candidate ledger rather than
    mutating analyst-facing identity claims in the master schema.
    """
    logger.info(f"Starting identity refinement for analysis {analysis_id}")

    master_json_path = Path(master_json_path) if master_json_path else get_master_schema_path(analysis_id)
    output_json_path = (
        Path(output_json_path) if output_json_path else get_identity_candidate_path(analysis_id)
    )

    if not master_json_path.exists():
        logger.error(f"Master JSON not found at {master_json_path}")
        return {
            "status": "error",
            "message": "Master JSON not found",
            "master_json_path": str(master_json_path),
        }

    try:
        with open(master_json_path, "r", encoding="utf-8") as f:
            master_data = json.load(f)
    except Exception as e:
        logger.error(f"Failed to read master JSON: {e}")
        return {
            "status": "error",
            "message": "Failed to read master JSON",
            "master_json_path": str(master_json_path),
        }

    candidates = []
    for index, annotation in enumerate(iter_person_annotations(master_data, "track_annotations")):
        candidates.append(
            build_identity_candidate(annotation, annotation_type="track", index=index)
        )

    for index, annotation in enumerate(iter_person_annotations(master_data, "object_annotations")):
        candidates.append(
            build_identity_candidate(annotation, annotation_type="object", index=index)
        )

    ledger = {
        "analysis_id": analysis_id,
        "status": "candidate_review_required",
        "source_master_schema": str(master_json_path),
        "candidate_count": len(candidates),
        "candidates": candidates,
        "audio_stack_plan": {
            "vad": "enabled",
            "diarization": "pyannote.audio",
            "speaker_embeddings": "pyannote.audio",
            "reference_upload": "custom",
            "real_time": "diart_later_if_needed",
            "alternative_embeddings": "SpeechBrain",
        },
    }

    try:
        output_json_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_json_path, "w", encoding="utf-8") as f:
            json.dump(ledger, f, indent=2, ensure_ascii=False)
        logger.info(f"Wrote {len(candidates)} identity candidates to {output_json_path}")
    except Exception as e:
        logger.error(f"Failed to write identity candidate ledger: {e}")
        return {
            "status": "error",
            "message": "Failed to write identity candidate ledger",
            "master_json_path": str(master_json_path),
            "output_json_path": str(output_json_path),
        }

    return {
        "status": "success",
        "candidate_count": len(candidates),
        "output_json_path": str(output_json_path),
        "master_json_path": str(master_json_path),
        "message": "Identification refinement candidates ready for analyst review",
    }

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        print(refine_identities(sys.argv[1]))
    else:
        print("Please provide an analysis_id")
