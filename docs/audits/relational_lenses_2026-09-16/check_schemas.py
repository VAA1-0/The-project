"""Read-only structural probes of the supplied proposal; not runtime acceptance tests."""
import copy
import hashlib
import json
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker

NAMES = ['goffmanian_situated_conduct', 'morenoan_relational_configuration', 'latourian_association_dynamics']

def minimum(schema, root):
    if '$ref' in schema:
        node = root
        for part in schema['$ref'][2:].split('/'):
            node = node[part]
        return minimum(node, root)
    if 'const' in schema: return schema['const']
    if 'enum' in schema: return schema['enum'][0]
    kind = schema.get('type')
    if kind == 'object': return {key: minimum(schema['properties'][key], root) for key in schema.get('required', [])}
    if kind == 'array': return [minimum(schema['items'], root) for _ in range(schema.get('minItems', 0))]
    if kind in ('number', 'integer'): return schema.get('minimum', schema.get('exclusiveMinimum', 0) + 1)
    if kind == 'boolean': return True
    if schema.get('format') == 'date-time': return '2026-09-16T09:00:00Z'
    if schema.get('pattern', '').startswith('^sha256:'): return 'sha256:' + '0' * 64
    return 'synthetic-unresolved-ref'

results = {}
for name in NAMES:
    path = Path('/Users/admin/Desktop') / (name + '.schema.json')
    raw = path.read_bytes(); schema = json.loads(raw)
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    baseline = minimum(schema, schema)
    validator.validate(baseline)
    probes = {}
    def probe(label, change):
        sample = copy.deepcopy(baseline); change(sample)
        errors = list(validator.iter_errors(sample))
        probes[label] = {'accepted_by_schema': not errors, 'errors': [e.message for e in errors][:2]}
    probe('add_addressable_anchor_id', lambda x: x['source_anchors'][0].update(anchor_id='anchor-1'))
    probe('reversed_interval', lambda x: x['source_anchors'][0].update(time_start=9, time_end=2))
    probe('normalized_roi_outside_frame', lambda x: x['source_anchors'][0].update(spatial_region={'coordinate_system':'normalized_0_1','x':2,'y':0,'width':3,'height':1}))
    probe('automated_claims_confirmed', lambda x: (x['governance'].update(record_status='confirmed',authority='automated_candidate'),x['interpretive_summary'].update(epistemic_level='confirmed_interpretation')))
    probe('invalid_datetime', lambda x: x['governance'].update(created_at='not-a-date'))
    probe('candidate_without_analyst_ledger_reference', lambda x: x['governance'].pop('ledger_event_id'))
    probe('duplicate_anchor_objects', lambda x: x['source_anchors'].append(copy.deepcopy(x['source_anchors'][0])))
    if name.startswith('morenoan'):
        probe('ethics_omitted', lambda x: x.pop('ethics', None))
        probe('sociometry_only_no_role_reading', lambda x: x.update(role_relations=[]))
    if name.startswith('latourian'):
        probe('participants_omitted', lambda x: x.pop('participants', None))
        probe('unsupported_stabilization', lambda x: x.update(stabilization={'state':'black_boxed','assessment':'Synthetic assertion with no supporting associations'}))
    results[name] = {'sha256':hashlib.sha256(raw).hexdigest(),'meta_schema_valid':True,'synthetic_baseline_valid':True,'baseline_note':'All reference strings are deliberately unresolved; structural acceptance is not referential validity.','probes':probes}
    (Path(__file__).parent / (name + '.synthetic.json')).write_text(json.dumps(baseline, indent=2)+'\n')
(Path(__file__).parent / 'schema_probe_results.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))
