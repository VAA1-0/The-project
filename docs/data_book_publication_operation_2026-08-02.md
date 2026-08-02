# Data Book publication operation

The Download panel generates two governed publication types from completed analyses:

- **Video publication** preserves one video identity, source clock, authority context, Data Book, scientific report, associated files, validation, history, and integrity manifest.
- **Corpus publication** preserves each selected completed video as its own video publication and adds a corpus manifest without flattening video identities.

## Human-readable archive layout

Internal registry identifiers stay inside JSON manifests. Archive names and chapter paths use readable analyst-facing labels, for example:

```text
Data Book/
  Data Book.json
  Chapters/
    01 - Video and Source Media/
    02 - Transcript/
    03 - Parts of Speech/
    04 - Quantitative Language Analysis/
    05 - Objects and Props/
    06 - On-Screen Text/
    07 - Expressions/
    08 - Audio and Prosody/
    09 - Speakers and Diarization/
    10 - Scene Cards/
    11 - Systemic Functional Language/
    12 - Meaning and Plot/
    13 - Narrative Agents/
    14 - Statistical Analysis/
    15 - POS and Quant Matrices/
    16 - Master Schema and Governance/
    17 - Search and Retrieval/
Scientific Report/
Publication Manifest.json
```

Every operational feature receives exactly one chapter. Missing feature output is published as a governed empty chapter rather than omitted. Existing artifacts below the configured embed limit are included; larger files remain checksum-addressed references so publication does not duplicate multi-gigabyte source media by default.

ZIP entries are written in lexicographic order with fixed timestamps and SHA-256 identities. Rebuilding an unchanged video edition therefore produces the same archive checksum.

## Manual operation

1. Open **Download** for a completed video.
2. Open **Data Book publication**.
3. Choose **Generate video publication** or **Generate corpus publication**.
4. Inspect the readable chapter tree and validation state.
5. Select **Download ZIP**.

The canonical schema is stored at `docs/schemas/Datascene Data Book Publication Schema v1.0.0.json`.
