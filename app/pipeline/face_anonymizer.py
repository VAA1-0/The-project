import json
from datetime import datetime, timezone
from pathlib import Path

import cv2


def _clamp_region(region, width, height):
    x = int(region.get("x", 0) or 0)
    y = int(region.get("y", 0) or 0)
    w = int(region.get("w", 0) or 0)
    h = int(region.get("h", 0) or 0)

    if w <= 0 or h <= 0:
        return None

    x = max(0, min(x, width))
    y = max(0, min(y, height))
    x2 = max(x, min(x + w, width))
    y2 = max(y, min(y + h, height))

    if x2 <= x or y2 <= y:
        return None

    return x, y, x2, y2


def _blur_region(image, bounds):
    x1, y1, x2, y2 = bounds
    roi = image[y1:y2, x1:x2]
    if roi.size == 0:
        return image

    blurred = cv2.GaussianBlur(roi, (51, 51), 30)
    image[y1:y2, x1:x2] = blurred
    return image


def anonymize_face_image(image_path, faces, output_path):
    """
    Blur all reported face regions in one image and save the result.
    """
    image_path = Path(image_path)
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    image = cv2.imread(str(image_path))
    if image is None:
        return {
            "success": False,
            "error": f"Could not read image: {image_path}",
            "image_path": str(image_path),
            "output_path": None,
            "faces_applied": 0,
        }

    image_height, image_width = image.shape[:2]
    faces_applied = 0

    for face in faces:
        region = face.get("region") or {}
        bounds = _clamp_region(region, image_width, image_height)
        if bounds is None:
            continue
        image = _blur_region(image, bounds)
        faces_applied += 1

    cv2.imwrite(str(output_path), image)

    return {
        "success": True,
        "error": None,
        "image_path": str(image_path),
        "output_path": str(output_path),
        "faces_applied": faces_applied,
    }


def anonymize_face_batch_results(face_batch_result, output_dir="tmp/face_anonymized"):
    """
    Apply anonymization to each frame described by a face batch result.

    This is intentionally downstream and opt-in. It should only be called
    when a user explicitly enables anonymization from the frontend.
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    frame_outputs = []
    for frame_result in face_batch_result.get("frames", []):
        image_path = Path(frame_result["image_path"])
        output_path = output_dir / image_path.name
        anonymized = anonymize_face_image(
            image_path=image_path,
            faces=frame_result.get("faces", []),
            output_path=output_path,
        )
        anonymized.update({
            "frame_index": frame_result.get("frame_index"),
            "source_timestamp": frame_result.get("source_timestamp"),
        })
        frame_outputs.append(anonymized)

    manifest_path = output_dir / "anonymization_manifest.json"
    manifest = {
        "success": all(item["success"] for item in frame_outputs) if frame_outputs else True,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "output_dir": str(output_dir),
        "frames": frame_outputs,
    }

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    manifest["manifest_path"] = str(manifest_path)
    return manifest
