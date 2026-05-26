from typing import Dict, List, Any

"""
VAA1 Antenarrative Lexicon Engine
Translates dependency parsing and SFL tokens into Bojean emergent epistemic orientations (5 B's).
"""

MODALITY_CLUSTERS = {
    "epistemic_modality": {
        "signals": ["uncertainty", "probability", "possibility", "speculation"],
        "markers": ["might", "could", "perhaps", "possibly", "likely", "unlikely", "seems", "appears", "apparently", "presumably"],
        "associated_b": "bets"
    },
    "deontic_modality": {
        "signals": ["obligation", "institutional force", "authority", "normativity"],
        "markers": ["must", "should", "required", "obliged", "allowed", "forbidden", "mandated"],
        "associated_b": "beyond"
    }
}

SEMANTIC_FIELDS = {
    "bets": {
        "core": ["future", "plan", "vision", "goal"],
        "projection_verbs": ["anticipate", "predict", "expect", "forecast", "project", "envision"],
        "risk_terms": ["uncertain", "danger", "threat", "possibility", "risk", "gamble"],
        "institutional_projection": ["roadmap", "strategy", "initiative", "transition", "agenda"],
        "conditional_structures": ["if", "unless", "assuming", "provided that"]
    },
    "beneath": {
        "marginalization_markers": ["ignored", "silenced", "not heard", "excluded", "overlooked", "dismissed", "interrupted", "pushed aside"],
        "structural_indicators": ["interrupted_syntax", "lack_of_response", "topic_abandonment", "low_turn_retention"]
    },
    "between": {
        "contradiction_structures": ["however", "but", "although", "on the other hand", "despite", "yet", "nevertheless"],
        "rhizomatic_links": ["connects", "relates", "echoes", "subverts", "parallels"]
    },
    "becoming": {
        "emergence_verbs": ["emerge", "become", "transform", "evolve", "develop", "shift", "arise"],
        "state_change_markers": ["new", "change", "beginning", "starting", "forming"]
    },
    "beyond": {
        "institutional_abstractions": ["the market", "the system", "society", "government", "industry", "regulation", "economy", "the law", "the institution"]
    }
}

GENRE_CONDITIONING_WEIGHTS = {
    "vision": {
        "startup_pitch": {"bets": 0.9, "meaning": "speculative_forecast"},
        "documentary": {"beyond": 0.6, "meaning": "historical_ideology"},
        "sci-fi": {"becoming": 0.8, "meaning": "world_building"},
        "politics": {"bets": 0.8, "beyond": 0.7, "meaning": "strategic_ideology"},
        "romance": {"between": 0.8, "meaning": "fantasy_projection"}
    },
    "transition": {
        "politics": {"bets": 0.8, "beyond": 0.7, "meaning": "institutional_propaganda"},
        "sci-fi": {"becoming": 0.9, "meaning": "state_change"},
        "documentary": {"between": 0.7, "meaning": "historical_shift"}
    }
}

def evaluate_antenarrative_cues(
    parsed_tokens: List[Dict[str, Any]], 
    dependencies: List[Dict[str, Any]], 
    genre: str,
    prosody_cues: List[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """
    Evaluates a transcript segment's SFL/Dependency outputs against the Antenarrative Lexicon.
    Returns a list of candidate meaning events mapping to Boje's 5 B's (Bets, Beneath, Between, Beyond, Becoming).
    """
    candidates = []
    
    # 1. Detect Epistemic/Deontic Modality (Bets / Beyond)
    for token in parsed_tokens:
        word = token.get("lemma", "").lower()
        
        # Modality checks
        if word in MODALITY_CLUSTERS["epistemic_modality"]["markers"]:
            candidates.append({
                "feature_type": "antenarrative_bet",
                "confidence": 0.65,
                "feature_payload": {"speculation_type": "epistemic_modality", "marker": word}
            })
        elif word in MODALITY_CLUSTERS["deontic_modality"]["markers"]:
            candidates.append({
                "feature_type": "antenarrative_beyond",
                "confidence": 0.70,
                "feature_payload": {"structural_type": "deontic_modality", "marker": word}
            })
            
        # 2. Institutional Abstractions (Beyond / Beneath)
        if any(word in inst for inst in SEMANTIC_FIELDS["beyond"]["institutional_abstractions"]):
            # Check dependencies: is the institution acting as the subject?
            is_active_agent = any(d["head"] == word and d["relation"] == "nsubj" for d in dependencies)
            if is_active_agent:
                candidates.append({
                    "feature_type": "antenarrative_beyond",
                    "confidence": 0.85,
                    "feature_payload": {"structural_type": "institutional_agency", "entity": word}
                })
                
        # 3. Genre-Conditioned Semantic Constellations
        if word in GENRE_CONDITIONING_WEIGHTS:
            genre_profile = GENRE_CONDITIONING_WEIGHTS[word].get(genre.lower(), {})
            if genre_profile:
                if "bets" in genre_profile:
                    candidates.append({
                        "feature_type": "antenarrative_bet",
                        "confidence": genre_profile["bets"],
                        "feature_payload": {"speculation_type": genre_profile["meaning"], "marker": word}
                    })
                if "beyond" in genre_profile:
                    candidates.append({
                        "feature_type": "antenarrative_beyond",
                        "confidence": genre_profile["beyond"],
                        "feature_payload": {"structural_type": genre_profile["meaning"], "marker": word}
                    })
                    
    # 4. Contradiction / Rhizomatic Links (Between)
    for token in parsed_tokens:
        word = token.get("lemma", "").lower()
        if word in SEMANTIC_FIELDS["between"]["contradiction_structures"]:
            candidates.append({
                "feature_type": "antenarrative_between",
                "confidence": 0.75,
                "feature_payload": {"relation_type": "contradiction_structure", "marker": word}
            })
            
    # 5. Beneath (Structural Marginalization via Audio Prosody - Sprint 2)
    if prosody_cues:
        for cue in prosody_cues:
            interaction = cue.get("interaction_cues", {})
            turn = cue.get("turn_structure", {})
            
            is_interruption = interaction.get("role_support") == "possible interruption"
            has_overlap = turn.get("overlap_cue", False)
            
            if is_interruption or has_overlap:
                candidates.append({
                    "feature_type": "antenarrative_beneath",
                    "confidence": 0.85 if is_interruption else 0.65,
                    "feature_payload": {
                        "structural_type": "interruption_or_overlap",
                        "overlap_seconds": turn.get("overlap_seconds", 0.0),
                        "role_support": interaction.get("role_support")
                    }
                })

    return candidates