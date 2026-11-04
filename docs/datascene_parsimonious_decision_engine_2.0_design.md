# Datascene Parsimonious Decision Engine 2.0 — Design Direction

## Purpose

PDE 2.0 should improve analytical reach without turning every media item into an
expensive full-model pass. Its governing measure is uncertainty reduced per unit
of incremental computation. It must remain source-linked, offline-capable,
human-authoritative, reversible, and compatible with PDE 1.x records.

## Development boundary

PDE 1.0 owns the actual runtime cascade, compatible-result and feature reuse,
three tracking programs, candidate decisions, abstention, selective Science
Sweep deepening, and Master Schema promotion gates. PDE 2.0 must not be used as
an excuse to postpone those operational capacities.

## Later capabilities

1. **Shared multimodal feature substrate.** Reuse one governed source-time feature
   family across retrieval, clustering, contextual classification and constellation
   matching when model, preprocessing and ontology versions are compatible.
2. **Multi-task capsule heads.** Small task-specific heads may share frozen local
   representations without forcing a large general model through every interval.
3. **Temporal decision memory.** Track identity, action and episodic state through
   explicit source-time transitions. Memory proposes continuity; it never erases
   local exceptions or contradictory evidence.
4. **Graph-conditioned reasoning.** Use confirmed Master Schema relations as
   bounded evidence inputs. Candidate graph edges cannot recursively manufacture
   their own support.
5. **Conformal prediction sets.** Prefer a small honest set of possible labels or
   abstention over an unjustified single answer.
6. **Active review selection.** Prioritize corrections with the greatest expected
   reduction in downstream uncertainty and repeated compute.
7. **Hardware-aware routing.** Select compatible CPU, Metal, CUDA or remote
   providers by measured marginal cost, availability and research-quality floor.
8. **Drift-controlled learning.** Corrections enter a quarantined, consented and
   source-grouped corpus. No silent retraining or automatic deployment is allowed.

## Tracking development

### Narrative agents

Compose face/appearance continuity, active-speaker synchrony, voice/prosody,
confirmed names, roles, interactions and scene membership. Preserve multiple
candidate identities and off-screen speech. A local contradiction opens review
rather than rewriting the complete character path.

### Actions and movements

Compose pose and motion measurements, transcript process types, object state
changes, Foley/audio events and agent-object relations. Separate measured movement
from interpreted action and from narrative significance.

### Episodic scene continuums

Compose shot boundaries, stable settings, participating agents, actions, objects,
dialogue topics, sound fields and situation transitions. An episode is a governed
continuity hypothesis spanning scenes, not a replacement for source-local scenes.

## Computational parsimony requirements

- Exact result reuse precedes all computation.
- Compatible feature reuse precedes extraction.
- Sparse adaptive sampling precedes dense sampling.
- Dense analysis is bounded to uncertainty hotspots or researcher priorities.
- Batch work by compatible provider and feature family.
- Invalidate only dependency-affected branches.
- Measure CPU/GPU seconds, memory, energy, reuse, abstention, review effort and
  downstream error propagation per analysed media hour.
- A new model must outperform the incumbent on a frozen benchmark or materially
  reduce resource cost at the same research-quality floor.

## Research and deployment gates

Training data must be rights-cleared, consented where required, deduplicated and
split by source and domain. Calibration, validation and test sets remain separate.
Promotion requires domain review, calibration review, licence/privacy approval,
standalone replay, signed artifacts and a tested rollback package.

## Compatibility commitments

PDE 2.0 reads PDE 1.x evidence slices and decisions, preserves evidence references
and authority states, retains raw evidence, and falls back to PDE 1.0 capsules when
new capabilities are unavailable or fail validation.
