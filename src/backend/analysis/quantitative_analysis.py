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


# Ensure basic NLTK resources are available.
nltk.download("punkt", quiet=True)
nltk.download("stopwords", quiet=True)


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
        spacy_model: str = "en_core_web_sm",
    ) -> None:
        self.zip_path = zip_path
        self.docs = docs
        self.file_paths = file_paths
        self.spacy_model = spacy_model

        # populated after run()
        self.stats_df: Optional[pd.DataFrame] = None
        self.token_info: Optional[Dict[str, Any]] = None
        self.tfidf_df: Optional[pd.DataFrame] = None
        self.bigrams: Optional[List[Tuple[str, str]]] = None
        self.sentence_tags: Optional[pd.DataFrame] = None

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
    ) -> Dict[str, Any]:
        """Run the standard exploratory analysis and return a result dict.

        Keys returned:
          - 'stats_df': per-document stats (pandas.DataFrame)
          - 'token_info': dict from build_token_stream
          - 'tfidf_df': top terms per document (pandas.DataFrame) or None
          - 'bigrams': list of bigram tuples or None
          - 'sentence_tags': DataFrame of sentence WHO/WHY tags
        """
        self._ensure_corpus_loaded()

        # Basic per-document statistics
        self.stats_df = corpus_sentence_word_stats(self.docs, self.file_paths)

        # Token stream and lexical stats
        self.token_info = build_token_stream(self.docs)

        # TF-IDF top terms
        if compute_tfidf:
            try:
                self.tfidf_df = compute_tfidf_top_terms(self.docs, self.file_paths)
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
            self.sentence_tags = tag_sentences_who_why(self.docs, spacy_model=self.spacy_model)
        except Exception:
            self.sentence_tags = pd.DataFrame()

        return {
            "stats_df": self.stats_df,
            "token_info": self.token_info,
            "tfidf_df": self.tfidf_df,
            "bigrams": self.bigrams,
            "sentence_tags": self.sentence_tags,
        }


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
    docs: Iterable[str], file_paths: Iterable[Path]
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

    for path, doc in zip(file_paths, docs):
        sentences = nltk.sent_tokenize(doc)
        words = nltk.word_tokenize(doc)
        stats.append(
            {
                "Document": path.name,
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

    # Remove everything that is not a lowercase letter or whitespace.
    text_clean = re.sub(r"[^a-z\s]", " ", text)
    raw_tokens = text_clean.split()
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
        sw = set(stopwords.words(stop_lang))
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
    vectorizer = TfidfVectorizer(stop_words="english", max_features=max_features)
    tfidf_matrix = vectorizer.fit_transform(list(docs))
    feature_names = vectorizer.get_feature_names_out()

    records = []
    for idx, path in enumerate(file_paths):
        scores = tfidf_matrix[idx].toarray().flatten()
        top_idx = scores.argsort()[::-1][:top_n]
        terms = [feature_names[i] for i in top_idx]
        records.append({"Document": path.name, "TopTerms": terms})

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
    spacy_model: str = "en_core_web_sm",
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
    nlp = spacy.load(spacy_model)

    sentences: List[str] = []
    for doc in docs:
        sentences.extend(nltk.sent_tokenize(doc))

    records = []
    pattern = re.compile(r"\b(because|in order to|so that)\b", flags=re.IGNORECASE)

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
