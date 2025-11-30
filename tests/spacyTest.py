import spacy
nlp = spacy.load("en_core_web_sm")
doc = nlp("Tesla released a new software update on September 10, 2025 in Berlin.")
for ent in doc.ents:
    print(ent.text, "->", ent.label_)