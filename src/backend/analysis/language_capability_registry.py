from __future__ import annotations

from copy import deepcopy
from typing import Any


SupportLevel = str

DEFAULT_LENS_SUPPORT: dict[str, SupportLevel] = {
    "pos": "limited",
    "quant": "limited",
    "future_discourse": "limited",
}


def _entry(
    code: str,
    language_name: str,
    *,
    current: dict[str, SupportLevel] | None = None,
    target: dict[str, SupportLevel] | None = None,
    varieties: list[str] | None = None,
    notes: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "code": code,
        "language_name": language_name,
        "current_support": {
            **DEFAULT_LENS_SUPPORT,
            **(current or {}),
        },
        "target_support": {
            **DEFAULT_LENS_SUPPORT,
            **(target or {}),
        },
        "regional_varieties": varieties or [],
        "notes": notes or [],
    }


LANGUAGE_CAPABILITY_REGISTRY: dict[str, dict[str, Any]] = {
    "en": _entry(
        "en",
        "English",
        current={
            "pos": "enhanced",
            "quant": "enhanced",
            "future_discourse": "limited",
        },
        target={
            "pos": "enhanced",
            "quant": "enhanced",
            "future_discourse": "enhanced",
        },
        varieties=["us", "uk", "au", "international"],
        notes=[
            "English variants should be handled through variety and register metadata, not separate language codes.",
        ],
    ),
    "es": _entry(
        "es",
        "Spanish",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "enhanced", "quant": "enhanced"},
    ),
    "pt": _entry(
        "pt",
        "Portuguese",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "enhanced", "quant": "enhanced"},
    ),
    "fr": _entry(
        "fr",
        "French",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "enhanced", "quant": "enhanced"},
    ),
    "de": _entry(
        "de",
        "German",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "enhanced", "quant": "enhanced"},
    ),
    "it": _entry(
        "it",
        "Italian",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "enhanced", "quant": "enhanced"},
    ),
    "nl": _entry(
        "nl",
        "Dutch",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "enhanced", "quant": "enhanced"},
        notes=["Flemish should be handled as a regional variety within Dutch."],
    ),
    "fi": _entry(
        "fi",
        "Finnish",
        current={"pos": "limited", "quant": "enhanced"},
        target={"pos": "multilingual", "quant": "enhanced"},
    ),
    "sv": _entry(
        "sv",
        "Swedish",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "multilingual", "quant": "enhanced"},
    ),
    "no": _entry(
        "no",
        "Norwegian",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "enhanced", "quant": "enhanced"},
        varieties=["bokmal", "nynorsk"],
    ),
    "da": _entry(
        "da",
        "Danish",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "enhanced", "quant": "enhanced"},
    ),
    "is": _entry(
        "is",
        "Icelandic",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "multilingual", "quant": "multilingual"},
    ),
    "et": _entry(
        "et",
        "Estonian",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "multilingual", "quant": "multilingual"},
    ),
    "pl": _entry(
        "pl",
        "Polish",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "enhanced", "quant": "enhanced"},
    ),
    "cs": _entry(
        "cs",
        "Czech",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "multilingual", "quant": "multilingual"},
    ),
    "hu": _entry(
        "hu",
        "Hungarian",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "multilingual", "quant": "multilingual"},
    ),
    "ro": _entry(
        "ro",
        "Romanian",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "enhanced", "quant": "enhanced"},
    ),
    "el": _entry(
        "el",
        "Greek",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "enhanced", "quant": "enhanced"},
    ),
    "he": _entry(
        "he",
        "Hebrew",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "multilingual", "quant": "multilingual"},
    ),
    "ar": _entry(
        "ar",
        "Arabic",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "multilingual", "quant": "multilingual"},
    ),
    "fa": _entry(
        "fa",
        "Persian (Farsi)",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "multilingual", "quant": "multilingual"},
    ),
    "ru": _entry(
        "ru",
        "Russian",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "enhanced", "quant": "enhanced"},
    ),
    "uk": _entry(
        "uk",
        "Ukrainian",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "multilingual", "quant": "multilingual"},
    ),
    "zh": _entry(
        "zh",
        "Mandarin",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "enhanced", "quant": "enhanced"},
        notes=["Cantonese should be tracked separately in user hints when possible."],
    ),
    "yue": _entry(
        "yue",
        "Cantonese",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "multilingual", "quant": "multilingual"},
    ),
    "ja": _entry(
        "ja",
        "Japanese",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "enhanced", "quant": "enhanced"},
    ),
    "hi": _entry(
        "hi",
        "Hindi",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "multilingual", "quant": "multilingual"},
    ),
    "tr": _entry(
        "tr",
        "Turkish",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "multilingual", "quant": "multilingual"},
    ),
    "sw": _entry(
        "sw",
        "Swahili",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "multilingual", "quant": "multilingual"},
    ),
    "yo": _entry(
        "yo",
        "Yoruba",
        current={"pos": "limited", "quant": "limited"},
        target={"pos": "multilingual", "quant": "multilingual"},
    ),
}


def get_language_capability(language_code: str | None) -> dict[str, Any]:
    if not language_code:
        return {
            "code": "unknown",
            "language_name": "Unknown",
            "current_support": deepcopy(DEFAULT_LENS_SUPPORT),
            "target_support": deepcopy(DEFAULT_LENS_SUPPORT),
            "regional_varieties": [],
            "notes": ["No language code was available."],
        }

    normalized = str(language_code).strip().lower()
    capability = LANGUAGE_CAPABILITY_REGISTRY.get(normalized)
    if capability:
        return deepcopy(capability)

    return {
        "code": normalized,
        "language_name": normalized,
        "current_support": deepcopy(DEFAULT_LENS_SUPPORT),
        "target_support": deepcopy(DEFAULT_LENS_SUPPORT),
        "regional_varieties": [],
        "notes": ["Language is not yet mapped in the first-wave capability registry."],
    }


def list_language_capabilities() -> dict[str, dict[str, Any]]:
    return deepcopy(LANGUAGE_CAPABILITY_REGISTRY)
