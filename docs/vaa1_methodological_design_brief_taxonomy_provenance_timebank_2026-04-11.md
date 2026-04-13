# VAA1 Methodological Design Brief:
# Shared Taxonomy, Provenance, Temporal Grounding, And Multimodal Interpretation

Date: 2026-04-11  
Status: human-readable design brief for the VAA1 method article  
Purpose: explain the conceptual design of VAA1’s taxonomy, provenance, reference, and temporal-grounding architecture in a form suitable for methodological writing and implementation guidance

## 1. Why This Design Brief Exists

VAA1 is not only a software stack for multimodal video analysis.  
It is also an interpretive method.

That distinction matters.

Many software systems can run object detection, OCR, audio analysis, transcript extraction, or emotion classification. Far fewer systems are able to explain how these outputs should be organized into a stable interpretive framework that remains useful across:

- multiple videos
- multiple analysts
- multiple AI agents
- multiple modalities
- multiple rounds of later review and correction

The purpose of this brief is to define that framework.

It explains why VAA1 requires:

- a shared taxonomy
- a distinction between taxonomy and taxonomy application
- explicit provenance
- temporally grounded evidence
- a role for reference analysis
- and a structure that remains methodologically sound even if computational power increases dramatically

This document is written as a human-readable source for the future VAA1 method article.

## 2. The Core Problem

Multimodal interpretation cannot rely on isolated labels.

If a video is classified as:

- `intimate`
- `public`
- `emergency response`
- `interview`
- `professional`

those labels only become meaningful when we know:

- who assigned them
- whether the source was human or AI
- what evidence supported them
- when in the video they apply
- whether they refer to the whole video or only a segment
- whether they are part of a stable shared vocabulary or only a local working note

Without that structure, labels become unstable fragments.  
With that structure, they become interpretable analytical claims.

That is why VAA1 cannot treat taxonomy as a decorative dropdown list.  
It must treat taxonomy as a shared interpretive backbone.

## 3. The Governing Methodological Principle

VAA1 should separate:

1. **canonical taxonomy**
2. **taxonomy application**
3. **provenance**
4. **temporal grounding**
5. **reference evidence**

This separation is the key to making the system scalable, interpretable, and governable.

### Canonical taxonomy

This defines what the shared concepts are.

Examples:

- `news`
- `drama / fiction`
- `public`
- `professional`
- `emergency response`
- `intimate interaction`

These are not yet claims about a specific video.  
They are the shared conceptual vocabulary.

### Taxonomy application

This defines where and how a term is applied.

Examples:

- an analyst marks a scene as `emergency response`
- an AI agent classifies a video segment as `public`
- a system assigns `interview` with moderate confidence to a whole clip

Applications are analytical acts.  
They should never be confused with the taxonomy itself.

### Provenance

This records how the application came to be.

Examples:

- manual analyst annotation
- LLM-based API interpretation
- pipeline-generated classification
- reviewed and corrected label

Provenance is essential because VAA1 is not merely producing outputs.  
It is producing accountable interpretations.

### Temporal grounding

This records when the interpretation applies.

Examples:

- whole video
- interval from 00:12.400 to 00:19.800
- anchor at a single frame or transcript-linked event

Without temporal grounding, multimodal interpretation becomes vague.  
With it, interpretation becomes traceable.

### Reference evidence

This records what external or parallel knowledge supports the interpretation.

Examples:

- transcript evidence
- OCR evidence
- object detections
- expression detections
- analyst notes
- supporting reference documents
- later-stage web reference pools

Reference evidence does not replace interpretation.  
It supports and contextualizes it.

## 4. Why Taxonomy Must Be Shared

The VAA1 method is designed for multi-video reasoning.

This means the system must support:

- searching across many videos
- comparing patterns across many videos
- aligning human and AI interpretations
- building cumulative analytical knowledge

This is impossible if each analysis item develops its own private vocabulary.

A shared taxonomy is therefore needed not only for interface consistency, but for methodological coherence.

The same label must mean approximately the same thing across:

- one analyst and another
- one video and another
- one pipeline and another
- one phase of the project and another

That does not mean the taxonomy should be frozen forever.  
It means the taxonomy must evolve through governance rather than drift.

## 5. Why The Taxonomy Must Still Remain Open

A rigid closed taxonomy would fail in real use.

Video interpretation is messy. Analysts will encounter:

- categories not anticipated in advance
- emerging cultural forms
- context-specific phenomena
- new stylistic hybrids
- domain-specific terminology

For that reason, VAA1 must allow custom label creation.

But open label creation must not mean uncontrolled global category growth.

The correct methodological solution is:

- analysts may propose or use local labels immediately
- shared taxonomy grows through explicit approval and review

In other words:

- the analyst must never be blocked from thinking
- the system must not mistake every local thought for shared ontology

## 6. Human Annotation And AI Annotation Must Coexist

VAA1 is designed as a multimodal analytical environment in which both human and machine interpretations matter.

That means the taxonomy backbone must support at least the following sources of application:

- `human_manual`
- `human_reviewed`
- `llm_generated`
- `pipeline_generated`
- `agent_suggested`
- `consensus` or `merged_review`

This is not only a software convenience.  
It is a methodological requirement.

If human and AI applications share the same concept space but differ in provenance, then they can be:

- compared
- reviewed
- corrected
- learned from
- audited

This creates a two-way feedback loop:

- analysts can correct machine interpretation
- machine systems can suggest missing human categories
- approved results can feed model refinement
- the taxonomy can evolve based on real analytical use

## 7. Reference Analysis Is A Supporting Layer, Not The Taxonomy Itself

Reference analysis should strengthen interpretation, not replace the taxonomy.

At the current stage, VAA1 supports only a minimal reference-data layer.  
In later stages, this may expand dramatically and may include live web-scale reference pools.

That expansion is useful, but it must be methodologically disciplined.

Reference data should produce:

- evidence candidates
- comparative context
- similarity signals
- interpretive suggestions
- confidence modifiers

Reference data should **not** directly redefine canonical taxonomy on its own.

This distinction matters because otherwise the system risks allowing:

- noisy external signals
- transient web language
- or model hallucination

to destabilize the core interpretive vocabulary.

The right relationship is:

- taxonomy defines the shared conceptual backbone
- reference analysis supports the application and refinement of those concepts

## 8. Time Bank As Temporal Grounding

Time Bank is one of the most important structural elements in the VAA1 method.

Its role is not merely to store timestamps.  
Its role is to provide temporal grounding for multimodal evidence.

In practical terms, VAA1 already organizes time-linked evidence across:

- transcript
- audio
- OCR
- objects
- expressions

This means Time Bank can function as the temporal spine through which interpretive labels become traceable.

The methodological relationship should be:

- Time Bank anchors evidence in time
- taxonomy names the interpretive category
- provenance explains who or what assigned it
- reference evidence explains why

This creates a richer analytical object than a plain label.

For example:

- a label such as `emergency response`
- attached to an anchored interval
- supported by object detections, transcript cues, and audio markers
- attributed to a named agent or analyst
- and later reviewed by a human

is far more analytically valuable than a free-floating classification.

## 9. The Future Traceback Tool

The future traceback tool should be understood as the audit and interpretability layer of the VAA1 method.

It should allow questions such as:

- where did this label come from?
- who first introduced it?
- which videos use it?
- was it suggested by a model, a pipeline, or an analyst?
- what evidence supported it?
- what time span does it refer to?
- was it later corrected, renamed, merged, or retired?

This is not only useful for debugging.

It is essential for:

- methodological transparency
- reproducibility
- human review
- long-term governance
- learning-unit feedback

The traceback tool therefore belongs directly inside the same conceptual family as:

- taxonomy governance
- provenance tracking
- reference evidence
- and Time Bank anchoring

## 10. Why The Design Must Survive Extreme Compute Scaling

The architecture should remain valid whether computation is:

- modest
- large-scale
- supercomputer-level
- or radically accelerated in later forms

The reason is simple:

compute changes speed, breadth, and volume.  
It should not change the interpretive logic of the system.

That means VAA1 should not depend methodologically on a fragile coupling between:

- one model
- one machine scale
- one processing rate
- or one output format

Instead, the architecture should preserve:

- canonical concepts
- applied records
- provenance
- temporal anchoring
- evidence references

as stable layers.

If compute expands dramatically, then:

- more candidate labels may be proposed
- more modalities may be processed simultaneously
- more videos may be searched together
- more real-time reference pools may be incorporated

But the same governance logic should still hold.

This is why the design should be event- and provenance-oriented rather than based on silent overwriting.

Speed can increase indefinitely.  
Interpretive accountability must remain legible.

## 11. Reducing Output Clutter

Another methodological design goal is to reduce the proliferation of disconnected output files.

Many analytical systems fail because they generate:

- too many downloadable fragments
- too many intermediate files
- too many user-visible artifacts that do not clearly relate to one another

VAA1 should avoid that.

The better model is:

### User-facing layer

Show only the outputs that the analyst or reviewer actually needs.

Examples:

- a coherent analysis record
- a coherent annotation record
- a clear evidence view

### Managed internal artifact layer

Keep detailed supporting files under the hood.

Examples:

- raw exports
- intermediate CSV outputs
- derived modality-specific packages
- temporary annotation artifacts

### Trace layer

Expose deep technical lineage only when explicitly needed.

Examples:

- through traceback
- admin review
- audit view
- methodological inspection

This reduces clutter without sacrificing evidential richness.

## 12. The Analyst Workflow Implication

For the analyst, the system should feel simple.

The analyst should experience:

- clear categories
- ability to add missing labels
- confidence that labels are not lost
- confidence that mistakes can be corrected
- visibility into how annotations matter

The analyst should **not** be burdened with:

- ontology administration
- raw backend files
- hidden format distinctions
- technical uncertainty about whether a label belongs to a stable system

The complexity should exist inside the architecture, not in the everyday cognitive burden of the user.

## 13. The Practical Backbone

The VAA1 methodological backbone should therefore be modeled as:

1. **Canonical taxonomy**
   shared concepts and governed terms
2. **Applied taxonomy records**
   who/what applied which concept to which media and where
3. **Reference evidence**
   what supports the interpretation
4. **Time Bank grounding**
   when the interpretation applies
5. **Provenance and traceback**
   how the interpretation came to exist and how it changed

This layered structure allows:

- cross-video search
- multimodal comparison
- human-AI feedback loops
- learning-unit refinement
- controlled taxonomy growth
- reduced user-visible clutter
- long-term interpretability

## 14. Conclusion

The central methodological claim is this:

VAA1 should not treat labels as isolated interface values.  
It should treat them as governed interpretive claims grounded in time, evidence, provenance, and shared conceptual structure.

That is what allows the system to function not only as an AI tool, but as a robust analytical method.

The shared taxonomy provides consistency.  
Provenance provides accountability.  
Time Bank provides temporal grounding.  
Reference analysis provides contextual support.  
Traceback provides auditability.  
And the layered architecture keeps all of this stable even as the scale of computation and automation increases.
