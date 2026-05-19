from __future__ import annotations

import importlib.util
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

try:
    from .agent_persistence import (
        DEFAULT_AMBIGUITY_MARGIN,
        DEFAULT_SCENE_CUT_WINDOW_SECONDS,
        DEFAULT_SIMILARITY_THRESHOLD,
        arrived_tracks_near_cut,
        cross_scene_persistence_check,
        departed_tracks_near_cut,
    )
except ImportError:
    _module_path = Path(__file__).with_name("agent_persistence.py")
    _spec = importlib.util.spec_from_file_location("agent_persistence", _module_path)
    _agent_persistence = importlib.util.module_from_spec(_spec)
    assert _spec and _spec.loader
    _spec.loader.exec_module(_agent_persistence)
    DEFAULT_AMBIGUITY_MARGIN = _agent_persistence.DEFAULT_AMBIGUITY_MARGIN
    DEFAULT_SCENE_CUT_WINDOW_SECONDS = _agent_persistence.DEFAULT_SCENE_CUT_WINDOW_SECONDS
    DEFAULT_SIMILARITY_THRESHOLD = _agent_persistence.DEFAULT_SIMILARITY_THRESHOLD
    arrived_tracks_near_cut = _agent_persistence.arrived_tracks_near_cut
    cross_scene_persistence_check = _agent_persistence.cross_scene_persistence_check
    departed_tracks_near_cut = _agent_persistence.departed_tracks_near_cut


class AgentPersistenceManager:
    """
    Implements scene-boundary-aware semantic relinking for object tracks.

    As mandated by Mitigation 4 in the VAA1 Constellational Constitution
    Mitigation Report, this manager identifies objects across scene cuts
    to enable un-linear timesphere mapping.
    """

    def __init__(
        self,
        *,
        similarity_threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
        window_seconds: float = DEFAULT_SCENE_CUT_WINDOW_SECONDS,
        ambiguity_margin: float = DEFAULT_AMBIGUITY_MARGIN,
    ) -> None:
        self.similarity_threshold = similarity_threshold
        self.window_seconds = window_seconds
        self.ambiguity_margin = ambiguity_margin

    def tracks_near_scene_cut(
        self,
        tracks: Iterable[Dict[str, Any]],
        scene_cut: Dict[str, Any],
    ) -> Dict[str, List[Dict[str, Any]]]:
        cut_time = _scene_cut_time(scene_cut)
        return {
            "departed": departed_tracks_near_cut(
                tracks,
                cut_time,
                window_seconds=self.window_seconds,
            ),
            "arrived": arrived_tracks_near_cut(
                tracks,
                cut_time,
                window_seconds=self.window_seconds,
            ),
        }

    def cross_scene_persistence_check(
        self,
        pre_cut_tracks: Iterable[Dict[str, Any]],
        post_cut_tracks: Iterable[Dict[str, Any]],
        *,
        scene_cut: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return cross_scene_persistence_check(
            pre_cut_tracks,
            post_cut_tracks,
            scene_cut=scene_cut,
            similarity_threshold=self.similarity_threshold,
            ambiguity_margin=self.ambiguity_margin,
        )


def _scene_cut_time(scene_cut: Dict[str, Any]) -> float:
    try:
        return float(scene_cut.get("time") or scene_cut.get("timestamp") or scene_cut.get("start") or 0.0)
    except (TypeError, ValueError):
        return 0.0
