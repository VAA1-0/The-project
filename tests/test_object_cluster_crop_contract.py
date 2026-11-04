from pathlib import Path


def test_object_crop_endpoint_is_analysis_and_source_coordinate_bound():
    source = (Path(__file__).resolve().parents[1] / "api_server.py").read_text(encoding="utf-8")
    assert '/api/analysis/{analysis_id}/objects/source-crop' in source
    assert 'get_analysis_entry(analysis_id)' in source
    assert 'capture.set(cv2.CAP_PROP_POS_MSEC' in source
    assert 'media_type="image/jpeg"' in source
    assert '"Cache-Control": "private, max-age=300"' in source


def test_object_crop_normalizes_bbox_and_never_writes_analysis_state():
    source = (Path(__file__).resolve().parents[1] / "api_server.py").read_text(encoding="utf-8")
    endpoint = source.split('async def get_object_source_crop(', 1)[1].split('\n\n@app.', 1)[0]
    assert 'max(abs(left), abs(top), abs(right), abs(bottom)) <= 1.5' in endpoint
    assert 'frame = frame[top:bottom, left:right]' in endpoint
    assert 'persist_analysis_record_for_status' not in endpoint
    assert 'annotation_corrections' not in endpoint


def test_object_appearance_endpoint_persists_private_sidecar_and_returns_public_measurement():
    source = (Path(__file__).resolve().parents[1] / "api_server.py").read_text(encoding="utf-8")
    assert '/api/analysis/{analysis_id}/objects/appearance/measure' in source
    endpoint = source.split("async def measure_object_appearance_endpoint(", 1)[1].split("\n\n@app.", 1)[0]
    assert "write_object_appearance_measurement" in endpoint
    assert 'public_result.pop("embedding_index", None)' in endpoint
    assert '"export_default": "withheld"' in endpoint
    assert 'append_analysis_event(status, "object_appearance_embedding_measured"' in endpoint
