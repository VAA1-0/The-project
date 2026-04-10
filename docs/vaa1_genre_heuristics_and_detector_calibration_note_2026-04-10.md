VAA1 Genre Heuristics And Detector Calibration Note
2026-04-10

Purpose

This note records an important distinction in VAA1's current visual-analysis workflow:

1. extracted evidence
2. heuristic descriptive wording
3. true genre detection

These must not be conflated.

Current issue

The motion and scene basis panel currently contains backend-extracted evidence such as:

- motion sample count
- high-motion sample count
- mean occupancy shift
- scene interval count
- mean scene duration
- individual timestamps and intervals

On top of this evidence, the frontend may add descriptive interpretations such as:

- very high cut density
- high-cut density
- moderate-cut density

These labels are useful as operational summaries, but they are not the same thing as actual genre detection.

Why this matters

If VAA1 says something that sounds like:

- trailer-like rapid cutting
- action-trailer pattern
- documentary pacing
- prestige-drama restraint

the wording can easily imply that the system has already identified the material's genre or format with meaningful confidence.

At the present stage, that is not what is happening.

What is actually happening is:

- VAA1 measures visual evidence
- VAA1 derives pattern summaries from that evidence
- the UI may describe those summaries in human-readable language

This is a heuristic description layer, not a validated genre-detection layer.

Required design principle

VAA1 must maintain a strict separation between:

1. Evidence layer
- raw extracted values and intervals

2. Heuristic description layer
- careful summaries such as:
  - very high cut density
  - low motion
  - dense visual churn

3. Genre-detection layer
- future workflow that attempts to infer:
  - trailer
  - action
  - spy/action
  - interview
  - music video
  - lecture
  - webcall
  - documentary
  - etc.

4. Analyst interpretation layer
- human judgement that may confirm, reject, or refine both heuristic and genre-level claims

Working package implication

This issue should be treated as part of the same work package as detector calibration.

That package should include:

- motion detector calibration
- scene-segmentation calibration
- person and object detector calibration
- genre-specific object-detection build-up
- adaptive dense sampling refinement
- strict wording control in the UI
- separation of heuristic description from actual genre inference

Practical UI rule

Until a real genre-detection workflow exists, VAA1 should prefer language like:

- very high cut density
- rapid-cut pattern
- low motion with burst peaks
- dense transition activity
- provisional derived scene basis

and avoid genre-sounding claims unless those are explicitly produced by a dedicated genre workflow.

Future workflow

Genre detection should become its own workflow with:

- explicit inputs
- documented signals
- calibration data
- analyst correction support
- confidence reporting
- traceability back to evidence

Only then should VAA1 use labels that directly imply genre or format identity.

Conclusion

Heuristic description is necessary and useful, but it must remain visibly separate from genre detection.

This separation is essential for:

- analytic honesty
- user trust
- calibration clarity
- later institutional reliability

