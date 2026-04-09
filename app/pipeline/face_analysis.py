import csv
from datetime import datetime, timezone
from pathlib import Path

from app.pipeline.face_bridge import run_face_worker

CSV_FIELDNAMES = [
    "image_path",
    "face_index",
    "source_timestamp",
    "analysis_timestamp",
    "age",
    "dominant_gender",
    "dominant_emotion",
    "dominant_race",
    "face_confidence",
    "region_x",
    "region_y",
    "region_w",
    "region_h",
    "box_area",
    "center_x",
    "center_y",
    "left_eye_x",
    "left_eye_y",
    "right_eye_x",
    "right_eye_y",
]


WARNING_MESSAGES = {
    "FACE_WORKER_FAILED": {
        "technical_note": "The face worker process returned a non-zero exit code.",
        "user_message": "Face analysis could not complete for this image yet.",
    },
    "NO_FACE_DATA": {
        "technical_note": "The face worker completed but returned no face data.",
        "user_message": "No face data was returned for this image.",
    },
    "LOW_FACE_CONFIDENCE": {
        "technical_note": "The face result was produced with very low confidence.",
        "user_message": "A face-like region was analyzed, but confidence is currently low.",
    },
    "PARTIAL_FACE_VISIBILITY": {
        "technical_note": "Key landmarks were incomplete or missing in the detected region.",
        "user_message": "The face appears partially visible, which can happen during motion or profile angles.",
    },
    "WHOLE_FRAME_FACE_REGION": {
        "technical_note": "The detected face region spans nearly the whole frame.",
        "user_message": "The model likely used a broad fallback region, so this frame should be interpreted cautiously.",
    },
    "BATCH_FRAME_FAILURE": {
        "technical_note": "At least one frame in the batch failed face analysis.",
        "user_message": "Some frames were analyzed successfully, but one or more frames need review.",
    },
}

STYLE_MESSAGES = {
    "plain": {
        "FACE_ANALYSIS_COMPLETED": "Face analysis completed successfully.",
        "FACE_ANALYSIS_COMPLETED_WITH_WARNINGS": "Face analysis completed with advisory notes.",
        "BATCH_COMPLETED": "Batch face analysis completed successfully.",
        "BATCH_COMPLETED_WITH_WARNINGS": "Batch face analysis completed with some frame-level issues.",
        "FACE_CONFIDENCE_OK": "Face analysis returned without active warning flags.",
        "FACE_CONFIDENCE_LOW": "Low-confidence face-like region retained as data.",
    },
    "starfleet": {
        "FACE_ANALYSIS_COMPLETED": "Face analysis complete. Visual sensors report stable results.",
        "FACE_ANALYSIS_COMPLETED_WITH_WARNINGS": "Face analysis complete. Sensors suggest a few advisory flags for the bridge log.",
        "BATCH_COMPLETED": "Batch face analysis complete. Sensor sweep reports a steady result set.",
        "BATCH_COMPLETED_WITH_WARNINGS": "Batch face analysis complete. A few frames request a closer bridge review.",
        "FACE_CONFIDENCE_OK": "Visual sensors report a stable facial readout.",
        "FACE_CONFIDENCE_LOW": "Sensors retained a low-confidence face-like signal for review.",
    },
}

WARNING_STYLE_MESSAGES = {
    "starfleet": {
        "FACE_WORKER_FAILED": "Face analysis is off the board for this image right now. Recommend another sensor pass.",
        "NO_FACE_DATA": "Sensors completed their sweep, but no facial data came back from this image.",
        "LOW_FACE_CONFIDENCE": "Sensors detected a face-like region, but confidence is currently low.",
        "PARTIAL_FACE_VISIBILITY": "Visual sensors show only a partial facial profile, likely due to motion or side-angle visibility.",
        "WHOLE_FRAME_FACE_REGION": "The model appears to have used a broad sensor fallback region, so this frame merits caution.",
        "BATCH_FRAME_FAILURE": "Most frames cleared the scan, but at least one frame still wants a closer look.",
    },
}


def _utc_now_iso():
    """
    Return current UTC time in ISO 8601 format.
    """
    return datetime.now(timezone.utc).isoformat()


def _normalize_style_mode(style_mode):
    if style_mode not in STYLE_MESSAGES:
        return "plain"
    return style_mode


def _style_message(key, style_mode="plain"):
    style_mode = _normalize_style_mode(style_mode)
    return STYLE_MESSAGES[style_mode][key]


def _warning_payload(code, style_mode="plain"):
    details = WARNING_MESSAGES[code]
    style_mode = _normalize_style_mode(style_mode)
    style_message = details["user_message"]
    if style_mode != "plain":
        style_message = WARNING_STYLE_MESSAGES.get(style_mode, {}).get(code, details["user_message"])
    return {
        "code": code,
        "technical_note": details["technical_note"],
        "user_message": details["user_message"],
        "style_message": style_message,
    }


def _collect_face_warnings(face, style_mode="plain"):
    warnings = []
    region = face.get("region", {}) or {}
    confidence = face.get("face_confidence")
    left_eye = region.get("left_eye")
    right_eye = region.get("right_eye")
    x = region.get("x") or 0
    y = region.get("y") or 0

    if confidence is not None and confidence <= 0:
        warnings.append(_warning_payload("LOW_FACE_CONFIDENCE", style_mode=style_mode))

    if not left_eye or not right_eye:
        warnings.append(_warning_payload("PARTIAL_FACE_VISIBILITY", style_mode=style_mode))

    if x == 0 and y == 0:
        warnings.append(_warning_payload("WHOLE_FRAME_FACE_REGION", style_mode=style_mode))

    return warnings


def _collect_result_warnings(normalized_faces):
    warnings = []
    seen_codes = set()

    for face in normalized_faces:
        for warning in face.get("warnings", []):
            if warning["code"] in seen_codes:
                continue
            seen_codes.add(warning["code"])
            warnings.append(warning)

    return warnings


def _flatten_face(face, image_path, source_timestamp=None, analysis_timestamp=None, face_index=None):
    """
    Convert one normalized face result into a flat dictionary
    suitable for CSV export.
    """
    region = face.get("region", {}) or {}

    x = region.get("x")
    y = region.get("y")
    w = region.get("w")
    h = region.get("h")

    center_x = x + w / 2 if x is not None and w is not None else None
    center_y = y + h / 2 if y is not None and h is not None else None
    box_area = w * h if w is not None and h is not None else None

    left_eye = region.get("left_eye")
    right_eye = region.get("right_eye")

    return {
        "image_path": str(image_path),
        "face_index": face_index,
        "source_timestamp": source_timestamp,
        "analysis_timestamp": analysis_timestamp,
        "age": face.get("age"),
        "dominant_gender": face.get("dominant_gender"),
        "dominant_emotion": face.get("dominant_emotion"),
        "dominant_race": face.get("dominant_race"),
        "face_confidence": face.get("face_confidence"),
        "region_x": x,
        "region_y": y,
        "region_w": w,
        "region_h": h,
        "box_area": box_area,
        "center_x": center_x,
        "center_y": center_y,
        "left_eye_x": left_eye[0] if left_eye else None,
        "left_eye_y": left_eye[1] if left_eye else None,
        "right_eye_x": right_eye[0] if right_eye else None,
        "right_eye_y": right_eye[1] if right_eye else None,
    }


def _write_faces_csv(faces, csv_path, image_path, source_timestamp=None, analysis_timestamp=None):
    """
    Write normalized face results into a CSV file.
    """
    csv_path = Path(csv_path)
    csv_path.parent.mkdir(parents=True, exist_ok=True)

    rows = []
    for idx, face in enumerate(faces):
        rows.append(
            _flatten_face(
                face=face,
                image_path=image_path,
                source_timestamp=source_timestamp,
                analysis_timestamp=analysis_timestamp,
                face_index=idx
            )
        )


    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)


def analyze_face_image(
    image_path,
    output_path="tmp/test_face_result.json",
    csv_path="tmp/test_face_result.csv",
    source_timestamp=None,
    style_mode="plain",
):
    """
    Run face analysis for one image and return a normalized summary.
    """
    image_path = Path(image_path)
    output_path = Path(output_path)
    csv_path = Path(csv_path)

    analysis_timestamp = _utc_now_iso()

    result = run_face_worker(image_path, output_path)

    if result["returncode"] != 0:
        warnings = [_warning_payload("FACE_WORKER_FAILED", style_mode=style_mode)]
        return {
            "success": False,
            "error": "Face worker failed",
            "error_code": "FACE_WORKER_FAILED",
            "stderr": result["stderr"],
            "stdout": result["stdout"],
            "image_path": str(image_path),
            "source_timestamp": source_timestamp,
            "analysis_timestamp": analysis_timestamp,
            "faces": [],
            "csv_path": None,
            "warnings": warnings,
            "user_message": warnings[0]["user_message"],
            "style_message": warnings[0]["style_message"],
            "style_mode": _normalize_style_mode(style_mode),
        }

    data = result.get("data") or []
    if not data:
        warnings = [_warning_payload("NO_FACE_DATA", style_mode=style_mode)]
        return {
            "success": False,
            "error": "No face data returned",
            "error_code": "NO_FACE_DATA",
            "stderr": result["stderr"],
            "stdout": result["stdout"],
            "image_path": str(image_path),
            "source_timestamp": source_timestamp,
            "analysis_timestamp": analysis_timestamp,
            "faces": [],
            "csv_path": None,
            "warnings": warnings,
            "user_message": warnings[0]["user_message"],
            "style_message": warnings[0]["style_message"],
            "style_mode": _normalize_style_mode(style_mode),
        }

    normalized_faces = []
    for idx, face in enumerate(data):
        face_warnings = _collect_face_warnings(face, style_mode=style_mode)
        normalized_faces.append({
            "face_index": idx,
            "image_path": str(image_path),
            "source_timestamp": source_timestamp,
            "analysis_timestamp": analysis_timestamp,
            "age": face.get("age"),
            "dominant_gender": face.get("dominant_gender"),
            "dominant_emotion": face.get("dominant_emotion"),
            "dominant_race": face.get("dominant_race"),
            "face_confidence": face.get("face_confidence"),
            "region": face.get("region"),
            "gender_scores": face.get("gender"),
            "emotion_scores": face.get("emotion"),
            "race_scores": face.get("race"),
            "warnings": face_warnings,
            "confidence_note": (
                _style_message("FACE_CONFIDENCE_LOW", style_mode=style_mode)
                if face_warnings else
                _style_message("FACE_CONFIDENCE_OK", style_mode=style_mode)
            ),
        })

    _write_faces_csv(
        faces=normalized_faces,
        csv_path=csv_path,
        image_path=image_path,
        source_timestamp=source_timestamp,
        analysis_timestamp=analysis_timestamp
    )

    result_warnings = _collect_result_warnings(normalized_faces)

    return {
        "success": True,
        "error": None,
        "error_code": None,
        "stderr": result["stderr"],
        "stdout": result["stdout"],
        "image_path": str(image_path),
        "source_timestamp": source_timestamp,
        "analysis_timestamp": analysis_timestamp,
        "faces": normalized_faces,
        "csv_path": str(csv_path),
        "warnings": result_warnings,
        "user_message": (
            STYLE_MESSAGES["plain"]["FACE_ANALYSIS_COMPLETED_WITH_WARNINGS"]
            if result_warnings else
            STYLE_MESSAGES["plain"]["FACE_ANALYSIS_COMPLETED"]
        ),
        "style_message": (
            _style_message("FACE_ANALYSIS_COMPLETED_WITH_WARNINGS", style_mode=style_mode)
            if result_warnings else
            _style_message("FACE_ANALYSIS_COMPLETED", style_mode=style_mode)
        ),
        "style_mode": _normalize_style_mode(style_mode),
    }


def analyze_face_images_batch(
    frame_items,
    output_dir="tmp/face_batch",
    combined_csv_path=None,
    style_mode="plain",
):
    """
    Run face analysis across multiple frame images.

    Each frame item should be a dict with:
    - image_path: path to a frame image
    - source_timestamp: optional video/frame timestamp
    - frame_index: optional frame number
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if combined_csv_path is None:
        combined_csv_path = output_dir / "face_batch_combined.csv"
    else:
        combined_csv_path = Path(combined_csv_path)
        combined_csv_path.parent.mkdir(parents=True, exist_ok=True)

    frame_results = []
    combined_rows = []

    for batch_index, frame_item in enumerate(frame_items):
        image_path = Path(frame_item["image_path"])
        frame_index = frame_item.get("frame_index", batch_index)
        source_timestamp = frame_item.get("source_timestamp")

        safe_stem = image_path.stem.replace(" ", "_")
        frame_output_path = output_dir / f"{frame_index:06d}_{safe_stem}.json"
        frame_csv_path = output_dir / f"{frame_index:06d}_{safe_stem}.csv"

        result = analyze_face_image(
            image_path=image_path,
            output_path=frame_output_path,
            csv_path=frame_csv_path,
            source_timestamp=source_timestamp,
            style_mode=style_mode,
        )

        frame_result = {
            "frame_index": frame_index,
            "image_path": str(image_path),
            "source_timestamp": source_timestamp,
            "success": result["success"],
            "error": result["error"],
            "analysis_timestamp": result["analysis_timestamp"],
            "csv_path": result["csv_path"],
            "faces": result["faces"],
            "warnings": result.get("warnings", []),
            "user_message": result.get("user_message"),
            "style_message": result.get("style_message"),
        }
        frame_results.append(frame_result)

        for face in result["faces"]:
            combined_rows.append(
                _flatten_face(
                    face=face,
                    image_path=image_path,
                    source_timestamp=source_timestamp,
                    analysis_timestamp=result["analysis_timestamp"],
                    face_index=face.get("face_index")
                )
            )

    with open(combined_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDNAMES)
        writer.writeheader()
        writer.writerows(combined_rows)

    overall_success = all(frame["success"] for frame in frame_results)
    batch_warnings = []
    if not overall_success:
        batch_warnings.append(_warning_payload("BATCH_FRAME_FAILURE", style_mode=style_mode))

    return {
        "success": overall_success,
        "error": None if overall_success else "One or more frame analyses failed",
        "error_code": None if overall_success else "BATCH_FRAME_FAILURE",
        "output_dir": str(output_dir),
        "combined_csv_path": str(combined_csv_path),
        "frames": frame_results,
        "warnings": batch_warnings,
        "user_message": (
            STYLE_MESSAGES["plain"]["BATCH_COMPLETED_WITH_WARNINGS"]
            if batch_warnings else
            STYLE_MESSAGES["plain"]["BATCH_COMPLETED"]
        ),
        "style_message": (
            _style_message("BATCH_COMPLETED_WITH_WARNINGS", style_mode=style_mode)
            if batch_warnings else
            _style_message("BATCH_COMPLETED", style_mode=style_mode)
        ),
        "style_mode": _normalize_style_mode(style_mode),
    }
