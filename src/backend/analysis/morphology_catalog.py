from __future__ import annotations

from typing import Any, Optional

from src.backend.analysis.language_capability_registry import (
    get_language_capability,
    list_language_capabilities,
)
from src.backend.analysis.language_utils import (
    SPACY_MODEL_ALIASES,
    is_spacy_model_available,
    language_display_name,
    normalize_language_code,
)


EU_OFFICIAL_LANGUAGE_CODES = {
    "bg",
    "cs",
    "da",
    "de",
    "el",
    "en",
    "es",
    "et",
    "fi",
    "fr",
    "ga",
    "hr",
    "hu",
    "it",
    "lt",
    "lv",
    "mt",
    "nl",
    "pl",
    "pt",
    "ro",
    "sk",
    "sl",
    "sv",
}

UN_OFFICIAL_LANGUAGE_CODES = {"ar", "zh", "en", "fr", "ru", "es"}

RECOMMENDED_EXTRA_LANGUAGE_CODES = {
    "fa",
    "he",
    "hi",
    "ja",
    "no",
    "tr",
    "uk",
}


def morphology_catalog_entry(language_code: str) -> dict[str, Any]:
    code = normalize_language_code(language_code) or language_code
    capability = get_language_capability(code)
    spacy_model = SPACY_MODEL_ALIASES.get(code)
    installed = bool(spacy_model and is_spacy_model_available(spacy_model))
    has_named_pipeline = bool(spacy_model)

    if installed:
        local_status = "installed"
    elif has_named_pipeline:
        local_status = "declared_but_not_installed"
    else:
        local_status = "rough_interpretation_only"

    return {
        "code": code,
        "name": language_display_name(code),
        "spacy_model": spacy_model,
        "has_named_pipeline": has_named_pipeline,
        "installed": installed,
        "local_status": local_status,
        "current_support": capability.get("current_support", {}),
        "target_support": capability.get("target_support", {}),
        "is_eu_official": code in EU_OFFICIAL_LANGUAGE_CODES,
        "is_un_official": code in UN_OFFICIAL_LANGUAGE_CODES,
        "is_recommended_extra": code in RECOMMENDED_EXTRA_LANGUAGE_CODES,
        "notes": capability.get("notes", []),
        "future_feed_repair_ready": True,
    }


def list_morphology_catalog(query: Optional[str] = None) -> list[dict[str, Any]]:
    registry_codes = set(list_language_capabilities().keys())
    all_codes = sorted(
        registry_codes
        | set(SPACY_MODEL_ALIASES.keys())
        | EU_OFFICIAL_LANGUAGE_CODES
        | UN_OFFICIAL_LANGUAGE_CODES
        | RECOMMENDED_EXTRA_LANGUAGE_CODES
    )

    entries = [morphology_catalog_entry(code) for code in all_codes]

    if query:
        needle = query.strip().lower()
        if needle:
            entries = [
                entry
                for entry in entries
                if needle in entry["code"].lower()
                or needle in entry["name"].lower()
                or needle in (entry.get("spacy_model") or "").lower()
            ]

    return sorted(
        entries,
        key=lambda entry: (
            0 if entry["installed"] else 1,
            0 if entry["is_eu_official"] else 1,
            0 if entry["is_un_official"] else 1,
            entry["name"].lower(),
        ),
    )
