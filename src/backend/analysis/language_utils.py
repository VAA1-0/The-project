from __future__ import annotations

import importlib.util
import re
from functools import lru_cache
from typing import Any, Optional

from src.backend.analysis.language_capability_registry import (
    get_language_capability,
    list_language_capabilities,
)

try:
    import nltk
    from nltk.corpus import stopwords
except Exception:  # pragma: no cover - fallback for lightweight test envs
    nltk = None
    stopwords = None


def _load_whisper_language_maps() -> tuple[dict[str, str], dict[str, str]]:
    try:
        from whisper.tokenizer import LANGUAGES, TO_LANGUAGE_CODE

        return dict(LANGUAGES), dict(TO_LANGUAGE_CODE)
    except Exception:
        return {}, {}


WHISPER_CODE_TO_NAME, WHISPER_NAME_TO_CODE = _load_whisper_language_maps()

ISO3_ALIASES = {
    "eng": "en",
    "fin": "fi",
    "fra": "fr",
    "fre": "fr",
    "deu": "de",
    "ger": "de",
    "spa": "es",
    "ita": "it",
    "por": "pt",
    "rus": "ru",
    "swe": "sv",
    "dan": "da",
    "nld": "nl",
    "dut": "nl",
    "nor": "no",
    "pol": "pl",
    "ces": "cs",
    "cze": "cs",
    "slk": "sk",
    "slv": "sl",
    "hrv": "hr",
    "srp": "sr",
    "hun": "hu",
    "ron": "ro",
    "rum": "ro",
    "bul": "bg",
    "ukr": "uk",
    "ell": "el",
    "gre": "el",
    "tur": "tr",
    "ara": "ar",
    "heb": "he",
    "fas": "fa",
    "per": "fa",
    "hin": "hi",
    "ben": "bn",
    "tam": "ta",
    "tel": "te",
    "mal": "ml",
    "mar": "mr",
    "guj": "gu",
    "pan": "pa",
    "urd": "ur",
    "zho": "zh",
    "chi": "zh",
    "jpn": "ja",
    "kor": "ko",
    "ind": "id",
    "msa": "ms",
    "tha": "th",
    "vie": "vi",
    "swa": "sw",
    "afr": "af",
    "est": "et",
    "lav": "lv",
    "lit": "lt",
    "cat": "ca",
    "eus": "eu",
    "baq": "eu",
    "glg": "gl",
    "isl": "is",
    "ice": "is",
    "gle": "ga",
    "mlt": "mt",
    "cym": "cy",
    "wel": "cy",
    "sqi": "sq",
    "alb": "sq",
    "mkd": "mk",
    "mac": "mk",
    "kaz": "kk",
    "nep": "ne",
}

ISO1_TO_ISO3 = {iso3: iso1 for iso3, iso1 in ISO3_ALIASES.items()}

STOPWORD_NAME_ALIASES = {
    "slovene": "slovenian",
}

SPACY_MODEL_ALIASES = {
    "en": "en_core_web_sm",
    "fi": "fi_core_news_sm",
    "de": "de_core_news_sm",
    "fr": "fr_core_news_sm",
    "es": "es_core_news_sm",
    "it": "it_core_news_sm",
    "nl": "nl_core_news_sm",
    "pt": "pt_core_news_sm",
    "da": "da_core_news_sm",
    "el": "el_core_news_sm",
    "lt": "lt_core_news_sm",
    "ja": "ja_core_news_sm",
    "nb": "nb_core_news_sm",
    "pl": "pl_core_news_sm",
    "ro": "ro_core_news_sm",
    "ru": "ru_core_news_sm",
    "zh": "zh_core_web_sm",
}

ENHANCED_QUANT_LANGS = {"en", "fi"}


@lru_cache(maxsize=1)
def available_stopword_languages() -> set[str]:
    if stopwords is None:
        return set()
    try:
        return set(stopwords.fileids())
    except Exception:
        return set()


def normalize_language_code(language_hint: Optional[str]) -> Optional[str]:
    if not language_hint:
        return None

    normalized = str(language_hint).strip().lower().replace("_", "-")
    primary = normalized.split("-", 1)[0]

    if primary in WHISPER_CODE_TO_NAME:
        return primary
    if primary in ISO3_ALIASES:
        return ISO3_ALIASES[primary]
    if primary in WHISPER_NAME_TO_CODE:
        return WHISPER_NAME_TO_CODE[primary]
    if primary in list_language_capabilities():
        return primary

    for code, name in WHISPER_CODE_TO_NAME.items():
        if name.lower() == primary:
            return code

    registry = list_language_capabilities()
    for code, capability in registry.items():
        if capability.get("language_name", "").lower() == primary:
            return code

    return primary if len(primary) in {2, 3} else None


def language_display_name(language_hint: Optional[str]) -> str:
    code = normalize_language_code(language_hint)
    capability = get_language_capability(code)
    if capability.get("code") != "unknown" and capability.get("language_name"):
        return capability["language_name"]
    if code and code in WHISPER_CODE_TO_NAME:
        return WHISPER_CODE_TO_NAME[code].title()
    if language_hint:
        return str(language_hint).strip().title()
    return "Unknown"


def normalize_language_name(language_hint: Optional[str]) -> str:
    name = language_display_name(language_hint)
    return name.lower()


def to_iso639_3(language_hint: Optional[str]) -> Optional[str]:
    code = normalize_language_code(language_hint)
    if not code:
        return None
    return ISO1_TO_ISO3.get(code)


def language_to_nltk_name(language_hint: Optional[str]) -> Optional[str]:
    code = normalize_language_code(language_hint)
    if code and code in WHISPER_CODE_TO_NAME:
        base_name = WHISPER_CODE_TO_NAME[code].lower()
    else:
        base_name = normalize_language_name(language_hint)

    nltk_name = STOPWORD_NAME_ALIASES.get(base_name, base_name)
    return nltk_name if nltk_name in available_stopword_languages() else None


def resolve_spacy_model(
    language_hint: Optional[str],
    requested_model: Optional[str] = None,
) -> Optional[str]:
    if requested_model:
        return requested_model
    code = normalize_language_code(language_hint)
    if not code:
        return None
    return SPACY_MODEL_ALIASES.get(code)


@lru_cache(maxsize=64)
def is_spacy_model_available(model_name: str) -> bool:
    return bool(importlib.util.find_spec(model_name))


def fallback_spacy_language_code(language_hint: Optional[str]) -> str:
    code = normalize_language_code(language_hint)
    if code:
        return code
    return "xx"


def safe_stopwords(language_hint: Optional[str]) -> set[str]:
    if stopwords is None:
        return set()
    nltk_name = language_to_nltk_name(language_hint)
    if not nltk_name:
        return set()
    try:
        return set(stopwords.words(nltk_name))
    except Exception:
        return set()


def simple_word_tokens(text: str, lowercase: bool = True) -> list[str]:
    if lowercase:
        text = text.lower()
    return re.findall(r"[^\W\d_]+", text, flags=re.UNICODE)


def infer_text_language(text: str) -> dict[str, Any]:
    tokens = [token for token in simple_word_tokens(text) if len(token) > 1]
    if not tokens:
        return {
            "code": None,
            "name": "Unknown",
            "confidence": 0.0,
            "method": "stopword_overlap",
            "token_count": 0,
        }

    best_language: Optional[str] = None
    best_hits = 0
    best_ratio = 0.0

    for nltk_language in available_stopword_languages():
        try:
            language_stopwords = set(stopwords.words(nltk_language))
        except Exception:
            continue

        hits = sum(1 for token in tokens if token in language_stopwords)
        ratio = hits / max(len(tokens), 1)
        if hits > best_hits or (hits == best_hits and ratio > best_ratio):
            best_language = nltk_language
            best_hits = hits
            best_ratio = ratio

    if not best_language or best_hits < 2:
        return {
            "code": None,
            "name": "Unknown",
            "confidence": round(best_ratio, 4),
            "method": "stopword_overlap",
            "token_count": len(tokens),
        }

    whisper_name = "slovenian" if best_language == "slovene" else best_language
    code = normalize_language_code(whisper_name)
    return {
        "code": code,
        "name": language_display_name(code or whisper_name),
        "confidence": round(best_ratio, 4),
        "method": "stopword_overlap",
        "token_count": len(tokens),
    }


def language_support_profile(language_hint: Optional[str]) -> dict[str, Any]:
    code = normalize_language_code(language_hint)
    capability = get_language_capability(code)
    nltk_name = language_to_nltk_name(code)
    spacy_model = resolve_spacy_model(code)
    spacy_available = bool(spacy_model and is_spacy_model_available(spacy_model))

    current_support = capability.get("current_support", {})
    quant_support = current_support.get(
        "quant",
        "enhanced" if code in ENHANCED_QUANT_LANGS else "multilingual" if nltk_name else "limited",
    )
    pos_support = current_support.get(
        "pos",
        "enhanced" if spacy_available else "multilingual" if code else "limited",
    )

    return {
        "quant": quant_support,
        "pos": pos_support,
        "future_discourse": current_support.get("future_discourse", "limited"),
        "nltk_stopwords": bool(nltk_name),
        "spacy_model": spacy_model,
        "spacy_model_available": spacy_available,
        "registry_language_name": capability.get("language_name"),
        "registry_target_support": capability.get("target_support", {}),
        "regional_varieties": capability.get("regional_varieties", []),
        "notes": capability.get("notes", []),
    }


def build_language_profile(
    language_hint: Optional[str] = None,
    text: str = "",
) -> dict[str, Any]:
    normalized_hint = normalize_language_code(language_hint)
    text_guess = infer_text_language(text)
    text_guess_code = normalize_language_code(text_guess.get("code"))

    if normalized_hint and text_guess_code == normalized_hint:
        selected_code = normalized_hint
        source = "whisper+text"
        confidence = max(0.95, text_guess.get("confidence", 0.0))
    elif normalized_hint:
        selected_code = normalized_hint
        source = "whisper"
        confidence = 0.95
    elif text_guess_code:
        selected_code = text_guess_code
        source = "text"
        confidence = text_guess.get("confidence", 0.0)
    else:
        selected_code = None
        source = "unknown"
        confidence = 0.0

    return {
        "code": selected_code or "unknown",
        "iso6393": to_iso639_3(selected_code),
        "name": language_display_name(selected_code),
        "source": source,
        "confidence": round(float(confidence), 4),
        "hint": language_hint,
        "text_guess": text_guess,
        "support": language_support_profile(selected_code),
    }
