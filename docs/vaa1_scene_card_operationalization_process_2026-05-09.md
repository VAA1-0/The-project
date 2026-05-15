# VAA1 Scene Card Operationalization Process - 2026-05-09

## Delivered in this development pass

- Added a Mise-en-scene Scene Cards artifact and UI panel.
- Registered Scene Cards and Source Extraction Metadata Summary as downloadable outputs.
- Added status-refresh regeneration so missing, thin, stale, or older scene-card artifacts are rebuilt from available VAA1 evidence.
- Added transcript-window scene splitting for long transcript-led videos that only have one detected scene boundary.
- Surfaced exact transcript lines in the Scene Card panel and made them navigable back to source time.
- Added Scene Card correction entry points so manual notes can be saved back to the Scene leaf.
- Routed mature transcript corrections into Scene Cards, following the VAA1 maturity principle: manual and mature evidence surfaces above raw detections.
- Added deterministic sentence-level NLP summaries for:
  - what is happening,
  - who is speaking,
  - the situation,
  - meanings being constructed,
  - phenomena occurring in the material.
- Added transcript topic modeling v3 so Scene Cards can identify evidence-bound topics such as:
  - street interview about existential belonging,
  - climate summit reporting,
  - government climate-policy comment,
  - spy-thriller betrayal and secrets,
  - Bond action-trailer threat.
- Added mature identity and role evidence into the "who is speaking" description when available from manual identification, role annotations, or identity triangulation candidates.
- Added Meaning / Plot evidence to Scene Cards.
- Added audio prosody cues as scene events when available.
- Added ontology facets for costume, action, cinematic cues, genre form, and subject domain.
- Added no-store download behavior and frontend cache busting so Scene Cards do not keep serving stale artifacts.
- Simplified per-card UI titles from "Mise-en-Scene Scene Card 001" to "Scene Card 001".
- Added AI Agent process starter contracts for future governed extensions:
  - metadata harvesting,
  - webpage comparison,
  - LLM/RAG boundary,
  - report writing,
  - audio command interface,
  - native learning and pattern accumulation.

## Operational gaps that remain

- The prose is still deterministic and rule-bound. It is improving, but it is not yet natural editorial prose.
- The current topic model is a practical local matcher, not a general NLP topic model. It needs broader domain coverage and better phrase weighting.
- Speaker identity is surfaced when mature identity evidence exists, but it does not yet perform robust speaker-to-face alignment.
- Scene boundaries are still fallback transcript windows when visual scene segmentation is weak. A stronger scene-boundary pass should combine:
  - transcript gaps,
  - audio prosody changes,
  - visual transition clues,
  - object/person continuity,
  - OCR/title-card cues.
- Meaning / Plot evidence is shown, but the relation between plot labels and Scene Card prose still needs stronger synthesis.
- Archive genre trees are represented as facets, but the larger national-archive genre ontology still needs governed import, editing, and propagation rules.
- Source Extraction Metadata Summary exists separately so original media metadata is not diluted, but archive metadata contribution workflows need user review states.
- Manual correction UX exists, but faster inline editing of Scene Card fields remains to be operationalized.
- AI/LLM annotations are only represented as governed starter contracts. Real API-backed annotations should remain opt-in, auditable, and clearly separated from deterministic evidence.
- Analysis rhythm needs a deliberate source-metadata opening pass: VAA1 should read beginning/title-card OCR, end-title/credit OCR, embedded camera/device metadata, GPS/date tags, and source-file media facts early, build a governed metadata schema from that evidence, and only then proliferate probable identities, places, roles, production crew, topics, and scene-card hints into downstream panels. Raw OCR and embedded tags must remain separately auditable.
- Next-stage maturation should include analyst-confirmed pattern naming. VAA1 can detect recurring visual, audio, narrative, SFL/interaction, prosody, object/person, or scene-structure patterns, but should ask the user to confirm, rename, merge, or reject important patterns before treating them as mature linked data. Confirmed pattern names should feed Master Schema, Scene Cards, Source Media metadata, Traceback, and later learning loops with source evidence and review state intact.

## Recommended next sprint

1. Strengthen Scene Card prose generation.
   Add better sentence templates, topic weighting, and domain-specific summaries for news, trailers, interviews, archive footage, and institutional recordings.

2. Implement source-metadata rhythm pass v1.
   Prioritize beginning/end OCR, embedded media tags, media facts, title cards, end credits, GPS/date/device metadata, and production-crew cues before later interpretation. Feed confirmed/proposed fields into Master Schema and Source Media metadata with maturity state and traceback.

3. Implement scene-boundary pass v1.
   Combine transcript gaps, audio prosody shifts, OCR/title-card cues, visual object/person continuity, and shot/transition clues into a candidate scene boundary artifact.

4. Mature identity routing.
   Feed identity triangulation and manual role evidence into Master Schema first, then redistribute mature identity labels to Scene Cards, Transcript, OBJ, and Meaning / Plot panels.

5. Add analyst-confirmed pattern naming.
   Present detected visual, audio, narrative, interaction, and prosody patterns as compact candidates. Let the user confirm names, link them to existing entities or pattern families, reject weak candidates, and preserve each decision in Master Schema with traceback.

6. Add inline Scene Card corrections.
   Let archive users correct topic, role, situation, genre, and summary text from the Scene Card panel while preserving raw detections.

7. Add report export polish.
   Turn the current Markdown draft into a cleaner archive-facing report with evidence links, scene navigation, and source extraction metadata separation.

## Validation run before push

- `conda run -n vaa1_core python -m unittest tests.test_mise_en_scene_scene_card_contract tests.test_ai_agent_feature_starters_contract`
- `conda run -n vaa1_core python -m py_compile api_server.py src/backend/analysis/mise_en_scene_scene_card.py`
- `npx tsc --noEmit`
- `npx eslint app/V2components/components/panels/SceneCardPanel.tsx`
