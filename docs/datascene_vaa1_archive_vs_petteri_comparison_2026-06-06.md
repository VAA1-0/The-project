# Datascene/VAA1 Archive Vs Git Petteri Comparison

Date: 2026-06-06

Archive compared:

```text
datascene_vaa1_windows_pipeline_handoff_2026-06-06.tar.gz
```

Git branch compared:

```text
petteri
```

Git commit:

```text
0bc740e755857c7bfc608198c247a759717a17b9
```

## Bottom Line

The handoff archive is materially richer than the committed Git `petteri` branch.

The archive contains:

- local Mac analysis outputs,
- uploaded media,
- untracked documentation,
- untracked test files,
- Playwright setup,
- transcript timing guard source/tests,
- investor deck files,
- Windows full-operation handout,
- current Mac-local modifications to tracked source files.

Therefore a plain GitHub clone of `petteri` will not reproduce the same Datascene/VAA1 capability currently present in the archive.

## Counts

Normalized file comparison:

```text
archive file entries: 5498
git-tracked files:    2460
archive-only files:   3078
```

Most archive-only files are generated/local analysis materials:

```text
3046 outputs/
  10 uploads/
   9 src/
   9 docs/
   1 tests/
   1 scripts/
   1 task_timing.log
   1 run_vaa1_lite.sh"
```

## Important Archive-Only Files Missing From Git Petteri

These files are in the archive but not tracked in Git:

```text
docs/datascene_investor_deck_visual_brief_2026-06-06.md
docs/datascene_vaa1_pipeline_archive_manifest_2026-06-06.md
docs/datascene_vaa1_windows_full_operation_handoff_2026-06-06.md
docs/investor_deck/datascene_investor_deck_editable_2026-06-06.pptx
docs/vaa1_transcript_timing_authority_bug_report_2026-06-05.md
docs/working_handover_handout_2026-06-03_Z_meaning_network_sfl_thread.md
scripts/generate_datascene_investor_deck.js
src/backend/analysis/transcript_timing_guard.py
src/frontend/e2e/dashboard-smoke.spec.ts
src/frontend/lib/transcript-time.js
src/frontend/playwright-report/index.html
src/frontend/playwright.config.ts
src/frontend/tests/transcript-time.test.mjs
tests/test_transcript_timing_guard_contract.py
```

Also present in the archive but not tracked:

```text
outputs/
uploads/
task_timing.log
```

The `outputs/` and `uploads/` folders are likely a major reason the Mac machine appears richer than a thin Git clone: they contain saved analyses, generated transcripts, frame outputs, audio artifacts, metadata, and media inputs.

## Tracked Git Files With Newer Mac-Local Versions In The Archive

These files are tracked in Git, but the Mac worktree version differs from the committed `petteri` branch. The archive contains the Mac-local version:

```text
.gitignore
WINDOWS_DEV_QUICKSTART.md
api_server.py
docs/vaa1_general_sprint_regime_remaining_tasks.md
package-lock.json
package.json
src/frontend/app/V2components/components/panels/POSAnalyzePanel.tsx
src/frontend/app/V2components/components/panels/POSMatrixPanel.tsx
src/frontend/app/V2components/components/panels/QuantMatrixPanel.tsx
src/frontend/app/V2components/components/panels/QuantitativeAnalysisPanel.tsx
src/frontend/app/V2components/components/panels/SpeechToTextPanel.tsx
src/frontend/lib/annotation-corrections.ts
src/frontend/lib/api-service.ts
src/frontend/lib/video-service.ts
src/frontend/package-lock.json
src/frontend/package.json
```

These differences include recent transcript timing authority work, POS/Quant timing work, Windows handoff updates, runtime/dependency changes, and investor deck generation dependencies.

## Git Files Not Included In The Archive

Some tracked Git files were intentionally excluded from the archive because they are local/dependency/cache/runtime materials, for example:

```text
node_modules/.package-lock.json
logs/
tmp/
build/
.idea/
.vscode/
Python cache files
frontend build/test artifacts
selected zip/cache artifacts
```

This is expected. The archive was rebuilt specifically to avoid transferring Mac virtual environments, IDE folders, dependency installs, caches, and old archives.

## Practical Meaning For The Windows Colleague

A Windows clone of Git `petteri` is missing three classes of material:

1. **Mac-local source/test/docs changes** that have not been committed.
2. **Local operating materials** such as uploads and outputs.
3. **Runtime/generated artifacts** needed to demonstrate current Mac feature richness.

If the goal is full Windows parity, use the archive, not only Git.

If the goal is to make GitHub `petteri` match the archive, the next step is to commit and push the intentional source/docs/test changes while still keeping large/local media outputs out of Git unless explicitly approved.
