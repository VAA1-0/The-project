from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import re
from typing import Any, Dict, Iterable, List, Optional, Tuple


SCHEMA = "vaa1.dependency_sfl_stage1.v1"

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
    "ja": "ja_core_news_sm",
    "pl": "pl_core_news_sm",
    "ru": "ru_core_news_sm",
    "zh": "zh_core_web_sm",
}

AUTHORITY_POLICY = {
    "manual_annotation_wins": True,
    "manual_correction_wins": True,
    "parser_outputs_do_not_override_manual": True,
    "parser_outputs_are_candidates": True,
    "authority_order": [
        "manual_correction",
        "manual_annotation",
        "confirmed_interpretation",
        "parser_supported_candidate",
        "raw_parser_output",
    ],
}

COMPUTE_PROFILE = {
    "cost_class": "low",
    "requires_gpu": False,
    "recommended_wave": "semantic_anchoring",
    "purpose": "Fast linguistic orientation before expensive visual deepening.",
}

OPEN_WEIGHTS = {
    "linguistic_pattern": 0.4,
    "metadata_reference": 0.2,
    "manual_annotation_reference": 0.25,
    "genre_profile_reference": 0.1,
    "culture_context_reference": 0.05,
}

MODAL_STRENGTHS = {
    "must": ("obligation", "high"),
    "should": ("obligation", "medium"),
    "need": ("obligation", "medium"),
    "have to": ("obligation", "high"),
    "can": ("ability", "medium"),
    "could": ("possibility", "medium"),
    "may": ("possibility", "medium"),
    "might": ("possibility", "low"),
    "will": ("prediction", "medium"),
    "would": ("prediction", "low"),
    "shall": ("obligation", "high"),
}

DIRECTIVE_HINTS = {
    "do",
    "go",
    "come",
    "look",
    "listen",
    "stop",
    "wait",
    "give",
    "take",
    "tell",
    "show",
    "make",
    "let",
    "bring",
}

REPORTING_VERBS = {
    "say",
    "tell",
    "ask",
    "claim",
    "report",
    "argue",
    "explain",
    "warn",
    "promise",
    "deny",
}

AFFECT_HINTS = {
    "afraid": "fear",
    "fear": "fear",
    "angry": "anger",
    "hate": "anger",
    "love": "affiliation",
    "happy": "positive_affect",
    "sad": "sadness",
    "sorry": "repair",
}

STANCE_HINTS = {
    "maybe": "uncertain",
    "perhaps": "uncertain",
    "probably": "probable",
    "certainly": "certain",
    "surely": "certain",
    "never": "negative",
    "not": "negative",
}

MATERIAL_HINTS = {"go", "come", "run", "walk", "move", "take", "give", "make", "kill", "hit"}
MENTAL_HINTS = {"think", "know", "see", "hear", "feel", "want", "believe", "remember"}
RELATIONAL_HINTS = {"be", "become", "seem", "remain", "have"}
VERBAL_HINTS = REPORTING_VERBS | {"speak", "talk"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_text(value: Any, fallback: str = "") -> str:
    text = str(value or "").strip()
    return text or fallback


def _safe_ms(value: Any, fallback: int = 0) -> int:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    if 0 < number < 10_000:
        return int(round(number * 1000))
    return int(round(number))


def _safe_raw_ms(value: Any, fallback: int = 0) -> int:
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return fallback


def _segment_start_ms(segment: Dict[str, Any]) -> int:
    if "start_ms" in segment:
        return _safe_raw_ms(segment.get("start_ms"))
    return _safe_ms(segment.get("start", segment.get("time_start")))


def _segment_end_ms(segment: Dict[str, Any], fallback: int) -> int:
    if "end_ms" in segment:
        return _safe_raw_ms(segment.get("end_ms"), fallback)
    return _safe_ms(segment.get("end", segment.get("time_end")), fallback)


def _normalize_language_code(language_hint: Optional[str]) -> Optional[str]:
    if not language_hint:
        return None
    normalized = str(language_hint).strip().lower().replace("_", "-")
    primary = normalized.split("-", 1)[0]
    aliases = {"eng": "en", "fin": "fi", "deu": "de", "ger": "de", "fra": "fr", "fre": "fr"}
    return aliases.get(primary, primary if primary else None)


def _resolve_spacy_model(language_hint: Optional[str], requested_model: Optional[str]) -> Optional[str]:
    if requested_model:
        return requested_model
    code = _normalize_language_code(language_hint)
    return SPACY_MODEL_ALIASES.get(code or "")


def _load_spacy_nlp(language: Optional[str], model_name: Optional[str]) -> Tuple[Any, Dict[str, Any]]:
    try:
        import spacy  # type: ignore
    except Exception as exc:  # pragma: no cover - depends on local env
        return None, {
            "runtime_status": "dependency_missing",
            "engine": "fallback_regex",
            "model_name": None,
            "message": f"spaCy unavailable: {exc.__class__.__name__}",
        }

    resolved_model = _resolve_spacy_model(language, model_name)
    if resolved_model:
        try:
            return spacy.load(resolved_model), {
                "runtime_status": "completed",
                "engine": "spacy",
                "model_name": resolved_model,
            }
        except Exception as exc:
            fallback_language = _normalize_language_code(language) or "en"
            try:
                nlp = spacy.blank(fallback_language)
                if "sentencizer" not in nlp.pipe_names:
                    nlp.add_pipe("sentencizer")
                return nlp, {
                    "runtime_status": "model_unavailable",
                    "engine": "spacy_blank",
                    "model_name": resolved_model,
                    "message": f"spaCy model unavailable: {exc.__class__.__name__}",
                }
            except Exception:
                return None, {
                    "runtime_status": "model_unavailable",
                    "engine": "fallback_regex",
                    "model_name": resolved_model,
                    "message": f"spaCy model unavailable: {exc.__class__.__name__}",
                }

    return None, {
        "runtime_status": "model_unavailable",
        "engine": "fallback_regex",
        "model_name": None,
        "message": "No spaCy model resolved for language.",
    }


def _regex_tokens(text: str) -> List[Dict[str, Any]]:
    tokens: List[Dict[str, Any]] = []
    for index, match in enumerate(re.finditer(r"\w+(?:'\w+)?|[^\w\s]", text, re.UNICODE)):
        token_text = match.group(0)
        tokens.append(
            {
                "text": token_text,
                "lemma": token_text.lower(),
                "pos": "PUNCT" if re.match(r"[^\w\s]", token_text) else "X",
                "dep": "",
                "head_index": None,
                "index": index,
                "char_start": match.start(),
                "char_end": match.end(),
            }
        )
    return tokens


def _doc_tokens(text: str, nlp: Any) -> List[Dict[str, Any]]:
    if nlp is None:
        return _regex_tokens(text)
    try:
        doc = nlp(text)
    except Exception:
        return _regex_tokens(text)

    tokens: List[Dict[str, Any]] = []
    for index, token in enumerate(doc):
        head_index = None
        try:
            head_index = int(token.head.i) if token.head is not token else index
        except Exception:
            head_index = None
        tokens.append(
            {
                "text": token.text,
                "lemma": (token.lemma_ or token.text).lower(),
                "pos": token.pos_ or "X",
                "dep": token.dep_ or "",
                "head_index": head_index,
                "index": index,
                "char_start": int(token.idx),
                "char_end": int(token.idx + len(token.text)),
            }
        )
    return tokens or _regex_tokens(text)


def _token_trace(
    utterance_id: str,
    text: str,
    tokens: List[Dict[str, Any]],
    start_ms: int,
    end_ms: int,
) -> List[Dict[str, Any]]:
    duration = max(0, end_ms - start_ms)
    text_length = max(1, len(text))
    trace: List[Dict[str, Any]] = []
    for token in tokens:
        token_id = f"{utterance_id}:tok:{token['index']}"
        head_index = token.get("head_index")
        head_token_id = (
            f"{utterance_id}:tok:{head_index}"
            if isinstance(head_index, int) and head_index >= 0
            else None
        )
        char_mid = (int(token["char_start"]) + int(token["char_end"])) / 2
        token_time_ms = start_ms + int(round(duration * min(1.0, max(0.0, char_mid / text_length))))
        trace.append(
            {
                "token_id": token_id,
                "utterance_id": utterance_id,
                "text": token["text"],
                "lemma": token["lemma"],
                "pos": token["pos"],
                "dep": token["dep"],
                "head_token_id": head_token_id,
                "index": token["index"],
                "char_start": token["char_start"],
                "char_end": token["char_end"],
                "estimated_time_ms": token_time_ms,
            }
        )
    return trace


def _lemmas(tokens: Iterable[Dict[str, Any]]) -> List[str]:
    return [str(token.get("lemma") or token.get("text") or "").lower() for token in tokens]


def _root(tokens: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    for token in tokens:
        if token.get("dep") == "ROOT":
            return token
    for token in tokens:
        lemma = str(token.get("lemma") or "").lower()
        if lemma in MATERIAL_HINTS | MENTAL_HINTS | RELATIONAL_HINTS | VERBAL_HINTS:
            return token
    return tokens[0] if tokens else None


def _syntax_features(tokens: List[Dict[str, Any]]) -> Dict[str, Any]:
    root = _root(tokens)
    subjects = [token["text"] for token in tokens if token.get("dep") in {"nsubj", "nsubjpass"}]
    objects = [token["text"] for token in tokens if token.get("dep") in {"dobj", "obj", "attr"}]
    indirect_objects = [token["text"] for token in tokens if token.get("dep") in {"iobj", "dative"}]
    auxiliaries = [token["text"] for token in tokens if token.get("dep") in {"aux", "auxpass"}]
    modals = []
    token_lemmas = _lemmas(tokens)
    joined = " ".join(token_lemmas)
    for modal in MODAL_STRENGTHS:
        if modal in token_lemmas or modal in joined:
            modals.append(modal)
    negation = any(lemma in {"not", "n't", "no", "never"} for lemma in token_lemmas)
    adverbials = [token["text"] for token in tokens if token.get("dep") in {"advmod", "npadvmod"}]
    clausal_complements = [
        token["text"] for token in tokens if token.get("dep") in {"ccomp", "xcomp", "advcl"}
    ]
    attribution_source = None
    if root and str(root.get("lemma")).lower() in REPORTING_VERBS:
        attribution_source = root.get("text")

    return {
        "root": root.get("text") if root else None,
        "root_lemma": root.get("lemma") if root else None,
        "subjects": subjects,
        "objects": objects,
        "indirect_objects": indirect_objects,
        "auxiliaries": auxiliaries,
        "modals": modals,
        "negation": negation,
        "adverbials": adverbials,
        "clausal_complements": clausal_complements,
        "attribution_source": attribution_source,
    }


def _process_type(root_lemma: Optional[str]) -> str:
    lemma = (root_lemma or "").lower()
    if lemma in MATERIAL_HINTS:
        return "material"
    if lemma in MENTAL_HINTS:
        return "mental"
    if lemma in RELATIONAL_HINTS:
        return "relational"
    if lemma in VERBAL_HINTS:
        return "verbal"
    return "undetermined"


def _speech_function(text: str, tokens: List[Dict[str, Any]], syntax: Dict[str, Any]) -> str:
    stripped = text.strip()
    lemmas = _lemmas(tokens)
    first = lemmas[0] if lemmas else ""
    if stripped.endswith("?"):
        return "question"
    if first in DIRECTIVE_HINTS:
        return "directive_candidate"
    if syntax.get("modals"):
        return "proposal_candidate"
    return "statement"


def _sfl_features(text: str, tokens: List[Dict[str, Any]], syntax: Dict[str, Any]) -> Dict[str, Any]:
    lemmas = _lemmas(tokens)
    process_type = _process_type(syntax.get("root_lemma"))
    modality = [
        {"modal": modal, "type": MODAL_STRENGTHS[modal][0], "strength": MODAL_STRENGTHS[modal][1]}
        for modal in syntax.get("modals") or []
        if modal in MODAL_STRENGTHS
    ]
    stance = sorted({STANCE_HINTS[lemma] for lemma in lemmas if lemma in STANCE_HINTS})
    affect = sorted({AFFECT_HINTS[lemma] for lemma in lemmas if lemma in AFFECT_HINTS})
    intensity = "high" if any(lemma in {"very", "extremely", "absolutely", "really"} for lemma in lemmas) else "normal"
    theme_candidate = next((token["text"] for token in tokens if token.get("pos") != "PUNCT"), None)

    return {
        "ideational": {
            "process_type": process_type,
            "participants": {
                "subjects": syntax.get("subjects") or [],
                "objects": syntax.get("objects") or [],
                "indirect_objects": syntax.get("indirect_objects") or [],
            },
            "circumstances": syntax.get("adverbials") or [],
        },
        "interpersonal": {
            "speech_function": _speech_function(text, tokens, syntax),
            "modality": modality,
            "stance": stance,
            "affect": affect,
            "intensity": intensity,
        },
        "textual": {
            "theme_candidate": theme_candidate,
            "sentence_type": "interrogative" if text.strip().endswith("?") else "declarative",
            "attribution_source": syntax.get("attribution_source"),
        },
        "confidence": {
            "syntax": 0.72 if any(token.get("dep") for token in tokens) else 0.35,
            "sfl_lite": 0.55,
        },
    }


def _candidate_labels(syntax: Dict[str, Any], sfl: Dict[str, Any]) -> List[Dict[str, Any]]:
    candidates: List[Dict[str, Any]] = []
    speech_function = sfl["interpersonal"]["speech_function"]
    process_type = sfl["ideational"]["process_type"]
    if speech_function in {"directive_candidate", "proposal_candidate"}:
        candidates.append(
            {
                "label_family": "Interaction",
                "candidate_label": speech_function,
                "support": "speech_function",
                "review_state": "candidate",
            }
        )
    if process_type in {"material", "verbal", "mental"}:
        target = "Action" if process_type == "material" else "Role"
        candidates.append(
            {
                "label_family": target,
                "candidate_label": f"{process_type}_process",
                "support": "sfl_ideational_process_type",
                "review_state": "candidate",
            }
        )
    if syntax.get("attribution_source"):
        candidates.append(
            {
                "label_family": "Episode",
                "candidate_label": "reported_speech_or_claim_boundary",
                "support": "dependency_root_reporting_verb",
                "review_state": "candidate",
            }
        )
    return candidates


def _segment_list(transcript: Any) -> List[Dict[str, Any]]:
    if isinstance(transcript, dict):
        for key in ("segments", "utterances", "transcript"):
            value = transcript.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
        if transcript.get("text"):
            return [transcript]
    if isinstance(transcript, list):
        return [item for item in transcript if isinstance(item, dict)]
    if isinstance(transcript, str):
        return [{"text": transcript}]
    return []


def _segment_language(transcript: Any, language: Optional[str]) -> str:
    if language:
        return _normalize_language_code(language) or language
    if isinstance(transcript, dict):
        return _normalize_language_code(transcript.get("language")) or "unknown"
    return "unknown"


def analyze_dependency_sfl_utterance(
    segment: Dict[str, Any],
    *,
    utterance_index: int,
    analysis_id: str,
    source_media_id: Optional[str],
    nlp: Any = None,
) -> Dict[str, Any]:
    utterance_id = _safe_text(
        segment.get("utterance_id") or segment.get("id"),
        f"{analysis_id}:utt:{utterance_index}",
    )
    text = _safe_text(segment.get("text") or segment.get("utterance"))
    start_ms = _segment_start_ms(segment)
    end_ms = _segment_end_ms(segment, start_ms)
    if end_ms < start_ms:
        end_ms = start_ms
    source_evidence_ids = [
        str(value)
        for value in (
            segment.get("source_evidence_ids")
            or segment.get("evidence_ids")
            or ([segment.get("evidence_id")] if segment.get("evidence_id") else [])
        )
        if value
    ]

    tokens = _doc_tokens(text, nlp)
    trace = _token_trace(utterance_id, text, tokens, start_ms, end_ms)
    syntax = _syntax_features(tokens)
    sfl = _sfl_features(text, tokens, syntax)

    return {
        "utterance_id": utterance_id,
        "analysis_id": analysis_id,
        "source_media_id": _safe_text(segment.get("source_media_id"), source_media_id or ""),
        "speaker_id": segment.get("speaker") or segment.get("speaker_id"),
        "time_interval": {"start_ms": start_ms, "end_ms": end_ms},
        "text": text,
        "source_evidence_ids": source_evidence_ids,
        "syntax": syntax,
        "sfl_lite": sfl,
        "token_trace": trace,
        "interpretation_support": {
            "epistemic_status": "parser_supported_candidate",
            "review_state": "candidate",
            "candidate_labels": _candidate_labels(syntax, sfl),
            "may_proliferate": True,
            "may_auto_confirm": False,
        },
        "traceback": {
            "traceback_required": True,
            "earliest_source_evidence_ids": source_evidence_ids,
            "source_text_span": {"char_start": 0, "char_end": len(text)},
            "token_trace_ids": [token["token_id"] for token in trace],
        },
    }


def build_dependency_sfl_stage1_artifact(
    analysis_id: str,
    transcript: Any,
    *,
    source_media_id: Optional[str] = None,
    language: Optional[str] = None,
    source_metadata: Optional[Dict[str, Any]] = None,
    genre_profile: Optional[Dict[str, Any]] = None,
    culture_context: Optional[Dict[str, Any]] = None,
    nlp: Any = None,
    model_name: Optional[str] = None,
) -> Dict[str, Any]:
    resolved_language = _segment_language(transcript, language)
    model_info = {
        "runtime_status": "completed",
        "engine": "injected_nlp",
        "model_name": getattr(nlp, "meta", {}).get("name") if nlp is not None else None,
    }
    if nlp is None:
        nlp, model_info = _load_spacy_nlp(resolved_language, model_name)

    segments = _segment_list(transcript)
    utterances = [
        analyze_dependency_sfl_utterance(
            segment,
            utterance_index=index,
            analysis_id=analysis_id,
            source_media_id=source_media_id,
            nlp=nlp,
        )
        for index, segment in enumerate(segments)
    ]
    token_count = sum(len(utterance["token_trace"]) for utterance in utterances)
    candidate_count = sum(
        len(utterance["interpretation_support"]["candidate_labels"])
        for utterance in utterances
    )

    runtime_status = model_info["runtime_status"]
    if runtime_status == "completed" and model_info.get("engine") in {"spacy_blank", "fallback_regex"}:
        runtime_status = "fallback_completed"

    return {
        "schema": SCHEMA,
        "analysis_id": analysis_id,
        "source_media_id": source_media_id,
        "language": resolved_language,
        "runtime_status": runtime_status,
        "model": model_info,
        "compute_profile": COMPUTE_PROFILE,
        "open_weights": OPEN_WEIGHTS,
        "authority_policy": AUTHORITY_POLICY,
        "interpretive_context": {
            "source_metadata": source_metadata or {},
            "genre_profile": genre_profile or {},
            "culture_context": culture_context or {},
            "metadata_may_contextualize_patterns": True,
            "metadata_must_not_override_manual_annotation": True,
        },
        "utterance_count": len(utterances),
        "utterances": utterances,
        "summary": {
            "token_count": token_count,
            "candidate_label_count": candidate_count,
            "candidate_label_families": sorted(
                {
                    candidate["label_family"]
                    for utterance in utterances
                    for candidate in utterance["interpretation_support"]["candidate_labels"]
                }
            ),
        },
        "provenance": {
            "created_at": _now_iso(),
            "source": "transcript_dependency_sfl_stage1",
            "traceback_required": True,
        },
    }


def write_dependency_sfl_stage1_artifact(
    analysis_id: str,
    transcript: Any,
    output_path: str | Path,
    *,
    source_media_id: Optional[str] = None,
    language: Optional[str] = None,
    source_metadata: Optional[Dict[str, Any]] = None,
    genre_profile: Optional[Dict[str, Any]] = None,
    culture_context: Optional[Dict[str, Any]] = None,
    nlp: Any = None,
    model_name: Optional[str] = None,
) -> Dict[str, Any]:
    artifact = build_dependency_sfl_stage1_artifact(
        analysis_id,
        transcript,
        source_media_id=source_media_id,
        language=language,
        source_metadata=source_metadata,
        genre_profile=genre_profile,
        culture_context=culture_context,
        nlp=nlp,
        model_name=model_name,
    )
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(artifact, ensure_ascii=False, indent=2), encoding="utf-8")
    return artifact
