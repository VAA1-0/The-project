from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_backend_analysis_catalogue_filters_before_sorting_and_response():
    source = (ROOT / "api_server.py").read_text(encoding="utf-8")
    start = source.index('@app.get("/api/analyses"')
    end = source.index('@app.delete("/api/analysis/{analysis_id}")', start)
    route = source[start:end]

    assert "project_id: Optional[str] = None" in route
    assert "requested_project = normalize_taxonomy_label(project_id)" in route
    assert 'normalize_taxonomy_label(record.get("project_id")) == requested_project' in route
    assert route.index("if project_id:") < route.index("recent_analyses = dict(sorted(")
