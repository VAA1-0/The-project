# YOLOv8 object-detection development regime verification

Date: 26 October 2026

## Decision

The analyst explicitly selected Ultralytics YOLOv8n for Datascene development
and research. This is not a silent Datascene licensing decision and it does not
make YOLOv8 the frozen release provider. The selection, analyst authority,
threshold and provider receipt travel with the analysis traceback.

The current development threshold is 0.15. It is adjustable in Analysis setup
and the working Tools surface. Detector observations remain candidates; the
lower threshold increases recall and analyst review volume but grants no
semantic maturity.

## Measured source check

Source: active No Time To Die artifact, duration 155.125 seconds. Thirty-one
frames were sampled at five-second intervals across the complete source.

| Threshold | Detections | Frames with detections | Maximum/frame | Detections at or after 1:21 |
| --- | ---: | ---: | ---: | ---: |
| 0.25 | 75 | 26/31 | 9 | 32 |
| 0.15 | 100 | 27/31 | 12 | 41 |

At 0.15 the most frequent raw labels were person (53), car (14), tie (9), bench
(4), chair (3) and television (3). These counts demonstrate usable source
coverage, not calibrated precision or semantic confirmation.

The one-second Science Scan equivalent was then run over 155 source timestamps
at the selected 0.15 threshold. It produced **470 raw detections across 129/155
sampled frames**, with a maximum of 14 detections in one frame. The section at
or after 1:21 contained **197 detections across 59 frames with detections**. The
largest raw classes were person (273), car (75), tie (35), television (8), book
(8), motorcycle (6), bench (5), truck (5) and mobile phone (5). Execution took
15.5 seconds on the current local CPU environment.

## Model-change persistence

Object detector runs are append-only. Changing provider or threshold triggers
a targeted visual recomputation even when a prior visual checkpoint is marked
complete. The earlier run remains active in `object_detection_runs`; associated
panels receive the governed union of provider-scoped raw detections and tracks.
Exact repeated observations from the same provider may be visually deduplicated
while retaining all contributing run ids.

The Objects workbench now exposes `All active detector runs`, provider-scoped
and individual-run filters. Provider lineage is printed in each family and
thumbnail. Confirmed Master Schema objects are deliberately immune to those
filters: selecting a detector changes only the raw-evidence view and cannot hide
or demote a mature analyst decision. New confirmations use a provider/run-scoped
track UID, while legacy numeric track references remain resolvable for existing
confirmations.

Mature Master Schema confirmations are not part of detector-run replacement.
They remain mature, continue to proliferate, and are never reopened merely
because YOLOv8, DETR, a threshold, or another analytical motor changed.

## Remaining acceptance

- Run the same one-second Science Scan through the normal background API and
  verify its checkpoint/run-registry receipt; the detector-equivalent source
  sweep itself has passed.
- Inspect recall and false-positive workload after 1:21 in the rendered Objects
  workbench.
- Confirm one object family and verify Master Schema plus associated consumers.
- Change provider or threshold once and verify both raw runs, the mature claim,
  save/reopen and export/restore.
