import spacy
from typing import Dict, List


class NLPProcessor:
    """
    NLP Pipeline using spaCy for:
    - Cleaning transcript text
    - Sentence segmentation
    - Keyword (noun chunk) extraction
    - Named Entity Recognition (NER)
    """

    def __init__(self, model_name: str = "en_core_web_sm"):
        """
        Initialize spaCy model.
        """
        try:
            self.nlp = spacy.load(model_name)
        except OSError:
            raise RuntimeError(
                f"SpaCy model '{model_name}' is not installed. "
                f"Install it using: python -m spacy download {model_name}"
            )

    def clean_text(self, text: str) -> str:
        """
        Basic cleanup for Whisper / OCR output.
        Removes multiple spaces, trims whitespace.
        """
        if not text:
            return ""

        text = " ".join(text.split())
        return text.strip()

    def process(self, text: str) -> Dict:
        """
        Full NLP pipeline:
        1. Clean text
        2. Sentence segmentation
        3. Extract noun chunks (keywords)
        4. Named Entity Recognition (NER)
        """

        cleaned = self.clean_text(text)
        document = self.nlp(cleaned)

        # Extract sentences
        sentences = [sent.text.strip() for sent in document.sents]

        # Extract keywords (noun chunks)
        keywords = list({chunk.text.lower() for chunk in document.noun_chunks})

        # Extract entities
        entities = [
            {
                "text": ent.text,
                "label": ent.label_,
                "start_char": ent.start_char,
                "end_char": ent.end_char
            }
            for ent in document.ents
        ]

        return {
            "cleaned_text": cleaned,
            "sentences": sentences,
            "keywords": keywords,
            "entities": entities,
            "entity_summary": self.summarize_entities(entities)
        }

    def summarize_entities(self, entities: List[Dict]) -> Dict[str, List[str]]:
        """
        Groups Named Entities by type to return a structured summary.
        Example: {"DATE": ["January 1, 2025"], "ORG": ["Tesla"]}
        """
        entity_map = {}

        for ent in entities:
            label = ent["label"]
            entity_map.setdefault(label, []).append(ent["text"])

        return entity_map


# Standalone test
if __name__ == "__main__":
    nlp_engine = NLPProcessor()
    sample = """
    Tesla released a new update on September 10, 2025 in Berlin.
    The camera detected an employee near the assembly line.
    """

    result = nlp_engine.process(sample)

    print("\n--- NLP OUTPUT ---")
    print("Cleaned:", result["cleaned_text"])
    print("\nSentences:", result["sentences"])
    print("\nKeywords:", result["keywords"])
    print("\nEntities:", result["entities"])
    print("\nEntity Summary:", result["entity_summary"])
