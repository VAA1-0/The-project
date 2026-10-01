"""Create a new, self-contained clock acceptance copy. Never writes to its source."""
import hashlib
import json
import shutil
import uuid
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ID = '8183c1fd-7cb9-49d0-b20c-378399e9c41f'


def create_fixture(source_id=SOURCE_ID, label='Clock acceptance A'):
    source = json.loads((ROOT / 'outputs/api_results' / source_id / 'analysis_record.json').read_text())
    aid = 'clock-acceptance-' + uuid.uuid4().hex
    directory = ROOT / 'outputs/api_results' / aid
    directory.mkdir(exist_ok=False)
    mapping = {
        'source_video': 'source_video.mp4', 'transcript': 'transcript.json',
        'linked_transcript': 'linked_transcript.json', 'annotation_corrections': 'annotation_corrections.json',
        'expression_json': 'expressions.json', 'source_media_metadata_json': 'source_media_metadata.json',
        'decision_ledger': 'decision_ledger.json',
        'vaa1_annotation_master_schema': 'vaa1_annotation_master_schema.json',
        'second_order_label_proliferation': 'second_order_label_proliferation.json',
        'live_mature_data_proliferation_audit': 'live_mature_data_proliferation_audit.json',
    }
    outputs, replacements, original_hashes = {}, {}, {}
    for kind, filename in mapping.items():
        raw = source['output_files'].get(kind)
        if not raw:
            continue
        src = Path(raw)
        if not src.is_absolute():
            src = ROOT / src
        dst = directory / filename
        shutil.copy2(src, dst)
        outputs[kind] = str(dst)
        replacements[raw] = str(dst)
        replacements[str(src)] = str(dst)
        original_hashes[str(src)] = hashlib.sha256(src.read_bytes()).hexdigest()
    def rebind(value):
        if isinstance(value, dict):
            # Saved paths are governed by the copied record's explicit output mapping.
            return {k: rebind(v) for k, v in value.items()}
        if isinstance(value, list):
            return [rebind(v) for v in value]
        if isinstance(value, str):
            return replacements.get(value, value.replace(source_id, aid))
        return value
    for path in directory.glob('*.json'):
        value = rebind(json.loads(path.read_text()))
        path.write_text(json.dumps(value, indent=2))
    record = {
        'analysis_id': aid, 'status': 'completed', 'progress': 100,
        'filename': f'{label}.mp4', 'original_filename': f'{label}.mp4',
        'project_id': 'source-clock-acceptance', 'source_video_path': outputs['source_video'],
        'file_path': outputs['source_video'], 'source_video_external': False,
        'output_files': outputs, 'results': {}, 'event_log': [], 'pipeline_type': 'full',
        'source_media_metadata': rebind(source.get('source_media_metadata', {})),
        'annotation_corrections': json.loads(Path(outputs['annotation_corrections']).read_text()),
        'canonical_decision_ledger': json.loads(Path(outputs['decision_ledger']).read_text()),
        'vaa1_annotation_master_schema': json.loads(Path(outputs['vaa1_annotation_master_schema']).read_text()),
    }
    for value in outputs.values():
        assert Path(value).resolve().is_relative_to(directory.resolve())
    (directory / 'analysis_record.json').write_text(json.dumps(record, indent=2))
    manifest = {'analysis_id': aid, 'project_id': record['project_id'], 'directory': str(directory),
                'original_hashes': original_hashes, 'output_files': outputs}
    (directory / 'acceptance_fixture_manifest.json').write_text(json.dumps(manifest, indent=2))
    for name, digest in original_hashes.items():
        assert hashlib.sha256(Path(name).read_bytes()).hexdigest() == digest
    print(json.dumps(manifest, indent=2))
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-id', default=SOURCE_ID)
    parser.add_argument('--label', default='Clock acceptance A')
    args = parser.parse_args()
    create_fixture(args.source_id, args.label)
