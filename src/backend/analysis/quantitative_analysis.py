"""
Quantitative explorative corpus analysis utilities.

This module provides a small toolbox for doing quick, exploratory,
quantitative analyses on a folder of plain-text documents. It is based
on the original "Quantitative Explorative Code" notebook and collects
the main steps into reusable functions.

The typical workflow is:

1. Load a zipped corpus of text files.
2. Compute corpus-level sentence and word statistics.
3. Build a token stream, compute type–token ratio (TTR), and inspect
   most frequent content words.
4. Compute TF–IDF scores to obtain top terms per document.
5. Identify salient bigram collocations using PMI.
6. Optionally, inspect concordances for a keyword.
7. Tag sentences with simple WHO / WHY flags using spaCy and regexes.

Requirements
------------
- Python 3.x
- nltk (with "punkt" and "stopwords" resources)
- scikit-learn
- spaCy with the ``en_core_web_sm`` model
- pandas

Notes
-----
The functions are intentionally simple and exploratory. They are meant
for rapid sense-making over a corpus, not for production-grade NLP.
"""

from __future__ import annotations

from pathlib import Path
from collections import Counter
import zipfile
import os
import re
from typing import Iterable, List, Dict, Tuple, Any, Optional

import nltk
from nltk.corpus import stopwords
from nltk.collocations import BigramCollocationFinder, BigramAssocMeasures

from sklearn.feature_extraction.text import TfidfVectorizer

import spacy
import pandas as pd
from src.backend.analysis.language_utils import (
    fallback_spacy_language_code,
    normalize_language_code,
    normalize_language_name,
    resolve_spacy_model,
    safe_stopwords,
    simple_word_tokens,
)


WHY_PATTERNS = {
    "english": re.compile(r"\b(because|in order to|so that)\b", flags=re.IGNORECASE),
    "finnish": re.compile(
        r"\b(koska|jotta|siksi|sen vuoksi|tämän vuoksi)\b",
        flags=re.IGNORECASE,
    ),
}


class QuantitativeAnalysis:
    """Object-oriented wrapper for the quantitative corpus analysis utilities.

    Usage patterns:
      - Initialize with a ZIP archive path: QuantitativeAnalysis(zip_path="corpus.zip")
      - Or initialize with in-memory docs: QuantitativeAnalysis(docs=docs, file_paths=paths)

    Call `run()` to compute a standard set of exploratory outputs.
    The output is a dictionary containing DataFrames and lists that are
    easy to inspect or save by the caller.
    """

    def __init__(
        self,
        zip_path: Optional[str] = None,
        docs: Optional[List[str]] = None,
        file_paths: Optional[List[Path]] = None,
        document_labels: Optional[List[str]] = None,
        spacy_model: Optional[str] = None,
        language_code: str = "en",
    ) -> None:
        self.zip_path = zip_path
        self.docs = docs
        self.file_paths = file_paths
        self.document_labels = document_labels
        self.language_code = normalize_language_code(language_code) or language_code
        self.language_name = normalize_language_name(self.language_code)
        self.spacy_model = resolve_spacy_model(self.language_code, spacy_model)

        # populated after run()
        self.stats_df: Optional[pd.DataFrame] = None
        self.token_info: Optional[Dict[str, Any]] = None
        self.tfidf_df: Optional[pd.DataFrame] = None
        self.bigrams: Optional[List[Tuple[str, str]]] = None
        self.sentence_tags: Optional[pd.DataFrame] = None
        self.concordance: Optional[Dict[str, Any]] = None
        self.evidence_map: Optional[Dict[str, Any]] = None

    def _ensure_corpus_loaded(self):
        if self.docs is None:
            if not self.zip_path:
                raise ValueError("Either `docs` or `zip_path` must be provided")
            self.docs, self.file_paths = load_corpus_from_zip(self.zip_path)

    def run(
        self,
        compute_tfidf: bool = True,
        compute_bigrams: bool = True,
        bigram_min_freq: int = 5,
        concordance_keyword: Optional[str] = None,
        concordance_width: int = 80,
        concordance_lines: int = 10,
    ) -> Dict[str, Any]:
        """Run the standard exploratory analysis and return a result dict.

        Keys returned:
          - 'stats_df': per-document stats (pandas.DataFrame)
          - 'token_info': dict from build_token_stream
          - 'tfidf_df': top terms per document (pandas.DataFrame) or None
          - 'bigrams': list of bigram tuples or None
          - 'sentence_tags': DataFrame of sentence WHO/WHY tags
          - 'concordance': keyword-in-context lines or None
        """
        self._ensure_corpus_loaded()

        # Basic per-document statistics
        self.stats_df = corpus_sentence_word_stats(
            self.docs,
            self.file_paths,
            language_name=self.language_name,
            document_labels=self.document_labels,
        )

        # Token stream and lexical stats
        self.token_info = build_token_stream(
            self.docs,
            stop_lang=self.language_code,
        )

        # TF-IDF top terms
        if compute_tfidf:
            try:
                self.tfidf_df = compute_tfidf_top_terms(
                    self.docs,
                    self.file_paths,
                    stop_lang=self.language_code,
                    document_labels=self.document_labels,
                )
            except Exception:
                self.tfidf_df = None
        else:
            self.tfidf_df = None

        # Bigrams
        if compute_bigrams:
            try:
                self.bigrams = compute_bigram_collocations(self.token_info.get("tokens_filtered", []), min_freq=bigram_min_freq)
            except Exception:
                self.bigrams = []
        else:
            self.bigrams = []

        # Sentence tagging
        try:
            self.sentence_tags = tag_sentences_who_why(
                self.docs,
                language_name=self.language_name,
                spacy_model=self.spacy_model,
                language_code=self.language_code,
            )
        except Exception:
            self.sentence_tags = pd.DataFrame()

        try:
            freq_dist = self.token_info.get("freq_dist", {}) if self.token_info else {}
            keyword = concordance_keyword or most_frequent_keyword(freq_dist)
            self.concordance = build_concordance_data(
                self.token_info.get("tokens", []) if self.token_info else [],
                keyword=keyword,
                width=concordance_width,
                lines=concordance_lines,
            )
        except Exception:
            self.concordance = None

        try:
            self.evidence_map = self.build_evidence_map()
        except Exception:
            self.evidence_map = {}

        return {
            "stats_df": self.stats_df,
            "token_info": self.token_info,
            "tfidf_df": self.tfidf_df,
            "bigrams": self.bigrams,
            "sentence_tags": self.sentence_tags,
            "concordance": self.concordance,
            "evidence_map": self.evidence_map,
        }

    def build_evidence_map(self) -> Dict[str, Any]:
        docs = self.docs or []
        doc_text = "\n".join(docs)

        def build_term_evidence(term: str, *, count: Optional[int] = None) -> Dict[str, Any]:
            term = str(term or "").strip()
            if not term:
                return {}
            pattern = re.compile(rf"\b{re.escape(term)}\b", flags=re.IGNORECASE)
            matches = list(pattern.finditer(doc_text))
            snippets: List[str] = []
            for match in matches[:5]:
                start = max(0, match.start() - 50)
                end = min(len(doc_text), match.end() + 50)
                snippet = doc_text[start:end].replace("\n", " ").strip()
                if snippet not in snippets:
                    snippets.append(snippet)
            return {
                "type": "term",
                "term": term,
                "matched_terms": [term],
                "count": int(count) if count is not None else len(matches),
                "snippets": snippets,
            }

        def build_phrase_evidence(phrase: str) -> Dict[str, Any]:
            phrase = str(phrase or "").strip()
            if not phrase:
                return {}
            phrase_lower = phrase.lower()
            snippets: List[str] = []
            for sent in simple_sentence_candidates(doc_text):
                if phrase_lower in sent.lower():
                    cleaned = sent.strip()
                    if cleaned and cleaned not in snippets:
                        snippets.append(cleaned)
                if len(snippets) >= 5:
                    break
            return {
                "type": "phrase",
                "phrase": phrase,
                "matched_terms": [token for token in phrase.split() if token],
                "snippets": snippets,
            }

        freq_dist = self.token_info.get("freq_dist", {}) if self.token_info else {}
        frequent_terms = []
        for term, count in Counter(freq_dist).most_common(20):
            evidence = build_term_evidence(term, count=count)
            if evidence:
                frequent_terms.append(evidence)

        tfidf_terms = []
        if self.tfidf_df is not None and not self.tfidf_df.empty:
            seen_terms = set()
            for _, row in self.tfidf_df.iterrows():
                for term in row.get("TopTerms", []) or []:
                    lowered = str(term).lower()
                    if lowered in seen_terms:
                        continue
                    seen_terms.add(lowered)
                    evidence = build_term_evidence(str(term))
                    if evidence:
                        tfidf_terms.append(evidence)

        bigram_evidence = []
        for bigram in self.bigrams or []:
            phrase = bigram if isinstance(bigram, str) else " ".join(map(str, bigram))
            evidence = build_phrase_evidence(phrase)
            if evidence:
                bigram_evidence.append(evidence)

        sentence_tag_evidence = []
        if self.sentence_tags is not None and not self.sentence_tags.empty:
            for _, row in self.sentence_tags.head(20).iterrows():
                sentence = row.get("sentence", "")
                sentence_tag_evidence.append(
                    {
                        "type": "sentence",
                        "sentence": sentence,
                        "WHO": bool(row.get("WHO")),
                        "WHY": bool(row.get("WHY")),
                        "matched_terms": simple_word_tokens(sentence, lowercase=False)[:8],
                    }
                )

        concordance_evidence = []
        for line in (self.concordance or {}).get("lines", [])[:10]:
            concordance_evidence.append(
                {
                    "type": "concordance_line",
                    "line": line,
                    "keyword": (self.concordance or {}).get("keyword"),
                    "matched_terms": simple_word_tokens(line, lowercase=False)[:8],
                }
            )

        return {
            "frequent_terms": frequent_terms,
            "tfidf_terms": tfidf_terms,
            "bigrams": bigram_evidence,
            "sentence_tags": sentence_tag_evidence,
            "concordance": concordance_evidence,
        }


def simple_sentence_candidates(text: str) -> List[str]:
    if not text:
        return []
    parts = re.split(r"(?<=[.!?])\s+", text)
    return [part.strip() for part in parts if part.strip()]


def split_keyword_context(text: str, keyword: str) -> Dict[str, str]:
    if not text or not keyword:
        return {
            "left_context": text or "",
            "keyword": keyword or "",
            "right_context": "",
        }
    match = re.search(re.escape(keyword), text, flags=re.IGNORECASE)
    if not match:
        return {
            "left_context": text,
            "keyword": keyword,
            "right_context": "",
        }
    return {
        "left_context": text[: match.start()].strip(),
        "keyword": text[match.start() : match.end()],
        "right_context": text[match.end() :].strip(),
    }


def attach_quant_evidence_to_transcript(
    quant_result: Dict[str, Any],
    transcript_segments: List[Dict[str, Any]],
) -> Dict[str, Any]:
    evidence_map = quant_result.get("evidence_map")
    if not isinstance(evidence_map, dict) or not transcript_segments:
        return quant_result

    def normalize_segment(segment: Dict[str, Any], index: int) -> Dict[str, Any]:
        return {
            "index": index,
            "text": segment.get("text", ""),
            "start": float(segment.get("start", 0) or 0),
            "end": float(segment.get("end", 0) or 0),
            "t": segment.get("t"),
        }

    normalized_segments = [
        normalize_segment(segment, index)
        for index, segment in enumerate(transcript_segments)
        if segment.get("text")
    ]

    def build_context_text(segment_index: int, window_size: int = 2) -> str:
        start_index = max(0, segment_index - window_size)
        end_index = min(len(normalized_segments), segment_index + window_size + 1)
        parts = [
            str(segment.get("text") or "").strip()
            for segment in normalized_segments[start_index:end_index]
            if str(segment.get("text") or "").strip()
        ]
        return " ".join(parts).strip()

    def find_segment_refs(item: Dict[str, Any]) -> List[Dict[str, Any]]:
        candidate_texts: List[str] = []
        for key in ("sentence", "line", "phrase", "term"):
            value = item.get(key)
            if isinstance(value, str) and value.strip():
                candidate_texts.append(value.strip())
        for snippet in item.get("snippets", []) or []:
            if isinstance(snippet, str) and snippet.strip():
                candidate_texts.append(snippet.strip())
        matched_terms = [
            str(term).strip()
            for term in (item.get("matched_terms") or [])
            if str(term).strip()
        ]

        refs: List[Dict[str, Any]] = []
        seen = set()
        for segment in normalized_segments:
            segment_text = segment["text"].lower()
            text_match = any(
                candidate.lower() in segment_text or segment_text in candidate.lower()
                for candidate in candidate_texts
            )
            term_match = bool(matched_terms) and all(
                term.lower() in segment_text for term in matched_terms[:4]
            )
            partial_term_match = bool(matched_terms) and any(
                term.lower() in segment_text for term in matched_terms[:4]
            )

            if not (text_match or term_match or partial_term_match):
                continue

            ref_key = (segment["start"], segment["end"], segment["text"])
            if ref_key in seen:
                continue
            seen.add(ref_key)
            refs.append(
                {
                    **segment,
                    "context_text": build_context_text(int(segment["index"])),
                }
            )
        return refs

    for key, items in list(evidence_map.items()):
        if not isinstance(items, list):
            continue
        enriched_items = []
        for item in items:
            if not isinstance(item, dict):
                enriched_items.append(item)
                continue
            enriched = dict(item)
            enriched["segment_refs"] = find_segment_refs(item)
            enriched_items.append(enriched)
        evidence_map[key] = enriched_items

    quant_result["evidence_map"] = evidence_map

    concordance = quant_result.get("concordance")
    if isinstance(concordance, dict) and concordance.get("keyword"):
        keyword = str(concordance.get("keyword") or "").strip()
        entries: List[Dict[str, Any]] = []
        for segment in normalized_segments:
            if not keyword or keyword.lower() not in segment["text"].lower():
                continue
            entry = {
                **split_keyword_context(segment["text"], keyword),
                "text": segment["text"],
                "start": segment["start"],
                "end": segment["end"],
                "t": segment["t"],
            }
            entries.append(entry)
            if len(entries) >= int(concordance.get("requested_lines") or 10):
                break
        concordance["entries"] = entries
        quant_result["concordance"] = concordance

    return quant_result


def process_quantitative(
    zip_path: Optional[str] = None,
    docs: Optional[List[str]] = None,
    file_paths: Optional[List[Path]] = None,
    **kwargs,
) -> Dict[str, Any]:
    """Compatibility wrapper: run quantitative analysis and return results dict.

    Keeps a simple functional API for callers that expect the old style.
    """
    qa = QuantitativeAnalysis(zip_path=zip_path, docs=docs, file_paths=file_paths, **kwargs)
    return qa.run()




def load_corpus_from_zip(zip_path: str, extract_dir: Optional[str] = None) -> Tuple[List[str], List[Path]]:
    """
    Extract a zipped text corpus and load all ``.txt`` files into memory.

    Parameters
    ----------
    zip_path : str
        Path to the ``.zip`` archive that contains the text corpus.
    extract_dir : str, optional
        Directory where the archive should be extracted. If ``None``,
        the directory name is derived from ``zip_path`` by removing the
        ``.zip`` suffix.

    Returns
    -------
    docs : list of str
        List of document strings, one per ``.txt`` file.
    file_paths : list of pathlib.Path
        Paths to the files from which the documents were read.

    Notes
    -----
    All files ending in ``.txt`` under the extracted directory (recursively)
    are treated as documents. Files are read using UTF-8 with
    ``errors="ignore"`` to avoid crashing on badly encoded characters.
    """
    if extract_dir is None:
        extract_dir = os.path.splitext(os.path.basename(zip_path))[0]

    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        zip_ref.extractall(extract_dir)

    # Many corpora are nested one level deeper; use rglob to be robust.
    base = Path(extract_dir)
    file_paths = list(base.rglob("*.txt"))
    docs = [p.read_text(encoding="utf-8", errors="ignore") for p in file_paths]

    return docs, file_paths


def corpus_sentence_word_stats(
    docs: Iterable[str],
    file_paths: Iterable[Path],
    language_name: str = "english",
    document_labels: Optional[Iterable[str]] = None,
) -> pd.DataFrame:
    """
    Compute per-document sentence and word counts for a corpus.

    Parameters
    ----------
    docs : iterable of str
        Documents whose statistics will be computed. The order must
        correspond to ``file_paths``.
    file_paths : iterable of pathlib.Path
        Paths identifying the documents; used to label rows.

    Returns
    -------
    pandas.DataFrame
        DataFrame with one row per document and the columns:

        - ``"Document"``  : file name
        - ``"Sentences"`` : number of sentences in the document
        - ``"Words"``     : number of word tokens in the document

    Notes
    -----
    Sentence and word tokenisation use ``nltk.sent_tokenize`` and
    ``nltk.word_tokenize`` with default (English) models.
    """
    stats = []

    labels = list(document_labels) if document_labels is not None else []
    for index, (path, doc) in enumerate(zip(file_paths, docs)):
        try:
            sentences = nltk.sent_tokenize(doc, language=language_name)
        except Exception:
            sentences = nltk.sent_tokenize(doc)
        try:
            words = nltk.word_tokenize(doc, language=language_name)
        except Exception:
            words = simple_word_tokens(doc, lowercase=False)
        stats.append(
            {
                "Document": labels[index] if index < len(labels) and labels[index] else path.name,
                "Sentences": len(sentences),
                "Words": len(words),
            }
        )

    df_stats = pd.DataFrame(stats)
    return df_stats


def build_token_stream(
    docs: Iterable[str],
    lowercase: bool = True,
    alpha_only: bool = True,
    remove_stopwords: bool = True,
    stop_lang: str = "english",
) -> Dict[str, Any]:
    """
    Build a global token stream and compute basic lexical statistics.

    Parameters
    ----------
    docs : iterable of str
        Documents to be concatenated into a single token stream.
    lowercase : bool, optional
        If ``True``, text is lowercased before tokenisation.
    alpha_only : bool, optional
        If ``True``, non-alphabetic tokens are removed.
    remove_stopwords : bool, optional
        If ``True``, tokens that occur in NLTK's stopword list for
        ``stop_lang`` are removed when constructing ``tokens_filtered``.
    stop_lang : str, optional
        Language code for stopwords (default is ``"english"``).

    Returns
    -------
    dict
        Dictionary with the following keys:

        - ``"tokens"`` : list of str
            All tokens from the corpus after cleaning.
        - ``"tokens_filtered"`` : list of str
            Tokens after optional stopword and non-alpha filtering.
        - ``"ttr"`` : float
            Type–token ratio (unique types divided by tokens).
        - ``"freq_dist"`` : collections.Counter
            Frequency distribution over ``tokens_filtered``.

    Notes
    -----
    The cleaning here mirrors the original notebook: documents are
    joined into one long string, punctuation and digits are stripped
    with a regex, then the result is split on whitespace.
    """
    text = " ".join(docs)
    if lowercase:
        text = text.lower()

    raw_tokens = simple_word_tokens(text, lowercase=False)
    if not raw_tokens:
        return {
            "tokens": [],
            "tokens_filtered": [],
            "ttr": 0.0,
            "freq_dist": Counter(),
        }

    ttr = len(set(raw_tokens)) / len(raw_tokens)

    if alpha_only:
        tokens_alpha = [w for w in raw_tokens if w.isalpha()]
    else:
        tokens_alpha = list(raw_tokens)

    tokens_filtered = tokens_alpha
    if remove_stopwords:
        sw = safe_stopwords(stop_lang)
        tokens_filtered = [w for w in tokens_alpha if w not in sw]

    freq_dist = Counter(tokens_filtered)

    return {
        "tokens": raw_tokens,
        "tokens_filtered": tokens_filtered,
        "ttr": ttr,
        "freq_dist": freq_dist,
    }


def compute_tfidf_top_terms(
    docs: Iterable[str],
    file_paths: Iterable[Path],
    max_features: int = 1000,
    top_n: int = 10,
    stop_lang: str = "english",
    document_labels: Optional[Iterable[str]] = None,
) -> pd.DataFrame:
    """
    Compute TF-IDF scores and return top terms per document.

    Parameters
    ----------
    docs : iterable of str
        Documents to vectorise.
    file_paths : iterable of pathlib.Path
        Paths whose ``name`` attributes are used as document labels.
    max_features : int, optional
        Maximum vocabulary size for ``TfidfVectorizer``.
    top_n : int, optional
        Number of top terms to return for each document.

    Returns
    -------
    pandas.DataFrame
        DataFrame with columns:

        - ``"Document"`` : document name
        - ``"TopTerms"`` : list of top ``top_n`` terms by TF–IDF score

    Notes
    -----
    The underlying vectoriser uses English stopwords and unigrams by
    default. The TF–IDF matrix is built once and rows are inspected
    to pick top terms for each document.
    """
    stop_words = sorted(safe_stopwords(stop_lang)) or None
    vectorizer = TfidfVectorizer(stop_words=stop_words, max_features=max_features)
    tfidf_matrix = vectorizer.fit_transform(list(docs))
    feature_names = vectorizer.get_feature_names_out()

    records = []
    labels = list(document_labels) if document_labels is not None else []
    for idx, path in enumerate(file_paths):
        scores = tfidf_matrix[idx].toarray().flatten()
        top_idx = scores.argsort()[::-1][:top_n]
        terms = [feature_names[i] for i in top_idx]
        records.append(
            {
                "Document": labels[idx] if idx < len(labels) and labels[idx] else path.name,
                "TopTerms": terms,
            }
        )

    return pd.DataFrame(records)


def compute_bigram_collocations(
    tokens: Iterable[str],
    min_freq: int = 5,
    top_n: int = 50,
) -> List[Tuple[str, str]]:
    """
    Find salient bigram collocations using PMI.

    Parameters
    ----------
    tokens : iterable of str
        Token stream (typically ``tokens_filtered`` from
        :func:`build_token_stream`).
    min_freq : int, optional
        Minimum frequency a bigram must have to be considered.
    top_n : int, optional
        Number of top bigrams to return according to PMI.

    Returns
    -------
    list of (str, str)
        List of bigram tuples sorted by pointwise mutual information (PMI),
        highest first.

    Notes
    -----
    This is a very simple collocation finder that mirrors the behaviour
    of NLTK's ``BigramCollocationFinder`` with PMI as the association
    measure.
    """
    tokens_list = list(tokens)
    finder = BigramCollocationFinder.from_words(tokens_list)
    if min_freq > 1:
        finder.apply_freq_filter(min_freq)
    bigrams = finder.nbest(BigramAssocMeasures().pmi, top_n)
    return bigrams


def most_frequent_keyword(freq_dist: Dict[str, int] | Counter) -> Optional[str]:
    if not freq_dist:
        return None
    try:
        return Counter(freq_dist).most_common(1)[0][0]
    except Exception:
        return None


def build_concordance_data(
    tokens: Iterable[str],
    keyword: Optional[str],
    width: int = 80,
    lines: int = 10,
) -> Dict[str, Any]:
    token_list = list(tokens)
    if not token_list or not keyword:
        return {
            "keyword": keyword,
            "lines": [],
            "width": width,
            "requested_lines": lines,
        }

    keyword_lower = keyword.lower()
    half_window = max(10, width // 4)
    matches: List[str] = []

    for index, token in enumerate(token_list):
        if token.lower() != keyword_lower:
            continue
        start = max(0, index - half_window)
        end = min(len(token_list), index + half_window + 1)
        snippet = " ".join(token_list[start:end]).strip()
        if snippet:
            matches.append(snippet)
        if len(matches) >= lines:
            break

    return {
        "keyword": keyword,
        "lines": matches,
        "width": width,
        "requested_lines": lines,
    }


def concordance_for_keyword(
    tokens: Iterable[str],
    keyword: str,
    width: int = 80,
    lines: int = 25,
) -> None:
    """
    Print concordance lines for a keyword.

    Parameters
    ----------
    tokens : iterable of str
        Token stream in which concordances are to be searched.
    keyword : str
        Keyword whose surrounding context will be printed.
    width : int, optional
        Width of each concordance line (characters).
    lines : int, optional
        Maximum number of concordance lines to display.

    Returns
    -------
    None
        Output is printed to stdout using NLTK's ``Text.concordance``.
    """
    text_obj = nltk.Text(list(tokens))
    text_obj.concordance(keyword, width=width, lines=lines)


def tag_sentences_who_why(
    docs: Iterable[str],
    language_name: str = "english",
    spacy_model: Optional[str] = "en_core_web_sm",
    language_code: Optional[str] = None,
) -> pd.DataFrame:
    """
    Tag sentences with simple WHO / WHY indicators.

    Parameters
    ----------
    docs : iterable of str
        Documents whose sentences will be tagged.
    spacy_model : str, optional
        Name of the spaCy language model to use.

    Returns
    -------
    pandas.DataFrame
        DataFrame with columns:

        - ``"sentence"`` : the sentence text
        - ``"WHO"``      : bool, sentence mentions WHO-like entities
                           (PERSON, ORG, GPE)
        - ``"WHY"``      : bool, sentence contains causal markers such
                           as 'because', 'in order to', 'so that'

    Notes
    -----
    This is a deliberately coarse tagging scheme intended for
    exploratory filtering of sentences that talk about agents (WHO)
    and reasons / purposes (WHY).
    """
    try:
        nlp = spacy.load(spacy_model) if spacy_model else spacy.blank("xx")
    except Exception:
        fallback_lang = fallback_spacy_language_code(language_code)
        nlp = spacy.blank(fallback_lang)

    sentences: List[str] = []
    for doc in docs:
        try:
            sentences.extend(nltk.sent_tokenize(doc, language=language_name))
        except Exception:
            sentences.extend(nltk.sent_tokenize(doc))

    records = []
    pattern = WHY_PATTERNS.get(language_name, WHY_PATTERNS["english"])

    for sent in sentences:
        doc_spacy = nlp(sent)
        who_flag = any(ent.label_ in ["PERSON", "ORG", "GPE"] for ent in doc_spacy.ents)
        why_flag = bool(pattern.search(sent))
        records.append({"sentence": sent, "WHO": who_flag, "WHY": why_flag})

    return pd.DataFrame(records)


if __name__ == "__main__":
    # Example usage with a local ZIP archive.
    # Adjust the path to match your environment.
    example_zip = "analysis.zip"

    if os.path.exists(example_zip):
        print(f"Loading corpus from {example_zip!r}...")
        qa = QuantitativeAnalysis(zip_path=example_zip)
        results = qa.run()

        docs_loaded = qa.stats_df is not None
        if docs_loaded:
            print(f"Loaded {len(qa.stats_df)} documents.")
            print(qa.stats_df.head(10))
            print("Total words:", int(qa.stats_df["Words"].sum()))

        token_info = results.get("token_info", {}) or {}
        print(
            f"Tokens: {len(token_info.get('tokens', []))}, "
            f"Types: {len(set(token_info.get('tokens', [])))}, "
            f"TTR: {token_info.get('ttr', 0.0):.3f}"
        )
        freq = token_info.get("freq_dist")
        if freq:
            print("Most common tokens (filtered):", freq.most_common(20))

        tfidf_df = results.get("tfidf_df")
        if tfidf_df is not None:
            print("\nTop TF–IDF terms per document:")
            print(tfidf_df.head(10))

        bigrams = results.get("bigrams") or []
        if bigrams:
            print("\nTop bigram collocations (PMI):")
            for bg in bigrams[:20]:
                print(bg)

        print("\nConcordance for keyword 'rights':")
        concordance_for_keyword(token_info.get("tokens_filtered", []), "rights", width=80, lines=20)

        df_tags = results.get("sentence_tags")
        if df_tags is not None and not df_tags.empty:
            print("\nExample WHO/WHY-tagged sentences:")
            print(df_tags.head(18))
    else:
        print(
            "Example zip archive 'interviews_enhanced_v1.zip' not found.\n"
            "Import this module and call the functions directly, or update "
            "the path in the __main__ block."
        )
