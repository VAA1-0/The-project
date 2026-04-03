from __future__ import annotations

from typing import Any, Optional

from src.backend.analysis.language_utils import (
    language_display_name,
    normalize_language_code,
)


MORPHOLOGY_PACK_LIMITS = {
    "core_only": 0,
    "plus_1": 1,
    "plus_2": 2,
}

PRIMARY_LANGUAGE_CODE = "en"
PRIMARY_LANGUAGE_NAME = "English"


def _dedupe_preserve(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        cleaned = value.strip()
        if not cleaned:
            continue
        lowered = cleaned.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        result.append(cleaned)
    return result


def parse_requested_languages(raw_value: Optional[str]) -> list[str]:
    if not raw_value:
        return []

    requested: list[str] = []
    for chunk in str(raw_value).split(","):
        normalized = normalize_language_code(chunk) or chunk.strip().lower()
        if not normalized or normalized == PRIMARY_LANGUAGE_CODE:
            continue
        requested.append(normalized)
    return _dedupe_preserve(requested)


def build_language_pack_policy(
    morphology_pack_policy: Optional[str] = None,
    morphology_languages: Optional[str] = None,
    special_use_morphology_language: Optional[str] = None,
    allow_rough_interpretation: bool = True,
) -> dict[str, Any]:
    policy_key = (
        morphology_pack_policy
        if morphology_pack_policy in MORPHOLOGY_PACK_LIMITS
        else "core_only"
    )
    slot_limit = MORPHOLOGY_PACK_LIMITS[policy_key]

    requested_languages = parse_requested_languages(morphology_languages)
    selected_languages = requested_languages[:slot_limit]

    special_code = normalize_language_code(special_use_morphology_language)
    if special_code == PRIMARY_LANGUAGE_CODE:
        special_code = None

    extra_request_count = len(selected_languages) + (1 if special_code else 0)
    commercial_extension_required = extra_request_count > slot_limit

    return {
        "primary_language": {
            "code": PRIMARY_LANGUAGE_CODE,
            "name": PRIMARY_LANGUAGE_NAME,
            "fixed": True,
        },
        "policy": policy_key,
        "policy_label": {
            "core_only": "English core",
            "plus_1": "English + 1 morphology language",
            "plus_2": "English + 2 morphology languages",
        }[policy_key],
        "slot_limit": slot_limit,
        "selected_languages": [
            {
                "code": code,
                "name": language_display_name(code),
            }
            for code in selected_languages
        ],
        "special_use_language": (
            {
                "code": special_code or special_use_morphology_language,
                "name": language_display_name(special_code or special_use_morphology_language),
            }
            if special_use_morphology_language
            else None
        ),
        "allow_rough_interpretation": bool(allow_rough_interpretation),
        "rough_interpretation_label": (
            "Enabled for unsupported languages"
            if allow_rough_interpretation
            else "Disabled"
        ),
        "commercial_extension_required": commercial_extension_required,
        "notes": [
            "English remains the fixed primary morphology language.",
            "Additional morphology languages are user-selected rather than factory-installed.",
            (
                "A special-use morphology request currently sits outside the standard slot count."
                if special_use_morphology_language
                else "No special-use morphology request was declared."
            ),
            (
                "A commercial or admin extension may be required for the requested language count."
                if commercial_extension_required
                else "Requested morphology languages fit within the active pack policy."
            ),
            (
                "Rough interpretation remains available for unsupported languages."
                if allow_rough_interpretation
                else "Rough interpretation fallback is disabled for this run."
            ),
        ],
    }
