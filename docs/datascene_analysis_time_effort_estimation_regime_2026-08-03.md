# Datascene/VAA1 Analysis Time and Effort Estimation Regime

Date: 2026-08-03
Runtime basis: one governed analysis at a time on the current Mac workstation

## Purpose

Datascene estimates analysis cost from source duration, analysis tier, enabled modalities, resolution/frame rate, and measured local throughput. An estimate is a planning range, not a completion promise. The displayed estimate must be recalibrated from completed runs on the same machine.

## A. Quick sweep

Purpose: transcript-led orientation and selection of material for deeper analysis.

- Operational profile: audio and language analysis; heavy object, OCR, expression, face, and annotated-video passes are omitted.
- Expected elapsed effort: **0.5–1.5 processing minutes per source minute**.
- Planning estimates: 3-minute source **2–5 min**; 5-minute source **3–8 min**; 8-minute source **4–12 min**.
- Suitable for: corpus intake, transcript availability, initial search, triage, and selection.
- Not equivalent to a completed multimodal scientific analysis.

## B. Science scan

Purpose: the main research-grade multimodal analysis.

- Operational profile: visual sampling at approximately one-second intervals, OCR, objects, expressions, face sampling, audio/transcription, prosody, language analysis, scene construction, and governed derived artifacts.
- Expected elapsed effort on the current Mac: **15–35 processing minutes per source minute** for ordinary material.
- Planning estimates: 3-minute source **45–105 min**; 5-minute source **75–175 min**; 8-minute source **120–280 min**.
- High-resolution, face-dense, text-dense, visually complex, or transcript-fallback material should use the upper end of the range.
- This is the default tier for the scientific corpus test.

## C. Forensic scan

Purpose: dense temporal inspection of selected sources or intervals.

- Operational profile: object detection approaches frame-level sampling; OCR and expression sampling run at approximately 0.5-second intervals; annotated outputs and the full enabled modality branches remain active.
- Expected elapsed effort on the current Mac: **180–600 processing minutes per source minute**.
- Planning estimates: 3-minute source **9–30 h**; 5-minute source **15–50 h**; 8-minute source **24–80 h**.
- Suitable for: bounded evidentiary intervals, difficult detections, and selected passages requiring dense temporal coverage.
- It is not operationally suitable as the default first pass over a multi-video corpus on the current laptop.

## Estimation formula

`estimated elapsed time = source minutes × calibrated tier rate × modality factor × media-complexity factor`

Initial factors:

- Multimodal: `1.00`
- Images/graphics only: `0.55–0.85`
- Audio/text only: `0.20–0.45` relative to Science scan
- 1080p or unusually dense visual content: `1.20–1.60`
- Transcript fallback or repeated recovery: add the measured branch time rather than hiding it in pipeline percentage

After a run begins, Datascene should replace the broad planning range with a live estimate derived from completed work units and recent throughput:

`remaining time = remaining governed work units ÷ rolling completed-work-unit rate`

The live view must show the estimate range, active stage, completed/total units, recent rate, and confidence. Queue completion is the sum of remaining active-run time, cooling periods, and estimates for queued analyses in their actual order.

## Current calibration evidence

- The completed 190-second Science scan required roughly 44 minutes for its recovered visual pass, followed by about 2 minutes for its resumed audio/language branch; later derived artifact writing continued separately.
- The active 333-second Science scan face pass is currently processing approximately one sampled frame every 12–14 seconds.
- These observations justify using a range. They do not yet constitute a stable machine-wide benchmark across resolution, duration, and content types.

## Operational decision for tomorrow

Run Quick sweep when rapid corpus accessibility is the immediate requirement. Run Science scan sequentially for publication-grade multimodal material, prioritizing the shortest or most important sources. Reserve Forensic scan for analyst-selected intervals after the Science scan identifies where dense inspection is warranted.
