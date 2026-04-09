# VAA1 Petteri Branch Review And Merge Note

Date: 2026-04-09

## Why this note exists

The `petteri` branch is functioning as a real working integration branch, not as a single-feature branch. It contains multiple development blocks that make sense individually, but should not be merged blindly into `main` as one undifferentiated mass.

The immediate goal is not "merge everything now." The immediate goal is:

- understand what is on `petteri`
- group the work into sensible review blocks
- decide what is mature enough for `main`
- keep the rest safely on `petteri` until it is clearer

## Current branch situation

`petteri` is ahead of `main` by eleven commits:

1. `b223356` Working face-analysis pipeline with core/face bridge
2. `3c6f548` Prepare clean delivery bundle and POS morphology updates
3. `2fe5ed2` Add Mac and Windows delivery note for VAA1 upgrade
4. `b08ff78` Add morphology exchange flow and move analysis launch to project panel
5. `6905c1f` Add analyst-focused quant and POS matrix workflows
6. `15331bb` Add visual cues workflow and constellational support note
7. `6d3eb18` Add cinematic clue workflow and design notes
8. `702bc1d` Add metadata uploads, POS refresh, and queued analysis cooling
9. `93929ee` Add metadata taxonomy and expression weighting layer
10. `bb25fef` Add pyarrow and scenedetect to macOS core environment
11. `4d23cf0` Add motion and scene basis to visual analysis

## Plain-language merge blocks

### Block A: environment and delivery groundwork

- `2fe5ed2`
- `bb25fef`

This block covers environment readiness and delivery-oriented infrastructure. It is comparatively legible and should be easier to review than the larger workflow blocks.

### Block B: morphology, POS, and quant workflow

- `3c6f548`
- `b08ff78`
- `6905c1f`

This block concerns analyst-facing language workflow, matrix work, and launch flow changes. It is functionally meaningful, but should be reviewed as one analytical workflow family rather than as isolated file edits.

### Block C: visual cues, cinematic logic, and motion basis

- `15331bb`
- `6d3eb18`
- `4d23cf0`

This block provides the visual-analysis interpretive path:

- visual cues
- cinematic clues
- motion and scene basis

This block is strategically important for the current sprint spine and should be reviewed as a coherent subsystem.

### Block D: metadata and expression system

- `702bc1d`
- `93929ee`

This block covers:

- upload metadata expansion
- post-upload source media enrichment
- POS refresh from corrected transcript
- queued analysis cooling
- metadata taxonomy
- expression weighting

This is one of the most methodologically important blocks, but also one that benefits from careful review because it changes interpretation logic, UI flow, and saved metadata shape.

### Block E: face pipeline bridge

- `b223356`

This block should remain separately reviewable because face-analysis infrastructure has different technical and legal sensitivities from the rest of the branch.

## Recommended merge stance

Do not merge `petteri` wholesale into `main` yet.

Recommended stance:

- keep using `petteri` as the protected working branch
- review the branch by merge blocks, not by raw file count
- merge only blocks that are understandable, stable, and wanted
- leave unclear or unfinished blocks on `petteri`

## Immediate practical task

The next governance task is:

- perform a structured review of `petteri` against `main`
- decide which merge blocks are ready for `main`
- decide which blocks remain branch-only for now

This is not bureaucracy. It is interpretive and technical risk control.
