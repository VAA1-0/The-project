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
    segments: Optional[list[dict[str, Any]]] = None,
) -> dict[str, Any]:
    normalized_hint = normalize_language_code(language_hint)
    timeline_profile = infer_timeline_language_distribution(segments or [])
    text_guess = (
        timeline_profile.get("primary_guess")
        if timeline_profile.get("recognized_sample_count")
        else infer_text_language(text)
    )
    text_guess_code = normalize_language_code(text_guess.get("code"))

    timeline_is_authoritative = bool(
        timeline_profile.get("recognized_sample_count", 0) >= 2
        and float(text_guess.get("confidence") or 0.0) >= 0.5
    )

    if normalized_hint and text_guess_code == normalized_hint:
        selected_code = normalized_hint
        source = "whisper+timeline" if timeline_profile.get("sample_count") else "whisper+text"
        confidence = max(0.95, text_guess.get("confidence", 0.0))
    elif timeline_is_authoritative and text_guess_code:
        selected_code = text_guess_code
        source = "timeline_over_whisper"
        confidence = text_guess.get("confidence", 0.0)
    elif normalized_hint:
        selected_code = normalized_hint
        source = "whisper"
        confidence = 0.95
    elif text_guess_code:
        selected_code = text_guess_code
        source = "timeline" if timeline_profile.get("sample_count") else "text"
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
        "timeline_distribution": timeline_profile,
        "support": language_support_profile(selected_code),
    }


def infer_timeline_language_distribution(
    segments: list[dict[str, Any]],
    *,
    maximum_samples: int = 9,
    significant_share: float = 0.12,
) -> dict[str, Any]:
    """Infer language volumes from representative samples across the timeline.

    The transcript is divided into evenly distributed buckets and each bucket's
    median segment plus its immediate neighbours are inspected.  This prevents
    an opening greeting or lead-in from deciding morphology for the whole file.
    """
    rows = [
        row for row in segments
        if isinstance(row, dict) and str(row.get("text") or "").strip()
    ]
    if not rows:
        return {
            "method": "timeline_median_distributed_stopword_overlap",
            "sample_count": 0,
            "recognized_sample_count": 0,
            "primary_guess": infer_text_language(""),
            "language_volumes": [],
            "significant_languages": [],
        }

    sample_count = min(maximum_samples, len(rows))
    samples: list[dict[str, Any]] = []
    totals: dict[str, dict[str, Any]] = {}
    for bucket_index in range(sample_count):
        start = (bucket_index * len(rows)) // sample_count
        stop = ((bucket_index + 1) * len(rows)) // sample_count
        median_index = start + max(0, (stop - start - 1) // 2)
        window_start = max(start, median_index - 1)
        window_stop = min(stop, median_index + 2)
        window = rows[window_start:window_stop]
        sample_text = " ".join(str(row.get("text") or "").strip() for row in window)
        guess = infer_text_language(sample_text)
        code = normalize_language_code(guess.get("code"))
        sample = {
            "sample_index": bucket_index,
            "segment_start_index": window_start,
            "segment_end_index": max(window_start, window_stop - 1),
            "source_start": window[0].get("start") if window else None,
            "source_end": window[-1].get("end") if window else None,
            "language": code or "unknown",
            "confidence": guess.get("confidence", 0.0),
            "token_count": guess.get("token_count", 0),
        }
        samples.append(sample)
        if not code:
            continue
        volume = totals.setdefault(code, {"code": code, "token_count": 0, "sample_count": 0})
        volume["token_count"] += int(guess.get("token_count") or 0)
        volume["sample_count"] += 1

    recognized_tokens = sum(item["token_count"] for item in totals.values())
    volumes = sorted(
        (
            {
                **item,
                "name": language_display_name(code),
                "share": round(item["token_count"] / max(recognized_tokens, 1), 4),
            }
            for code, item in totals.items()
        ),
        key=lambda item: (-item["token_count"], item["code"]),
    )
    significant = [
        item for index, item in enumerate(volumes)
        if index == 0 or (item["share"] >= significant_share and item["sample_count"] >= 2)
    ][:3]
    primary = volumes[0] if volumes else None
    return {
        "method": "timeline_median_distributed_stopword_overlap",
        "sample_count": len(samples),
        "recognized_sample_count": sum(item["sample_count"] for item in volumes),
        "samples": samples,
        "primary_guess": {
            "code": primary.get("code") if primary else None,
            "name": primary.get("name") if primary else "Unknown",
            "confidence": primary.get("share") if primary else 0.0,
            "method": "timeline_median_distributed_stopword_overlap",
            "token_count": primary.get("token_count") if primary else 0,
        },
        "language_volumes": volumes,
        "significant_languages": significant,
        "significant_share_threshold": significant_share,
    }
