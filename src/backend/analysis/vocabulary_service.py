"""Versioned vocabulary resolution for canonical Datascene attributes."""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any, Dict, Iterable


DEFAULT_REGISTRY_PATH = (
    Path(__file__).resolve().parents[3] / "docs" / "inventory" / "vocabulary_registry.json"
)


class VocabularyError(ValueError):
    pass


def load_vocabulary_registry(path: str | Path | None = None) -> Dict[str, Any]:
    registry_path = Path(path) if path else DEFAULT_REGISTRY_PATH
    payload = json.loads(registry_path.read_text(encoding="utf-8"))
    validate_vocabulary_registry(payload)
    return payload


def validate_vocabulary_registry(payload: Dict[str, Any]) -> None:
    vocabularies = payload.get("vocabularies")
    if not isinstance(vocabularies, list) or not vocabularies:
        raise VocabularyError("vocabularies must be a non-empty list")
    seen_vocabularies: set[tuple[str, str]] = set()
    for vocabulary in vocabularies:
        vocabulary_id = str(vocabulary.get("vocabulary_id") or "").strip()
        version = str(vocabulary.get("version") or "").strip()
        if not vocabulary_id or not version:
            raise VocabularyError("Every vocabulary requires vocabulary_id and version")
        key = (vocabulary_id, version)
        if key in seen_vocabularies:
            raise VocabularyError(f"Duplicate vocabulary version: {vocabulary_id}@{version}")
        seen_vocabularies.add(key)
        terms = vocabulary.get("terms")
        if not isinstance(terms, list):
            raise VocabularyError(f"Vocabulary {vocabulary_id}@{version} requires terms")
        term_ids = [str(term.get("term_id") or "").strip() for term in terms]
        if any(not term_id for term_id in term_ids) or len(term_ids) != len(set(term_ids)):
            raise VocabularyError(f"Vocabulary {vocabulary_id}@{version} has invalid term ids")


def list_vocabularies(registry: Dict[str, Any]) -> list[Dict[str, Any]]:
    return [
        {
            "vocabulary_id": item["vocabulary_id"],
            "version": item["version"],
            "term_count": len(item.get("terms") or []),
            "extension_policy": item.get("extension_policy"),
        }
        for item in registry.get("vocabularies", [])
    ]


def _select_vocabulary(
    registry: Dict[str, Any], vocabulary_id: str, version: str | None = None
) -> Dict[str, Any]:
    matches = [
        item
        for item in registry.get("vocabularies", [])
        if item.get("vocabulary_id") == vocabulary_id
        and (version is None or item.get("version") == version)
    ]
    if not matches:
        suffix = f"@{version}" if version else ""
        raise VocabularyError(f"Unknown vocabulary: {vocabulary_id}{suffix}")
    if version is None and len(matches) > 1:
        active = [item for item in matches if item.get("status", "active") == "active"]
        if len(active) != 1:
            raise VocabularyError(f"Vocabulary version is ambiguous: {vocabulary_id}")
        return active[0]
    return matches[0]


def resolve_term(
    registry: Dict[str, Any],
    vocabulary_id: str,
    term_id: str,
    *,
    version: str | None = None,
    language: str = "en",
    follow_replacement: bool = True,
) -> Dict[str, Any]:
    vocabulary = _select_vocabulary(registry, vocabulary_id, version)
    terms = {str(item.get("term_id")): item for item in vocabulary.get("terms", [])}
    term = terms.get(term_id)
    if term is None:
        raise VocabularyError(f"Unknown term: {vocabulary_id}:{term_id}")
    requested_term_id = term_id
    replacement_path: list[str] = []
    while follow_replacement and term.get("deprecated") and term.get("replaced_by"):
        replacement_path.append(str(term["term_id"]))
        replacement_id = str(term["replaced_by"])
        if replacement_id in replacement_path or replacement_id not in terms:
            raise VocabularyError(f"Invalid replacement lineage in {vocabulary_id}:{term_id}")
        term = terms[replacement_id]
    labels = term.get("labels") if isinstance(term.get("labels"), dict) else {}
    label = labels.get(language) or term.get("preferred_label") or term["term_id"]
    return {
        "vocabulary_id": vocabulary_id,
        "vocabulary_version": vocabulary["version"],
        "requested_term_id": requested_term_id,
        "term_id": term["term_id"],
        "preferred_label": label,
        "language": language,
        "deprecated": bool(term.get("deprecated")),
        "replacement_path": replacement_path,
        "broader_term_ids": list(term.get("broader_term_ids") or []),
        "definition": term.get("definition"),
    }


def canonical_term_value(term_ref: Dict[str, Any]) -> str:
    return (
        f"{term_ref['vocabulary_id']}@{term_ref['vocabulary_version']}:"
        f"{term_ref['term_id']}"
    )


def referenced_term_ids(items: Iterable[Dict[str, Any]]) -> set[str]:
    return {canonical_term_value(item) for item in items}


def public_registry(registry: Dict[str, Any]) -> Dict[str, Any]:
    return copy.deepcopy(registry)
