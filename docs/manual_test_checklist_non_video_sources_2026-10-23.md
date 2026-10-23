# Deferred manual acceptance — non-video source families

Run after each source family has an operational ingestion path. A toolbar entry
or successful preflight is not acceptance.

For every case below, verify: source identity and canonical coordinates;
project-private storage; actual hydration in every associated panel; panel-local
navigation back to the source; confirm-once maturation in Master Schema; no
duplicate confirmation request; save/reopen; detached-panel return; export;
isolated restore; and explicit missingness for unsupported consumers.

1. **Text-only import** — plain text and one structured document; paragraph,
   sentence and character offsets remain stable through correction/export.
2. **Single-frame photograph** — image dimensions and pixel/normalized regions;
   visual/object/OCR consumers hydrate without inventing a video clock.
3. **Audio/music import** — sample clock, waveform, transcript/diarization,
   speaker and music evidence; no fabricated visual consumer.
4. **Graphics import** — SVG and one raster graphic remain distinct; text,
   shapes and spatial relations retain graphic-native coordinates.
5. **Saved web-page import** — immutable capture identity, URL/capture time,
   DOM/text/media anchors and offline restoration; never analyze live mutable
   content as though it were the saved source.
6. **Reference-data import** — CSV/JSON table identity, row/column/cell anchors,
   schema and missing values; joins remain governed and reversible.

Record one passing and one deliberately failing boundary case for each family.
Cross-project membership mismatch must fail closed in every case.
