# VAA1 Working Handover Handout - 2026-07-07

Updated analytically on 2026-07-08 after the Audio Workbench / transcript timing repair thread.

## Purpose

This document checkpoints the current state of the VAA1 project, focusing on the significant progress made in three core areas. It also corrects several over-broad claims from the first draft: the audio/timing stack is improved, but it is not globally mature yet; Narrative Agent confirmation is the correct vocabulary, not identity recognition; and source-linked partial repair must not be presented as full timing authority.

1.  **Mature Data Proliferation**: Operationalizing the system's ability to learn from analyst confirmations and apply that knowledge across the dataset.
2.  **StatsKit Workbench**: Introducing a dedicated, source-linked statistical analysis panel.
3.  **UI and Governance Hardening**: Ensuring that analytical power is matched with clear, traceable, and reliable user interfaces.

This work moves VAA1 closer to its goal of providing scalable multimodal analysis where human insight and machine processing work in a governed partnership. The guiding principle is still "professional tooling, not metadata parade": every visible analytical claim should either be actionable, source-navigable, editable/reviewable, or clearly marked as missing/candidate/degraded.

## 1. Mature Data Proliferation and the Open-Topology Matcher

The core principle of "Mature Data Proliferation" is now an operational feature, not just a design concept. The system can now use confirmed evidence to find related patterns, reducing repetitive manual work and surfacing connections that might otherwise be missed.

### Key Developments:

*   **Economic and Governed Matching**: The proliferation bus is designed for **economical computation**. Instead of brute-force comparisons, it computes representative "fingerprints" (embeddings) for voice clouds. This allows for efficient, indexed similarity searches, making the process practical for real-world use.
*   **From "Identity" to "Narrative Agent Confirmation"**: The system's vocabulary has been aligned with the project's specific ontology. We do not discuss identities as a free-floating recognition claim; we discuss Narrative Agents as governed analytical entities in Datascene. Audio, visual, transcript, and scene evidence may support a Narrative Agent confirmation, but no single detector should silently declare the agent as mature truth.
*   **Analyst-in-the-Loop Governance**: The matcher **proposes** candidates; it does not declare truth. An analyst's confirmation is required to mature a candidate into a confirmed fact. This ensures that human expertise remains the final authority.
*   **Audio Sample Clouds for Narrative Agents**: The system now generates audio samples for known Narrative Agents (`build_audio_sample_clouds_for_narrative_agents` in `audio_sample_cloud.py`). These samples are candidate evidence for voice-pattern matching, not standalone ground truth. They become mature only when linked to source time, method provenance, and analyst confirmation.
*   **Confirmation UI in the Audio Panel**: The Audio Panel now exposes Narrative Agent confirmation controls. Analysts can review an unconfirmed speaker event, choose from the pre-existing pool of known characters/Narrative Agents, and confirm, name, sample, or drop the evidence. This action should create a mature evidence seed that the proliferation bus can reuse, but the save/proliferation loop still needs hardening so confirmations round-trip cleanly through the Master Schema.

### How it Works in Practice:

1.  **Seed Creation**: An analyst confirms that a source-timed audio/visual anchor belongs to the Narrative Agent "James Bond".
2.  **Mature Memory**: The Master Schema records the confirmed source anchor, evidence route, confirmation authority, and projection targets.
3.  **Proliferation**: The `live_mature_data_proliferation_bus` may use the confirmed sample cloud to scan other unconfirmed speech or presence segments.
4.  **Candidate Proposal**: When it finds a strong match, it proposes, "This other segment may belong to the James Bond Narrative Agent."
5.  **Surfacing**: These proposals surface in the Audio Panel, Meaning Network, BBox overlays, Scene Cards, and Narrative Agent views as reviewable candidates, not silent overwrites.

This loop transforms a single manual correction into a system-wide analytical accelerant.

## 2. StatsKit: A Dedicated Analytics Workbench

Statistical analysis has been promoted from a sub-feature to a first-class citizen of the VAA1 interface with the introduction of the **StatsKit Panel**.

### Key Developments:

*   **New Backend Agent**: The `StatsKitAgent` (`statskit_agent.py`) is a new backend component responsible for executing statistical runs. It loads the necessary artifacts (transcripts, diarization, metadata) and computes the requested metrics.
*   **Dedicated UI Panel**: A new `StatsKitPanel.tsx` provides a professional workbench interface. It is no longer a small part of another panel but a full-featured tool accessible from the main menu.
*   **Source-Linked Results**: Every statistical result is designed to be source-linked. Computed rows should navigate to the source moment, evidence object, or interval that produced the value. If no source layer exists, the row must explain the missing layer rather than inventing an actual.
*   **Speech Ratio Analysis**: StatsKit can use measured VAD segments from `audio_diarization.json` for speech/silence readiness and ratio-style measures. This should not be conflated with fully mature speaker attribution. VAD can establish speech/non-speech timing; Narrative Agent speaker attribution requires triangulated transcript timing, diarization, source evidence, and confirmation.
*   **Foundation for Deeper Analysis**: StatsKit is positioned to support speaker dominance, turn-taking frequency, interruption analysis, music/noise ratios, color/brightness measures, and shot-boundary statistics. These become actual only after the required source layers are persisted through the Master Schema or governed analysis artifacts.

## 3. Core UI and Governance Hardening

Significant work has been done to ensure the UI is not just functional but also governed, reliable, and intuitive.

### Audio and Diarization Enhancements:

*   **Measured VAD / Acoustic Clustering, Not Full pyannote Certainty**: The active local artifact currently reports `local_waveform_vad_acoustic_clustering`. `pyannote.audio` remains an important optional or future route, but the current handoff must not claim that pyannote has replaced all placeholder diarization. The mature-data principle is: use the most mature available source layer, record the method, and keep uncertainty visible.
*   **Richer Artifacts**: The `audio_diarization.json` artifact is richer than the earlier scaffold because it contains measured VAD timing and acoustic clustering support. However, the `speaker_turns` can still inherit transcript timing problems if the transcript clock is degraded. The Audio Panel and StatsKit must prefer verified/anchored timing over raw scaffold speaker-turn timing.
*   **Navigable Audio Panel**: The new `AudioPanel.tsx` provides a navigable workbench for speech/VAD/diarization, prosody/delivery/turn structure, music/sound classifier rows, lyrics/transcript matches, foley sampling candidates, waveform/energy strips, and audio recognition governance. Clicking a row should jump to the relevant source time. The next maturity step is to make each row editable/reviewable with confirm, name, sample, drop, and Narrative Agent assignment actions.
*   **Timing Authority Repair - 2026-07-08**: The Bond trailer transcript had correct text but a scaffold clock. Spoken word does not begin at `0.000`; the first line "Why would I betray you?" begins at about `6.400s`. A later drift point placed "The world is arming faster than we can respond." too early; the closest measured VAD anchor places it at `20.960-22.215s`. The backend now includes an anchored VAD timing repair path in `transcript_timing_guard.py`, invoked by `repair_transcript_timing_if_needed` when chunked fallback cannot improve coverage. This repair writes `transcription_strategy: anchored_vad_timing_repair` and marks rows as `anchor_verified`, `vad_anchor_verified`, `anchored_offset`, or `inherited_after_vad_anchor`.
*   **Partial Repair Must Stay Partial**: The current repaired Bond artifact is `partially_repaired`, not fully mature, because the transcript still has a trailing coverage gap. The fix corrects the known timing regime and regenerates linked transcript, audio prosody, POS, Quant, and time-bank surfaces from the repaired clock, but the remaining tail coverage must stay visible as degraded until verified.

### Meaning Network and Master Schema Integration:

*   **Speaker Timelines in Core Profiles**: Speaker timelines are an active integration target. The `build_narrative_agent_profile` direction is to enrich Narrative Agent profiles with a `speaker_timeline` array, but these rows should only be presented as mature when the spoken line, source time, diarization/prosody support, and Narrative Agent confirmation are all aligned.
*   **Visualization in the Meaning Network**: The `MeaningPlotPanel.tsx` now visualizes these timelines. Each character gets a dedicated lane in the graph, with their spoken turns rendered as navigable bars. This provides an immediate, intuitive overview of the dialogue flow.
*   **Master Schema as the Source of Truth**: The Master Schema must arbitrate between transcript, diarization, prosody, visual anchors, manual confirmations, and correction ledgers. `audio_diarization.json` is an important source, especially for measured VAD, but it is not automatically the final truth when its speaker turns inherit a scaffold transcript clock. The source route should prefer the most mature verified timing available and record why that route was chosen.

### Source Authority Rules Added By This Review:

*   **Most Mature Data Principle**: Panels should consume the most mature available evidence, not the nearest convenient artifact. Manual/confirmed source anchors outrank raw detector outputs; verified timing anchors outrank scaffold transcript timing; Master Schema-governed projections outrank panel-local guesses.
*   **Triangulation Before Confirmation Relief**: If a Narrative Agent is already confirmed on screen at the same source interval, Audio Panel confirmation should not ask for an unrelated second confirmation. It should surface the visual/audio triangulation and allow the analyst to accept, correct, split, or drop the link.
*   **Candidate Is Not Mature**: Similarity matches, inferred speaker labels, acoustic clusters, expression labels, and graph deductions stay candidate until the analyst or a governed high-authority route confirms them.
*   **No Silent Timing Promotion**: Any derived surface - Audio Panel, Transcript, POS, Quant, StatsKit, Meaning Network, Narrative Agent, Search, reports - must display or carry timing repair status when using a partially repaired transcript.

## Summary of Analyst-Facing Improvements

*   **Less Repetitive Work**: Confirm a speaker or character once, and the system will help you find them everywhere else.
*   **Deeper Audio Insights**: The new Audio Panel and StatsKit provide tools to analyze not just *what* was said, but *how* it was said, by whom, and when. The current emphasis is on source navigation and reviewability first, then full maturation.
*   **Connected Evidence**: Speaker timelines are no longer isolated data points. They are now visually and structurally connected to Narrative Agent profiles and the overall scene structure in the Meaning Network.
*   **More Auditable Foundations**: Placeholder logic has been reduced, and source-linked timing/prosody/statistical routes are more explicit. The foundation is more auditable, but not uniformly mature. Remaining degraded, missing, or candidate layers must stay visible.

This sprint represents a significant step toward making VAA1 a system that doesn't just produce data, but actively helps the analyst make sense of it.

## Next Steps

*   **Close The Audio Feedback Loop**: Confirm/name/drop/sample actions in the Audio Panel must write through the Master Schema and return as mature or candidate projections to Audio, Transcript, Narrative Agent, Meaning Network, StatsKit, Search, and Traceback.
*   **Generalize Anchored Timing Repair**: The July 8 fix handles the known Bond scaffold-clock drift with opening and VAD anchors. The next step is a reusable row-level timing-anchor ledger so analysts can correct any transcript line and have all derived artifacts rebuild from the corrected clock.
*   **Enhance The Matcher**: Improve audio embedding comparison logic, but keep it as candidate proposal unless backed by source anchors and confirmation.
*   **Expand StatsKit**: Implement more advanced dialogue metrics such as speaker dominance, interruption rates, music/silence/noise ratios, shot-duration distributions, color statistics, and sentiment/affect correlation only when the required source layers exist.
*   **Refine The Narrative Agent Panel**: Display source-timed dialogue, prosody, and presence data in a dedicated Narrative Agent dialogue/workbench area, with clear mature/candidate/degraded status.
*   **Do Not Lose Shot/Color/Music Foundations**: True shot-boundary intervals, visual color/brightness/contrast extraction, music/sound classifier timelines, and foley sample/proliferation candidates remain foundational detection-reporting work.

---
*This document reflects the state of the `petteri` branch as of 2026-07-07.*
