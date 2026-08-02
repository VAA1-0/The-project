# Research corpus ingestion runbook — 2026-08-02

## Delivered operating envelope

- One governed research project may ingest multiple videos in one selection.
- Default per-video ceiling: 6 GiB.
- Default selected-corpus ceiling: 12 GiB.
- Reserved free workspace after source ingestion: 8 GiB.
- Uploads run sequentially, display per-file progress, and write in bounded 8 MiB chunks.
- Incomplete or size-mismatched uploads are removed.
- The source video is retained by the backend; the upload path does not duplicate the full corpus into browser IndexedDB.
- Every video in the selection receives the same persistent `project_id`.
- The Project analysis queue runs one analysis at a time and survives a browser refresh.
- Backend analysis records and stage checkpoints are written atomically.
- After a backend restart, an interrupted job is returned to the queue and resumes from its latest completed visual or audio/language branch checkpoint.

The ceilings can be calibrated before backend startup:

```bash
export VAA1_MAX_VIDEO_UPLOAD_BYTES=6442450944
export VAA1_MAX_RESEARCH_CORPUS_BYTES=12884901888
export VAA1_RESEARCH_WORKING_RESERVE_BYTES=8589934592
```

These are the defaults and therefore do not need to be exported for the planned eight-video, 3.4 GB test.

## Eight-video intake

1. Start the backend and frontend using the canonical macOS startup runbook.
2. Choose **File → Upload** and select all eight videos in one file selection.
3. Confirm that the header reports `8 videos` and approximately `3.40 GB`.
4. Enter one research-project identifier and keep it unchanged for the complete batch.
5. Select **Upload**. Capacity is checked for the whole selection before the first transfer begins.
6. Keep the browser and backend running until all eight per-file counters complete. Files transfer sequentially.
7. Open **Project**, confirm eight uploaded records, and add the records to **Analysis queue**.
8. Run the queue. One video is analyzed at a time; refreshing the browser preserves the pending queue and active job reference.

## Interruption recovery

The backend writes `analysis_checkpoint.json` inside the analysis result directory after each completed expensive branch. A recovered run validates all retained output paths before reusing the checkpoint.

- If the visual branch completed, visual detection, OCR, expression, and linked visual artifacts are reused.
- If the audio/language branch completed, audio extraction, transcription, prosody, diarization, POS, and Quant artifacts are reused.
- If interruption occurred inside a branch, that incomplete branch starts again; the previous completed branch is not repeated.
- Consolidation and derived governed artifacts run again when necessary so the final record reflects all recovered branch outputs.
- If a checkpoint references a missing artifact, it is rejected and the affected pipeline is recomputed.

When the backend restarts, the next Project-panel refresh changes the stale `processing` record to `interrupted`, places it back at the head of the persisted queue, and launches it when no other analysis is running. The event log retains the interrupted stage, previous progress, recovery time, completed checkpoint stages, and resume count.

## Capacity interpretation

Admission is based on:

`selected source bytes + configured working reserve <= current free workspace bytes`

The reserve protects space for intermediate and result artifacts. A fresh analysis is blocked before launch if the reserve is no longer present. This prevents a later corpus member from starting into an already exhausted workspace. Free space should still be reviewed during a long forensic run because output volume depends on duration, resolution, sampling density, and retained renders.

## Verification supplied

`tests/test_research_corpus_ingestion.py` verifies:

- admission of eight files totaling exactly 3,400,000,000 bytes with the current operating envelope;
- rejection when ingestion would consume the working reserve;
- cleanup after a per-file limit violation;
- cleanup after an interrupted or incomplete size transfer.

`tests/test_analysis_recovery.py` verifies atomic checkpoint round-trip, invalidation when an expected artifact disappears, and conversion of a stale processing record into a resumable interrupted record.
