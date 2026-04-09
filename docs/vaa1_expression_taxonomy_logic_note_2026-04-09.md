# VAA1 Expression Taxonomy Logic Note

Date: 2026-04-09
Status: working note for human readers
Scope: explain the logic of the VAA1 expression layer in clear terms

## 1. Why this note exists

The VAA1 expression layer should not be read as a simple emotion detector.

It is designed as a layered interpretation system that:

- keeps raw model outputs visible
- avoids overwriting detector evidence
- maps facial signals into a more careful ontology
- allows contextual weighting
- keeps interpretation contestable rather than pretending to be final truth

This note explains that logic in ordinary language for human readers.

## 2. What the expression layer is not

VAA1 should not be treated as:

- a mind-reading system
- a psychology machine
- a final arbiter of inner state
- a replacement for human interpretation

Facial expression is only one source of evidence. It is often partial, stylized, socially managed, and genre-dependent.

So the expression layer must remain:

- evidence-based
- layered
- revisable
- traceable

## 3. The reading order

The intended reading order is:

1. raw detector output
2. face signal quality
3. expression evidence strength
4. affect hints
5. social function profile
6. interpreted expression
7. context-weighted reading

This order matters.

The weighted reading should never be read before the raw and intermediate layers are visible.

## 4. Layer 1: Raw detector output

This is the underlying model output, such as:

- happy
- sad
- angry
- fear
- surprise
- disgust
- neutral

These are baseline machine categories, not final VAA1 interpretive categories.

They remain visible because:

- they show what the base model actually produced
- they help calibration
- they help audit disagreement between raw output and later interpretation

## 5. Layer 2: Face signal

Before interpretation, VAA1 asks whether the visible face signal is strong enough to support meaningful reading.

Relevant questions include:

- was a face detected at all
- how many faces were present
- how large was the visible face in the frame
- how stable or weak was the usable signal

This prevents overconfident reading from poor input.

## 6. Layer 3: Expression evidence

Expression evidence is the layer that asks:

- is the dominant emotion signal clear
- is it weak
- is it too ambiguous to treat as stable

This means VAA1 is not forced to commit to a single strong label every time.

Weak evidence should remain weak, not be dressed up as certainty.

## 7. Layer 4: Affect hints

Instead of jumping straight from raw detector output to a rich expression label, VAA1 derives a simpler intermediate layer:

- valence tilt
  - positive_tilt
  - negative_tilt
  - mixed_or_uncertain

- activation
  - higher_activation
  - lower_activation
  - mixed_or_uncertain

This is a more modest and scientifically defensible bridge between the detector and the interpretive layer.

## 8. Layer 5: Social function profile

Expression in audiovisual media is rarely only about private feeling. It often has social function.

So VAA1 also estimates a limited social-function layer, such as:

- authority signal
- affiliation signal
- persuasion signal
- distance signal
- reassurance signal

This does not claim to know intention perfectly.

It only indicates which communicative directions the visible cue may be supporting.

## 9. Layer 6: Interpreted expression

The interpreted-expression layer maps the earlier evidence into a VAA1 ontology that is better suited for audiovisual analysis than raw emotion labels alone.

Examples include:

- serious
- focused
- formal_neutral
- composed
- restrained
- deliberate
- concerned
- reflective
- skeptical
- attentive
- emphatic
- assertive
- authoritative
- warm
- reassuring
- empathetic
- amused
- approving
- tense
- uneasy

These are not meant to replace raw detector outputs in storage.

They are a higher interpretive layer built on top of them.

## 10. Why these labels are better for VAA1

A label like `angry` can be misleading in many contexts.

In public speech, news, interviews, campaign messages, and institutional footage, the same visible signal may function more like:

- assertive
- serious
- emphatic
- authoritative

Similarly, a `neutral` face may not be best read as emotionally empty. It may function as:

- formal_neutral
- composed
- authoritative
- reassuring

So the ontology is designed to shift from:

- basic emotion classes

toward:

- communicative and interpretive classes better suited to audiovisual analysis

## 11. Context-sensitive weighting

The weighting layer does not overwrite the earlier layers.

It reweights them according to context such as:

- media genre
- genre subtype
- situational genre
- situational subtype
- privacy axis
- expertise axis

The same visible cue may be read differently in:

- news
- drama
- vlog
- interview
- institutional communication
- webcall

So weighted interpretation is not a truth claim. It is a context-sensitive reading aid.

## 12. Why runner-up labels matter

Sometimes the top weighted interpretation is only marginally ahead of the second-best interpretation.

When that happens, VAA1 should keep both visible.

This is important because:

- ambiguity is analytically meaningful
- mixed readings are common
- some genres intentionally play with expressive ambiguity
- keeping runner-up labels supports better later review

## 13. Corrections and learning

Human correction is not an embarrassment to the system. It is part of the system’s development path.

When analysts correct expression readings:

- the correction should stand as the active reading
- the raw detector output should remain preserved
- the correction should be traceable
- the correction should later help the learning module improve

So the correction layer is both:

- an operational tool for current analysis
- a future training and calibration resource

## 14. Genre and intertextuality

Expression does not mean the same thing in every media form.

Genre changes how signals are read, and genres can also mix.

That means:

- a vlog may borrow institutional seriousness
- news may borrow dramatic suspense
- parody may imitate and distort formal expression styles
- webcalls may reproduce talk-show or panel conventions

This mixing is not noise only. It can be analytically meaningful.

That is why genre and situational context should remain adjustable and traceable.

## 15. The core principle

The VAA1 expression layer should always preserve the distinction between:

- what the detector saw
- how strong the signal was
- what intermediate cues were derived
- what ontology label was proposed
- how context reweighted the reading
- what the analyst finally accepted or corrected

That is what keeps the system:

- inspectable
- scientifically safer
- useful for human analysis
- reusable for future learning

## 16. Summary

In plain terms:

- raw emotions are only the beginning
- VAA1 adds guarded intermediate layers
- ontology labels are more suitable for audiovisual interpretation
- weighting adds context, not truth
- corrections help both current work and future learning
- ambiguity should remain visible where needed

This is the intended logic for human readers of the VAA1 expression system.
