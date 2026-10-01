"""Probe ledger semantics in memory without importing the analysis package."""
import importlib.util
import json
from pathlib import Path
root = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('lens_audit_ledger', root / 'src/backend/analysis/decision_ledger.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
ledger = module.empty_decision_ledger('assessment-synthetic')
payload = {'subject_ref': {'id': 'shared-participant'}, 'scope': {'start_seconds': 1, 'end_seconds': 2}, 'value': 'synthetic first reading', 'decision_id': 'first'}
ledger, first, _ = module.append_decision(ledger, payload, analysis_id='assessment-synthetic')
ledger, second, _ = module.append_decision(ledger, {**payload, 'decision_id': 'second', 'value': 'synthetic alternative'}, analysis_id='assessment-synthetic')
result = {'scope': 'in-memory only, no live API calls', 'omitted_authority_defaults_to': first['authority'], 'omitted_maturity_defaults_to': first['maturity'], 'second_same_subject_property_interval_supersedes': second['supersedes']}
(Path(__file__).parent / 'ledger_probe_results.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result))
