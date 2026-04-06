## VAA1 Visual Scan Progress Reporting Note

### Observed issue

During full analysis, progress can appear stuck at `20%` for a long time while the system remains active and the machine is still clearly working.

This appears to happen because:

- `20%` currently covers a long `visual_scan` phase
- the visual phase includes substantial work without finer-grained visible progress
- later stages may complete quickly, making the remaining percentage jump suddenly

So the user experience can look like:

- `20%`
- long apparent stall
- then rapid completion

### Current interpretation

This does not necessarily indicate a failed analysis.

It more likely indicates:

- coarse progress reporting
- insufficient substage visibility inside visual processing

### Why this matters

This can mislead users into thinking:

- the analysis is stuck
- the backend has failed
- the system has frozen

even when the job is actually still running.

### Recommended future fix

Improve progress granularity during `visual_scan`.

Possible approaches:

1. break visual scan into visible substages
- frame sampling
- object detection
- OCR pass
- expression pass
- aggregation

2. advance progress incrementally within visual processing

3. show active substage text even when percentage changes only slightly

4. add a visible note that `visual_scan` may remain at one percentage for extended periods on local hardware

### Short formulation

The analysis may not be stuck at `20%`; the progress model is currently too coarse during the long visual phase and should be made more informative.
