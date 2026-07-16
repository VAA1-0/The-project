"""Affected-branch planning for the scientific execution graph."""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path
from typing import Any, Dict, Iterable


DEFAULT_GRAPH_PATH = (
    Path(__file__).resolve().parents[3]
    / "docs"
    / "inventory"
    / "interpretation_execution_graph.json"
)


def load_execution_graph(path: str | Path | None = None) -> Dict[str, Any]:
    return json.loads((Path(path) if path else DEFAULT_GRAPH_PATH).read_text(encoding="utf-8"))


def validate_execution_graph(graph: Dict[str, Any]) -> None:
    nodes = graph.get("nodes")
    edges = graph.get("edges")
    if not isinstance(nodes, list) or not isinstance(edges, list):
        raise ValueError("Execution graph requires nodes and edges")
    node_ids = [str(item.get("node_id") or "") for item in nodes]
    if any(not item for item in node_ids) or len(node_ids) != len(set(node_ids)):
        raise ValueError("Execution graph node ids must be non-empty and unique")
    known = set(node_ids)
    indegree = {node_id: 0 for node_id in known}
    outgoing = {node_id: [] for node_id in known}
    for edge in edges:
        upstream = str(edge.get("upstream") or "")
        downstream = str(edge.get("downstream") or "")
        if upstream not in known or downstream not in known:
            raise ValueError("Execution graph edge references an unknown node")
        outgoing[upstream].append(downstream)
        indegree[downstream] += 1
    ready = deque(sorted(node_id for node_id, count in indegree.items() if count == 0))
    visited = 0
    while ready:
        node_id = ready.popleft()
        visited += 1
        for downstream in outgoing[node_id]:
            indegree[downstream] -= 1
            if indegree[downstream] == 0:
                ready.append(downstream)
    if visited != len(known):
        raise ValueError("Execution graph contains a cycle")


def plan_affected_branches(
    graph: Dict[str, Any],
    changed_nodes: Iterable[str],
    *,
    include_operational_edges: bool = False,
) -> Dict[str, Any]:
    validate_execution_graph(graph)
    node_map = {item["node_id"]: item for item in graph["nodes"]}
    changed = list(dict.fromkeys(str(item) for item in changed_nodes if item))
    unknown = [item for item in changed if item not in node_map]
    if unknown:
        raise ValueError("Unknown changed nodes: " + ", ".join(unknown))
    outgoing: dict[str, list[Dict[str, Any]]] = {node_id: [] for node_id in node_map}
    for edge in graph["edges"]:
        if not include_operational_edges and edge.get("dependency_type") in {"observability", "operational"}:
            continue
        outgoing[edge["upstream"]].append(edge)

    distance = {node_id: 0 for node_id in changed}
    reasons: dict[str, list[Dict[str, Any]]] = {node_id: [] for node_id in changed}
    queue = deque(changed)
    while queue:
        upstream = queue.popleft()
        for edge in outgoing[upstream]:
            downstream = edge["downstream"]
            reasons.setdefault(downstream, []).append(
                {
                    "upstream": upstream,
                    "dependency_type": edge["dependency_type"],
                    "change_effect": edge["change_effect"],
                }
            )
            candidate_distance = distance[upstream] + 1
            if downstream not in distance or candidate_distance < distance[downstream]:
                distance[downstream] = candidate_distance
                queue.append(downstream)

    affected = [node_id for node_id in distance if node_id not in changed]
    affected.sort(key=lambda node_id: (distance[node_id], node_id))
    return {
        "schema": "vaa1.affected_branch_plan.v1",
        "graph_id": graph.get("graph_id"),
        "changed_nodes": changed,
        "affected_nodes": [
            {
                "node_id": node_id,
                "distance": distance[node_id],
                "change_reasons": reasons.get(node_id, []),
                "invalidation_scope": node_map[node_id].get("invalidation_scope"),
                "implementation_status": node_map[node_id].get("implementation_status"),
            }
            for node_id in affected
        ],
        "unaffected_nodes": sorted(set(node_map) - set(changed) - set(affected)),
        "operational_edges_included": include_operational_edges,
    }
