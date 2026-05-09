"""Governed starter contracts for AI-agent-adjacent VAA1 features.

The functions here intentionally avoid network calls and heavyweight runtime
dependencies. They give VAA1 stable, testable boundaries for the feature
families described in the selected AI Agent report, while keeping licensing,
provenance, and analyst authority explicit.
"""

from __future__ import annotations

import difflib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlencode


PERMISSIVE_LICENSES = {"mit", "apache-2.0", "apache 2.0", "bsd", "bsd-3-clause", "cc0"}
ISOLATE_LICENSES = {"gpl", "gpl-2.0", "gpl-3.0", "agpl", "agpl-3.0", "mpl", "mpl-2.0"}


@dataclass(frozen=True)
class ComponentCandidate:
    name: str
    license: str
    role: str
    integration_policy: str = "core_allowed"


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
            candidates.append(
                {
                    "name": candidate.name,
                    "license": candidate.license,
                    "role": candidate.role,
                    "integration_policy": candidate.integration_policy,
                    "license_policy": policy["policy"],
                    "core_compatible": policy["compatible"]
                    and candidate.integration_policy == "core_allowed",
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
