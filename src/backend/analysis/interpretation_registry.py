"""Governed candidate claims, propositions, relations, and state transitions."""

from __future__ import annotations

import copy
import hashlib
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable

from .evidence_quality import evaluate_quality_use
from .execution_graph_planner import load_execution_graph, plan_affected_branches


REGISTRY_SCHEMA = "vaa1.interpretation_registry.v1"
KINDS = {"claim", "proposition", "relation", "state_transition", "invalidation"}


def _canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _stable_id(kind: str, payload: Dict[str, Any]) -> str:
    return f"{kind}-{hashlib.sha256(_canonical(payload)).hexdigest()[:20]}"


def _atomic_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def empty_registry(analysis_id: str) -> Dict[str, Any]:
    return {"schema": REGISTRY_SCHEMA, "analysis_id": analysis_id, "version": 1, "records": []}


class InterpretationRegistry:
    """Append-only proposal substrate; never appends canonical analyst decisions."""

    def __init__(self, analysis_id: str, path: str | Path):
        self.analysis_id = analysis_id
        self.path = Path(path)

    def load(self) -> Dict[str, Any]:
        if not self.path.exists():
            return empty_registry(self.analysis_id)
        value = json.loads(self.path.read_text(encoding="utf-8"))
        if value.get("schema") != REGISTRY_SCHEMA or value.get("analysis_id") != self.analysis_id:
            raise ValueError("Interpretation registry identity does not match the analysis")
        return value

    def _append(self, record: Dict[str, Any], *, persist: bool) -> Dict[str, Any]:
        registry = self.load()
        records = registry.setdefault("records", [])
        existing = next((item for item in records if item.get("record_id") == record["record_id"]), None)
        if existing:
            comparable_existing = {key: value for key, value in existing.items() if key != "created_at"}
            comparable_record = {key: value for key, value in record.items() if key != "created_at"}
            if _canonical(comparable_existing) != _canonical(comparable_record):
                raise ValueError("record_id already exists with different content")
            return {"record": copy.deepcopy(existing), "appended": False, "registry": registry}
        records.append(record)
        registry["version"] = int(registry.get("version") or 0) + 1
        if persist:
            _atomic_json(self.path, registry)
        return {"record": copy.deepcopy(record), "appended": True, "registry": registry}

    def append_claim(self, payload: Dict[str, Any], *, persist: bool = True) -> Dict[str, Any]:
        text = str(payload.get("claim_text") or "").strip()
        finding_refs = [str(item) for item in payload.get("finding_refs", []) if item]
        evidence_refs = [str(item) for item in payload.get("evidence_refs", []) if item]
        quality = payload.get("quality_assessment")
        if not text or not finding_refs or not evidence_refs or not isinstance(quality, dict):
            raise ValueError("claim_text, finding_refs, evidence_refs, and quality_assessment are required")
        use = evaluate_quality_use(quality, "proposition_candidate")
        core = {
            "kind": "claim", "analysis_id": self.analysis_id, "claim_text": text,
            "claim_type": str(payload.get("claim_type") or "descriptive"),
            "subject_ref": payload.get("subject_ref") or {"type": "analysis", "id": self.analysis_id},
            "scope": payload.get("scope") or {}, "finding_refs": finding_refs, "evidence_refs": evidence_refs,
            "counter_evidence_refs": [str(item) for item in payload.get("counter_evidence_refs", []) if item],
            "quality_assessment": quality, "quality_use": use,
            "status": "candidate" if use["eligible"] else "observation_only",
            "authority": "candidate_service", "maturity": "candidate", "validity": "current",
            "lineage": {"source_run_refs": [str(item) for item in payload.get("source_run_refs", []) if item]},
        }
        return self._append(self._record(core), persist=persist)

    def append_proposition(self, payload: Dict[str, Any], *, persist: bool = True) -> Dict[str, Any]:
        statement = str(payload.get("statement") or "").strip()
        support = [str(item) for item in payload.get("support_refs", []) if item]
        if not statement or not support or "counter_evidence_refs" not in payload:
            raise ValueError("statement, support_refs, and an explicit counter_evidence_refs list are required")
        self._require_records(support, {"claim", "proposition"})
        core = {
            "kind": "proposition", "analysis_id": self.analysis_id, "statement": statement,
            "proposition_type": str(payload.get("proposition_type") or "analytical"),
            "subject_ref": payload.get("subject_ref") or {"type": "analysis", "id": self.analysis_id},
            "scope": payload.get("scope") or {}, "support_refs": support,
            "counter_evidence_refs": [str(item) for item in payload.get("counter_evidence_refs", []) if item],
            "framework_ref": payload.get("framework_ref"), "alternatives": list(payload.get("alternatives") or []),
            "status": "candidate", "authority": "candidate_service", "maturity": "candidate", "validity": "current",
        }
        return self._append(self._record(core), persist=persist)

    def append_relation(self, payload: Dict[str, Any], *, persist: bool = True) -> Dict[str, Any]:
        source_ref, target_ref = str(payload.get("source_ref") or ""), str(payload.get("target_ref") or "")
        relation_type = str(payload.get("relation_type") or "")
        if not source_ref or not target_ref or source_ref == target_ref or not relation_type:
            raise ValueError("Distinct source_ref, target_ref, and relation_type are required")
        self._require_records([source_ref, target_ref], {"claim", "proposition"})
        core = {
            "kind": "relation", "analysis_id": self.analysis_id, "source_ref": source_ref, "target_ref": target_ref,
            "relation_type": relation_type, "evidence_refs": [str(item) for item in payload.get("evidence_refs", []) if item],
            "counter_evidence_refs": [str(item) for item in payload.get("counter_evidence_refs", []) if item],
            "status": "candidate", "authority": "candidate_service", "maturity": "candidate", "validity": "current",
        }
        return self._append(self._record(core), persist=persist)

    def append_transition(self, payload: Dict[str, Any], *, persist: bool = True) -> Dict[str, Any]:
        before_ref, after_ref = str(payload.get("before_ref") or ""), str(payload.get("after_ref") or "")
        subject = payload.get("subject_ref")
        boundary = payload.get("boundary")
        if not before_ref or not after_ref or before_ref == after_ref or not isinstance(subject, dict) or not isinstance(boundary, dict):
            raise ValueError("Distinct before_ref/after_ref, subject_ref, and boundary are required")
        self._require_records([before_ref, after_ref], {"claim", "proposition"})
        try:
            before_end, after_start = float(boundary["before_end_seconds"]), float(boundary["after_start_seconds"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError("Boundary requires numeric before_end_seconds and after_start_seconds") from exc
        if after_start < before_end:
            raise ValueError("State transition after_start_seconds cannot precede before_end_seconds")
        core = {
            "kind": "state_transition", "analysis_id": self.analysis_id, "subject_ref": subject,
            "state_property": str(payload.get("state_property") or "state"), "before_ref": before_ref, "after_ref": after_ref,
            "boundary": {"before_end_seconds": before_end, "after_start_seconds": after_start},
            "method": str(payload.get("method") or "supported_before_after_comparison"),
            "evidence_refs": [str(item) for item in payload.get("evidence_refs", []) if item],
            "status": "candidate", "authority": "candidate_service", "maturity": "before_after_supported", "validity": "current",
        }
        return self._append(self._record(core), persist=persist)

    def invalidate(self, payload: Dict[str, Any], *, persist: bool = True) -> Dict[str, Any]:
        targets = [str(item) for item in payload.get("target_refs", []) if item]
        self._require_records(targets, KINDS - {"invalidation"})
        core = {"kind": "invalidation", "analysis_id": self.analysis_id, "target_refs": targets,
                "reason_code": str(payload.get("reason_code") or "dependency_changed"),
                "reason": str(payload.get("reason") or "A supporting dependency changed."),
                "authority": str(payload.get("authority") or "system_dependency_invalidation"), "validity": "current"}
        return self._append(self._record(core), persist=persist)

    def view(self) -> Dict[str, Any]:
        registry = self.load()
        invalidated = {ref for item in registry["records"] if item.get("kind") == "invalidation" for ref in item.get("target_refs", [])}
        records = [{**item, "effective_validity": "invalid" if item.get("record_id") in invalidated else item.get("validity", "current")}
                   for item in registry["records"]]
        return {**registry, "records": records, "affected_branch_plan": plan_affected_branches(
            load_execution_graph(), ["claim_service", "proposition_registry", "state_transition_service"]
        )}

    def _require_records(self, refs: Iterable[str], kinds: set[str]) -> None:
        refs = list(refs)
        known = {str(item.get("record_id")): item for item in self.load().get("records", [])}
        if not refs or any(ref not in known or known[ref].get("kind") not in kinds for ref in refs):
            raise ValueError("Every referenced record must exist and have an eligible kind")

    def _record(self, core: Dict[str, Any]) -> Dict[str, Any]:
        record_id = _stable_id(core["kind"], core)
        return {"schema": f"vaa1.{core['kind']}.v1", "record_id": record_id, **core,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "provenance": {"writer_class": "candidate_service", "canonical_write": False}}
