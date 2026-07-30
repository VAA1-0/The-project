"""Verified report claims and reproducible exports over governed analytical objects."""

from __future__ import annotations

import copy
import hashlib
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable

from .execution_graph_planner import load_execution_graph, plan_affected_branches


SCHEMA = "vaa1.governed_report_registry.v1"
ELIGIBLE_SOURCE_KINDS = {
    "claim",
    "proposition",
    "decision",
    "framework_projection",
    "measurement",
}


def _canonical(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _stable_id(prefix: str, value: Any) -> str:
    return f"{prefix}-{hashlib.sha256(_canonical(value)).hexdigest()[:20]}"


def _atomic_json(path: Path, value: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def empty_report_registry(analysis_id: str) -> Dict[str, Any]:
    return {"schema": SCHEMA, "analysis_id": analysis_id, "version": 1, "records": []}


class GovernedReportService:
    """Append-only reporting projection; it cannot promote source authority."""

    def __init__(self, analysis_id: str, path: str | Path):
        self.analysis_id = analysis_id
        self.path = Path(path)

    def load(self) -> Dict[str, Any]:
        if not self.path.exists():
            return empty_report_registry(self.analysis_id)
        value = json.loads(self.path.read_text(encoding="utf-8"))
        if value.get("schema") != SCHEMA or value.get("analysis_id") != self.analysis_id:
            raise ValueError("Report registry identity does not match the analysis")
        return value

    def _append(self, record: Dict[str, Any], *, persist: bool = True) -> Dict[str, Any]:
        registry = self.load()
        existing = next((item for item in registry["records"] if item.get("record_id") == record["record_id"]), None)
        if existing:
            return {"record": copy.deepcopy(existing), "appended": False, "registry": registry}
        registry["records"].append(record)
        registry["version"] = int(registry.get("version") or 0) + 1
        if persist:
            _atomic_json(self.path, registry)
        return {"record": copy.deepcopy(record), "appended": True, "registry": registry}

    def create_claim(self, payload: Dict[str, Any], source_objects: Dict[str, Dict[str, Any]], *, persist: bool = True) -> Dict[str, Any]:
        text = str(payload.get("claim_text") or "").strip()
        refs = [str(item) for item in payload.get("source_object_refs", []) if item]
        citations = list(payload.get("citations") or [])
        if not text or not refs or not citations:
            raise ValueError("claim_text, source_object_refs, and citations are required")
        missing = [ref for ref in refs if ref not in source_objects]
        if missing:
            raise ValueError("Unknown source object refs: " + ", ".join(missing))
        sources = [source_objects[ref] for ref in refs]
        if any(str(item.get("kind") or "") not in ELIGIBLE_SOURCE_KINDS for item in sources):
            raise ValueError("Report claims require governed analytical source objects")
        cited_refs = {str(item.get("source_object_ref") or "") for item in citations if isinstance(item, dict)}
        if cited_refs != set(refs) or any(not isinstance(item.get("evidence_refs"), list) or not item["evidence_refs"] for item in citations):
            raise ValueError("Every source object requires a citation with evidence_refs")
        citation_map = {str(item["source_object_ref"]): item for item in citations}
        source_traceback = {}
        for ref in refs:
            source = source_objects[ref]
            governed_evidence = {str(item) for item in source.get("evidence_refs", []) if item}
            cited_evidence = {str(item) for item in citation_map[ref]["evidence_refs"] if item}
            if not governed_evidence or not cited_evidence.issubset(governed_evidence):
                raise ValueError(f"Citation evidence must resolve through governed source object {ref}")
            source_traceback[ref] = {
                "source_object_ref": ref,
                "source_object_sha256": hashlib.sha256(_canonical(source)).hexdigest(),
                "evidence_refs": sorted(cited_evidence),
                "source_locations": list(citation_map[ref].get("source_locations") or []),
            }
        explicit_author = bool(payload.get("analyst_authored"))
        if explicit_author and str(payload.get("authority") or "") not in {"manual_confirmation", "explicit_user_confirmation"}:
            raise ValueError("Analyst-authored claims require explicit analyst authority")
        invalid = any(item.get("effective_validity", item.get("validity", "current")) != "current" for item in sources)
        counter = sorted({str(ref) for item in sources for ref in item.get("counter_evidence_refs", []) if ref})
        conflicts = counter or any(str(item.get("conflict_status") or "none_detected") != "none_detected" for item in sources)
        mature = all(str(item.get("maturity") or "") in {"verified", "analyst_confirmed", "canonical"} for item in sources)
        status = "analyst_authored" if explicit_author else "limited" if invalid else "conflicting" if conflicts else "verified" if mature else "candidate"
        core = {
            "kind": "report_claim", "analysis_id": self.analysis_id, "claim_text": text,
            "source_object_refs": refs, "citations": citations, "status": status,
            "source_traceback": source_traceback,
            "counter_evidence_refs": counter, "limitations": list(payload.get("limitations") or []),
            "authority": str(payload.get("authority") or "derived_report_projection"),
            "canonical": False, "validity": "current",
            "verifier": {"citations_complete": True, "sources_current": not invalid, "source_authority_inherited": True},
        }
        return self._append(self._record(core), persist=persist)

    def invalidate_sources(self, source_refs: Iterable[str], *, reason: str, persist: bool = True) -> Dict[str, Any]:
        changed = {str(item) for item in source_refs if item}
        view = self.view()
        targets = sorted(item["record_id"] for item in view["records"] if item.get("kind") == "report_claim"
                         and item.get("effective_validity") == "current" and changed.intersection(item.get("source_object_refs", [])))
        core = {"kind": "report_invalidation", "analysis_id": self.analysis_id, "target_refs": targets,
                "changed_source_refs": sorted(changed), "reason": str(reason or "A governed source changed."),
                "validity": "current", "authority": "system_dependency_invalidation"}
        result = self._append(self._record(core), persist=persist)
        result["affected_branch_plan"] = plan_affected_branches(load_execution_graph(), ["report_claim_service"])
        return result

    def export(self, claim_refs: Iterable[str], output_path: str | Path, *, persist_registry: bool = True) -> Dict[str, Any]:
        refs = list(dict.fromkeys(str(item) for item in claim_refs if item))
        view = self.view()
        claims = {item["record_id"]: item for item in view["records"] if item.get("kind") == "report_claim"}
        if not refs or any(ref not in claims for ref in refs):
            raise ValueError("Every exported claim must exist")
        selected = [claims[ref] for ref in refs]
        if any(item.get("effective_validity") != "current" for item in selected):
            raise ValueError("Invalidated report claims cannot be exported")
        manifest_core = {"analysis_id": self.analysis_id, "claim_refs": refs,
                         "claim_hashes": {item["record_id"]: hashlib.sha256(_canonical(item)).hexdigest() for item in selected},
                         "renderer": "datascene.governed_json_report.v1"}
        run = self._record({"kind": "report_run", **manifest_core, "validity": "current", "canonical": False})
        package = {"schema": "vaa1.governed_report_export.v1", "report_run": run,
                   "claims": selected, "traceback_index": {item["record_id"]: self.traceback(item["record_id"]) for item in selected}}
        _atomic_json(Path(output_path), package)
        result = self._append(run, persist=persist_registry)
        return {"report_run": result["record"], "export_path": str(output_path), "package": package}

    def traceback(self, claim_ref: str) -> Dict[str, Any]:
        claim = next((item for item in self.view()["records"] if item.get("record_id") == claim_ref and item.get("kind") == "report_claim"), None)
        if not claim:
            raise ValueError("Report claim not found")
        return {"schema": "vaa1.report_claim_traceback.v1", "analysis_id": self.analysis_id,
                "report_claim_ref": claim_ref, "status": claim.get("status"),
                "source_object_refs": claim.get("source_object_refs", []), "citations": claim.get("citations", []),
                "source_traceback": claim.get("source_traceback", {}),
                "counter_evidence_refs": claim.get("counter_evidence_refs", []), "limitations": claim.get("limitations", [])}

    def view(self) -> Dict[str, Any]:
        registry = self.load()
        invalid = {ref for item in registry["records"] if item.get("kind") == "report_invalidation" for ref in item.get("target_refs", [])}
        return {**registry, "records": [{**item, "effective_validity": "invalid" if item.get("record_id") in invalid else item.get("validity", "current")}
                                          for item in registry["records"]]}

    def _record(self, core: Dict[str, Any]) -> Dict[str, Any]:
        stable = {key: value for key, value in core.items() if key != "created_at"}
        return {"schema": f"vaa1.{core['kind']}.v1", "record_id": _stable_id(core["kind"], stable), **core,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "provenance": {"writer_class": "report_projection_service", "canonical_write": False}}
