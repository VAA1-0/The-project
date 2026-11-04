"""Governed starter contracts for AI-agent-adjacent VAA1 features.

The functions here intentionally avoid network calls and heavyweight runtime
dependencies. They give VAA1 stable, testable boundaries for the feature
families described in the selected AI Agent report, while keeping licensing,
provenance, and analyst authority explicit.
"""

from __future__ import annotations

import difflib
import importlib.util
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlencode

from src.backend.analysis.object_appearance_embedding import model_runtime_state as object_appearance_runtime_state

PERMISSIVE_LICENSES = {"mit", "apache-2.0", "apache 2.0", "bsd", "bsd-3-clause", "cc0"}
ISOLATE_LICENSES = {"gpl", "gpl-2.0", "gpl-3.0", "agpl", "agpl-3.0", "mpl", "mpl-2.0"}


def face_model_runtime_state() -> Dict[str, Any]:
    root = Path(__file__).resolve().parents[3] / "models" / "face"
    filenames = (
        "face_detection_yunet_2023mar.onnx",
        "face_recognition_sface_2021dec.onnx",
    )
    missing = [str(root / filename) for filename in filenames if not (root / filename).is_file()]
    return {
        "available": not missing,
        "model_dir": str(root),
        "missing": missing,
        "network_access": "disabled_by_design",
        "installation_command": "python scripts/install_face_measurement_models.py",
    }


def _module_runtime(module: str, *, model_files: Iterable[Path] = (), installation_command: str = "") -> Dict[str, Any]:
    files = [Path(path) for path in model_files]
    missing_files = [str(path) for path in files if not path.is_file()]
    try:
        package_ready = importlib.util.find_spec(module) is not None
    except (ImportError, ModuleNotFoundError, AttributeError):
        package_ready = False
    available = package_ready and not missing_files
    missing = ([] if package_ready else [f"python package: {module}"]) + missing_files
    return {
        "available": available,
        "package_available": package_ready,
        "model_files": [str(path) for path in files],
        "missing": missing,
        "network_access": "disabled_by_design",
        "installation_command": installation_command or None,
        "readiness": "installed_and_ready" if available else ("weights_required" if package_ready else "package_and_weights_required"),
    }


def component_runtime_state(candidate_name: str) -> Optional[Dict[str, Any]]:
    root = Path(__file__).resolve().parents[3]
    cache = Path.home() / ".cache" / "torch" / "hub" / "checkpoints"
    if candidate_name == "OpenCV YuNet + SFace":
        return face_model_runtime_state()
    if candidate_name == "pyannote.audio Community-1":
        state = _module_runtime(
            "pyannote.audio",
            installation_command="install pyannote.audio in an isolated compatible runtime, accept the selected gated model terms, and configure a user-owned Hugging Face token",
        )
        state.update({
            "activation_required": True,
            "external_model_terms_required": True,
            "user_owned_hugging_face_token_required": True,
            "readiness": "installed_activation_required" if state["available"] else state["readiness"],
        })
        return state
    if candidate_name == "Datascene native diarization scaffold":
        return {
            "available": True,
            "package_available": True,
            "model_files": [],
            "missing": [],
            "network_access": "disabled_by_design",
            "installation_command": None,
            "readiness": "installed_and_ready",
        }
    if candidate_name == "Datascene Native Object Appearance v1":
        return object_appearance_runtime_state()
    if candidate_name == "Ultralytics YOLOv8n":
        state = _module_runtime("ultralytics", model_files=[root / "models" / "yolov8n.pt"])
        state.update({"activation_required": True, "readiness": "installed_activation_required" if state["available"] else state["readiness"]})
        return state
    if candidate_name == "Torchvision Faster R-CNN MobileNetV3":
        return _module_runtime(
            "torchvision",
            model_files=[cache / "fasterrcnn_mobilenet_v3_large_320_fpn-907ea3f9.pth"],
            installation_command="install/checksum-pin FasterRCNN_MobileNet_V3_Large_320_FPN_Weights.COCO_V1",
        )
    if candidate_name == "Detectron2 Faster R-CNN":
        return _module_runtime("detectron2", installation_command="install Detectron2 and explicitly licensed/checksum-pinned weights")
    if candidate_name == "IDEA-Research DINO detector":
        return _module_runtime("detrex", installation_command="install the DINO/detrex provider and explicitly licensed/checksum-pinned weights")
    if candidate_name == "YOLO-NAS":
        return _module_runtime("super_gradients", installation_command="install SuperGradients and activate weights under their separate licence")
    if candidate_name == "TensorFlow EfficientDet D0":
        return _module_runtime("official", installation_command="install TensorFlow Model Garden and checksum-pin its Apache-2.0 EfficientDet D0 checkpoint")
    if candidate_name == "Meta DETR ResNet-50":
        state = _module_runtime(
            "transformers",
            model_files=[
                root / "models" / "object" / "detr-resnet-50" / "config.json",
                root / "models" / "object" / "detr-resnet-50" / "preprocessor_config.json",
                root / "models" / "object" / "detr-resnet-50" / "model.safetensors",
                root / "models" / "object" / "detr-resnet-50" / "datascene_model_manifest.json",
            ],
            installation_command="install/checksum-pin the Apache-2.0 DETR ResNet-50 repository checkpoint into models/object/detr-resnet-50",
        )
        state["timm_available"] = importlib.util.find_spec("timm") is not None
        state["available"] = bool(state["available"] and state["timm_available"])
        if not state["timm_available"]:
            state["missing"].append("python package: timm")
            state["readiness"] = "package_required"
        return state
    if candidate_name == "DINOv2 ViT-S/14":
        return _module_runtime("dinov2", installation_command="install and checksum-pin the Apache-2.0 DINOv2 ViT-S/14 weights")
    if candidate_name == "Torchvision ResNet-18 appearance features":
        return _module_runtime(
            "torchvision",
            model_files=[cache / "resnet18-f37072fd.pth"],
            installation_command="review ImageNet weight terms, then install/checksum-pin ResNet18_Weights.IMAGENET1K_V1",
        )
    return None


@dataclass(frozen=True)
class ComponentCandidate:
    name: str
    license: str
    role: str
    integration_policy: str = "core_allowed"


COMPONENT_LITERATURE: Dict[str, List[Dict[str, Any]]] = {
    "pyannote.audio Community-1": [{
        "title": "pyannote.audio: neural building blocks for speaker diarization",
        "url": "https://doi.org/10.1109/ICASSP40776.2020.9052974",
        "peer_reviewed": True,
    }],
    "OpenCV YuNet + SFace": [
        {
            "title": "YuNet: A Tiny Millisecond-level Face Detector",
            "url": "https://doi.org/10.1007/s11633-023-1423-y",
            "peer_reviewed": True,
        },
        {
            "title": "SFace: Sigmoid-Constrained Hypersphere Loss for Robust Face Recognition",
            "url": "https://doi.org/10.1109/TIP.2020.3048632",
            "peer_reviewed": True,
        },
    ],
    "Datascene Native Object Appearance v1": [{
        "title": "Histograms of Oriented Gradients for Human Detection",
        "url": "https://doi.org/10.1109/CVPR.2005.177",
        "peer_reviewed": True,
    }],
    "Ultralytics YOLOv8n": [{
        "title": "Ultralytics YOLO documentation and licence",
        "url": "https://docs.ultralytics.com/",
        "peer_reviewed": False,
    }],
    "Torchvision Faster R-CNN MobileNetV3": [{
        "title": "Faster R-CNN: Towards Real-Time Object Detection with Region Proposal Networks",
        "url": "https://proceedings.neurips.cc/paper/2015/hash/14bfa6bb14875e45bba028a21ed38046-Abstract.html",
        "peer_reviewed": True,
    }],
    "Detectron2 Faster R-CNN": [{
        "title": "Detectron2 model zoo and documentation",
        "url": "https://github.com/facebookresearch/detectron2/blob/main/MODEL_ZOO.md",
        "peer_reviewed": False,
    }],
    "IDEA-Research DINO detector": [{
        "title": "DINO: DETR with Improved DeNoising Anchor Boxes for End-to-End Object Detection",
        "url": "https://openreview.net/forum?id=3mRwyG5one",
        "peer_reviewed": True,
    }],
    "YOLO-NAS": [{
        "title": "SuperGradients model repository and YOLO-NAS technical record",
        "url": "https://doi.org/10.5281/zenodo.7789328",
        "peer_reviewed": False,
    }],
    "TensorFlow EfficientDet D0": [{
        "title": "EfficientDet: Scalable and Efficient Object Detection",
        "url": "https://doi.org/10.1109/CVPR42600.2020.01081",
        "peer_reviewed": True,
    }],
    "Meta DETR ResNet-50": [{
        "title": "End-to-End Object Detection with Transformers",
        "url": "https://doi.org/10.1007/978-3-030-58452-8_13",
        "peer_reviewed": True,
    }],
    "DINOv2 ViT-S/14": [{
        "title": "DINOv2: Learning Robust Visual Features without Supervision",
        "url": "https://openreview.net/forum?id=a68SUt6zFt",
        "peer_reviewed": True,
    }],
    "Torchvision ResNet-18 appearance features": [{
        "title": "Deep Residual Learning for Image Recognition",
        "url": "https://doi.org/10.1109/CVPR.2016.90",
        "peer_reviewed": True,
    }],
    "Wikidata structured data": [{
        "title": "Wikidata: a free collaborative knowledgebase",
        "url": "https://doi.org/10.1145/2629489",
        "peer_reviewed": True,
    }],
    "Haystack": [{
        "title": "Haystack: A Framework for Scalable End-to-End Question Answering",
        "url": "https://aclanthology.org/2020.emnlp-demos.30/",
        "peer_reviewed": True,
    }],
    "FAISS": [{
        "title": "Billion-scale similarity search with GPUs",
        "url": "https://doi.org/10.1109/BigData.2017.8251892",
        "peer_reviewed": True,
    }],
    "scikit-learn": [{
        "title": "Scikit-learn: Machine Learning in Python",
        "url": "https://jmlr.org/papers/v12/pedregosa11a.html",
        "peer_reviewed": True,
    }],
    "PyTorch": [{
        "title": "PyTorch: An Imperative Style, High-Performance Deep Learning Library",
        "url": "https://proceedings.neurips.cc/paper/2019/hash/bdbca288fee7f92f2bfa9f7012727740-Abstract.html",
        "peer_reviewed": True,
    }],
    "TensorFlow": [{
        "title": "TensorFlow: A System for Large-Scale Machine Learning",
        "url": "https://www.usenix.org/conference/osdi16/technical-sessions/presentation/abadi",
        "peer_reviewed": True,
    }],
}


@dataclass(frozen=True)
class FeatureStarter:
    feature_id: str
    title: str
    purpose: str
    starter_boundary: str
    candidates: List[ComponentCandidate]
    immediate_action: str


FEATURE_STARTERS: List[FeatureStarter] = [
    FeatureStarter(
        feature_id="speaker_diarization",
        title="Speaker diarization provider",
        purpose="Measure source-linked speech turns and acoustic speaker clusters without treating technical speaker labels as Narrative Agents.",
        starter_boundary="Provider selection is explicit. pyannote code is permissive, while gated pretrained pipelines require analyst-owned model acceptance and credentials; missing runtimes fail closed and existing diarization evidence remains readable.",
        candidates=[
            ComponentCandidate("pyannote.audio Community-1", "MIT code / gated model terms", "optional high-quality local speaker diarization", "explicit_activation_isolated"),
            ComponentCandidate("Datascene native diarization scaffold", "Apache-2.0 / BSD-3-Clause", "current local VAD, acoustic clustering and provenance-safe fallback"),
        ],
        immediate_action="Keep the native scaffold active; expose pyannote.audio as an analyst-selected optional provider and mitigate dependency, token, model-terms, timing-parity and packaged-runtime requirements before activation.",
    ),
    FeatureStarter(
        feature_id="object_detection",
        title="Object detection provider",
        purpose="Create source-linked object boxes and raw detector observations without treating a detector label as analyst truth.",
        starter_boundary="Provider selection is explicit. Missing, unactivated, or licence-sensitive detectors fail closed and existing observations remain readable.",
        candidates=[
            ComponentCandidate("Ultralytics YOLOv8n", "AGPL-3.0 / Enterprise", "currently installed COCO object detector", "explicit_activation_isolated"),
            ComponentCandidate("Torchvision Faster R-CNN MobileNetV3", "BSD-3-Clause / pretrained-weights-review-required", "permissive-framework CPU detector alternative", "weights_review_required"),
            ComponentCandidate("Detectron2 Faster R-CNN", "Apache-2.0 / weights-review-required", "second-iteration configurable detector", "weights_review_required"),
            ComponentCandidate("IDEA-Research DINO detector", "Apache-2.0 / checkpoint-review-required", "higher-accuracy non-real-time detector", "weights_review_required"),
            ComponentCandidate("YOLO-NAS", "Apache-2.0 code / restricted pretrained weights", "second-iteration speed/accuracy alternative", "isolate_service_only"),
            ComponentCandidate("TensorFlow EfficientDet D0", "Apache-2.0", "documented efficient permissive code-and-checkpoint detector alternative"),
            ComponentCandidate("Meta DETR ResNet-50", "Apache-2.0", "permissive code-and-checkpoint end-to-end transformer detector alternative"),
        ],
        immediate_action="Run the checksum-pinned Meta DETR adapter by default; keep YOLOv8 and other licence-sensitive providers visible but activated only by explicit analyst choice.",
    ),
    FeatureStarter(
        feature_id="object_appearance_embedding",
        title="Measured object appearance embedding",
        purpose="Measure colour, structure and texture resemblance across source-linked object tracks for cluster exploration.",
        starter_boundary="Similarity creates candidates only. Detector confidence is not appearance similarity, and only analyst confirmation creates mature semantic object data.",
        candidates=[
            ComponentCandidate("Datascene Native Object Appearance v1", "Apache-2.0 / BSD-3-Clause", "operational local HSV/Lab/HOG/luminance appearance measurement"),
            ComponentCandidate("DINOv2 ViT-S/14", "Apache-2.0", "second-iteration learned visual retrieval embedding", "weights_review_required"),
            ComponentCandidate("Torchvision ResNet-18 appearance features", "BSD-3-Clause / pretrained-weights-review-required", "second-iteration compact learned appearance baseline", "weights_review_required"),
        ],
        immediate_action="Run the native measured motor now; install and calibrate learned providers only through explicit model setup.",
    ),
    FeatureStarter(
        feature_id="facial_landmark_embedding",
        title="Facial landmark and embedding measurement",
        purpose="Measure five-point facial landmarks and local embeddings for Narrative Agent candidate discrimination.",
        starter_boundary="Local measurements remain candidates until analyst confirmation; biometric derivatives are withheld from export by default.",
        candidates=[
            ComponentCandidate(
                "OpenCV YuNet + SFace",
                "MIT / Apache-2.0",
                "five-point face localisation and SFace embedding discrimination",
            ),
        ],
        immediate_action="Install checksum-verified local weights, measure source-linked crops, and retain ambiguous candidates for review.",
    ),
    FeatureStarter(
        feature_id="metadata_harvesting",
        title="Automated metadata harvesting",
        purpose="Collect source metadata from archive, library, museum, and public entity sources.",
        starter_boundary="Build source request seeds and normalized provenance records; do not crawl by default.",
        candidates=[
            ComponentCandidate("Wikidata structured data", "CC0", "entity enrichment"),
            ComponentCandidate("IMDb public/title lookup", "review_required", "film and TV reference lookup", "review_required"),
            ComponentCandidate("DSpace REST/OAI-PMH", "BSD", "repository metadata"),
            ComponentCandidate("OpenMetadata", "Apache-2.0", "metadata governance catalog"),
            ComponentCandidate("Internet Archive Python library", "AGPL-3.0", "archive access", "isolate_service_only"),
        ],
        immediate_action="Create non-network metadata harvest seeds and provenance schema.",
    ),
    FeatureStarter(
        feature_id="webpage_comparison",
        title="Webpage comparison",
        purpose="Compare webpage snapshots across text, structure, links, and later visual captures.",
        starter_boundary="Accept captured HTML snapshots and produce deterministic text/link diffs.",
        candidates=[
            ComponentCandidate("Playwright", "Apache-2.0", "browser capture"),
            ComponentCandidate("diff-dom-streaming", "MIT", "DOM diff"),
            ComponentCandidate("BackstopJS", "MIT", "visual diff"),
            ComponentCandidate("Wayback-Diff", "GPL-3.0", "historical diff", "isolate_service_only"),
        ],
        immediate_action="Create snapshot and diff contracts without adding browser dependencies.",
    ),
    FeatureStarter(
        feature_id="llm_gateway_rag",
        title="LLM gateway and RAG boundary",
        purpose="Prepare optional external or local LLM annotations with provenance and opt-in governance.",
        starter_boundary="Build request envelopes only; no hidden API call or provider lock-in.",
        candidates=[
            ComponentCandidate("LangChain", "MIT", "LLM orchestration"),
            ComponentCandidate("LlamaIndex", "MIT", "RAG retrieval"),
            ComponentCandidate("Haystack", "Apache-2.0", "production RAG pipelines"),
            ComponentCandidate("FAISS", "MIT", "offline vector search"),
        ],
        immediate_action="Create provider-neutral annotation request envelope.",
    ),
    FeatureStarter(
        feature_id="report_writer",
        title="Report-writing agent",
        purpose="Render VAA1 evidence into auditable Markdown, HTML, DOCX, or PDF reports.",
        starter_boundary="Render Markdown from structured sections and evidence references.",
        candidates=[
            ComponentCandidate("python-docx", "MIT", "DOCX export"),
            ComponentCandidate("ReportLab", "BSD", "PDF export"),
            ComponentCandidate("Jinja2", "BSD", "templating"),
            ComponentCandidate("Pandoc", "GPL-2.0", "document conversion", "external_command_only"),
        ],
        immediate_action="Create Markdown report renderer with evidence links.",
    ),
    FeatureStarter(
        feature_id="audio_command_interface",
        title="Audio command interface",
        purpose="Route timestamped speech commands to VAA1 navigation and annotation actions.",
        starter_boundary="Map recognized command text to safe UI intents; speech-to-text remains pluggable.",
        candidates=[
            ComponentCandidate("Whisper", "MIT", "high-accuracy transcription"),
            ComponentCandidate("Vosk", "Apache-2.0", "offline command recognition"),
            ComponentCandidate("DeepSpeech", "MPL-2.0", "legacy speech recognition", "avoid_core"),
        ],
        immediate_action="Create text-command router for play, pause, nudge, scene, and correction intents.",
    ),
    FeatureStarter(
        feature_id="native_learning_engine",
        title="Native learning and pattern accumulation",
        purpose="Capture analyst corrections as governed learning feedback without auto-overwriting truth.",
        starter_boundary="Write append-only feedback events with source, authority, and review state.",
        candidates=[
            ComponentCandidate("scikit-learn", "BSD-3-Clause", "classical pattern learning"),
            ComponentCandidate("PyTorch", "BSD", "custom deep learning"),
            ComponentCandidate("TensorFlow", "Apache-2.0", "training framework"),
            ComponentCandidate("FAISS", "MIT", "pattern recall"),
        ],
        immediate_action="Create append-only learning feedback event schema.",
    ),
]


class HtmlSnapshotParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.text_parts: List[str] = []
        self.tags: Dict[str, int] = {}
        self.links: List[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: List[tuple[str, Optional[str]]]) -> None:
        normalized = tag.lower()
        self.tags[normalized] = self.tags.get(normalized, 0) + 1
        if normalized in {"script", "style", "noscript"}:
            self._skip_depth += 1
        if normalized == "a":
            for key, value in attrs:
                if key.lower() == "href" and value:
                    self.links.append(value)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in {"script", "style", "noscript"} and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        text = " ".join(data.split())
        if text:
            self.text_parts.append(text)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def license_policy(license_name: str) -> Dict[str, Any]:
    normalized = re.sub(r"\s+", " ", str(license_name or "").strip().lower())
    components = [item.strip() for item in re.split(r"\s*(?:/|\+)\s*", normalized) if item.strip()]
    if components and all(component in PERMISSIVE_LICENSES for component in components):
        return {"compatible": True, "policy": "core_allowed"}
    if normalized in PERMISSIVE_LICENSES:
        return {"compatible": True, "policy": "core_allowed"}
    if normalized in ISOLATE_LICENSES or any(item in normalized for item in ISOLATE_LICENSES):
        return {"compatible": False, "policy": "isolate_or_avoid"}
    return {"compatible": False, "policy": "review_required"}


def build_feature_starter_manifest() -> Dict[str, Any]:
    features: List[Dict[str, Any]] = []
    for feature in FEATURE_STARTERS:
        candidates = []
        for candidate in feature.candidates:
            policy = license_policy(candidate.license)
            runtime = component_runtime_state(candidate.name)
            candidates.append(
                {
                    "name": candidate.name,
                    "license": candidate.license,
                    "role": candidate.role,
                    "integration_policy": candidate.integration_policy,
                    "license_policy": policy["policy"],
                    "core_compatible": policy["compatible"]
                    and candidate.integration_policy == "core_allowed",
                    "literature": COMPONENT_LITERATURE.get(candidate.name, []),
                    "runtime": runtime,
                }
            )
        features.append(
            {
                "feature_id": feature.feature_id,
                "title": feature.title,
                "purpose": feature.purpose,
                "starter_boundary": feature.starter_boundary,
                "immediate_action": feature.immediate_action,
                "status": "starter_contract_ready",
                "candidates": candidates,
            }
        )

    return {
        "schema": "vaa1.ai_agent_feature_starters.v1",
        "generated_at": utc_now_iso(),
        "governance": {
            "no_hidden_network_calls": True,
            "manual_correction_wins": True,
            "raw_outputs_preserved": True,
            "strong_copyleft_is_isolated_or_avoided": True,
        },
        "features": features,
    }


def write_feature_starter_manifest(output_path: Path) -> Dict[str, Any]:
    manifest = build_feature_starter_manifest()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    return manifest


def build_metadata_harvest_seed(
    *,
    source_type: str,
    base_url: str,
    query: Optional[str] = None,
    set_spec: Optional[str] = None,
    metadata_prefix: str = "oai_dc",
) -> Dict[str, Any]:
    params: Dict[str, str] = {}
    normalized_type = source_type.strip().lower()
    if normalized_type == "oai_pmh":
        params = {"verb": "ListRecords", "metadataPrefix": metadata_prefix}
        if set_spec:
            params["set"] = set_spec
    elif normalized_type == "wikidata":
        params = {"search": query or "", "language": "en", "format": "json"}
    elif normalized_type == "imdb":
        params = {"q": query or ""}
    else:
        params = {"query": query or ""}

    separator = "&" if "?" in base_url else "?"
    request_url = f"{base_url}{separator}{urlencode(params)}" if params else base_url
    return {
        "schema": "vaa1.metadata_harvest_seed.v1",
        "source_type": normalized_type,
        "request_url": request_url,
        "network_status": "not_fetched",
        "provenance": {
            "created_at": utc_now_iso(),
            "license_policy": "source_license_must_be_recorded_before_ingest",
        },
    }


def build_webpage_snapshot_record(
    *,
    url: str,
    html: str,
    captured_at: Optional[str] = None,
) -> Dict[str, Any]:
    parser = HtmlSnapshotParser()
    parser.feed(html or "")
    text = "\n".join(parser.text_parts)
    return {
        "schema": "vaa1.webpage_snapshot.v1",
        "url": url,
        "captured_at": captured_at or utc_now_iso(),
        "text": text,
        "links": sorted(set(parser.links)),
        "tag_counts": dict(sorted(parser.tags.items())),
        "provenance": {"capture_method": "provided_html", "visual_capture": "not_started"},
    }


def compare_webpage_snapshots(left: Dict[str, Any], right: Dict[str, Any]) -> Dict[str, Any]:
    left_lines = str(left.get("text") or "").splitlines()
    right_lines = str(right.get("text") or "").splitlines()
    diff_lines = list(
        difflib.unified_diff(
            left_lines,
            right_lines,
            fromfile=str(left.get("url") or "left"),
            tofile=str(right.get("url") or "right"),
            lineterm="",
        )
    )
    left_links = set(left.get("links") or [])
    right_links = set(right.get("links") or [])
    return {
        "schema": "vaa1.webpage_snapshot_diff.v1",
        "left_url": left.get("url"),
        "right_url": right.get("url"),
        "text_diff": diff_lines[:200],
        "link_changes": {
            "added": sorted(right_links - left_links),
            "removed": sorted(left_links - right_links),
        },
        "tag_delta": _tag_delta(left.get("tag_counts") or {}, right.get("tag_counts") or {}),
        "status": "completed",
    }


def build_llm_annotation_request(
    *,
    analysis_id: str,
    task: str,
    evidence_refs: Iterable[Dict[str, Any]],
    provider: str = "external_api",
    model: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "schema": "vaa1.llm_annotation_request.v1",
        "analysis_id": analysis_id,
        "task": task,
        "provider": provider,
        "model": model,
        "execution_status": "prepared_not_sent",
        "governance": {
            "requires_explicit_operator_enablement": True,
            "llm_output_is_annotation_not_detection_truth": True,
            "must_return_source_citations": True,
            "manual_correction_wins": True,
        },
        "evidence_refs": list(evidence_refs),
    }


def render_report_markdown(
    *,
    title: str,
    sections: Iterable[Dict[str, Any]],
    evidence_refs: Optional[Iterable[Dict[str, Any]]] = None,
) -> str:
    lines = [f"# {title.strip() or 'VAA1 Report'}", "", "Generated by VAA1 report starter.", ""]
    for section in sections:
        heading = str(section.get("heading") or "Section").strip()
        body = str(section.get("body") or "").strip()
        lines.extend([f"## {heading}", "", body or "No narrative text supplied.", ""])
    refs = list(evidence_refs or [])
    if refs:
        lines.extend(["## Evidence References", ""])
        for ref in refs:
            label = ref.get("label") or ref.get("evidence_id") or "evidence"
            target = ref.get("target") or ref.get("time") or ref.get("url") or ""
            lines.append(f"- {label}: {target}")
        lines.append("")
    return "\n".join(lines)


def route_audio_command(text: str) -> Dict[str, Any]:
    normalized = " ".join(str(text or "").lower().split())
    action = "unrecognized"
    payload: Dict[str, Any] = {}
    if normalized in {"play", "start", "resume"}:
        action = "video.play"
    elif normalized in {"pause", "stop"}:
        action = "video.pause"
    elif "scene card" in normalized:
        action = "panel.open"
        payload["panel"] = "SceneCards"
    elif "correct" in normalized or "correction" in normalized:
        action = "annotation.correct"
    elif "back" in normalized or "left" in normalized:
        action = "video.nudge"
        payload["seconds"] = -1.0
    elif "forward" in normalized or "right" in normalized:
        action = "video.nudge"
        payload["seconds"] = 1.0
    return {
        "schema": "vaa1.audio_command_intent.v1",
        "input_text": text,
        "normalized_text": normalized,
        "action": action,
        "payload": payload,
        "review_state": "safe_intent" if action != "unrecognized" else "needs_review",
    }


def build_learning_feedback_event(
    *,
    analysis_id: str,
    evidence_id: str,
    analyst_action: str,
    label: str,
    authority: str = "manual_correction",
    notes: str = "",
) -> Dict[str, Any]:
    return {
        "schema": "vaa1.learning_feedback_event.v1",
        "event_id": f"learning:{analysis_id}:{evidence_id}:{utc_now_iso()}",
        "analysis_id": analysis_id,
        "evidence_id": evidence_id,
        "analyst_action": analyst_action,
        "label": label,
        "authority": authority,
        "notes": notes,
        "created_at": utc_now_iso(),
        "governance": {
            "append_only": True,
            "does_not_mutate_raw_detection": True,
            "eligible_for_pattern_accumulation": analyst_action in {"confirm", "correct", "merge"},
        },
    }


def write_learning_feedback_event(output_path: Path, event: Dict[str, Any]) -> Dict[str, Any]:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False) + "\n")
    return event


def _tag_delta(left: Dict[str, Any], right: Dict[str, Any]) -> Dict[str, int]:
    tags = sorted(set(left) | set(right))
    return {tag: int(right.get(tag, 0)) - int(left.get(tag, 0)) for tag in tags}
