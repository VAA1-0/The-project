# Datascene/VAA1 Data Attribute Inventory Report

**Date:** 2026-07-12
**Status:** Inventory specification assessment and architectural findings - Phase 1 (Read-only; empirical field inventory incomplete)

## 1. Executive Summary

### 1.1. Purpose and Scope

This document records initial architectural findings from reviewing the empirical-inventory specification and selected repository surfaces. It does **not** yet constitute a comprehensive field-level empirical inventory of all data produced, stored, transformed, or displayed by Datascene/VAA1. The completed audit remains a mandatory prerequisite for safely generalizing the **Data Maturation Proliferation Regime v2**.

The next audit stage must establish a machine-actionable **Data Attribute Taxonomy**, implementation inventory, vocabulary registry, and typed dependency model. Completion requires field-level producer/consumer traces, persistence locations, representative runtime values, provenance completeness, duplicate and panel-local override findings, invalidation behaviour, and test evidence. The governing process is `docs/sprint_program_empirical_taxonomy_discovery_2026-07-12.md`.

### 1.2. Key Architectural Findings

The initial review indicates that while VAA1 possesses a rich set of analytical capabilities, its data governance is not yet uniformly implemented. These findings require verification through the evidence-backed audit.

1.  **Semantic Ambiguity and Overloaded Terms:** A significant architectural risk is the inconsistent use of generic terms like `label`, `identity`, and `object`. These terms carry different meanings across different panels and backend modules, leading to ambiguity and a high risk of incorrect data interpretation and propagation.

2.  **Panel-Local Truth:** Many UI panels maintain their own local state and business logic for interpreting and displaying data. This "panel-local truth" anti-pattern is the root cause of data inconsistencies across the application, where a correction made in one panel does not reliably project to others.

3.  **Observation-Interpretation Collapse:** The system frequently conflates raw, direct observations (e.g., a `person` detection from YOLO) with higher-level analytical claims (e.g., a confirmed `Narrative Agent`). This collapse prevents the system from properly governing the maturation of evidence from raw signal to confirmed insight.

4.  **Incomplete Governance Layers:** The audit confirms the architectural diagnosis that VAA1 has operational **Candidate Services** (Layer 4, e.g., the "SOM-matcher") and a partial **Evidence Substrate** (Layer 1). However, it critically lacks a robust, centralized **Canonical Decision Ledger** (Layer 2) and a deterministic **Projection Engine** (Layer 3). This gap is the primary reason the current data proliferation regime has not produced the expected consistency and reliability.

5.  **Rich but Ungoverned Taxonomies:** The system contains extensive, well-structured taxonomies for advanced analytical concepts, particularly for genre, situations, and interpretive readings (e.g., SFL, virtue/vice). However, these are not yet registered as first-class, governed attribute categories whose values can be reliably projected and traced across the application.

### 1.3. Primary Recommendation

The review concludes that a **taxonomy-first migration is mandatory** before the Data Maturation Proliferation Regime v2 can be safely generalized. The system must first know precisely what kind of data it is handling before it can govern its proliferation.

The immediate next steps should be the creation of the **Data Attribute Registry** and the **Dependency Graph** as machine-readable configuration. These artifacts will enforce a clear operational contract for every piece of data in the system.

Following a successful Pass 1 go/no-go decision, implementation of the **Canonical Decision Ledger** and backend-resolved **Projection Engine** can proceed with the BBox/ROI correction pilot. Until then, the generalized implementation gate remains `NO-GO`.

### 1.4. Pass 1 delivery update - 2026-07-14

The operational-core empirical pass has now been executed against repository paths, a representative saved analysis, and the focused governance test suite. Its field registry, implementation bindings, dependencies, migration mappings, runtime evidence, and gate result are in `docs/inventory/`.

The result remains `NO-GO`, now for evidenced implementation blockers rather than missing audit work. See `docs/vaa1_empirical_inventory_pass_1_report_2026-07-14.md`.
