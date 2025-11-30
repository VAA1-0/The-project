# pos_dramatistic_lens.py

"""
VAA1 linguistic features v1:
- POS lens (basic grammatical features)
- Dramatistic interrogative lens

Requirements:
    pip install spacy
    python -m spacy download en_core_web_sm
"""

from collections import Counter
from typing import Dict, List, Any

import spacy
from spacy.tokens import Doc, Token


# -------------------------------
# 0. Load spaCy model (English)
# -------------------------------

# You can swap this model to e.g. 'en_core_web_trf' or a different language.
NLP = spacy.load("en_core_web_sm")


# -------------------------------
# 1. POS LENS
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


def compute_pos_counts(doc: Doc) -> Dict[str, int]:
    """
    Compute basic POS counts for a spaCy Doc.
    We ignore punctuation and spaces.
    """

    counts = Counter()

    for token in doc:
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

    return dict(counts)


def collect_pos_words(doc: Doc) -> Dict[str, List[str]]:
    """
    Collects a list of words for each POS category.
    """
    full_pos_words: Dict[str, List[str]] = {
        "NOUN": [], "VERB": [], "ADJ": [], "ADV": [], "PRON": [],
        "AUX_MODAL": [], "ADP": [], "CONJ": []
    }

    for token in doc:
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
        elif tag == "MD" or lemma in MODAL_LEMMAS:
            full_pos_words["AUX_MODAL"].append(token.text)
        elif pos == "ADP":
            full_pos_words["ADP"].append(token.text)
        elif pos in ("CCONJ", "SCONJ"):
            full_pos_words["CONJ"].append(token.text)

    return {k: v for k, v in full_pos_words.items() if v}


def compute_pos_ratios(doc: Doc, pos_counts: Dict[str, int]) -> Dict[str, float]:
    """
    Compute a few robust ratios based on POS counts.
    """

    # Count tokens used for ratios (non-space, non-punct)
    token_count = sum(
        1 for t in doc
        if not t.is_space and not t.is_punct
    )
    if token_count == 0:
        token_count = 1  # avoid division by zero

    noun = pos_counts.get("NOUN", 0)
    verb = pos_counts.get("VERB", 0)
    modal = pos_counts.get("AUX_MODAL", 0)
    pron = pos_counts.get("PRON", 0)
    adj = pos_counts.get("ADJ", 0)
    adv = pos_counts.get("ADV", 0)

    ratios = {}

    # Verb–noun ratio
    if noun > 0:
        ratios["verb_noun_ratio"] = verb / noun
    else:
        ratios["verb_noun_ratio"] = 0.0

    # Modal density (per token)
    ratios["modal_density"] = modal / token_count

    # Pronoun share (per token)
    ratios["pronoun_share"] = pron / token_count

    # Adjective–adverb ratio (optional but useful)
    if adv > 0:
        ratios["adj_adv_ratio"] = adj / adv
    else:
        ratios["adj_adv_ratio"] = float(adj) if adj > 0 else 0.0

    # Nominalization Density (new)
    nominalizations_count = 0
    for token in doc:
        if token.pos_ == "NOUN":
            lower_text = token.text.lower()
            if any(lower_text.endswith(s) for s in NOMINALIZATION_SUFFIXES):
                nominalizations_count += 1
    ratios["nominalization_density"] = nominalizations_count / token_count if token_count > 0 else 0.0

    return ratios


# -------------------------------
# 2. DRAMATISTIC / INTERROGATIVE LENS
# -------------------------------

def _span_text(tokens: List[Token]) -> str:
    """
    Utility: convert a list of tokens to a minimal contiguous span string.
    """
    if not tokens:
        return ""
    doc = tokens[0].doc
    start = min(t.i for t in tokens)
    end = max(t.i for t in tokens) + 1
    return doc[start:end].text.strip()


def _unique_append(bucket: List[str], text: str, seen: set):
    """
    Append text to bucket if non-empty and not seen.
    """
    text = text.strip()
    if not text:
        return
    if text in seen:
        return
    seen.add(text)
    bucket.append(text)


def extract_interrogatives(doc: Doc) -> Dict[str, List[str]]:
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
    doc_text_lower = doc.text.lower()

    # --------------------
    # WHO? (subjects)
    # --------------------
    for token in doc:
        if "subj" in token.dep_:  # nsubj, nsubjpass, etc.
            span = _span_text(list(token.subtree))
            _unique_append(result["who"], span, seen["who"])

    # --------------------
    # WHAT? (main actions)
    # --------------------
    for sent in doc.sents:
        # use ROOT if it is a verb, otherwise any main verb in the sentence
        root = sent.root
        if root.pos_ == "VERB":
            span = _span_text(list(root.subtree))
            _unique_append(result["what"], span, seen["what"])
        else:
            verbs = [t for t in sent if t.pos_ == "VERB"]
            for v in verbs:
                span = _span_text(list(v.subtree))
                _unique_append(result["what"], span, seen["what"])

    # --------------------
    # WHEN? (time)
    # --------------------
    temporal_adverbs = {
        "now", "today", "yesterday", "tonight", "tomorrow",
        "currently", "presently", "recently", "soon", "lately"
    }
    for ent in doc.ents:
        if ent.label_ in ("DATE", "TIME"):
            _unique_append(result["when"], ent.text, seen["when"])

    for token in doc:
        if token.pos_ == "ADV" and token.lemma_.lower() in temporal_adverbs:
            _unique_append(result["when"], token.text, seen["when"])

    # --------------------
    # WHERE? (place)
    # --------------------
    for ent in doc.ents:
        if ent.label_ in ("GPE", "LOC", "FAC"):
            _unique_append(result["where"], ent.text, seen["where"])

    # Prepositional places (simple heuristic)
    place_nouns = {"office", "city", "country", "parliament", "building",
                   "room", "hall", "campus", "village", "town"}
    for token in doc:
        if token.pos_ == "ADP" and token.lemma_.lower() in {"in", "at", "on", "inside", "into"}:
            pobj = [t for t in token.children if t.dep_ in ("pobj", "obl")]
            if pobj:
                # check if it's likely a place
                head_noun = pobj[0].lemma_.lower()
                if pobj[0].ent_type_ in ("GPE", "LOC", "FAC") or head_noun in place_nouns:
                    span_tokens = [token] + list(pobj[0].subtree)
                    span = _span_text(span_tokens)
                    _unique_append(result["where"], span, seen["where"])

    # --------------------
    # WHY? (reason)
    # --------------------
    reason_markers = {"because", "since", "as", "cos", "cause"}
    multi_markers = {"due to", "because of"}

    # Single-word markers
    for token in doc:
        lower = token.text.lower()
        if lower in reason_markers:
            # take clause from this marker to the end of the sentence
            sent = token.sent
            span = sent[token.i - sent.start:].text
            _unique_append(result["why"], span, seen["why"])

    # Multi-word markers (append full sentence)
    for marker in multi_markers:
        for sent in doc.sents:
            if marker in sent.text.lower():
                _unique_append(result["why"], sent.text, seen["why"])

    # --------------------
    # HOW? (manner / process)
    # --------------------
    # Heuristic 1: Phrases and conjunctions indicating manner, capturing the full sentence for context.
    manner_keywords_phrases = {
        "in a way", "in this way", "in that way", "by means of", "as if", "as though", "in the manner"
    }

    for sent in doc.sents:
        sent_text_lower = sent.text.lower()

        # Check for specific phrases indicating manner
        for phrase in manner_keywords_phrases:
            if phrase in sent_text_lower:
                _unique_append(result["how"], sent.text, seen["how"])

        # Check for conjunctions indicating manner ('as', 'like') followed by a clause.
        # This is a bit more complex as 'as' and 'like' can have many meanings.
        # Focusing on clear cases where they introduce a manner clause.
        for token in sent:
            if token.text.lower() == "as" and token.dep_ == "advcl": # e.g., "He spoke as if he knew..."
                _unique_append(result["how"], sent.text, seen["how"])
            if token.text.lower() == "like" and token.dep_ == "prep": # e.g., "She sings like a bird."
                 # check if 'like' has a verbal head and is acting adverbially
                if token.head and token.head.pos_ == "VERB":
                    _unique_append(result["how"], sent.text, seen["how"])

        # New Heuristic: Capture full sentences where an adverb of manner is present.
        # This ensures contextual sentences for general 'how' descriptions.
        for token in sent:
            if token.pos_ == "ADV" and token.dep_ == "advmod" and token.lemma_.lower() not in temporal_adverbs:
                # Only add if it's a known manner adverb for better precision
                if token.lemma_.lower() in MANNER_ADVERBS:
                    _unique_append(result["how"], sent.text, seen["how"])


    # --------------------
    # BY WHAT MEANS? (instrument / method)
    # --------------------
    means_preps = {"by", "with", "through", "using", "via"}
    for token in doc:
        if token.pos_ == "ADP" and token.lemma_.lower() in means_preps:
            span_tokens = [token] + list(token.subtree)
            span = _span_text(span_tokens)
            _unique_append(result["by_what_means"], span, seen["by_what_means"])

    if "by means of" in doc_text_lower:
        for sent in doc.sents:
            if "by means of" in sent.text.lower():
                _unique_append(result["by_what_means"], sent.text, seen["by_what_means"])

    # --------------------
    # TOWARDS WHAT END? (purpose / goal)
    # --------------------
    purpose_markers = {"in order to", "so that", "so we can", "so they can"}
    for marker in purpose_markers:
        if marker in doc_text_lower:
            for sent in doc.sents:
                if marker in sent.text.lower():
                    _unique_append(result["towards_what_end"], sent.text, seen["towards_what_end"])

    # Infinitival purpose clauses: "to VERB" attached as advcl/xcomp (simple heuristic)
    for token in doc:
        if token.text.lower() == "to" and token.nbor(1).pos_ == "VERB":
            span_tokens = [token, token.nbor(1)]
            # expand slightly to the right
            for t in token.nbor(1).subtree:
                span_tokens.append(t)
            span = _span_text(span_tokens)
            _unique_append(result["towards_what_end"], span, seen["towards_what_end"])

    # --------------------
    # WHENCE? (origin / source)
    # --------------------
    whence_preps = {"from", "out of", "since"}
    for token in doc:
        lower = token.text.lower()
        if token.pos_ == "ADP" and (lower in {"from", "since"}):
            span_tokens = [token] + list(token.subtree)
            span = _span_text(span_tokens)
            _unique_append(result["whence"], span, seen["whence"])

    if "out of" in doc_text_lower:
        for sent in doc.sents:
            if "out of" in sent.text.lower():
                _unique_append(result["whence"], sent.text, seen["whence"])

    # --------------------
    # BY WHAT CONSEQUENCE? (effect / outcome)
    # --------------------
    consequence_markers = {"so", "therefore", "thus", "hence"}
    for token in doc:
        lower = token.text.lower()
        if lower in consequence_markers:
            # Take from marker to end of sentence as rough consequence clause
            sent = token.sent
            span = sent[token.i - sent.start:].text
            _unique_append(result["by_what_consequence"], span, seen["by_what_consequence"])

    # Phrases: "as a result", "resulting in", "which led to" (append full sentence)
    if "as a result" in doc_text_lower:
        for sent in doc.sents:
            if "as a result" in sent.text.lower():
                _unique_append(result["by_what_consequence"], sent.text, seen["by_what_consequence"])
    if "resulting in" in doc.text.lower():
        for sent in doc.sents:
            if "resulting in" in sent.text.lower():
                _unique_append(result["by_what_consequence"], sent.text, seen["by_what_consequence"])
    if "which led to" in doc.text.lower():
        for sent in doc.sents:
            if "which led to" in sent.text.lower():
                _unique_append(result["by_what_consequence"], sent.text, seen["by_what_consequence"])

    return result


# -------------------------------
# 3. MAIN ENTRY: PROCESS SEGMENT
# -------------------------------

def process_segment(text: str) -> Dict[str, Any]:
    """
    Core function:
    - Parses the text
    - Computes POS counts & ratios
    - Extracts interrogative lens
    - Collects POS words
    """

    doc = NLP(text)

    pos_counts = compute_pos_counts(doc)
    pos_ratios = compute_pos_ratios(doc, pos_counts)
    interrogative_lens = extract_interrogatives(doc)
    pos_words = collect_pos_words(doc)

    return {
        "text": text,
        "pos_counts": pos_counts,
        "pos_ratios": pos_ratios,
        "interrogative_lens": interrogative_lens,
        "pos_words": pos_words
    }


# -------------------------------
# 4. SIMPLE TEST HARNESS
# -------------------------------

if __name__ == "__main__":
    # --- Add the text you want to analyze here ---
    # Example: text_to_analyze = "Your custom text goes here."
    # Or load from a file:
    # with open("your_document.txt", "r") as f:
    #     text_to_analyze = f.read()

    sample_text = (
        "In 2024, our team at the Commission launched a new pilot in Finland "
        "to make liquidity risks visible earlier. We monitor cash flows with an AI-based "
        "dashboard so the CFO can react faster, because reporting requirements increased "
        "after the last crisis. The movement grew from local activist circles, "
        "which led to broader reforms."
    )

    # Replace sample_text with your actual text_to_analyze if using custom input.
    result = process_segment(sample_text)

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