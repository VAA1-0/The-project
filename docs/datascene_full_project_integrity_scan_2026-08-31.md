# Datascene Full Project Integrity Scan

Date: 2026-08-31  
Scope: 12 active analyses in `research-test-2026` and `bond-cop30-helsinki`  
Method: read-only comparison of analysis records, physical artifacts, JSON timing/content, backend summaries, backend downloads and frontend hydration routes

## Executive result

The seven Marcella analyses are materially complete: each reports 15/15 required branches and retains its source media and correction ledger.

The five restored analyses are heterogeneous. Their transcripts are not deleted: all five transcript artifacts parse and all transcript segments have timing. However, their backend status summaries report zero transcript segments and broad missing-branch lists because restored artifacts are not consistently incorporated into completeness/status accounting.

Four restored bundles are genuinely incomplete relative to the current 15-branch Science-scan contract. No Time to Die is the most complete restored analysis; Diamonds, Brazil, Helsinki and English Brazil lack current-generation visual/statistical branches. The UI currently conflates three states that must remain distinct:

1. artifact truly absent from the saved bundle;
2. artifact present and retrievable but not registered/accounted for;
3. artifact hydrated into a panel but omitted from the bounded status summary.

## Cohort result

| Project | Analyses | Current completeness result |
|---|---:|---|
| Marcella (`research-test-2026`) | 7 | All seven report 15/15 branches |
| Bond/COP30/Helsinki (`bond-cop30-helsinki`) | 5 | All five report gaps, but several reported gaps are false negatives |

All 12 source-video paths exist.

## Transcript audit

Every transcript file exists, parses and contains timed segments:

| Analysis | Segments | Timed segments | Approx. text characters | Frontend route |
|---|---:|---:|---:|---|
| Marcella Spirituality | 34 | 34 | 1,930 | 200 |
| Marcella Time | 27 | 27 | 2,501 | 200 |
| Brazil complete | 62 | 62 | 2,265 | 200 |
| English Brazil short | 2 | 2 | 95 | 200 |
| No Time to Die | 47 | 47 | 1,045 | 200 |
| Helsinki checkpoint | 2 | 2 | 167 | 200 |
| Marcella Vision | 28 | 28 | 2,457 | 200 |
| Marcella Business | 79 | 79 | 6,285 | 200 |
| Diamonds Are Forever | 57 | 57 | 1,296 | 200 |
| Marcella Technology | 63 | 63 | 5,359 | 200 |
| Marcella Health | 59 | 59 | 3,997 | 200 |
| Marcella Space | 22 | 22 | 1,112 | 200 |

The five restored transcripts are therefore **present and frontend-retrievable**. Their `audio_segments: 0` status is a summary/hydration defect, not evidence of missing transcript data.

## Restored-analysis artifact findings

### No Time to Die

Present and retrievable:

- transcript and linked transcript;
- POS and quantitative language analysis;
- audio prosody, diarization and audio sample clouds;
- tracked objects, OCR and expressions;
- source video;
- annotation corrections;
- Master Schema and Scene Cards;
- shot boundaries, spatial tone, adaptive visual scan and native statistical interpretation through the frontend route.

Missing:

- audio-event interval artifact.

Status accounting still incorrectly marks eight branches missing, including transcript, OCR and expressions that are demonstrably present.

### Diamonds Are Forever

Present and retrievable:

- 57-segment timed transcript and linked transcript;
- POS, quantitative analysis and audio prosody;
- diarization scaffold and audio sample clouds;
- tracked objects, OCR and expressions;
- source video;
- 11 visual corrections, 6 label overrides and 5 text corrections;
- Master Schema and nine restored Scene Cards.

Actually absent from the available bundle/current projection:

- audio-event intervals;
- shot boundaries;
- spatial tone scan;
- adaptive visual scan;
- native statistical interpretation.

### Brazil complete

Present and retrievable:

- 62-segment timed transcript and linked transcript;
- POS, quantitative analysis and audio prosody;
- diarization and audio sample clouds;
- tracked objects, OCR and expressions;
- source video;
- 18 visual corrections and 41 label overrides;
- Master Schema and Scene Cards.

Actually absent:

- audio-event intervals;
- shot boundaries;
- spatial tone scan;
- adaptive visual scan;
- native statistical interpretation.

### Helsinki checkpoint

Present and retrievable:

- two-segment timed transcript and linked transcript;
- POS, quantitative analysis and audio prosody;
- OCR and expressions;
- source video;
- 23 visual corrections, one label override and six text corrections;
- several meaning-stage artifacts.

Actually absent:

- audio-event intervals;
- diarization and audio sample clouds;
- tracked-object artifact (YOLO detections exist, but no governed tracked-object output);
- shot boundaries;
- spatial tone scan;
- adaptive visual scan;
- native statistical interpretation;
- Scene Cards.

### English Brazil short

Present and retrievable:

- two-segment timed transcript;
- POS and quantitative analysis;
- YOLO detections, OCR and seven expression samples;
- source video.

Actually absent:

- linked transcript;
- audio prosody, audio-event intervals, diarization and audio sample clouds;
- tracked-object artifact;
- shot boundaries;
- spatial tone scan;
- adaptive visual scan;
- native statistical interpretation;
- annotation correction ledger;
- Scene Cards and the richer governed interpretation artifacts.

This is the thinnest saved bundle and should not be labelled a full current-generation analysis.

## Interface and accounting defects

1. The bounded backend summary counts only inline/current-run result structures for several modalities. It reports zero transcript and OCR rows for restored analyses even when their dedicated artifact routes return valid data.
2. Completeness evaluates legacy/restored records against the modern 15-branch contract without reliably consulting recovered output paths.
3. Backend download routing rejects some advanced artifact names with HTTP 400, while the frontend-local route may return the same artifact successfully. Availability therefore depends on which consumer asks.
4. The Project panel says `Saved analysis · full profile` for bundles that lack required modern branches.
5. A panel can show empty data before dedicated artifact hydration finishes, without identifying whether it is loading, absent, unregistered or incompatible.
6. No in-program matrix exposes the distinction between raw detections, tracked detections, manual annotations, corrections and governed projections.

## Required Datascene mitigation

Add a project-level **Integrity Scan** available from the Project panel. It must show, per analysis and modality:

- `Available and hydrated`;
- `Available but not registered`;
- `Available but not projected`;
- `Missing from saved bundle`;
- `Incompatible legacy artifact`;
- `Failed or corrupt`.

For each row, expose the artifact authority, row/sample count, timing coverage, content hash, import source and the panels consuming it. Repairs must be explicit and non-destructive:

- **Register existing artifact** must not recompute it;
- **Refresh projection** must preserve the original and correction ledger;
- **Run missing analysis branch** must name the computation and estimated cost;
- **Open source evidence** must navigate to the corresponding panel/time;
- **Export integrity report** must preserve the scan used to approve dissemination.

The label `full profile` must be reserved for a verified contract. Restored legacy work should instead show `legacy complete`, `partially restored`, or `current contract verified`.

## Immediate disposition

- No source or annotation data was overwritten during this scan.
- Transcript data should be treated as recovered but incorrectly accounted for.
- The four genuinely incomplete restored bundles require an analyst choice between retaining their documented legacy scope and computing missing modern branches.
- English Brazil short must not be represented as fully restart-ready.

