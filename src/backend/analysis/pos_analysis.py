"""
VAA1 linguistic features v1:
- POS lens (basic grammatical features)
- Dramatistic interrogative lens

Requirements:
    pip install spacy
    python -m spacy download en_core_web_sm


To run in powershell, execute the following command:
    python -c "from src.backend.analysis.pos_analysis import POSAnalysis; print(POSAnalysis('Hello').run())"
    Replace 'Hello' with your desired text.
"""

from collections import Counter
from functools import lru_cache
from typing import Dict, List, Any, Tuple

import spacy
from spacy.language import Language
from spacy.tokens import Doc, Token

from src.backend.analysis.language_utils import (
    fallback_spacy_language_code,
    normalize_language_code,
    resolve_spacy_model,
    safe_stopwords,
    simple_word_tokens,
)
from src.backend.utils.logger import get_logger


logger = get_logger(__name__)

CASE_LABELS = {
    "Nom": "Nominative",
    "Acc": "Accusative",
    "Gen": "Genitive",
    "Dat": "Dative",
    "Par": "Partitive",
    "Loc": "Locative",
    "Ela": "Elative",
    "Ill": "Illative",
    "Ine": "Inessive",
    "Ade": "Adessive",
    "Abl": "Ablative",
    "All": "Allative",
    "Ess": "Essive",
    "Tra": "Translative",
    "Ins": "Instrumental",
    "Com": "Comitative",
    "Abe": "Abessive",
    "Voc": "Vocative",
}

TENSE_LABELS = {
    "present": "Present",
    "past": "Past",
    "future_like": "Future-like",
}

VERB_FORM_LABELS = {
    "infinitive": "Infinitive",
    "participle": "Participle",
    "gerund_like": "Gerund-like",
}


@lru_cache(maxsize=16)
def get_nlp_for_language(language_code: str | None) -> Language:
    normalized_code = normalize_language_code(language_code) or "en"
    model_name = resolve_spacy_model(normalized_code, None)

    if model_name:
        try:
            nlp = spacy.load(model_name)
            if not any(
                pipe_name in nlp.pipe_names
                for pipe_name in ("parser", "senter", "sentencizer")
            ):
                nlp.add_pipe("sentencizer")
            return nlp
        except Exception:
            logger.warning("Falling back to blank spaCy model for %s", normalized_code)

    nlp = spacy.blank(fallback_spacy_language_code(normalized_code))
    if "sentencizer" not in nlp.pipe_names:
        nlp.add_pipe("sentencizer")
    return nlp


# -------------------------------
# 1. POS LENS (constants)
# -------------------------------

MODAL_LEMMAS = {
    "can", "could", "may", "might", "must",
    "shall", "should", "will", "would"
}

NOMINALIZATION_SUFFIXES = {
    "tion", "sion", "ment", "ance", "ence", "ity", "ness", "er", "or", "al", "age", "dom", "hood", "ism", "ist", "ship", "ure"
}

MANNER_ADVERBS = {
    "quickly", "slowly", "carefully", "happily", "loudly", "silently", "well", "badly",
    "easily", "hard", "fast", "smoothly", "suddenly", "gradually", "patiently", "eagerly",
    "reluctantly", "personally", "officially", "publicly", "privately", "together", "directly",
    "indirectly", "properly", "improperly", "correctly", "incorrectly", "clearly", "unclearly",
    "differently", "similarly", "briefly", "thoroughly", "precisely", "roughly", "strongly",
    "weakly", "safely", "dangerously", "successfully", "unsuccessfully"
}

FALLBACK_ADPOSITIONS = {
    "en": {"in", "on", "at", "to", "from", "with", "by", "for", "of", "into"},
    "fi": {"ilman", "kanssa", "kohti", "alla", "ennen", "jälkeen", "vuoksi"},
    "es": {"de", "en", "con", "por", "para", "sin", "desde", "hasta"},
    "fr": {"de", "dans", "avec", "pour", "sans", "sur", "vers"},
    "de": {"in", "mit", "von", "zu", "für", "auf", "aus"},
}

FALLBACK_VERB_HINTS = {
    "en": {"is", "are", "was", "were", "be", "have", "has", "had", "do", "does"},
    "fi": {"on", "ovat", "oli", "olla", "näyttää", "otetaan", "saamassa"},
    "es": {"es", "son", "fue", "ser", "tener", "hacer"},
    "fr": {"est", "sont", "etre", "avoir", "faire"},
    "de": {"ist", "sind", "war", "sein", "haben", "machen"},
}

FALLBACK_ADVERB_SUFFIXES = {
    "en": ("ly",),
    "fi": ("sti",),
    "es": ("mente",),
    "pt": ("mente",),
    "fr": ("ment",),
}

FALLBACK_TEMPORAL_MARKERS = {
    "en": {"now", "today", "yesterday", "tonight", "tomorrow", "currently", "recently"},
    "fi": {"nyt", "tänään", "eilen", "huomenna", "illalla", "päivänä"},
    "es": {"ahora", "hoy", "ayer", "mañana"},
    "fr": {"maintenant", "aujourd'hui", "hier", "demain"},
    "de": {"jetzt", "heute", "gestern", "morgen"},
}

FALLBACK_REASON_MARKERS = {
    "en": {"because", "since", "due to", "because of"},
    "fi": {"koska", "siksi", "vuoksi"},
    "es": {"porque", "debido a"},
    "fr": {"parce que", "à cause de"},
    "de": {"weil", "deshalb", "wegen"},
}

FALLBACK_MEANS_MARKERS = {
    "en": {"by", "with", "through", "using", "via"},
    "fi": {"kanssa", "avulla", "käyttämällä"},
    "es": {"con", "mediante"},
    "fr": {"avec", "par", "au moyen de"},
    "de": {"mit", "durch"},
}

FALLBACK_PURPOSE_MARKERS = {
    "en": {"in order to", "so that", "to"},
    "fi": {"jotta", "voidakseen"},
    "es": {"para", "a fin de"},
    "fr": {"pour", "afin de"},
    "de": {"um zu", "damit"},
}

FALLBACK_SOURCE_MARKERS = {
    "en": {"from", "out of", "since"},
    "fi": {"mistä", "lähtien", "alkaen"},
    "es": {"desde", "de"},
    "fr": {"de", "depuis"},
    "de": {"von", "seit"},
}

FALLBACK_CONSEQUENCE_MARKERS = {
    "en": {"so", "therefore", "thus", "hence", "as a result"},
    "fi": {"siksi", "seurauksena"},
    "es": {"por eso", "así", "como resultado"},
    "fr": {"donc", "ainsi", "par conséquent"},
    "de": {"also", "deshalb", "dadurch"},
}

FALLBACK_AGENT_CUES = {
    "en": {"minister", "president", "reporter", "official", "government", "people", "leader"},
    "fi": {"ministeri", "presidentti", "toimittaja", "hallitus", "ihmiset", "johtaja"},
    "es": {"ministro", "presidente", "reportero", "gobierno", "gente"},
    "fr": {"ministre", "président", "journaliste", "gouvernement", "personnes"},
    "de": {"minister", "präsident", "regierung", "menschen", "sprecher"},
}


class POSAnalysis:
    """Object-oriented wrapper for POS and dramatistic/interrogative analysis.

    Instantiate with `text` and call `run()` to perform analysis.
    """

    def __init__(self, text: str, language_code: str = "en", nlp=None):
        self.text = text
        self.language_code = normalize_language_code(language_code) or language_code
        self.nlp = nlp or get_nlp_for_language(self.language_code)
        self.doc: Doc | None = None

    def _span_text(self, tokens: List[Token]) -> str:
        if not tokens:
            return ""
        doc = tokens[0].doc
        start = min(t.i for t in tokens)
        end = max(t.i for t in tokens) + 1
        return doc[start:end].text.strip()

    def _unique_append(self, bucket: List[str], text: str, seen: set):
        text = text.strip()
        if not text:
            return
        if text in seen:
            return
        seen.add(text)
        bucket.append(text)

    def _uses_structured_pos(self) -> bool:
        return any(
            (token.pos_ or token.tag_ or token.dep_)
            for token in self.doc
            if not token.is_space and not token.is_punct
        )

    def _ordered_unique(self, values: List[str]) -> List[str]:
        seen: set[str] = set()
        result: List[str] = []
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

    def _fallback_sentences(self) -> List[str]:
        if self.doc is not None:
            sentences = [sent.text.strip() for sent in self.doc.sents if sent.text.strip()]
            if sentences:
                return sentences
        return [part.strip() for part in self.text.replace("?", ".").replace("!", ".").split(".") if part.strip()]

    def _confidence_label(self, score: float) -> str:
        if score >= 0.75:
            return "high"
        if score >= 0.45:
            return "medium"
        if score > 0:
            return "low"
        return "undetermined"

    def build_lexical_interrogatives(
        self,
        noun_candidates: List[str],
        verb_candidates: List[str],
        adverb_candidates: List[str],
        adposition_candidates: List[str],
    ) -> Tuple[Dict[str, List[str]], Dict[str, Dict[str, Any]]]:
        result: Dict[str, List[str]] = {
            "who": [],
            "what": [],
            "when": [],
            "where": [],
            "why": [],
            "how": [],
            "by_what_means": [],
            "towards_what_end": [],
            "whence": [],
            "by_what_consequence": [],
        }
        seen: Dict[str, set[str]] = {key: set() for key in result}
        confidence: Dict[str, Dict[str, Any]] = {
            key: {
                "level": "undetermined",
                "score": 0.0,
                "source": "transcript_lexical_fallback",
                "triangulation_ready": True,
                "timestamp_ready": False,
            }
            for key in result
        }
        sentences = self._fallback_sentences()
        lowered_verbs = {value.lower() for value in verb_candidates}
        lowered_nouns = {value.lower() for value in noun_candidates}
        temporal_markers = FALLBACK_TEMPORAL_MARKERS.get(self.language_code, set())
        reason_markers = FALLBACK_REASON_MARKERS.get(self.language_code, set())
        means_markers = FALLBACK_MEANS_MARKERS.get(self.language_code, set())
        purpose_markers = FALLBACK_PURPOSE_MARKERS.get(self.language_code, set())
        source_markers = FALLBACK_SOURCE_MARKERS.get(self.language_code, set())
        consequence_markers = FALLBACK_CONSEQUENCE_MARKERS.get(self.language_code, set())
        agent_cues = FALLBACK_AGENT_CUES.get(self.language_code, set())

        for sentence in sentences:
            sentence_lower = sentence.lower()
            sentence_tokens = simple_word_tokens(sentence, lowercase=False)
            lowered_sentence_tokens = [token.lower() for token in sentence_tokens]

            if any(marker in sentence_lower for marker in temporal_markers):
                self._unique_append(result["when"], sentence, seen["when"])
                confidence["when"]["score"] = max(confidence["when"]["score"], 0.55)

            if any(marker in sentence_lower for marker in reason_markers):
                self._unique_append(result["why"], sentence, seen["why"])
                confidence["why"]["score"] = max(confidence["why"]["score"], 0.5)

            if any(marker in sentence_lower for marker in means_markers):
                self._unique_append(result["by_what_means"], sentence, seen["by_what_means"])
                confidence["by_what_means"]["score"] = max(confidence["by_what_means"]["score"], 0.5)

            if any(marker in sentence_lower for marker in purpose_markers):
                self._unique_append(result["towards_what_end"], sentence, seen["towards_what_end"])
                confidence["towards_what_end"]["score"] = max(confidence["towards_what_end"]["score"], 0.45)

            if any(marker in sentence_lower for marker in source_markers):
                self._unique_append(result["whence"], sentence, seen["whence"])
                confidence["whence"]["score"] = max(confidence["whence"]["score"], 0.45)

            if any(marker in sentence_lower for marker in consequence_markers):
                self._unique_append(result["by_what_consequence"], sentence, seen["by_what_consequence"])
                confidence["by_what_consequence"]["score"] = max(confidence["by_what_consequence"]["score"], 0.45)

            if any(token.lower() in lowered_verbs for token in sentence_tokens):
                self._unique_append(result["what"], sentence, seen["what"])
                confidence["what"]["score"] = max(confidence["what"]["score"], 0.55)

            agent_tokens = [
                token for token in sentence_tokens if token.lower() in agent_cues
            ]
            if agent_tokens:
                self._unique_append(result["who"], " ".join(agent_tokens[:2]), seen["who"])
                confidence["who"]["score"] = max(confidence["who"]["score"], 0.65)

            if any(token.lower() in {value.lower() for value in adverb_candidates} for token in sentence_tokens):
                self._unique_append(result["how"], sentence, seen["how"])
                confidence["how"]["score"] = max(confidence["how"]["score"], 0.4)

        if not result["what"] and verb_candidates:
            self._unique_append(result["what"], " ".join(verb_candidates), seen["what"])
            confidence["what"]["score"] = max(confidence["what"]["score"], 0.35)

        for key in confidence:
            confidence[key]["level"] = self._confidence_label(confidence[key]["score"])

        return result, confidence

    def build_lexical_fallback(self) -> Dict[str, Any]:
        tokens = simple_word_tokens(self.text, lowercase=False)
        token_count = len(tokens)
        stopword_set = safe_stopwords(self.language_code)

        adposition_candidates = self._ordered_unique(
            [
                token
                for token in tokens
                if token.lower()
                in FALLBACK_ADPOSITIONS.get(self.language_code, set())
            ]
        )
        adverb_suffixes = FALLBACK_ADVERB_SUFFIXES.get(self.language_code, ())
        adverb_candidates = self._ordered_unique(
            [
                token
                for token in tokens
                if adverb_suffixes and token.lower().endswith(adverb_suffixes)
            ]
        )
        verb_hints = FALLBACK_VERB_HINTS.get(self.language_code, set())
        verb_candidates = self._ordered_unique(
            [
                token
                for token in tokens
                if token.lower() in verb_hints
                or (
                    self.language_code == "fi"
                    and token.lower().endswith(("taa", "tään", "vat", "vät"))
                )
                or (
                    self.language_code == "en"
                    and token.lower().endswith(("ed", "ing"))
                )
            ]
        )

        content_candidates = self._ordered_unique(
            [
                token
                for token in tokens
                if len(token) > 2
                and token.lower() not in stopword_set
                and token.lower() not in {value.lower() for value in adposition_candidates}
                and token.lower() not in {value.lower() for value in adverb_candidates}
                and token.lower() not in {value.lower() for value in verb_candidates}
            ]
        )

        pos_counts = {
            "NOUN": len(content_candidates),
            "VERB": len(verb_candidates),
            "ADP": len(adposition_candidates),
            "ADV": len(adverb_candidates),
            "ADJ": 0,
            "PRON": 0,
            "CONJ": 0,
            "INTJ": 0,
            "DET": 0,
            "AUX_MODAL": 0,
        }

        safe_denominator = max(token_count, 1)
        pos_ratios = {
            "verb_noun_ratio": (
                pos_counts["VERB"] / pos_counts["NOUN"]
                if pos_counts["NOUN"] > 0
                else 0.0
            ),
            "modal_density": 0.0,
            "pronoun_share": 0.0,
            "adj_adv_ratio": 0.0,
            "nominalization_density": pos_counts["NOUN"] / safe_denominator,
        }

        interrogative_lens, interrogative_confidence = self.build_lexical_interrogatives(
            noun_candidates=content_candidates,
            verb_candidates=verb_candidates,
            adverb_candidates=adverb_candidates,
            adposition_candidates=adposition_candidates,
        )

        return {
            "text": self.text,
            "language": self.language_code,
            "analysis_mode": "lexical_fallback",
            "token_count": token_count,
            "confidence_profile": {
                "overall": {
                    "level": "low",
                    "score": 0.35,
                    "source": "transcript_lexical_fallback",
                    "triangulation_ready": True,
                    "timestamp_ready": False,
                },
                "pos_words": {
                    "level": "low",
                    "score": 0.3,
                    "source": "transcript_lexical_fallback",
                    "triangulation_ready": True,
                    "timestamp_ready": False,
                },
                "interrogatives": interrogative_confidence,
            },
            "notes": [
                "Structured POS tagging was unavailable for this language in the current environment.",
                "A conservative lexical fallback was used instead.",
                "Confidence can be raised later through cross-lens triangulation.",
                "Grammar profile and tense profile remain limited in lexical fallback mode.",
            ],
            "pos_counts": pos_counts,
            "pos_ratios": pos_ratios,
            "interrogative_lens": interrogative_lens,
            "grammar_profile": {
                "content_words": {
                    "count": len(content_candidates) + len(verb_candidates) + len(adverb_candidates),
                    "categories": {
                        "NOUN": len(content_candidates),
                        "VERB": len(verb_candidates),
                        "ADJ": 0,
                        "ADV": len(adverb_candidates),
                        "INTJ": 0,
                    },
                },
                "function_words": {
                    "count": len(adposition_candidates),
                    "categories": {
                        "ADP": len(adposition_candidates),
                        "CONJ": 0,
                        "DET": 0,
                        "PRON": 0,
                        "AUX_MODAL": 0,
                    },
                },
            },
            "tense_profile": {
                "available": False,
                "counts": {},
                "examples": {},
                "note": "Tense extraction requires structured morphology support.",
            },
            "case_profile": {
                "available": False,
                "counts": {},
                "examples": {},
                "labels": {},
                "note": "Case extraction requires structured morphology support.",
            },
            "pos_words": {
                "NOUN": content_candidates,
                "VERB": verb_candidates,
                "ADJ": [],
                "ADV": adverb_candidates,
                "ADP": adposition_candidates,
                "PRON": [],
                "CONJ": [],
                "INTJ": [],
                "DET": [],
                "AUX_MODAL": [],
            },
        }

    def compute_pos_counts(self) -> Dict[str, int]:
        counts = Counter()
        for token in self.doc:
            if token.is_space or token.is_punct:
                continue

            pos = token.pos_
            tag = token.tag_.upper()
            lemma = token.lemma_.lower()

            # Nouns (common + proper)
            if pos in ("NOUN", "PROPN"):
                counts["NOUN"] += 1
            # Verbs (main verbs only; modals handled separately)
            if pos == "VERB":
                counts["VERB"] += 1
            # Adjectives
            if pos == "ADJ":
                counts["ADJ"] += 1
            # Adverbs
            if pos == "ADV":
                counts["ADV"] += 1
            # Pronouns
            if pos == "PRON":
                counts["PRON"] += 1
            # Determiners / articles
            if pos == "DET":
                counts["DET"] += 1
            # Modals / auxiliary of modality
            # In English, modals are tagged 'MD' or have modal lemma.
            if tag == "MD" or lemma in MODAL_LEMMAS:
                counts["AUX_MODAL"] += 1
            # Prepositions
            if pos == "ADP":
                counts["ADP"] += 1
            # Conjunctions (coordinating + subordinating)
            if pos in ("CCONJ", "SCONJ"):
                counts["CONJ"] += 1
            # Interjections
            if pos == "INTJ":
                counts["INTJ"] += 1

        return dict(counts)

    def collect_pos_words(self) -> Dict[str, List[str]]:
        full_pos_words: Dict[str, List[str]] = {
            "NOUN": [], "VERB": [], "ADJ": [], "ADV": [], "PRON": [], "DET": [],
            "AUX_MODAL": [], "ADP": [], "CONJ": [], "INTJ": []
        }

        for token in self.doc:
            if token.is_space or token.is_punct:
                continue

            pos = token.pos_
            tag = token.tag_.upper()
            lemma = token.lemma_.lower()

            if pos in ("NOUN", "PROPN"):
                full_pos_words["NOUN"].append(token.text)
            elif pos == "VERB":
                full_pos_words["VERB"].append(token.text)
            elif pos == "ADJ":
                full_pos_words["ADJ"].append(token.text)
            elif pos == "ADV":
                full_pos_words["ADV"].append(token.text)
            elif pos == "PRON":
                full_pos_words["PRON"].append(token.text)
            elif pos == "DET":
                full_pos_words["DET"].append(token.text)
            elif tag == "MD" or lemma in MODAL_LEMMAS:
                full_pos_words["AUX_MODAL"].append(token.text)
            elif pos == "ADP":
                full_pos_words["ADP"].append(token.text)
            elif pos in ("CCONJ", "SCONJ"):
                full_pos_words["CONJ"].append(token.text)
            elif pos == "INTJ":
                full_pos_words["INTJ"].append(token.text)

        return {k: v for k, v in full_pos_words.items() if v}

    def compute_pos_ratios(self, pos_counts: Dict[str, int]) -> Dict[str, float]:
        # Count tokens used for ratios (non-space, non-punct)
        token_count = sum(1 for t in self.doc if not t.is_space and not t.is_punct)
        if token_count == 0:
            token_count = 1

        noun = pos_counts.get("NOUN", 0)
        verb = pos_counts.get("VERB", 0)
        modal = pos_counts.get("AUX_MODAL", 0)
        pron = pos_counts.get("PRON", 0)
        adj = pos_counts.get("ADJ", 0)
        adv = pos_counts.get("ADV", 0)

        ratios = {}
        # Verb–noun ratio
        ratios["verb_noun_ratio"] = (verb / noun) if noun > 0 else 0.0
        # Modal density (per token)
        ratios["modal_density"] = modal / token_count
        # Pronoun share (per token)
        ratios["pronoun_share"] = pron / token_count
        # Adjective–adverb ratio (optional but useful)
        ratios["adj_adv_ratio"] = (adj / adv) if adv > 0 else (float(adj) if adj > 0 else 0.0)

        # Nominalization Density (new)
        nominalizations_count = 0
        for token in self.doc:
            if token.pos_ == "NOUN":
                lower_text = token.text.lower()
                if any(lower_text.endswith(s) for s in NOMINALIZATION_SUFFIXES):
                    nominalizations_count += 1
        ratios["nominalization_density"] = nominalizations_count / token_count if token_count > 0 else 0.0

        return ratios

    def build_grammar_profile(
        self,
        pos_counts: Dict[str, int],
    ) -> Dict[str, Any]:
        content_categories = {
            "NOUN": pos_counts.get("NOUN", 0),
            "VERB": pos_counts.get("VERB", 0),
            "ADJ": pos_counts.get("ADJ", 0),
            "ADV": pos_counts.get("ADV", 0),
            "INTJ": pos_counts.get("INTJ", 0),
        }
        function_categories = {
            "ADP": pos_counts.get("ADP", 0),
            "CONJ": pos_counts.get("CONJ", 0),
            "DET": pos_counts.get("DET", 0),
            "PRON": pos_counts.get("PRON", 0),
            "AUX_MODAL": pos_counts.get("AUX_MODAL", 0),
        }
        return {
            "content_words": {
                "count": sum(content_categories.values()),
                "categories": content_categories,
            },
            "function_words": {
                "count": sum(function_categories.values()),
                "categories": function_categories,
            },
        }

    def extract_tense_profile(self) -> Dict[str, Any]:
        tense_counts: Counter = Counter()
        tense_examples: Dict[str, List[str]] = {
            "present": [],
            "past": [],
            "future_like": [],
        }
        verb_form_counts: Counter = Counter()
        verb_form_examples: Dict[str, List[str]] = {
            "infinitive": [],
            "participle": [],
            "gerund_like": [],
        }

        def add_example(
            counts_bucket: Counter,
            examples_bucket: Dict[str, List[str]],
            key: str,
            text: str,
        ):
            if key not in examples_bucket:
                return
            counts_bucket[key] += 1
            if text not in examples_bucket[key] and len(examples_bucket[key]) < 6:
                examples_bucket[key].append(text)

        structured_hits = 0
        for token in self.doc:
            if token.is_space or token.is_punct:
                continue
            if token.pos_ not in ("VERB", "AUX"):
                continue

            morph = token.morph
            tense_values = set(morph.get("Tense"))
            verb_form_values = set(morph.get("VerbForm"))
            if tense_values or verb_form_values:
                structured_hits += 1

            if "Pres" in tense_values:
                add_example(tense_counts, tense_examples, "present", token.text)
            if "Past" in tense_values:
                add_example(tense_counts, tense_examples, "past", token.text)
            if "Inf" in verb_form_values:
                add_example(
                    verb_form_counts,
                    verb_form_examples,
                    "infinitive",
                    token.text,
                )
            if "Part" in verb_form_values:
                add_example(
                    verb_form_counts,
                    verb_form_examples,
                    "participle",
                    token.text,
                )
            if "Ger" in verb_form_values:
                add_example(
                    verb_form_counts,
                    verb_form_examples,
                    "gerund_like",
                    token.text,
                )

            lower = token.text.lower()
            if lower in {"will", "shall", "going"} or token.lemma_.lower() in {"will", "shall"}:
                add_example(
                    tense_counts,
                    tense_examples,
                    "future_like",
                    token.text,
                )

        if structured_hits == 0:
            return {
                "available": False,
                "counts": {},
                "examples": {},
                "tense_counts": {},
                "tense_examples": {},
                "tense_labels": {},
                "verb_form_counts": {},
                "verb_form_examples": {},
                "verb_form_labels": {},
                "note": "Structured tense/morphology was not available for this language model.",
            }

        filtered_tense_counts = {
            key: value for key, value in tense_counts.items() if value > 0
        }
        filtered_tense_examples = {
            key: value for key, value in tense_examples.items() if value
        }
        filtered_verb_form_counts = {
            key: value for key, value in verb_form_counts.items() if value > 0
        }
        filtered_verb_form_examples = {
            key: value for key, value in verb_form_examples.items() if value
        }
        return {
            "available": True,
            "counts": {
                **filtered_tense_counts,
                **filtered_verb_form_counts,
            },
            "examples": {
                **filtered_tense_examples,
                **filtered_verb_form_examples,
            },
            "tense_counts": filtered_tense_counts,
            "tense_examples": filtered_tense_examples,
            "tense_labels": {
                key: TENSE_LABELS.get(key, key)
                for key in filtered_tense_counts.keys()
            },
            "verb_form_counts": filtered_verb_form_counts,
            "verb_form_examples": filtered_verb_form_examples,
            "verb_form_labels": {
                key: VERB_FORM_LABELS.get(key, key)
                for key in filtered_verb_form_counts.keys()
            },
            "note": "Tense and verb-form profile is derived from model-backed morphology where available.",
        }

    def extract_case_profile(self) -> Dict[str, Any]:
        counts: Counter = Counter()
        examples: Dict[str, List[str]] = {}
        structured_hits = 0

        for token in self.doc:
            if token.is_space or token.is_punct:
                continue

            case_values = list(dict.fromkeys(token.morph.get("Case")))
            if not case_values:
                continue

            structured_hits += 1
            for case_value in case_values:
                counts[case_value] += 1
                examples.setdefault(case_value, [])
                if token.text not in examples[case_value] and len(examples[case_value]) < 8:
                    examples[case_value].append(token.text)

        if structured_hits == 0:
            return {
                "available": False,
                "counts": {},
                "examples": {},
                "labels": {},
                "note": "Structured case/morphology was not available for this language model.",
            }

        filtered_counts = {key: value for key, value in counts.items() if value > 0}
        filtered_examples = {key: value for key, value in examples.items() if value}

        return {
            "available": True,
            "counts": filtered_counts,
            "examples": filtered_examples,
            "labels": {
                key: CASE_LABELS.get(key, key)
                for key in filtered_counts.keys()
            },
            "note": "Case profile is derived from model-backed morphology where available.",
        }

    def extract_interrogatives(self) -> Dict[str, List[str]]:
        """
    Extract dramatistic interrogative slots from a parsed Doc.
    Slots:
        who, what, when, where, why, how,
        by_what_means, towards_what_end, whence, by_what_consequence
    """
        
        result: Dict[str, List[str]] = {
            "who": [],
            "what": [],
            "when": [],
            "where": [],
            "why": [],
            "how": [],
            "by_what_means": [],
            "towards_what_end": [],
            "whence": [],
            "by_what_consequence": []
        }

        seen: Dict[str, set] = {k: set() for k in result.keys()}
        # Define doc_text_lower once at the beginning
        doc_text_lower = self.doc.text.lower()

        # WHO? (subjects)
        for token in self.doc:
            if "subj" in token.dep_:
                span = self._span_text(list(token.subtree))
                self._unique_append(result["who"], span, seen["who"])

        # WHAT? (main actions)
        for sent in self.doc.sents:
            root = sent.root
            if root.pos_ == "VERB":
                span = self._span_text(list(root.subtree))
                self._unique_append(result["what"], span, seen["what"])
            else:
                verbs = [t for t in sent if t.pos_ == "VERB"]
                for v in verbs:
                    span = self._span_text(list(v.subtree))
                    self._unique_append(result["what"], span, seen["what"])

        # WHEN? (time)
        temporal_adverbs = {
            "now", "today", "yesterday", "tonight", "tomorrow",
            "currently", "presently", "recently", "soon", "lately"
        }
        for ent in self.doc.ents:
            if ent.label_ in ("DATE", "TIME"):
                self._unique_append(result["when"], ent.text, seen["when"])
        for token in self.doc:
            if token.pos_ == "ADV" and token.lemma_.lower() in temporal_adverbs:
                self._unique_append(result["when"], token.text, seen["when"])

        # WHERE? (place)
        for ent in self.doc.ents:
            if ent.label_ in ("GPE", "LOC", "FAC"):
                self._unique_append(result["where"], ent.text, seen["where"])

        place_nouns = {"office", "city", "country", "parliament", "building",
                       "room", "hall", "campus", "village", "town"}
        for token in self.doc:
            if token.pos_ == "ADP" and token.lemma_.lower() in {"in", "at", "on", "inside", "into"}:
                pobj = [t for t in token.children if t.dep_ in ("pobj", "obl")]
                if pobj:
                    head_noun = pobj[0].lemma_.lower()
                    if pobj[0].ent_type_ in ("GPE", "LOC", "FAC") or head_noun in place_nouns:
                        span_tokens = [token] + list(pobj[0].subtree)
                        span = self._span_text(span_tokens)
                        self._unique_append(result["where"], span, seen["where"])

        # WHY? (reason)
        reason_markers = {"because", "since", "as", "cos", "cause"}
        multi_markers = {"due to", "because of"}
        # Single-word markers
        for token in self.doc:
            lower = token.text.lower()
            if lower in reason_markers:
                sent = token.sent
                span = sent[token.i - sent.start:].text
                self._unique_append(result["why"], span, seen["why"])
        # Single-word markers
        for marker in multi_markers:
            for sent in self.doc.sents:
                if marker in sent.text.lower():
                    self._unique_append(result["why"], sent.text, seen["why"])

        # HOW? (manner / process)
        # Heuristic 1: Phrases and conjunctions indicating manner, capturing the full sentence for context.
        manner_keywords_phrases = {
            "in a way", "in this way", "in that way", "by means of", "as if", "as though", "in the manner"
        }
        for sent in self.doc.sents:
            sent_text_lower = sent.text.lower()
            # Check for specific phrases indicating manner
            for phrase in manner_keywords_phrases:
                if phrase in sent_text_lower:
                    self._unique_append(result["how"], sent.text, seen["how"])
            # Check for conjunctions indicating manner ('as', 'like') followed by a clause.
            # This is a bit more complex as 'as' and 'like' can have many meanings.
            # Focusing on clear cases where they introduce a manner clause.
            for token in sent:
                if token.text.lower() == "as" and token.dep_ == "advcl":
                    self._unique_append(result["how"], sent.text, seen["how"])
                if token.text.lower() == "like" and token.dep_ == "prep":
                    if token.head and token.head.pos_ == "VERB":
                        self._unique_append(result["how"], sent.text, seen["how"])
            # New Heuristic: Capture full sentences where an adverb of manner is present.
            # This ensures contextual sentences for general 'how' descriptions.
            for token in sent:
                if token.pos_ == "ADV" and token.dep_ == "advmod" and token.lemma_.lower() not in temporal_adverbs:
                    if token.lemma_.lower() in MANNER_ADVERBS:
                        self._unique_append(result["how"], sent.text, seen["how"])

        # BY WHAT MEANS? (instrument / method)
        means_preps = {"by", "with", "through", "using", "via"}
        for token in self.doc:
            if token.pos_ == "ADP" and token.lemma_.lower() in means_preps:
                span_tokens = [token] + list(token.subtree)
                span = self._span_text(span_tokens)
                self._unique_append(result["by_what_means"], span, seen["by_what_means"])
        if "by means of" in doc_text_lower:
            for sent in self.doc.sents:
                if "by means of" in sent.text.lower():
                    self._unique_append(result["by_what_means"], sent.text, seen["by_what_means"])

        # TOWARDS WHAT END? (purpose / goal)
        purpose_markers = {"in order to", "so that", "so we can", "so they can"}
        for marker in purpose_markers:
            if marker in doc_text_lower:
                for sent in self.doc.sents:
                    if marker in sent.text.lower():
                        self._unique_append(result["towards_what_end"], sent.text, seen["towards_what_end"])
        for token in self.doc:
            # Infinitival purpose clause heuristic
            if token.text.lower() == "to" and token.nbor(1).pos_ == "VERB":
                span_tokens = [token, token.nbor(1)]
                for t in token.nbor(1).subtree:
                    span_tokens.append(t)
                span = self._span_text(span_tokens)
                self._unique_append(result["towards_what_end"], span, seen["towards_what_end"])

        # WHENCE? (origin / source)
        whence_preps = {"from", "out of", "since"}
        for token in self.doc:
            lower = token.text.lower()
            if token.pos_ == "ADP" and (lower in {"from", "since"}):
                span_tokens = [token] + list(token.subtree)
                span = self._span_text(span_tokens)
                self._unique_append(result["whence"], span, seen["whence"])
        if "out of" in doc_text_lower:
            for sent in self.doc.sents:
                if "out of" in sent.text.lower():
                    self._unique_append(result["whence"], sent.text, seen["whence"])

        # BY WHAT CONSEQUENCE? (effect / outcome)
        consequence_markers = {"so", "therefore", "thus", "hence"}
        for token in self.doc:
            lower = token.text.lower()
            if lower in consequence_markers:
                # Take from marker to end of sentence as rough consequence clause
                sent = token.sent
                span = sent[token.i - sent.start:].text
                self._unique_append(result["by_what_consequence"], span, seen["by_what_consequence"])
        
        # Phrases: "as a result", "resulting in", "which led to" (append full sentence)
        if "as a result" in doc_text_lower:
            for sent in self.doc.sents:
                if "as a result" in sent.text.lower():
                    self._unique_append(result["by_what_consequence"], sent.text, seen["by_what_consequence"])
        if "resulting in" in self.doc.text.lower():
            for sent in self.doc.sents:
                if "resulting in" in sent.text.lower():
                    self._unique_append(result["by_what_consequence"], sent.text, seen["by_what_consequence"])
        if "which led to" in self.doc.text.lower():
            for sent in self.doc.sents:
                if "which led to" in sent.text.lower():
                    self._unique_append(result["by_what_consequence"], sent.text, seen["by_what_consequence"])

        return result

    def run(self) -> Dict[str, Any]:
        """Run the full analysis and return a structured dict (compatible with previous `process_segment`)."""
        logger.debug("Parsing text into spaCy Doc")
        self.doc = self.nlp(self.text)

        if not self._uses_structured_pos():
            logger.info(
                "Using lexical POS fallback for language %s due to missing structured tagger",
                self.language_code,
            )
            return self.build_lexical_fallback()

        pos_counts = self.compute_pos_counts()
        pos_ratios = self.compute_pos_ratios(pos_counts)
        interrogative_lens = self.extract_interrogatives()
        pos_words = self.collect_pos_words()
        grammar_profile = self.build_grammar_profile(pos_counts)
        tense_profile = self.extract_tense_profile()
        case_profile = self.extract_case_profile()

        return {
            "text": self.text,
            "language": self.language_code,
            "analysis_mode": "structured_pos",
            "token_count": sum(
                1 for token in self.doc if not token.is_space and not token.is_punct
            ),
            "confidence_profile": {
                "overall": {
                    "level": "high",
                    "score": 0.9,
                    "source": "structured_pos",
                    "triangulation_ready": True,
                    "timestamp_ready": False,
                },
                "pos_words": {
                    "level": "high",
                    "score": 0.9,
                    "source": "structured_pos",
                    "triangulation_ready": True,
                    "timestamp_ready": False,
                },
                "interrogatives": {
                    key: {
                        "level": "high" if value else "undetermined",
                        "score": 0.85 if value else 0.0,
                        "source": "structured_pos",
                        "triangulation_ready": True,
                        "timestamp_ready": False,
                    }
                    for key, value in interrogative_lens.items()
                },
            },
            "notes": [],
            "pos_counts": pos_counts,
            "pos_ratios": pos_ratios,
            "interrogative_lens": interrogative_lens,
            "grammar_profile": grammar_profile,
            "tense_profile": tense_profile,
            "case_profile": case_profile,
            "pos_words": pos_words
        }


# Compatibility function kept for earlier callers
def process_segment(text: str) -> Dict[str, Any]:
    analyzer = POSAnalysis(text)
    return analyzer.run()


if __name__ == "__main__":
    sample_text = (
        "In 2024, our team at the Commission launched a new pilot in Finland "
        "to make liquidity risks visible earlier. We monitor cash flows with an AI-based "
        "dashboard so the CFO can react faster, because reporting requirements increased "
        "after the last crisis. The movement grew from local activist circles, "
        "which led to broader reforms."
    )

    analyzer = POSAnalysis(sample_text)
    result = analyzer.run()

    print("=== INPUT TEXT ===")
    print(sample_text)
    print("\n=== POS COUNTS ===")
    print(result["pos_counts"])
    print("\n=== POS RATIOS ===")
    print(result["pos_ratios"])
    print("\n=== INTERROGATIVE LENS ===")
    for k, v in result["interrogative_lens"].items():
        print(f"{k}: {v}")
    print("\n=== POS WORDS ===")
    for k, v in result["pos_words"].items():
        print(f"{k}: {v}")
