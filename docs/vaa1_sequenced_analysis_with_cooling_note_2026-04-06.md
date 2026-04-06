## VAA1 Sequenced Analysis With Cooling Intervals

### Working need

VAA1 should support unattended analysis of multiple videos in sequence on modest local hardware such as a household Mac.

The core practical issue is thermal load. Long multimodal analyses can keep CPU usage high for extended periods, which may:

- slow later analyses
- increase fan noise
- reduce system responsiveness
- raise the risk of throttling
- make unattended batch work less reliable

### Desired capability

VAA1 should offer a queued analysis mode in which:

- the analyst selects multiple videos
- the system analyzes them one by one
- a configurable cooling interval is inserted between analyses
- the next analysis begins automatically after that interval

This would allow analysts to leave VAA1 running while away from the workstation.

### Practical form

The first useful version can be simple.

- queue selected videos
- run one analysis at a time
- wait a defined number of minutes between runs
- show queue state in the UI
- allow pause, resume, skip, and cancel

### Suggested settings

- no cooling interval
- 2 minutes
- 5 minutes
- 10 minutes
- custom interval

Optional later behavior:

- longer cooling after especially heavy runs
- cooling only when CPU temperature or sustained load has crossed a threshold
- lower-power analysis mode for queue work

### Why this matters

This is not only a convenience feature.

It strengthens:

- unattended use
- reliability on local machines
- practical batch processing
- energy and thermal awareness
- analyst workflow continuity

It also supports later software-environment economics testing, because VAA1 can compare:

- continuous back-to-back analysis
- queued analysis with cooldown
- lighter vs heavier analysis modes

### Methodological note

This feature belongs to the operational layer rather than the governance layer. It improves actual day-to-day use of VAA1 without changing the underlying analytic doctrine.

### Recommended delivery order

1. basic queued analysis list
2. fixed cooling interval between jobs
3. queue controls in Project or Tools
4. unattended run summary
5. later: temperature/load-aware arbitration

### Short formulation

VAA1 should support sequenced unattended analysis with cooling intervals between jobs so that multiple videos can be processed safely and practically on modest local hardware.
